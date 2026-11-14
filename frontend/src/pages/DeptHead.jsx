import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, fmtDay } from '../api.js';

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

// Public comments on the ticket. Staff can remove one and warn its author, with a reason the author will see.
function CommentModeration({ ticketId, onError }) {
  const [comments, setComments] = useState(null);
  const [target, setTarget] = useState(null);   // id of the comment being removed
  const [reason, setReason] = useState('');

  const load = useCallback(() => api(`/feed/${ticketId}/comments`).then(setComments).catch((e) => onError(e.message)), [ticketId, onError]);

  async function remove(id) {
    onError('');
    try {
      await api(`/feed/comments/${id}/moderate`, { method: 'POST', body: { reason } });
      setTarget(null); setReason('');
      load();
    } catch (e) { onError(e.message); }
  }

  return (
    <details onToggle={(e) => { if (e.target.open && comments === null) load(); }}>
      <summary>Comments{comments ? ` (${comments.length})` : ''}</summary>
      {comments && comments.length === 0 && <p className="muted">No comments on this ticket.</p>}
      {(comments || []).map((m) => (
        <div key={m.id} className="mod-comment">
          <strong>{m.name}</strong> <small className="muted">{fmtDate(m.created_at)}</small>
          <p>{m.body}</p>
          {m.role === 'student' && target !== m.id && (
            <button type="button" className="btn ghost small" onClick={() => { setTarget(m.id); setReason(''); }}>Remove and warn</button>
          )}
          {target === m.id && (
            <div className="inline-form">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to the student (e.g. abusive language)" maxLength={300} />
              <button type="button" className="btn danger small" disabled={reason.trim().length < 5} onClick={() => remove(m.id)}>Remove and warn</button>
              <button type="button" className="btn ghost small" onClick={() => setTarget(null)}>Cancel</button>
            </div>
          )}
        </div>
      ))}
    </details>
  );
}

