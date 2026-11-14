import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool, redis, STREAM } from '../config.js';
import { ACTIVE_STATUSES, CATEGORIES, findSubCategory } from '../constants.js';
import { findSimilar, rateLimit } from '../services/search.js';
import { auth } from '../middleware/auth.js';
import { notify, affectedUsers } from '../services/notify.js';
import { emitToRoom, emitAll } from '../socket.js';

const router = Router();

const uploadDir = path.resolve('uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

// expected_date is returned as 'YYYY-MM-DD' text so time zones can't shift the day
const SELECT = `
  SELECT c.id, c.ticket_no, c.user_id, c.image_url, c.lat, c.lng, c.location_label, c.description, c.status,
         c.problem_type, c.category, c.department, c.priority, c.summary, c.parent_id, c.affected_count,
         c.escalated, c.is_public, c.assigned_to, c.resolution_note, c.created_at, c.assigned_at, c.resolved_at,
         c.worker_name, c.worker_phone, to_char(c.expected_date, 'YYYY-MM-DD') AS expected_date, c.worker_assigned_at,
         (c.expected_date < current_date AND c.status IN ('in_progress','reopened')) AS overdue,
         p.ticket_no AS parent_ticket, s.name AS head_name, u.name AS reporter_name
  FROM complaints c
  LEFT JOIN complaints p ON p.id = c.parent_id
  LEFT JOIN users s ON s.id = c.assigned_to
  LEFT JOIN users u ON u.id = c.user_id`;

const wordCount = (t) => t.trim().split(/\s+/).filter(Boolean).length;
const prettyDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// ---- Category dropdown data -----------------------------------------------------------
router.get('/categories', auth(), (_req, res) => {
  res.json(CATEGORIES.map((c) => ({ label: c.label, subs: c.subs.map((s) => ({ label: s.label, department: s.department })) })));
});

// ---- Student: "has someone already reported this?" (called while the form is being filled) ----
router.post('/similar', auth('student'), async (req, res) => {
  const description = String(req.body.description || '').trim();
  if (wordCount(description) < 4) return res.json({ matches: [] });
  if (!(await rateLimit(`rl:similar:${req.user.id}`, 30))) {
    return res.status(429).json({ error: 'Checking too fast. Wait a few seconds.' });
  }
  const lat = parseFloat(req.body.lat);
  const lng = parseFloat(req.body.lng);
  const matches = await findSimilar({
    userId: req.user.id,
    description,
    subCategory: String(req.body.sub_category || ''),
    label: String(req.body.location_label || '').trim() || null,
    lat: Number.isNaN(lat) ? null : lat,
    lng: Number.isNaN(lng) ? null : lng
  });
  res.json({ matches });
});

// ---- Student: file a complaint -------------------------------------------------
router.post('/', auth('student'), upload.single('image'), async (req, res) => {
  const description = String(req.body.description || '').trim();
  const words = wordCount(description);
  if (words < 5) return res.status(400).json({ error: 'Please describe the problem in at least 5 words' });
  if (words > 300) return res.status(400).json({ error: `Description is ${words} words; the limit is 300` });

  const picked = findSubCategory(String(req.body.main_category || ''), String(req.body.sub_category || ''));
  if (!picked) return res.status(400).json({ error: 'Please choose a category and a sub-category' });

  const lat = req.body.lat ? parseFloat(req.body.lat) : null;
  const lng = req.body.lng ? parseFloat(req.body.lng) : null;
  const label = String(req.body.location_label || '').trim() || null;
  if (!label && lat == null) return res.status(400).json({ error: 'Please add the location of the problem' });

  // Visibility: public (default) shows on the campus feed; anything else other than 'false' stays public
  const isPublic = String(req.body.is_public) !== 'false';

  // No-duplicate gate: unless the student has already seen the similar issues and said
  // "none of these is mine", refuse to file and send the matches back so they can upvote/comment instead.
  const confirmedNew = String(req.body.confirmed_new) === 'true';
  if (!confirmedNew) {
    const duplicates = await findSimilar({
      userId: req.user.id, description, subCategory: picked.sub.label, label,
      lat: Number.isNaN(lat) ? null : lat, lng: Number.isNaN(lng) ? null : lng
    });
    if (duplicates.length) {
      return res.status(409).json({
        code: 'DUPLICATE_FOUND',
        error: 'Similar issues are already registered. Upvote or comment on one, or confirm that yours is different.',
        duplicates
      });
    }
  }

  const { rows: [{ n }] } = await pool.query("SELECT nextval('ticket_seq') AS n");
  const ticketNo = `GRV-${new Date().getFullYear()}-${n}`;
  const { rows: [c] } = await pool.query(
    `INSERT INTO complaints (ticket_no, user_id, image_url, lat, lng, location_label, description, status,
                             main_category, sub_category, skip_dedupe, is_public)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'processing',$8,$9,$10,$11) RETURNING id, ticket_no, status, is_public`,
    [ticketNo, req.user.id, req.file ? `/uploads/${req.file.filename}` : null,
      Number.isNaN(lat) ? null : lat, Number.isNaN(lng) ? null : lng, label, description,
      picked.main.label, picked.sub.label, confirmedNew, isPublic]
  );

  // The assigner worker consumes this stream: classify -> dedupe -> route to the department head
  await redis.xadd(STREAM, '*', 'complaintId', String(c.id));
  res.status(201).json(c);
});

// ---- Student: change the visibility of an issue they reported -------------------------------
router.patch('/:id/visibility', auth('student'), async (req, res) => {
  if (typeof req.body.is_public !== 'boolean') return res.status(400).json({ error: 'is_public must be true or false' });
  const { rows: [c] } = await pool.query('SELECT id, user_id, parent_id FROM complaints WHERE id = $1', [req.params.id]);
  if (!c || c.user_id !== req.user.id) return res.status(404).json({ error: 'Ticket not found' });
  if (c.parent_id) return res.status(400).json({ error: 'This report is linked to another ticket and is not shown on the feed on its own' });

  await pool.query('UPDATE complaints SET is_public = $2, updated_at = now() WHERE id = $1', [c.id, req.body.is_public]);
  emitAll('feed:changed', {});
  res.json({ ok: true, is_public: req.body.is_public });
});

router.get('/mine', auth(), async (req, res) => {
  const { rows } = await pool.query(`${SELECT} WHERE c.user_id = $1 ORDER BY c.created_at DESC`, [req.user.id]);
  res.json(rows);
});

// ---- Department head: queue and worker directory -------------------------------------
router.get('/head/queue', auth('dept_head', 'admin'), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { rows } = await pool.query(
    `${SELECT}
     WHERE c.parent_id IS NULL AND c.status = ANY($1)
       AND ($2::boolean OR (c.department = $3 AND (c.assigned_to = $4 OR c.assigned_to IS NULL)))
     ORDER BY c.escalated DESC,
       CASE c.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       c.created_at`,
    [ACTIVE_STATUSES, isAdmin, req.user.head_department, req.user.id]
  );
  res.json(rows);
});

