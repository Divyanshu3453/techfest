import crypto from 'crypto';
import { pool, redis } from '../config.js';
import { ACTIVE_STATUSES } from '../constants.js';
import { embed, cosine } from './llm.js';
import { haversineKm } from './geo.js';

// Tune these if you switch embedding models (hashed local embeddings score lower than OpenAI ones).
const SEARCH_SEM_MIN = Number(process.env.SEARCH_SEM_MIN) || 0.4;   // semantic-only hit in the search bar
const SUGGEST_MIN = Number(process.env.SUGGEST_THRESHOLD) || 0.5;   // "this looks already reported" while filing

// ---------- text helpers -----------------------------------------------------------------------
const STOP = new Set(('a an the is are was were be been am i me my we our us you your it its this that these those of in on at to for from ' +
  'and or but with without by as there here has have had do does did not no very so can could would should will just please ' +
  'issue issues problem problems complaint complaints regarding about near since still again also too').split(' '));

// everything on the left is treated as the word on the right
const SYN = {
  washroom: 'bathroom', restroom: 'bathroom', toilet: 'bathroom', lavatory: 'bathroom', loo: 'bathroom', bath: 'bathroom',
  wifi: 'wifi', internet: 'wifi', network: 'wifi', net: 'wifi', lan: 'wifi', broadband: 'wifi',
  bulb: 'light', tubelight: 'light', lamp: 'light', lights: 'light', lighting: 'light',
  faucet: 'tap', leakage: 'leak', seepage: 'leak', dripping: 'leak', drip: 'leak',
  canteen: 'mess', dining: 'mess', meal: 'food', meals: 'food', lunch: 'food', dinner: 'food', breakfast: 'food',
  filthy: 'dirty', unclean: 'dirty', unhygienic: 'dirty', garbage: 'trash', waste: 'trash', dustbin: 'trash', litter: 'trash',
  electrical: 'electric', electricity: 'electric', power: 'electric', current: 'electric', blackout: 'electric',
  hostel: 'hostel', dorm: 'hostel', dormitory: 'hostel', pc: 'computer', desktop: 'computer', systems: 'computer'
};

function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokenize(text = '') {
  const t = String(text).toLowerCase()
    .replace(/wi-?\s?fi/g, 'wifi')
    .replace(/\bblock\s*([a-z0-9])\b/g, 'block$1')      // "block b" and "b block" must not match "block a"
    .replace(/\b([a-z0-9])\s+block\b/g, 'block$1');
  const out = [];
  for (const raw of t.match(/[a-z0-9]+/g) || []) {
    if (STOP.has(raw)) continue;
    const w = SYN[raw] || stem(raw);
    out.push(SYN[w] || w);
  }
  return out;
}

// share of the query's words that appear in the document (exact, or prefix match for longer words)
function keywordScore(qTokens, docTokens) {
  if (!qTokens.length) return 0;
  const set = new Set(docTokens);
  let hit = 0;
  for (const q of qTokens) {
    if (set.has(q)) hit++;
    else if (q.length >= 4 && docTokens.some((d) => d.length >= 4 && (d.startsWith(q) || q.startsWith(d)))) hit += 0.7;
  }
  return Math.min(1, hit / qTokens.length);
}

// ---------- shared plumbing --------------------------------------------------------------------
export async function rateLimit(key, max, windowSec = 60) {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return n <= max;
}

// query embeddings are cached for an hour so repeated searches don't cost API calls
async function cachedEmbed(text) {
  const key = `emb:q:${crypto.createHash('sha1').update(text).digest('hex')}`;
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit);
  } catch { /* cache is optional */ }
  const v = await embed(text);
  redis.set(key, JSON.stringify(v), 'EX', 3600).catch(() => {});
  return v;
}

