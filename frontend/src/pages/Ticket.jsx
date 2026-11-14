import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate, fmtDay, statusLabel } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function Ticket() {
  const { id } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api(`/complaints/${id}`).then(setC).catch((e) => setError(e.message)), [id]);

  useEffect(() => {
    load();
    window.addEventListener('refresh', load);
    return () => window.removeEventListener('refresh', load);
  }, [load]);

  async function feedback(resolved) {
    try { await api(`/complaints/${id}/feedback`, { method: 'POST', body: { resolved } }); load(); }
    catch (e) { setError(e.message); }
  }

  if (error && !c) return <p className="error">{error}</p>;
  if (!c) return <p className="muted">Loading…</p>;

  const waiting = user.role === 'student' && c.status === 'resolved';

  return (
    <article className="card form-card">
      <div className="row between">
        <h1>{c.ticket_no}</h1>
        <span className={`chip s-${c.status}`}>{statusLabel(c.status)}</span>
      </div>

      {c.status === 'processing' && <p className="muted">We are classifying your report and finding the right person. This page updates by itself.</p>}
      {c.parent_ticket && <p className="notice">This matches an issue already being handled under {c.parent_ticket}. You will be notified when it is fixed.</p>}
      {c.escalated && <p className="notice danger">This issue has been escalated because many students are affected.</p>}

      <dl className="facts">
        <dt>Problem type</dt><dd>{c.problem_type || '—'}</dd>
        <dt>Category</dt><dd>{c.category || '—'}</dd>
        <dt>Department</dt><dd>{c.department || '—'}</dd>
        <dt>Priority</dt><dd>{c.priority}</dd>
        <dt>Department head</dt><dd>{c.head_name || 'Not yet assigned'}</dd>
        <dt>Location</dt><dd>{c.location_label || '—'}</dd>
        <dt>Visibility</dt><dd>{c.is_public ? 'Public (shown on the campus feed)' : 'Private (only you and the department staff)'}</dd>
        <dt>Reported</dt><dd>{fmtDate(c.created_at)}</dd>
        {c.resolved_at && <><dt>Resolved</dt><dd>{fmtDate(c.resolved_at)}</dd></>}
        <dt>People affected</dt><dd>{c.affected_count}</dd>
      </dl>

      <h3>Worker</h3>
      {c.worker_name ? (
        <div className={`worker-box${c.overdue ? ' late' : ''}`}>
          <strong>{c.worker_name}</strong>
          {c.worker_phone && <div>Contact: <a href={`tel:${c.worker_phone.replace(/\s/g, '')}`}>{c.worker_phone}</a></div>}
          {c.expected_date && <div>Expected to fix by <strong>{fmtDay(c.expected_date)}</strong>{c.overdue ? ' (overdue)' : ''}</div>}
        </div>
      ) : (
        <p className="muted">The department head has not assigned a worker yet. You will be notified with the worker’s name and expected date.</p>
      )}

      <h3>Description</h3>
      <p className="prose">{c.description}</p>
      {c.image_url && <img className="preview" src={c.image_url} alt="Reported issue" />}
      {c.resolution_note && <><h3>Staff note</h3><p className="prose">{c.resolution_note}</p></>}

      {waiting && (
        <div className="confirm">
          <p><strong>Is the problem fixed?</strong></p>
          <div className="row">
            <button className="btn" onClick={() => feedback(true)}>Yes, it’s fixed</button>
            <button className="btn danger" onClick={() => feedback(false)}>No, still broken</button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <Link to={user.role === 'student' ? '/' : '/head'} className="muted">← Back</Link>
    </article>
  );
}
