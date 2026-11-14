import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

function Bars({ title, data, labelKey }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <section className="card">
      <h3>{title}</h3>
      {data.length === 0 && <p className="muted">No data yet.</p>}
      {data.map((d) => (
        <div key={d[labelKey]} className="bar-row">
          <span className="bar-label">{d[labelKey]}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(d.count / max) * 100}%` }} /></div>
          <span className="bar-num">{d.count}</span>
        </div>
      ))}
    </section>
  );
}

export default function Admin() {
  const [s, setS] = useState(null);
  const [warned, setWarned] = useState({ max: 3, users: [] });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/admin/stats').then(setS).catch((e) => setError(e.message));
    api('/admin/warnings').then(setWarned).catch(() => {});
  }, []);

  async function restore(id) {
    setError('');
    try { await api(`/admin/users/${id}/restore`, { method: 'POST' }); load(); }
    catch (e) { setError(e.message); }
  }

  useEffect(() => {
    load();
    window.addEventListener('refresh', load);
    return () => window.removeEventListener('refresh', load);
  }, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!s) return <p className="muted">Loading…</p>;
  const t = s.totals;

  const kpis = [
    ['Total tickets', t.total], ['Open', t.open], ['Resolved', t.resolved],
    ['Escalated', t.escalated], ['Overdue', t.overdue], ['Duplicates merged', t.duplicates_merged],
    ['Rejected', t.rejected], ['Rerouted', t.rerouted], ['Warnings issued', t.warnings_issued],
    ['Avg. fix time', t.avg_resolution_hours == null ? '—' : `${t.avg_resolution_hours} h`]
  ];

  return (
    <>
      <h1>Statistics</h1>
      <div className="kpis">
        {kpis.map(([label, value]) => (
          <div key={label} className="card kpi"><strong>{value}</strong><span className="muted">{label}</span></div>
        ))}
      </div>

      <div className="grid two">
        <Bars title="Tickets per day (last 14 days)" data={s.daily} labelKey="day" />
        <Bars title="By department" data={s.by_department} labelKey="department" />
        <Bars title="Top categories" data={s.by_category} labelKey="category" />
        <Bars title="Hotspot locations" data={s.hotspots} labelKey="location_label" />
        <Bars title="By status" data={s.by_status} labelKey="status" />

        <section className="card">
          <h3>Escalated and still open</h3>
          {s.escalated.length === 0 && <p className="muted">Nothing escalated right now.</p>}
          {s.escalated.map((e) => (
            <Link key={e.id} to={`/ticket/${e.id}`} className="esc-row">
              <strong>{e.ticket_no}</strong> {e.summary}
              <small className="muted"> {e.department} · {e.affected_count} affected · {e.priority}</small>
            </Link>
          ))}
        </section>

        <section className="card">
          <h3>Students with active warnings</h3>
          {warned.users.length === 0 && <p className="muted">No student currently has a warning.</p>}
          {warned.users.map((u) => (
            <div key={u.id} className="mod-comment">
              <strong>{u.name}</strong> <small className="muted">{u.enrollment}</small>{' '}
              <span className={`chip ${u.restricted ? 'danger' : 'p-high'}`}>{u.active} / {warned.max}{u.restricted ? ' · restricted' : ''}</span>
              <p className="muted">Latest: {u.last_reason}</p>
              <button className="btn ghost small" onClick={() => restore(u.id)}>Clear warnings and restore access</button>
            </div>
          ))}
        </section>

        <section className="card">
          <h3>Department head workload</h3>
          <table>
            <thead><tr><th>Head</th><th>Department</th><th>Open</th><th>Done</th></tr></thead>
            <tbody>
              {s.head_load.map((u) => (
                <tr key={u.name}><td>{u.name}</td><td>{u.head_department}</td><td>{u.open}</td><td>{u.done}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
