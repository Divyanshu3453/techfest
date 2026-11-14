// Fills the database with demo students, tickets (with images), upvotes, comments and workers.
//   node scripts/demo.js            add demo data
//   node scripts/demo.js --reset    remove old demo data first, then add it again
// Run `npm run setup` first (needs the schema, locations and department heads).
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { embed } from '../src/services/llm.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const uploads = fileURLToPath(new URL('../uploads/', import.meta.url));
const customImages = fileURLToPath(new URL('../demo-images/', import.meta.url));
fs.mkdirSync(uploads, { recursive: true });

const DEMO_PASSWORD = 'demo123';
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3);
const dayOffset = (d) => (d == null ? null : new Date(Date.now() + d * 86400e3).toLocaleDateString('en-CA'));

// ---------- demo students: login demo01 ... demo12, password demo123 ----------
const STUDENTS = [
  ['Aarav Sharma', 'Aryabhatta Hostel', 'CSE'], ['Priya Debbarma', 'Bhaskara Hostel', 'ECE'],
  ['Rahul Das', 'Aryabhatta Hostel', 'Mechanical'], ['Ananya Roy', 'Bhaskara Hostel', 'CSE'],
  ['Vikram Singh', 'Aryabhatta Hostel', 'EEE'], ['Meera Nair', 'Bhaskara Hostel', 'Civil'],
  ['Rohan Gupta', 'Aryabhatta Hostel', 'Chemical'], ['Sneha Paul', 'Aryabhatta Hostel', 'ECE'],
  ['Arjun Reddy', 'Bhaskara Hostel', 'Production'], ['Ishita Saha', 'Aryabhatta Hostel', 'CSE'],
  ['Karan Mehta', 'Bhaskara Hostel', 'Instrumentation'], ['Diya Chakraborty', 'Aryabhatta Hostel', 'EEE']
];
const login = (i) => `demo${String(i + 1).padStart(2, '0')}`;

