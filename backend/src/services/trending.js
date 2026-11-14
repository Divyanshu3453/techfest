import { pool } from '../config.js';
import { PRIORITY_RANK } from '../constants.js';
import { emitToRoom, emitAll } from '../socket.js';
import { notify, affectedUsers } from './notify.js';

const ESCALATE_AT = Number(process.env.ESCALATE_AT) || 5;
const CRITICAL_AT = Number(process.env.CRITICAL_AT) || 10;

// Adds a user to a root ticket ("I'm facing this too"). Returns the new count or null if already counted.
export async function addVote(rootId, userId) {
  const ins = await pool.query(
    'INSERT INTO complaint_votes (complaint_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING 1',
    [rootId, userId]
  );
  if (!ins.rowCount) return null;
  const { rows } = await pool.query(
    'UPDATE complaints SET affected_count = affected_count + 1, updated_at = now() WHERE id = $1 RETURNING *',
    [rootId]
  );
  await maybeEscalate(rows[0]);
  emitToRoom('admins', 'stats:changed', {});
  emitAll('feed:changed', {});
  return rows[0].affected_count;
}

export async function maybeEscalate(c) {
  const target = c.affected_count >= CRITICAL_AT ? 'critical' : c.affected_count >= ESCALATE_AT ? 'high' : null;
  if (!target) return;
  if (c.escalated && PRIORITY_RANK[c.priority] >= PRIORITY_RANK[target]) return;

  const priority = PRIORITY_RANK[target] > PRIORITY_RANK[c.priority] ? target : c.priority;
  await pool.query('UPDATE complaints SET escalated = true, priority = $2, updated_at = now() WHERE id = $1', [c.id, priority]);

  const msg = `Ticket ${c.ticket_no} escalated to ${priority}: ${c.affected_count} people are affected`;
  for (const uid of await affectedUsers(c.id)) await notify(uid, c.id, msg);
  if (c.assigned_to) await notify(c.assigned_to, c.id, msg);
  if (c.department) emitToRoom(`dept:${c.department}`, 'notification', { complaintId: c.id, message: msg });
  emitToRoom('admins', 'notification', { complaintId: c.id, message: msg });
}
