import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './AuthContext.jsx';
import AskBot from './AskBot.jsx';
import { BellIcon, ClosedIcon, HomeIcon, OngoingIcon, PlusIcon, QueueIcon, StatsIcon, UpvoteIcon } from './Icons.jsx';

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const roleLabel = (u) => (u.role === 'dept_head' ? 'Department head' : u.role === 'admin' ? 'Super admin' : `${u.department} · Student`);

function ProfileCard({ user }) {
  const [mine, setMine] = useState([]);
  const [warn, setWarn] = useState(null);
  const load = useCallback(() => {
    api('/complaints/mine').then(setMine).catch(() => {});
    api('/complaints/warnings/mine').then(setWarn).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('refresh', load);
    return () => window.removeEventListener('refresh', load);
  }, [load]);

  const closed = mine.filter((c) => ['resolved', 'closed', 'rejected'].includes(c.status)).length;
  const ongoing = mine.length - closed;
  const priv = mine.filter((c) => !c.is_public && !c.parent_id).length;
  const affected = mine.filter((c) => !c.parent_id).reduce((n, c) => n + (c.affected_count || 0), 0);

  return (
    <aside className="li-left">
      <div className="li-card profile-card">
        <div className="profile-banner" />
        <div className="profile-avatar">{initials(user.name)}</div>
        <div className="profile-info">
          <h2>{user.name}</h2>
          <p>{roleLabel(user)}</p>
          {user.hostel && <p className="profile-sub">{user.hostel}</p>}
          <p className="profile-sub">{user.enrollment}</p>
        </div>
        <div className="profile-stats">
          <Link to="/ongoing"><span>Ongoing issues</span><strong>{ongoing}</strong></Link>
          <Link to="/closed"><span>Closed issues</span><strong>{closed}</strong></Link>
          <Link to="/ongoing"><span>Private issues</span><strong>{priv}</strong></Link>
          <Link to="/ongoing"><span>Students affected</span><strong>{affected}</strong></Link>
          {warn && warn.active > 0 && (
            <Link to="/notifications" className="warn-stat"><span>Warnings</span><strong>{warn.active} / {warn.max}</strong></Link>
          )}
        </div>
        {warn?.restricted && (
          <p className="warn-box restricted">Your account is restricted after {warn.max} warnings. You cannot report or comment until the administrator restores access.</p>
        )}
      </div>
      <div className="li-card side-cta">
        <Link to="/report" className="li-btn primary block"><PlusIcon width={18} height={18} /> Report an issue</Link>
      </div>
    </aside>
  );
}

// Right-hand card: the most-upvoted open issues on campus right now (public issues only)
function TrendingCard() {
  const [items, setItems] = useState([]);
  const load = useCallback(() => api('/feed?sort=trending').then((r) => setItems(r.slice(0, 4))).catch(() => {}), []);
  useEffect(() => {
    load();
    window.addEventListener('refresh', load);
    return () => window.removeEventListener('refresh', load);
  }, [load]);

  if (!items.length) return null;
  return (
    <div className="li-card">
      <h3>Trending on campus</h3>
      <ul className="trend-list">
        {items.map((t) => (
          <li key={t.id}>
            <p className="trend-text">{t.summary}</p>
            <span className="trend-meta">
              <UpvoteIcon filled width={12} height={12} /> {t.affected_count} · {t.location_label || 'Campus'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout, toasts } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const isStudent = user.role === 'student';

  const loadUnread = useCallback(
    () => api('/notifications').then((r) => setUnread(r.filter((n) => !n.read).length)).catch(() => {}),
    []
  );
  useEffect(() => {
    loadUnread();
    window.addEventListener('refresh', loadUnread);
    return () => window.removeEventListener('refresh', loadUnread);
  }, [loadUnread]);

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const items = [
    isStudent && { to: '/', end: true, label: 'Home', icon: <HomeIcon /> },
    isStudent && { to: '/ongoing', label: 'Ongoing Issues', icon: <OngoingIcon /> },
    isStudent && { to: '/closed', label: 'Closed Issues', icon: <ClosedIcon /> },
    !isStudent && { to: '/head', label: 'Department Queue', icon: <QueueIcon /> },
    user.role === 'admin' && { to: '/admin', label: 'Statistics', icon: <StatsIcon /> },
    { to: '/notifications', label: 'Notifications', icon: <BellIcon />, badge: unread }
  ].filter(Boolean);

  return (
    <>
      <header className="li-nav">
        <div className="li-nav-inner">
          <Link to="/" className="li-brand">
            <img src="/nita-logo.png" alt="NIT Agartala" />
            <span className="li-brand-text"><strong>Campus Grievance Desk</strong><small>NIT Agartala</small></span>
          </Link>

          <nav className="li-tabs" aria-label="Main">
            {items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end} className="li-tab">
                <span className="li-tab-icon">
                  {it.icon}
                  {it.badge > 0 && <span className="li-badge">{it.badge > 99 ? '99+' : it.badge}</span>}
                </span>
                <span className="li-tab-label">{it.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="li-me" ref={menuRef}>
            <button className="li-me-btn" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu">
              <span className="li-avatar sm">{initials(user.name)}</span>
              <span className="li-tab-label">Me ▾</span>
            </button>
            {menu && (
              <div className="li-menu" role="menu">
                <div className="li-menu-head">
                  <span className="li-avatar">{initials(user.name)}</span>
                  <div>
                    <strong>{user.name}</strong>
                    <div className="muted">{roleLabel(user)}</div>
                  </div>
                </div>
                <button role="menuitem" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {isStudent ? (
        <div className="li-shell">
          <ProfileCard user={user} />
          <main className="li-center">{children}</main>
          <aside className="li-right">
            <TrendingCard />
          </aside>
        </div>
      ) : (
        <main className="page">{children}</main>
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className="toast">{t.message}</div>)}
      </div>

      <AskBot />
    </>
  );
}
