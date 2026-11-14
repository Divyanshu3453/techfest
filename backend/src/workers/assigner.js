import { pool, redis, STREAM } from '../config.js';
import { ACTIVE_STATUSES, findSubCategory } from '../constants.js';
import { classify, embed, cosine } from '../services/llm.js';
import { haversineKm } from '../services/geo.js';
import { notify } from '../services/notify.js';
import { leastLoadedHead } from '../services/routing.js';
import { logEvent } from '../services/moderation.js';
import { addVote } from '../services/trending.js';
import { emitToRoom, emitAll } from '../socket.js';

const GROUP = 'assigners';
const CONSUMER = process.env.WORKER_NAME || 'worker-1';
const SIM = Number(process.env.SIMILARITY_THRESHOLD) || 0.82;

function sameSpot(a, b) {
  if (a.location_label && b.location_label && a.location_label.toLowerCase() === b.location_label.toLowerCase()) return true;
  if (a.lat != null && b.lat != null) return haversineKm(a.lat, a.lng, b.lat, b.lng) < 0.15;
  return false;
}

async function processComplaint(id) {
  const { rows: [c] } = await pool.query('SELECT * FROM complaints WHERE id = $1', [id]);
  if (!c || c.status !== 'processing') return;

  const cls = await classify(c.description, c.location_label);
  // The student's dropdown choice beats the AI guess for category and department; AI still sets priority + summary.
  const picked = findSubCategory(c.main_category, c.sub_category);
  if (picked) {
    cls.category = picked.sub.label;
    if (picked.sub.department) cls.department = picked.sub.department;
  }
  const emb = await embed(`${cls.category}. ${c.description}`);

  // Semantic duplicate check against open root tickets from the same department
  const { rows: candidates } = await pool.query(
    `SELECT id, ticket_no, embedding, location_label, lat, lng FROM complaints
     WHERE parent_id IS NULL AND id <> $1 AND department = $2 AND is_public = TRUE
       AND status = ANY($3) AND embedding IS NOT NULL
       AND created_at > now() - interval '30 days'`,
    [id, cls.department, ACTIVE_STATUSES]
  );
  let best = null, bestScore = 0;
  for (const p of candidates) {
    // skip_dedupe: student saw the similar issues and confirmed theirs is different
    // !is_public: private reports are never merged into another ticket
    if (c.skip_dedupe || !c.is_public) break;
    if (!sameSpot(c, p)) continue;
    const s = cosine(emb, p.embedding);
    if (s > bestScore) { bestScore = s; best = p; }
  }

  if (best && bestScore >= SIM) {
    await pool.query(
      `UPDATE complaints SET parent_id=$2, status='linked', problem_type=$3, category=$4, department=$5,
       priority=$6, summary=$7, embedding=$8, updated_at=now() WHERE id=$1`,
      [id, best.id, cls.problem_type, cls.category, cls.department, cls.priority, cls.summary, emb]
    );
    await logEvent(id, null, 'linked', `Matched existing ticket ${best.ticket_no} and merged into it`);
    await addVote(best.id, c.user_id);
    await notify(c.user_id, id, `Your report matches ticket ${best.ticket_no}, which is already being handled. You've been added as an affected student.`);
    return;
  }

  // Least-loaded department head (a department can have several heads)
  const assignee = await leastLoadedHead(cls.department);

  await pool.query(
    `UPDATE complaints SET status='assigned', problem_type=$2, category=$3, department=$4, priority=$5,
     summary=$6, embedding=$7, assigned_to=$8, assigned_at=now(), updated_at=now() WHERE id=$1`,
    [id, cls.problem_type, cls.category, cls.department, cls.priority, cls.summary, emb, assignee]
  );
  await pool.query('INSERT INTO complaint_votes (complaint_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, c.user_id]);

  await logEvent(id, null, 'routed', `Classified as ${cls.category} (${cls.priority} priority) and sent to ${cls.department}`);
  await notify(c.user_id, id, `Ticket ${c.ticket_no} has been sent to the ${cls.department} head, who will arrange a worker.`);
  const staffMsg = `New ${cls.priority} ticket ${c.ticket_no}: ${cls.summary}`;
  if (assignee) await notify(assignee, id, staffMsg);
  else emitToRoom(`dept:${cls.department}`, 'notification', { complaintId: id, message: staffMsg });
  emitToRoom('admins', 'stats:changed', {});
  emitAll('feed:changed', {});
}

export async function startWorker() {
  const r = redis.duplicate(); // dedicated connection for blocking reads
  try {
    await r.xgroup('CREATE', STREAM, GROUP, '0', 'MKSTREAM');
  } catch (e) {
    if (!String(e.message).includes('BUSYGROUP')) throw e;
  }
  console.log(`Assigner worker ${CONSUMER} listening on ${STREAM}`);

  let cursor = '0'; // first drain this consumer's pending (unacked) entries, then switch to new ones
  while (true) {
    try {
      const res = await r.xreadgroup('GROUP', GROUP, CONSUMER, 'COUNT', 5, 'BLOCK', 5000, 'STREAMS', STREAM, cursor);
      if (!res) continue;
      const entries = res[0][1];
      if (cursor === '0' && entries.length === 0) { cursor = '>'; continue; }
      for (const [entryId, fields] of entries) {
        const complaintId = Number(fields[1]);
        try {
          await processComplaint(complaintId);
          await r.xack(STREAM, GROUP, entryId);
        } catch (e) {
          console.error(`Failed processing complaint ${complaintId}:`, e.message);
        }
      }
      if (cursor !== '>') cursor = entries[entries.length - 1][0]; // walk through the pending backlog once
    } catch (e) {
      console.error('Worker loop error:', e.message);
      await new Promise((ok) => setTimeout(ok, 2000));
    }
  }
}
