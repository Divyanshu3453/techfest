import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate } from '../api.js';

export default function Notifications() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const marked = useRef(false);

  const load = useCallback(async () => {
    try { setItems(await api('/notifications')); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('refresh', load);
    return () => window.removeEventListener('refresh', load);
  }, [load]);

  // Opening the page marks everything as read (once), then the top-bar badge refreshes
  useEffect(() => {
    if (!items || marked.current || !items.some((n) => !n.read)) return;
    marked.current = true;
    api('/notifications/read', { method: 'POST' })
      .then(() => window.dispatchEvent(new Event('refresh')))
      .catch(() => {});
  }, [items]);

  return (
    <>
      <div className="li-card section-title">
        <h1>Notifications</h1>
      </div>
      {error && <p className="error">{error}</p>}
      {items && items.length === 0 && <p className="empty">You have no notifications yet.</p>}
      <div className="li-card notif-list">
        {(items || []).map((n) => {
          const body = (
            <>
              <span className={`notif-dot${n.read ? ' read' : ''}`} />
              <div>
                <p>{n.message}</p>
                <small className="muted">{fmtDate(n.created_at)}</small>
              </div>
            </>
          );
          return n.complaint_id
            ? <Link key={n.id} to={`/ticket/${n.complaint_id}`} className={`notif${n.read ? '' : ' unread'}`}>{body}</Link>
            : <div key={n.id} className={`notif${n.read ? '' : ' unread'}`}>{body}</div>;
        })}
      </div>
    </>
  );
}
