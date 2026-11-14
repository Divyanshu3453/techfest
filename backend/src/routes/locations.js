import { Router } from 'express';
import { pool } from '../config.js';
import { auth } from '../middleware/auth.js';
import { nearestLocation } from '../services/geo.js';

const router = Router();

router.get('/', auth(), async (_req, res) => {
  const { rows } = await pool.query('SELECT id, label, lat, lng FROM locations ORDER BY label');
  res.json(rows);
});

// GPS coordinates -> "Block B Bathroom, Aryabhatta Hostel"
router.get('/resolve', auth(), async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: 'lat and lng are required' });
  res.json({ match: await nearestLocation(lat, lng) });
});

export default router;