router.get('/workers/list', auth('dept_head', 'admin'), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { rows } = await pool.query(
    `SELECT name, phone, department FROM workers WHERE $1::boolean OR department = $2 ORDER BY name`,
    [isAdmin, req.user.head_department]
  );
  res.json(rows);
});

router.get('/:id', auth(), async (req, res) => {
  const { rows: [c] } = await pool.query(`${SELECT} WHERE c.id = $1`, [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Ticket not found' });

  let allowed = req.user.role !== 'student' || c.user_id === req.user.id;
  if (!allowed) {
    const v = await pool.query('SELECT 1 FROM complaint_votes WHERE complaint_id = $1 AND user_id = $2', [c.parent_id || c.id, req.user.id]);
    allowed = v.rowCount > 0;
  }
  if (!allowed) return res.status(403).json({ error: 'You do not have access to this ticket' });

  // A linked duplicate shows the worker and head handling the ticket it was merged into
  if (c.parent_id) {
    const { rows: [r] } = await pool.query(`${SELECT} WHERE c.id = $1`, [c.parent_id]);
    Object.assign(c, {
      worker_name: r.worker_name, worker_phone: r.worker_phone, expected_date: r.expected_date,
      overdue: r.overdue, head_name: r.head_name, status: r.status, resolution_note: r.resolution_note,
      resolved_at: r.resolved_at, affected_count: r.affected_count, escalated: r.escalated
    });
  }
  res.json(c);
});

// ---- Department head: assign / change the 3rd-party worker ---------------------------
router.patch('/:id/assign-worker', auth('dept_head', 'admin'), async (req, res) => {
  const name = String(req.body.worker_name || '').trim();
  const phone = String(req.body.worker_phone || '').trim();
  const day = String(req.body.expected_date || '').trim();

  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Enter the worker’s name' });
  if (!/^\+?[\d\s-]{7,16}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid contact number' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'Choose the expected resolution date' });
  const { rows: [chk] } = await pool.query('SELECT ($1::date >= current_date) AS ok', [day]).catch(() => ({ rows: [{ ok: false }] }));
  if (!chk.ok) return res.status(400).json({ error: 'Expected date cannot be in the past' });

  const { rows: [c] } = await pool.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
  if (!c || c.parent_id) return res.status(404).json({ error: 'Ticket not found' });
  if (req.user.role === 'dept_head' && c.department !== req.user.head_department) {
    return res.status(403).json({ error: 'This ticket belongs to another department' });
  }
  if (!ACTIVE_STATUSES.includes(c.status)) return res.status(400).json({ error: 'This ticket is not open for assignment' });

  const takeOver = req.user.role === 'dept_head';
  await pool.query(
    `UPDATE complaints SET worker_name=$2, worker_phone=$3, expected_date=$4, worker_assigned_at=now(),
       status='in_progress', assigned_to = CASE WHEN $6 THEN COALESCE(assigned_to, $5) ELSE assigned_to END,
       updated_at=now() WHERE id=$1`,
    [c.id, name, phone, day, req.user.id, takeOver]
  );
  await pool.query(`UPDATE complaints SET status='in_progress' WHERE parent_id = $1`, [c.id]);
  await pool.query(
    `INSERT INTO workers (department, name, phone) VALUES ($1,$2,$3)
     ON CONFLICT (department, phone) DO UPDATE SET name = EXCLUDED.name`,
    [c.department, name, phone]
  );

  const msg = `${name} will fix ticket ${c.ticket_no}. Expected by ${prettyDay(day)}.`;
  for (const uid of await affectedUsers(c.id)) await notify(uid, c.id, msg);
  emitToRoom('admins', 'stats:changed', {});
  emitAll('feed:changed', {});
  res.json({ ok: true });
});

// ---- Department head: mark resolved --------------------------------------------------
router.patch('/:id/resolve', auth('dept_head', 'admin'), async (req, res) => {
  const { rows: [c] } = await pool.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
  if (!c || c.parent_id) return res.status(404).json({ error: 'Ticket not found' });
  if (req.user.role === 'dept_head' && c.department !== req.user.head_department) {
    return res.status(403).json({ error: 'This ticket belongs to another department' });
  }
  const note = String(req.body.note || '').trim() || null;

  await pool.query(
    `UPDATE complaints SET status='resolved', resolved_at=now(), resolution_note=$2,
       assigned_to = COALESCE(assigned_to, $3), updated_at=now() WHERE id=$1`,
    [c.id, note, req.user.role === 'dept_head' ? req.user.id : null]
  );
  await pool.query(`UPDATE complaints SET status='resolved', resolved_at=now() WHERE parent_id = $1`, [c.id]);

  const msg = `Ticket ${c.ticket_no} was marked resolved. Please confirm whether the problem is fixed.`;
  for (const uid of await affectedUsers(c.id)) await notify(uid, c.id, msg);
  emitToRoom('admins', 'stats:changed', {});
  emitAll('feed:changed', {});
  res.json({ ok: true });
});

// ---- Student: confirm fixed / not fixed -------------------------------------------
router.post('/:id/feedback', auth('student'), async (req, res) => {
  const { resolved } = req.body;
  const { rows: [c] } = await pool.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Ticket not found' });
  const rootId = c.parent_id || c.id;

  const { rows: [root] } = await pool.query('SELECT * FROM complaints WHERE id = $1', [rootId]);
  if (root.status !== 'resolved') return res.status(400).json({ error: 'This ticket is not waiting for confirmation' });
  if (!(await affectedUsers(rootId)).includes(req.user.id)) return res.status(403).json({ error: 'You are not part of this ticket' });

  await pool.query('UPDATE complaint_votes SET confirmed = $3 WHERE complaint_id = $1 AND user_id = $2', [rootId, req.user.id, !!resolved]);

  if (resolved === false) {
    // Reopened: the old worker details stay for reference, but the head must set a fresh date
    await pool.query(
      `UPDATE complaints SET status = 'reopened', resolved_at = NULL, priority = 'high', expected_date = NULL, updated_at = now()
       WHERE id = $1 OR parent_id = $1`, [rootId]);
    const msg = `${req.user.name} reports ticket ${root.ticket_no} is NOT fixed. Reopened.`;
    if (root.assigned_to) await notify(root.assigned_to, rootId, msg);
    emitToRoom(`dept:${root.department}`, 'notification', { complaintId: rootId, message: msg });
    emitToRoom('admins', 'notification', { complaintId: rootId, message: msg });
  } else if (root.user_id === req.user.id) {
    await pool.query(`UPDATE complaints SET status = 'closed', updated_at = now() WHERE id = $1 OR parent_id = $1`, [rootId]);
  }
  emitToRoom('admins', 'stats:changed', {});
  emitAll('feed:changed', {});
  res.json({ ok: true });
});

export default router;