// ---------- demo tickets ----------
// status: assigned | in_progress | reopened | resolved | closed
// worker: [name, phone, expected day relative to today]  (negative = overdue)
const T = [
  { key: 'water', loc: 'Block B Bathroom, Aryabhatta Hostel', dept: 'Plumbing & Water', type: 'Maintenance', cat: 'No water supply',
    priority: 'high', escalated: true, status: 'in_progress', ago: 20, reporter: 0, upvoters: [1, 2, 3, 4, 5, 6], dupReporter: 7,
    summary: 'No water supply in Block B bathrooms since morning',
    desc: 'There has been no water in the Block B bathrooms on all floors since early morning. Taps are completely dry and the flush tanks are empty. Students cannot bathe or use the toilets properly. Please arrange a fix urgently.',
    dupDesc: 'Taps are dry in B block bathroom since morning, no water for bathing or flushing.',
    worker: ['Ramesh Das', '90000 00001', 1],
    comments: [[2, 'Same on the second floor, nothing is coming out.'], ['head', 'Plumber has been called. Tank motor is being checked.'], [5, 'Thanks, please update when water is back.']] },
  { key: 'tap', loc: 'Block A Bathroom, Bhaskara Hostel', dept: 'Plumbing & Water', type: 'Maintenance', cat: 'Leaking tap',
    priority: 'medium', status: 'assigned', ago: 6, reporter: 1, upvoters: [3, 8],
    summary: 'Tap leaking continuously in Block A bathroom',
    desc: 'The tap near the last wash basin keeps leaking day and night and the floor stays wet and slippery. Someone could fall. It needs a new washer or a replacement tap.',
    comments: [[3, 'Slipped here yesterday, please fix soon.']] },
  { key: 'mess', loc: 'Mess Hall, Aryabhatta Hostel', dept: 'Mess & Food', type: 'Food Quality', cat: 'Stale food',
    priority: 'high', escalated: true, status: 'assigned', ago: 30, reporter: 4, upvoters: [0, 2, 6, 9],
    summary: 'Stale rice and insects found in mess dinner',
    desc: 'Dinner rice yesterday smelled stale and several students found small insects in the dal. A few of us felt sick afterwards. The mess needs an inspection and the kitchen should be cleaned.',
    comments: [[0, 'Happened to me too, I could not finish the meal.'], [6, 'This is not the first time this month.']] },
  { key: 'light', loc: 'Block C Corridor, Aryabhatta Hostel', dept: 'Electrical', type: 'Maintenance', cat: 'Corridor lights not working',
    priority: 'medium', status: 'in_progress', ago: 100, reporter: 6, upvoters: [4, 10, 11],
    summary: 'Corridor tube lights off on Block C second floor',
    desc: 'Three tube lights in the second floor corridor of Block C have stopped working. The corridor is completely dark at night and it is hard to reach rooms safely.',
    worker: ['Suresh Paul', '90000 00002', -2],
    comments: [['head', 'Electrician promised to come on Monday. Following up.']] },
  { key: 'wifi', loc: 'Computer Centre', dept: 'IT & Network', type: 'IT/Network', cat: 'Wi-Fi outage',
    priority: 'high', escalated: true, status: 'in_progress', ago: 52, reporter: 3, upvoters: [1, 5, 7, 9, 11],
    summary: 'Wi-Fi not connecting at Computer Centre for two days',
    desc: 'The Wi-Fi network at the Computer Centre has not been connecting for two days. The login page does not load and the wired lab machines are also very slow. Assignments and online labs are affected.',
    worker: ['Network Solutions (Joy)', '90000 00003', 3],
    comments: [[9, 'Hostel Wi-Fi is also unstable since yesterday.'], [1, 'Lab submission deadline is tomorrow, this is urgent.']] },
  { key: 'ceiling', loc: 'Central Library Ground Floor', dept: 'Civil & Maintenance', type: 'Infrastructure', cat: 'Ceiling leakage',
    priority: 'medium', status: 'assigned', ago: 14, reporter: 5, upvoters: [8],
    summary: 'Water dripping from ceiling in library reading area',
    desc: 'Water drips from the ceiling near the third reading table whenever it rains. Books and bags have got wet. The ceiling panel looks damaged and may fall.',
    comments: [] },
  { key: 'dogs', loc: 'Main Gate Road', dept: 'Security', type: 'Safety', cat: 'Stray dog menace',
    priority: 'high', status: 'assigned', ago: 40, reporter: 7, upvoters: [0, 10, 11],
    summary: 'Pack of stray dogs chasing students near main gate at night',
    desc: 'A pack of stray dogs has been chasing students returning from the library after 9 pm near the main gate road. Two students were nearly bitten. The street lights there are also dim.',
    comments: [[10, 'They chased my bicycle yesterday.']] },
  { key: 'garbage', loc: 'Block B Corridor, Bhaskara Hostel', dept: 'Housekeeping & Sanitation', type: 'Hygiene', cat: 'Garbage not cleared',
    priority: 'medium', status: 'resolved', ago: 90, resolvedAgo: 8, reporter: 1, upvoters: [3, 5],
    summary: 'Garbage bins overflowing in Block B corridor',
    desc: 'The garbage bins in the Block B corridor have not been emptied for three days. They are overflowing and the smell is spreading. Mosquitoes and flies are increasing.',
    worker: ['Sunita Devi', '90000 00004', -1], resolutionNote: 'Bins cleared and a daily pickup slot has been fixed with the cleaning contractor.',
    comments: [['head', 'Cleaning contractor has been informed. Cleared today.']] },
  { key: 'cooler', loc: 'Sports Complex', dept: 'Plumbing & Water', type: 'Maintenance', cat: 'Water cooler not working',
    priority: 'low', status: 'closed', ago: 150, resolvedAgo: 110, reporter: 10, upvoters: [4],
    summary: 'Water cooler at sports complex not giving cold water',
    desc: 'The water cooler near the basketball court has stopped cooling and the water tastes warm and metallic. It is used by many players every evening.',
    worker: ['Ramesh Das', '90000 00001', -4], resolutionNote: 'Compressor repaired and filter changed.', confirmed: true,
    comments: [] },
  { key: 'wiring', loc: 'Main Academic Building Lobby', dept: 'Electrical', type: 'Maintenance', cat: 'Exposed wiring',
    priority: 'critical', status: 'in_progress', ago: 9, reporter: 2, upvoters: [3],
    summary: 'Exposed wires sparking near lobby notice board',
    desc: 'Wires are hanging out of a damaged switch board near the notice board in the main lobby and they spark when touched by the wind from the door. This is dangerous, especially for students passing by.',
    worker: ['Suresh Paul', '90000 00002', 0],
    comments: [['head', 'Area has been cordoned. Electrician arrives today.']] },
  { key: 'flush', loc: 'Block A Bathroom, Aryabhatta Hostel', dept: 'Plumbing & Water', type: 'Maintenance', cat: 'Flush not working',
    priority: 'high', status: 'reopened', ago: 120, reporter: 0, upvoters: [2, 9],
    summary: 'Flush in Block A bathroom stopped working again',
    desc: 'The flush in the first bathroom stall of Block A was repaired last week but has stopped working again. The same problem returned within two days so the earlier repair did not hold.',
    worker: ['Ramesh Das', '90000 00001', null],
    comments: [[2, 'It was marked fixed but it is still broken.']] },
  { key: 'shuttle', loc: 'Main Gate Road', dept: 'Transport', type: 'Administrative', cat: 'Shuttle delays',
    priority: 'medium', status: 'assigned', ago: 3, reporter: 8, upvoters: [],
    summary: 'Campus shuttle arriving 30 minutes late every morning',
    desc: 'The morning campus shuttle from the hostels to the academic block has been arriving about thirty minutes late all week. Many students miss the first lecture because of this.',
    comments: [] }
];

