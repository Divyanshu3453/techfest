import { pool } from '../config.js';
import { ACTIVE_STATUSES } from '../constants.js';

// The department head with the fewest open tickets (a department can have several heads). Null if it has none.
export async function leastLoadedHead(department) {
  const { rows } = await pool.query(
    `SELECT u.id FROM users u WHERE u.role = 'dept_head' AND u.head_department = $1
     ORDER BY (SELECT count(*) FROM complaints x WHERE x.assigned_to = u.id AND x.status = ANY($2)), u.id
     LIMIT 1`,
    [department, ACTIVE_STATUSES]
  );
  return rows[0]?.id || null;
}
