import { pool } from '../config.js';
import { emitToUser } from '../socket.js';

export async function notify(userId, complaintId, message) {
  if (!userId) return;
  await pool.query('INSERT INTO notifications (user_id, complaint_id, message) VALUES ($1,$2,$3)', [userId, complaintId, message]);
  emitToUser(userId, 'notification', { complaintId, message });
}

// Everyone affected by a root ticket: its reporter, linked duplicates, and "me too" voters.
export async function affectedUsers(rootId) {
  const { rows } = await pool.query(
    `SELECT user_id FROM complaint_votes WHERE complaint_id = $1
     UNION SELECT user_id FROM complaints WHERE id = $1 OR parent_id = $1`,
    [rootId]
  );
  return rows.map((r) => r.user_id);
}