function TicketCard({ c, workers, departments, onDone, onError }) {
  const [name, setName] = useState(c.worker_name || '');
  const [phone, setPhone] = useState(c.worker_phone || '');
  const [day, setDay] = useState(c.expected_date || '');
  const [note, setNote] = useState('');
  const [toDept, setToDept] = useState('');
  const [routeReason, setRouteReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [warnUser, setWarnUser] = useState(false);

  function pickName(v) {
    setName(v);
    const known = workers.find((w) => w.name === v);
    if (known) setPhone(known.phone); // reuse saved contact of a worker used before
  }

  async function assign(e) {
    e.preventDefault();
    onError('');
    try {
      await api(`/complaints/${c.id}/assign-worker`, { method: 'PATCH', body: { worker_name: name, worker_phone: phone, expected_date: day } });
      onDone();
    } catch (err) { onError(err.message); }
  }

  async function resolve() {
    onError('');
    try { await api(`/complaints/${c.id}/resolve`, { method: 'PATCH', body: { note } }); onDone(); }
    catch (err) { onError(err.message); }
  }

  async function reroute(e) {
    e.preventDefault();
    onError('');
    try {
      await api(`/complaints/${c.id}/reroute`, { method: 'PATCH', body: { department: toDept, reason: routeReason } });
      onDone();
    } catch (err) { onError(err.message); }
  }

  async function reject(e) {
    e.preventDefault();
    onError('');
    const ok = window.confirm(warnUser
      ? 'Reject this complaint and send a warning to the reporter? The reporter will see your reason.'
      : 'Reject this complaint? The reporter and everyone affected will see your reason.');
    if (!ok) return;
    try {
      await api(`/complaints/${c.id}/reject`, { method: 'PATCH', body: { reason: rejectReason, warn_user: warnUser } });
      onDone();
    } catch (err) { onError(err.message); }
  }

  const hasWorker = !!c.worker_name && c.status !== 'reopened';

  return (
    <article className="card">
      <div className="row between">
        <strong>{c.ticket_no} · {c.category}</strong>
        <div className="row">
          {c.overdue && <span className="chip danger">Overdue</span>}
          {c.escalated && <span className="chip danger">Escalated</span>}
          {c.status === 'reopened' && <span className="chip s-reopened">Reopened</span>}
          <span className={`chip p-${c.priority}`}>{c.priority}</span>
        </div>
      </div>
      <p>{c.description}</p>
      <p className="muted">{c.location_label} · {c.affected_count} affected · reported {fmtDate(c.created_at)} by {c.reporter_name}</p>
      {c.image_url && <img className="preview small" src={c.image_url} alt="Reported issue" />}

      {hasWorker && (
        <div className={`worker-box${c.overdue ? ' late' : ''}`}>
          <strong>{c.worker_name}</strong> · {c.worker_phone} · expected by {fmtDay(c.expected_date)}
        </div>
      )}

      <form className="worker-form" onSubmit={assign}>
        <h3>{hasWorker ? 'Change worker or date' : 'Assign a worker'}</h3>
        <div className="form-grid">
          <label>Worker name
            <input list={`w-${c.id}`} value={name} onChange={(e) => pickName(e.target.value)} required />
            <datalist id={`w-${c.id}`}>{workers.map((w) => <option key={w.phone} value={w.name} />)}</datalist>
          </label>
          <label>Contact number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required />
          </label>
          <label>Expected fix date
            <input type="date" min={today()} value={day} onChange={(e) => setDay(e.target.value)} required />
          </label>
        </div>
        <button className="btn">{hasWorker ? 'Update worker' : 'Assign worker'}</button>
      </form>

      <div className="resolve-box">
        <textarea rows={2} placeholder="Resolution note, shown to students (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" className="btn ghost" onClick={resolve}>Mark resolved</button>
      </div>

      <div className="staff-tools">
        <details>
          <summary>Wrong department? Reroute</summary>
          <form onSubmit={reroute}>
            <div className="form-grid">
              <label>Send to
                <select value={toDept} onChange={(e) => setToDept(e.target.value)} required>
                  <option value="">Choose a department…</option>
                  {departments.filter((d) => d !== c.department).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label>Reason
                <input value={routeReason} onChange={(e) => setRouteReason(e.target.value)} maxLength={300} placeholder="e.g. This is a plumbing leak, not electrical" required />
              </label>
            </div>
            <p className="muted">The ticket moves to that department’s head. Any worker you arranged is cleared, and everyone affected is told.</p>
            <button className="btn ghost small" disabled={!toDept || routeReason.trim().length < 5}>Reroute ticket</button>
          </form>
        </details>

        <details>
          <summary>False or invalid complaint? Reject</summary>
          <form onSubmit={reject}>
            <label>Reason (shown to the reporter)
              <textarea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300}
                        placeholder="Explain clearly why this complaint is being rejected" required />
            </label>
            <label className="check">
              <input type="checkbox" checked={warnUser} onChange={(e) => setWarnUser(e.target.checked)} />
              Also warn the reporter (3 warnings restrict the account)
            </label>
            <button className="btn danger small" disabled={rejectReason.trim().length < 10}>Reject{warnUser ? ' and warn' : ''}</button>
          </form>
        </details>

        <CommentModeration ticketId={c.id} onError={onError} />
      </div>
    </article>
  );
}

export default function DeptHead() {
  const [items, setItems] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [q, w, d] = await Promise.all([api('/complaints/head/queue'), api('/complaints/workers/list'), api('/complaints/departments')]);
      setItems(q);
      setWorkers(w);
      setDepartments(d);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('refresh', load);
    return () => window.removeEventListener('refresh', load);
  }, [load]);

  return (
    <>
      <h1>Department queue</h1>
      <p className="muted">Arrange an outside worker for each ticket. Students see the worker’s name, contact number and expected date.</p>
      {error && <p className="error">{error}</p>}
      {items.length === 0 && <p className="empty">No open tickets. New ones appear here as soon as they are routed to your department.</p>}
      <div className="list">
        {items.map((c) => <TicketCard key={c.id} c={c} workers={workers} departments={departments} onDone={load} onError={setError} />)}
      </div>
    </>
  );
}
