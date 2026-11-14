import { Router } from 'express';
import { pool } from '../config.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/', auth(), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, complaint_id, message, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
    [req.user.id]
  );
  res.json(rows);
});

router.post('/read', auth(), async (req, res) => {
  await pool.query('UPDATE notifications SET read = true WHERE user_id = $1', [req.user.id]);
  res.json({ ok: true });
});

export default router;
