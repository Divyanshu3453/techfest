import { Router } from 'express';
import { pool } from '../config.js';
import { auth } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { MAX_WARNINGS } from '../constants.js';

const router = Router();

router.get('/stats', auth('admin'), async (_req, res) => {
  const q = (sql) => pool.query(sql).then((r) => r.rows);
  const [totals, byStatus, byDept, byCategory, daily, hotspots, escalated, headLoad] = await Promise.all([
    q(`SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status IN ('assigned','in_progress','reopened'))::int AS open,
              count(*) FILTER (WHERE status IN ('resolved','closed'))::int AS resolved,
              count(*) FILTER (WHERE status = 'rejected' AND parent_id IS NULL)::int AS rejected,
              (SELECT count(*)::int FROM complaint_events WHERE kind = 'rerouted') AS rerouted,
              (SELECT count(*)::int FROM warnings) AS warnings_issued,
              count(*) FILTER (WHERE escalated)::int AS escalated,
              count(*) FILTER (WHERE expected_date < current_date AND status IN ('in_progress','reopened'))::int AS overdue,
              count(*) FILTER (WHERE parent_id IS NOT NULL)::int AS duplicates_merged,
              round(avg(EXTRACT(EPOCH FROM resolved_at - created_at) / 3600)::numeric, 1) AS avg_resolution_hours
       FROM complaints`),
    q(`SELECT status, count(*)::int AS count FROM complaints GROUP BY status ORDER BY count DESC`),
    q(`SELECT department, count(*)::int AS count FROM complaints WHERE department IS NOT NULL GROUP BY department ORDER BY count DESC`),
    q(`SELECT category, count(*)::int AS count FROM complaints WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 8`),
    q(`SELECT to_char(d, 'DD Mon') AS day, count(c.id)::int AS count
       FROM generate_series(current_date - 13, current_date, '1 day') d
       LEFT JOIN complaints c ON c.created_at::date = d::date GROUP BY d ORDER BY d`),
    q(`SELECT location_label, count(*)::int AS count FROM complaints WHERE location_label IS NOT NULL
       GROUP BY location_label ORDER BY count DESC LIMIT 6`),
    q(`SELECT id, ticket_no, summary, department, location_label, affected_count, priority, status
       FROM complaints WHERE escalated AND parent_id IS NULL AND status IN ('assigned','in_progress','reopened')
       ORDER BY affected_count DESC LIMIT 10`),
    q(`SELECT u.name, u.head_department,
              count(c.id) FILTER (WHERE c.status IN ('assigned','in_progress','reopened'))::int AS open,
              count(c.id) FILTER (WHERE c.status IN ('resolved','closed'))::int AS done
       FROM users u LEFT JOIN complaints c ON c.assigned_to = u.id
       WHERE u.role = 'dept_head' GROUP BY u.id ORDER BY open DESC LIMIT 10`)
  ]);
  res.json({
    totals: { ...totals[0], avg_resolution_hours: totals[0].avg_resolution_hours == null ? null : Number(totals[0].avg_resolution_hours) },
    by_status: byStatus, by_department: byDept, by_category: byCategory,
    daily, hotspots, escalated, head_load: headLoad
  });
});

// Students who currently hold warnings (3 = restricted), newest first
router.get('/warnings', auth('admin'), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.enrollment, u.hostel,
            count(*) FILTER (WHERE NOT w.cleared)::int AS active,
            max(w.created_at) AS last_at,
            (array_agg(w.reason ORDER BY w.created_at DESC) FILTER (WHERE NOT w.cleared))[1] AS last_reason
     FROM warnings w JOIN users u ON u.id = w.user_id
     GROUP BY u.id HAVING count(*) FILTER (WHERE NOT w.cleared) > 0
     ORDER BY active DESC, last_at DESC LIMIT 20`);
  res.json({ max: MAX_WARNINGS, users: rows.map((r) => ({ ...r, restricted: r.active >= MAX_WARNINGS })) });
});

// Clear a student's warnings (history is kept, they just stop counting) and restore access
router.post('/users/:id/restore', auth('admin'), async (req, res) => {
  const { rowCount } = await pool.query('UPDATE warnings SET cleared = TRUE WHERE user_id = $1 AND NOT cleared', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'This student has no active warnings' });
  await notify(Number(req.params.id), null, 'The administrator has cleared your warnings. You can report and comment again.');
  res.json({ ok: true });
});

export default router;