const CARD_COLUMNS = `
  c.id, c.ticket_no, c.summary, c.category, c.main_category, c.sub_category, c.department, c.location_label,
  c.affected_count, c.escalated, c.status, c.priority, c.image_url, c.created_at, c.worker_name, c.lat, c.lng,
  to_char(c.expected_date, 'YYYY-MM-DD') AS expected_date,
  (c.expected_date < current_date AND c.status IN ('in_progress','reopened')) AS overdue,
  EXISTS (SELECT 1 FROM complaint_votes v WHERE v.complaint_id = c.id AND v.user_id = $1) AS joined,
  (SELECT count(*)::int FROM complaint_comments m WHERE m.complaint_id = c.id) AS comment_count,
  c.description, c.embedding`;

// the description and embedding are only used for scoring; they never leave the server
function toCard(row, extra = {}) {
  const { description, embedding, lat, lng, ...card } = row;
  return { ...card, ...extra };
}

// ---------- 1) search bar ----------------------------------------------------------------------
export async function searchComplaints({ userId, q, includeResolved = false, limit = 20 }) {
  const qTokens = tokenize(q);
  if (!qTokens.length) return [];

  const statuses = includeResolved ? [...ACTIVE_STATUSES, 'resolved', 'closed'] : ACTIVE_STATUSES;
  const { rows } = await pool.query(
    `SELECT ${CARD_COLUMNS} FROM complaints c
     WHERE c.parent_id IS NULL AND c.status = ANY($2) AND c.embedding IS NOT NULL
       AND (c.is_public = TRUE OR c.user_id = $1)   -- private issues only show up for their reporter
     ORDER BY c.created_at DESC LIMIT 600`,
    [userId, statuses]
  );
  if (!rows.length) return [];

  const qEmb = await cachedEmbed(q);
  const scored = [];
  for (const r of rows) {
    const doc = tokenize([r.summary, r.category, r.sub_category, r.main_category, r.department, r.location_label, r.ticket_no, r.description].join(' '));
    const kw = keywordScore(qTokens, doc);
    const sem = Math.max(0, cosine(qEmb, r.embedding));
    if (kw < 0.5 && sem < SEARCH_SEM_MIN) continue;      // neither a keyword hit nor close in meaning
    scored.push({ r, score: 0.6 * kw + 0.4 * sem });
  }
  scored.sort((a, b) => b.score - a.score || b.r.affected_count - a.r.affected_count);
  return scored.slice(0, limit).map(({ r, score }) => toCard(r, { score: Math.round(score * 100) }));
}

// ---------- 2) "already registered?" check while filing ---------------------------------------------
function sameSpot(label, lat, lng, r) {
  if (label && r.location_label && label.toLowerCase() === r.location_label.toLowerCase()) return true;
  if (lat != null && lng != null && r.lat != null && r.lng != null) return haversineKm(lat, lng, r.lat, r.lng) < 0.15;
  return false;
}

export async function findSimilar({ userId, description, subCategory, label, lat, lng, limit = 5 }) {
  const qTokens = tokenize(`${subCategory || ''} ${description}`);
  if (!qTokens.length) return [];

  const { rows } = await pool.query(
    `SELECT ${CARD_COLUMNS} FROM complaints c
     WHERE c.parent_id IS NULL AND c.status = ANY($2) AND c.embedding IS NOT NULL
       AND c.is_public = TRUE   -- never suggest a private issue to another student
       AND c.created_at > now() - interval '60 days'
     ORDER BY c.created_at DESC LIMIT 400`,
    [userId, ACTIVE_STATUSES]
  );
  if (!rows.length) return [];

  // same text shape the assigner worker stores: "<category>. <description>"
  const emb = await cachedEmbed(`${subCategory || ''}. ${description}`);
  const out = [];
  for (const r of rows) {
    const doc = tokenize([r.summary, r.category, r.sub_category, r.location_label, r.description].join(' '));
    const sem = Math.max(0, cosine(emb, r.embedding));
    const kw = keywordScore(qTokens, doc);
    const spot = sameSpot(label, lat, lng, r);
    const score = Math.min(1, 0.7 * sem + 0.3 * kw + (spot ? 0.1 : 0) + (subCategory && r.sub_category === subCategory ? 0.05 : 0));
    if (score >= SUGGEST_MIN) out.push({ r, score, spot });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit).map(({ r, score, spot }) => toCard(r, { score: Math.round(score * 100), same_spot: spot }));
}
