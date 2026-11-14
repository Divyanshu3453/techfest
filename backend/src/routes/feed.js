import { Router } from 'express';
import { pool, redis } from '../config.js';
import { auth } from '../middleware/auth.js';
import { addVote } from '../services/trending.js';
import { searchComplaints, rateLimit } from '../services/search.js';
import { emitAll } from '../socket.js';

const router = Router();
const OPEN = ['assigned', 'in_progress', 'reopened'];

// Campus live feed (public issues only): caption + image + location. The reporter's name and the full description stay private.
router.get('/', auth(), async (req, res) => {
  const order = req.query.sort === 'trending'
    ? `c.affected_count / POWER(EXTRACT(EPOCH FROM now() - c.created_at) / 3600 + 2, 0.5) DESC`
    : `c.created_at DESC`;
  const { rows } = await pool.query(
    `SELECT c.id, c.ticket_no, c.summary, c.category, c.department, c.location_label, c.affected_count,
            c.escalated, c.status, c.priority, c.image_url, c.created_at, c.worker_name,
            to_char(c.expected_date, 'YYYY-MM-DD') AS expected_date,
            (c.expected_date < current_date AND c.status IN ('in_progress','reopened')) AS overdue,
            EXISTS (SELECT 1 FROM complaint_votes v WHERE v.complaint_id = c.id AND v.user_id = $1) AS joined,
            (SELECT count(*)::int FROM complaint_comments m WHERE m.complaint_id = c.id) AS comment_count
     FROM complaints c
     WHERE c.parent_id IS NULL AND c.is_public = TRUE AND c.status = ANY($2)
     ORDER BY ${order}
     LIMIT 30`,
    [req.user.id, OPEN]
  );
  res.json(rows);
});

// Search bar: keywords + semantic match over every registered complaint (e.g. "block b bathroom").
router.get('/search', auth(), async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  if (q.length < 2) return res.json([]);
  if (!(await rateLimit(`rl:search:${req.user.id}`, 60))) {
    return res.status(429).json({ error: 'Searching too fast. Wait a few seconds.' });
  }
  const results = await searchComplaints({ userId: req.user.id, q, includeResolved: req.query.scope === 'all' });
  res.json(results);
});

// Upvote = "I'm facing this too". Counts toward escalation.
router.post('/:id/upvote', auth('student'), async (req, res) => {
  const { rows: [c] } = await pool.query(
    `SELECT id FROM complaints WHERE id = $1 AND parent_id IS NULL AND is_public = TRUE AND status = ANY($2)`, [req.params.id, OPEN]);
  if (!c) return res.status(404).json({ error: 'This issue is no longer open' });
  const count = await addVote(c.id, req.user.id);
  if (count === null) return res.status(409).json({ error: 'You have already upvoted this issue' });
  res.json({ affected_count: count });
});

// Private issues: only the reporter and staff may read or write comments on them
async function canSeeIssue(id, user) {
  const { rows: [c] } = await pool.query('SELECT is_public, user_id FROM complaints WHERE id = $1 AND parent_id IS NULL', [id]);
  if (!c) return { found: false };
  return { found: true, allowed: c.is_public || user.role !== 'student' || c.user_id === user.id };
}

router.get('/:id/comments', auth(), async (req, res) => {
  const vis = await canSeeIssue(req.params.id, req.user);
  if (!vis.found || !vis.allowed) return res.status(404).json({ error: 'Issue not found' });
  const { rows } = await pool.query(
    `SELECT m.id, m.body, m.created_at, m.user_id, u.name, u.role
     FROM complaint_comments m JOIN users u ON u.id = m.user_id
     WHERE m.complaint_id = $1 ORDER BY m.created_at`,
    [req.params.id]
  );
  res.json(rows);
});

router.post('/:id/comments', auth(), async (req, res) => {
  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Write a comment first' });
  if (body.length > 500) return res.status(400).json({ error: 'Comments are limited to 500 characters' });

  const key = `rl:comment:${req.user.id}`; // 10 comments per minute per user
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, 60);
  if (n > 10) return res.status(429).json({ error: 'You are commenting too fast. Wait a minute.' });

  const vis = await canSeeIssue(req.params.id, req.user);
  if (!vis.found || !vis.allowed) return res.status(404).json({ error: 'Issue not found' });
  const c = { id: Number(req.params.id) };

  await pool.query('INSERT INTO complaint_comments (complaint_id, user_id, body) VALUES ($1,$2,$3)', [c.id, req.user.id, body]);
  emitAll('feed:changed', {});
  res.status(201).json({ ok: true });
});

router.delete('/comments/:cid', auth(), async (req, res) => {
  const { rows: [m] } = await pool.query('SELECT user_id FROM complaint_comments WHERE id = $1', [req.params.cid]);
  if (!m) return res.status(404).json({ error: 'Comment not found' });
  if (m.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'You can only delete your own comments' });
  await pool.query('DELETE FROM complaint_comments WHERE id = $1', [req.params.cid]);
  emitAll('feed:changed', {});
  res.json({ ok: true });
});

export default router;