const PALETTE = {
  'Plumbing & Water': '#1d6fa5', 'Electrical': '#b7791f', 'Mess & Food': '#b45309', 'IT & Network': '#5b4bb7',
  'Civil & Maintenance': '#6b7280', 'Security': '#9b2c2c', 'Housekeeping & Sanitation': '#2f7d4f',
  'Transport': '#0e7490', 'Hostel Administration': '#475569'
};
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function makeImage(t) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    const src = path.join(customImages, `${t.key}.${ext}`); // optional: put your own photos here
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(uploads, `demo-${t.key}.${ext}`));
      return `/uploads/demo-${t.key}.${ext}`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
<rect width="800" height="500" fill="${PALETTE[t.dept] || '#334155'}"/>
<circle cx="650" cy="130" r="95" fill="rgba(255,255,255,.16)"/><circle cx="560" cy="210" r="48" fill="rgba(255,255,255,.12)"/>
<rect x="50" y="290" width="700" height="130" rx="14" fill="rgba(0,0,0,.3)"/>
<text x="80" y="347" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#fff">${esc(t.cat)}</text>
<text x="80" y="388" font-family="Arial, sans-serif" font-size="22" fill="#fff">${esc(t.loc)}</text>
<text x="50" y="62" font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,.85)">DEMO PHOTO (placeholder)</text></svg>`;
  fs.writeFileSync(path.join(uploads, `demo-${t.key}.svg`), svg);
  return `/uploads/demo-${t.key}.svg`;
}

