import { Router } from 'express';
import { pool } from '../config.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/stats', auth('admin'), async (_req, res) => {
  const q = (sql) => pool.query(sql).then((r) => r.rows);
  const [totals, byStatus, byDept, byCategory, daily, hotspots, escalated, headLoad] = await Promise.all([
    q(`SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status IN ('assigned','in_progress','reopened'))::int AS open,
              count(*) FILTER (WHERE status IN ('resolved','closed'))::int AS resolved,
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

export default router;
