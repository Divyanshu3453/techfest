import { pool } from '../config.js';
import { MAX_WARNINGS } from '../constants.js';
import { llmFlagsAbuse } from './llm.js';
import { notify } from './notify.js';
import { emitToRoom } from '../socket.js';

// ---------- 1) abuse filter -------------------------------------------------------------------
// Strong profanity and abuse only (English + common Hindi/Bengali transliterations). Matching is done on whole
// words after undoing common tricks (f*ck, fuuuck, sh1t, f u c k) so honest words such as "class" never trip it.
const BAD = [
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'shitty', 'bullshit', 'bitch', 'bastard', 'asshole', 'dickhead',
  'cunt', 'slut', 'whore', 'piss off', 'retard', 'retarded', 'nigger', 'nigga',
  'madarchod', 'behenchod', 'bhenchod', 'bhosdike', 'bhosadi', 'chutiya', 'chutiye', 'gandu', 'harami', 'haramzada',
  'haramkhor', 'randi', 'lund', 'bokachoda', 'khanki', 'fck', 'fuk', 'fukk'
];
const LEET = { '@': 'a', '4': 'a', '0': 'o', '1': 'i', '!': 'i', '3': 'e', '$': 's', '5': 's', '7': 't', '*': '', '#': '' };
const BAD_SET = new Set(BAD.filter((w) => !w.includes(' ')));
const BAD_PHRASES = BAD.filter((w) => w.includes(' '));

function normalise(text) {
  return String(text).toLowerCase()
    .replace(/[@4013!$57*#]/g, (ch) => LEET[ch])
    .replace(/(.)\1{2,}/g, '$1$1');          // fuuuuck -> fuuck
}
const squeeze = (w) => w.replace(/(.)\1+/g, '$1'); // fuuck -> fuck, shiit -> shit

function hasBadWord(text) {
  const norm = normalise(text);
  const tokens = norm.match(/[a-z]+/g) || [];
  const bad = new Set([...BAD_SET].flatMap((w) => [w, squeeze(w)]));
  for (const t of tokens) if (bad.has(t) || bad.has(squeeze(t))) return true;
  // "f u c k" written as single letters
  const singles = norm.match(/\b(?:[a-z]\s+){2,}[a-z]\b/g) || [];
  for (const run of singles) if (bad.has(run.replace(/\s+/g, ''))) return true;
  return BAD_PHRASES.some((p) => norm.includes(p));
}

// true when the text must not be posted
export async function isAbusive(text) {
  return hasBadWord(text) || (await llmFlagsAbuse(text));
}

// ---------- 2) warnings -----------------------------------------------------------------------
export async function activeWarnings(userId) {
  const { rows: [r] } = await pool.query('SELECT count(*)::int AS n FROM warnings WHERE user_id = $1 AND NOT cleared', [userId]);
  return r.n;
}

export async function isRestricted(userId) {
  return (await activeWarnings(userId)) >= MAX_WARNINGS;
}

export const RESTRICTED_MESSAGE =
  `Your account is restricted after ${MAX_WARNINGS} warnings. You can still read the feed and track your tickets. Please contact the administrator to restore access.`;

// Records a warning, tells the student the exact reason, and flags the account when the limit is reached.
export async function warnUser({ userId, complaintId = null, issuedBy = null, reason, source = 'manual' }) {
  await pool.query(
    'INSERT INTO warnings (user_id, complaint_id, issued_by, source, reason) VALUES ($1,$2,$3,$4,$5)',
    [userId, complaintId, issuedBy, source, reason]
  );
  const count = await activeWarnings(userId);
  const by = source === 'auto' ? 'the platform' : 'the department staff';
  let msg = `Warning ${count} of ${MAX_WARNINGS} from ${by}: ${reason}`;
  if (count >= MAX_WARNINGS) msg += ' Your account is now restricted from reporting and commenting. Contact the administrator.';
  else if (count === MAX_WARNINGS - 1) msg += ' One more warning will restrict your account.';
  await notify(userId, complaintId, msg);
  emitToRoom('admins', 'stats:changed', {});
  return { count, restricted: count >= MAX_WARNINGS };
}

// ---------- 3) ticket history -----------------------------------------------------------------
export async function logEvent(complaintId, actorId, kind, message) {
  await pool.query('INSERT INTO complaint_events (complaint_id, actor_id, kind, message) VALUES ($1,$2,$3,$4)', [complaintId, actorId || null, kind, message]);
}