async function main() {
  const reset = process.argv.includes('--reset');

  // heads and locations must exist (created by `npm run setup`)
  const heads = {};
  for (const r of (await pool.query(`SELECT id, head_department FROM users WHERE role='dept_head' ORDER BY id`)).rows) {
    if (!heads[r.head_department]) heads[r.head_department] = r.id;
  }
  if (!Object.keys(heads).length) throw new Error('No department heads found. Run `npm run setup` first.');
  const locs = Object.fromEntries((await pool.query('SELECT label, lat, lng FROM locations')).rows.map((l) => [l.label, l]));

  // students
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const ids = [];
  for (let i = 0; i < STUDENTS.length; i++) {
    const [name, hostel, dept] = STUDENTS[i];
    await pool.query(
      `INSERT INTO users (name, enrollment, hostel, department, password_hash, role)
       VALUES ($1,$2,$3,$4,$5,'student') ON CONFLICT (enrollment) DO NOTHING`,
      [name, login(i), hostel, dept, hash]
    );
    ids.push((await pool.query('SELECT id FROM users WHERE enrollment = $1', [login(i)])).rows[0].id);
  }

  if (reset) {
    await pool.query('DELETE FROM notifications WHERE user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM complaint_comments WHERE user_id = ANY($1) OR complaint_id IN (SELECT id FROM complaints WHERE user_id = ANY($1))', [ids]);
    await pool.query('DELETE FROM complaint_votes WHERE user_id = ANY($1) OR complaint_id IN (SELECT id FROM complaints WHERE user_id = ANY($1))', [ids]);
    await pool.query('DELETE FROM complaints WHERE user_id = ANY($1) AND parent_id IS NOT NULL', [ids]);
    await pool.query('DELETE FROM complaints WHERE user_id = ANY($1)', [ids]);
    console.log('Old demo tickets removed');
  } else if ((await pool.query('SELECT 1 FROM complaints WHERE user_id = ANY($1) LIMIT 1', [ids])).rowCount) {
    console.log('Demo tickets already exist. Run with --reset to recreate them.');
    return;
  }

  const insert = async (t, userId, description, createdAt, parentId) => {
    const l = locs[t.loc];
    const { rows: [{ n }] } = await pool.query("SELECT nextval('ticket_seq') AS n");
    const emb = await embed(`${t.cat}. ${description}`);
    const worker = !parentId && t.worker;
    const isDone = ['resolved', 'closed'].includes(t.status);
    const { rows: [r] } = await pool.query(
      `INSERT INTO complaints (ticket_no, user_id, image_url, lat, lng, location_label, description, status, problem_type,
         category, department, priority, summary, embedding, parent_id, affected_count, escalated, assigned_to,
         resolution_note, worker_name, worker_phone, expected_date, worker_assigned_at, created_at, assigned_at, resolved_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING id`,
      [`GRV-2026-${n}`, userId, t.image, l?.lat ?? null, l?.lng ?? null, t.loc, description, t.status, t.type,
        t.cat, t.dept, t.priority, t.summary, emb, parentId || null, 1 + t.upvoters.length + (t.dupReporter != null ? 1 : 0), !!t.escalated,
        heads[t.dept] || null, isDone ? t.resolutionNote || null : null,
        worker ? worker[0] : null, worker ? worker[1] : null, worker ? dayOffset(worker[2]) : null,
        worker ? new Date(createdAt.getTime() + 3 * 3600e3) : null, createdAt, new Date(createdAt.getTime() + 600e3),
        isDone ? hoursAgo(t.resolvedAgo) : null, new Date()]
    );
    return r.id;
  };

  let count = 0;
  for (const t of T) {
    t.image = makeImage(t);
    const createdAt = hoursAgo(t.ago);
    const rootId = await insert(t, ids[t.reporter], t.desc, createdAt, null);
    count++;

    // votes: reporter + "facing this too" upvoters (+ the linked duplicate's reporter)
    const voters = [t.reporter, ...t.upvoters, ...(t.dupReporter != null ? [t.dupReporter] : [])];
    for (const [k, u] of voters.entries()) {
      await pool.query(
        'INSERT INTO complaint_votes (complaint_id, user_id, confirmed, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [rootId, ids[u], t.confirmed && k === 0 ? true : null, new Date(createdAt.getTime() + (k + 1) * 45 * 60e3)]
      );
    }
    if (t.dupReporter != null) { // a duplicate report merged into this ticket
      await insert({ ...t, upvoters: [], dupReporter: null, worker: null }, ids[t.dupReporter], t.dupDesc, new Date(createdAt.getTime() + 2 * 3600e3), rootId);
      count++;
    }
    for (const [k, [who, body]] of t.comments.entries()) {
      const author = who === 'head' ? heads[t.dept] : ids[who];
      if (author) await pool.query(
        'INSERT INTO complaint_comments (complaint_id, user_id, body, created_at) VALUES ($1,$2,$3,$4)',
        [rootId, author, body, new Date(createdAt.getTime() + (k + 1) * 40 * 60e3)]
      );
    }
  }

  // a few notifications for demo01
  const first = (await pool.query('SELECT id, ticket_no FROM complaints WHERE user_id = $1 AND parent_id IS NULL ORDER BY id LIMIT 1', [ids[0]])).rows[0];
  if (first) await pool.query('INSERT INTO notifications (user_id, complaint_id, message) VALUES ($1,$2,$3)',
    [ids[0], first.id, `Ticket ${first.ticket_no} has been sent to the department head, who will arrange a worker.`]);

  console.log(`Created ${STUDENTS.length} students and ${count} tickets with images, upvotes, comments and workers.`);
  console.log(`Student logins: ${login(0)} ... ${login(STUDENTS.length - 1)}  (password: ${DEMO_PASSWORD})`);
  console.log('Department heads: head-<department>, e.g. head-plumbing-water / head123. Admin: admin / admin123.');
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => pool.end());
