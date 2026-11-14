import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, fmtDay } from '../api.js';

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

function TicketCard({ c, workers, onDone, onError }) {
  const [name, setName] = useState(c.worker_name || '');
  const [phone, setPhone] = useState(c.worker_phone || '');
  const [day, setDay] = useState(c.expected_date || '');
  const [note, setNote] = useState('');

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
    </article>
  );
}

export default function DeptHead() {
  const [items, setItems] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [q, w] = await Promise.all([api('/complaints/head/queue'), api('/complaints/workers/list')]);
      setItems(q);
      setWorkers(w);
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
        {items.map((c) => <TicketCard key={c.id} c={c} workers={workers} onDone={load} onError={setError} />)}
      </div>
    </>
  );
}
