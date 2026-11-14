import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, fmtDay, statusLabel } from '../api.js';
import { PinIcon } from '../Icons.jsx';

const DONE = ['resolved', 'closed', 'rejected'];
// can still be edited: not yet picked up by the department head, nobody else joined, not a linked duplicate
const editable = (c) => ['processing', 'assigned'].includes(c.status) && !c.worker_name && !c.parent_id && c.affected_count <= 1;

export default function MyIssues({ kind }) {
  const closed = kind === 'closed';
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setItems(await api('/complaints/mine')); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('refresh', load);
    return () => window.removeEventListener('refresh', load);
  }, [load]);

  async function setVisibility(id, is_public) {
    setError('');
    try {
      await api(`/complaints/${id}/visibility`, { method: 'PATCH', body: { is_public } });
      setItems((list) => list.map((c) => (c.id === id ? { ...c, is_public } : c)));
    } catch (e) { setError(e.message); }
  }

  const shown = (items || []).filter((c) => DONE.includes(c.status) === closed);

  return (
    <>
      <div className="li-card section-title">
        <h1>{closed ? 'Closed issues' : 'Ongoing issues'}</h1>
        <p className="muted">{closed ? 'Issues you reported that have been resolved, closed or rejected.' : 'Issues you reported that are still being handled.'}</p>
      </div>
      {error && <p className="error">{error}</p>}
      {items && shown.length === 0 && (
        <p className="empty">{closed ? 'No closed issues yet.' : 'You have no ongoing issues.'}</p>
      )}
      <div className="feed">
        {shown.map((c) => (
          <article key={c.id} className={`issue s-${c.status}${c.image_url ? '' : ' no-img'}`}>
            <div className="issue-main">
              <div className="issue-top">
                <span className="tag">{c.category || 'Issue'}</span>
                <span className="grow" />
                <span className={`chip ${c.is_public ? 'vis-public' : 'vis-private'}`}>{c.is_public ? 'Public' : 'Private'}</span>
                <span className={`chip s-${c.status}`}>{statusLabel(c.status)}</span>
              </div>
              <h3 className="issue-title">{c.summary || c.description.slice(0, 160)}</h3>
              <p className="issue-meta">
                <span><PinIcon width={14} height={14} /> {c.location_label || 'Location not specified'}</span>
                <span>{c.ticket_no}</span>
                <span>{fmtDate(c.created_at)}</span>
              </p>
              {c.status === 'rejected' && c.reject_reason && <p className="eta late">Rejected: {c.reject_reason}</p>}
              {!closed && c.worker_name && (
                <p className={`eta${c.overdue ? ' late' : ''}`}>{c.worker_name} · expected by {fmtDay(c.expected_date) || 'date to be confirmed'}{c.overdue ? ' (overdue)' : ''}</p>
              )}
              <div className="issue-foot">
                <span className="act-info">{c.affected_count} affected</span>
                {!c.parent_id && (
                  <button className="act" onClick={() => setVisibility(c.id, !c.is_public)}>
                    {c.is_public ? 'Make private' : 'Make public'}
                  </button>
                )}
                {editable(c) && <Link to={`/ticket/${c.id}`} className="act">Edit</Link>}
                <Link to={`/ticket/${c.id}`} className="act">View details</Link>
              </div>
            </div>
            {c.image_url && <div className="issue-img"><img src={c.image_url} alt="Reported issue" loading="lazy" /></div>}
          </article>
        ))}
      </div>
    </>
  );
}
