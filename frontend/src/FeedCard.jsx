import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, fmtDay, statusLabel } from './api.js';
import { useAuth } from './AuthContext.jsx';
import { CommentIcon, PinIcon, ShareIcon, UpvoteIcon } from './Icons.jsx';

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export default function FeedCard({ item, onUpvote }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [shared, setShared] = useState('');

  const loadComments = useCallback(
    () => api(`/feed/${item.id}/comments`).then(setComments).catch((e) => setError(e.message)),
    [item.id]
  );

  // Refetch when the panel opens or when anyone adds/removes a comment (comment_count changes)
  useEffect(() => { if (open) loadComments(); }, [open, item.comment_count, loadComments]);

  async function post(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setError('');
    try {
      await api(`/feed/${item.id}/comments`, { method: 'POST', body: { body: text } });
      setText('');
      loadComments();
    } catch (err) { setError(err.message); }
  }

  async function remove(id) {
    try { await api(`/feed/comments/${id}`, { method: 'DELETE' }); loadComments(); }
    catch (err) { setError(err.message); }
  }

  async function share() {
    const msg = `${item.summary} — ${item.location_label || 'NIT Agartala campus'}`;
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: 'Campus Grievance Desk', text: msg, url });
      else {
        await navigator.clipboard.writeText(`${msg}\n${url}`);
        setShared('Link copied');
        setTimeout(() => setShared(''), 2000);
      }
    } catch { /* share cancelled */ }
  }

  const isStudent = user.role === 'student';

  return (
    <article className={`issue s-${item.status}${item.escalated ? ' esc' : ''}${item.image_url ? '' : ' no-img'}`}>
      <div className="issue-main">
        <div className="issue-top">
          <span className="tag">{item.category || 'Campus issue'}</span>
          <span className="grow" />
          {item.escalated && <span className="chip danger">Escalated</span>}
          <span className={`chip s-${item.status}`}>{statusLabel(item.status)}</span>
        </div>

        <h3 className="issue-title">{item.summary}</h3>
        <p className="issue-meta">
          <span><PinIcon width={14} height={14} /> {item.location_label || 'Location not specified'}</span>
          <span>{item.ticket_no}</span>
          <span>{fmtDate(item.created_at)}</span>
        </p>
        <p className={`eta${item.overdue ? ' late' : ''}`}>
          {item.worker_name
            ? `${item.worker_name} is on it · expected by ${fmtDay(item.expected_date) || 'date to be confirmed'}${item.overdue ? ' (overdue)' : ''}`
            : 'Waiting for the department head to arrange a worker'}
        </p>

        <div className="issue-foot">
          <button className={`act${item.joined ? ' on' : ''}`} disabled={!isStudent || item.joined} onClick={() => onUpvote(item.id)} title={isStudent ? 'Upvote if you face this too' : 'Only students can upvote'}>
            <UpvoteIcon filled={item.joined} width={16} height={16} /> {item.joined ? 'Upvoted' : 'Upvote'} · <b>{item.affected_count}</b>
          </button>
          <button className="act" onClick={() => setOpen(!open)} aria-expanded={open}>
            <CommentIcon width={16} height={16} /> Comments · <b>{item.comment_count}</b>
          </button>
          <button className="act" onClick={share}>
            <ShareIcon width={16} height={16} /> {shared || 'Share'}
          </button>
        </div>
      </div>

      {item.image_url && <div className="issue-img"><img src={item.image_url} alt={item.summary} loading="lazy" /></div>}

      {open && (
        <div className="comments">
          <form className="comment-form" onSubmit={post}>
            <span className="li-avatar sm">{initials(user.name)}</span>
            <input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" aria-label="Add a comment" />
            <button className="li-btn primary small" disabled={!text.trim()}>Post</button>
          </form>
          {error && <p className="error">{error}</p>}
          {comments.length === 0 && <p className="muted">No comments yet. Be the first to comment.</p>}
          {comments.map((m) => (
            <div key={m.id} className="comment">
              <span className="li-avatar sm">{initials(m.name)}</span>
              <div className="comment-bubble">
                <div className="row between">
                  <strong>{m.name}{m.role !== 'student' && <span className="chip small-chip">{m.role === 'admin' ? 'Admin' : 'Dept head'}</span>}</strong>
                  <small className="muted">{fmtDate(m.created_at)}</small>
                </div>
                <p>{m.body}</p>
                {(m.user_id === user.id || user.role === 'admin') && (
                  <button className="link-btn" onClick={() => remove(m.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
