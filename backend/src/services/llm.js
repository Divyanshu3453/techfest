import { DEPARTMENTS, PRIORITIES } from '../constants.js';

const BASE = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const KEY = process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-small';

const SYSTEM = `You triage campus grievances for a university. Reply with ONLY a JSON object:
{
 "problem_type": one of ["Maintenance","Hygiene","Safety","Food Quality","IT/Network","Infrastructure","Administrative","Other"],
 "category": short specific label such as "Water leakage", "Fan not working", "Wi-Fi outage",
 "department": one of ${JSON.stringify(DEPARTMENTS)},
 "priority": one of ["low","medium","high","critical"] (critical = risk to life/safety),
 "summary": max 15 words, neutral wording
}`;

const RULES = [
  [/leak|tap|water|pipe|flush|drain|geyser|plumb|seepage/i, 'Plumbing & Water', 'Maintenance', 'Water / plumbing'],
  [/light|fan|switch|socket|wire|wiring|power|electric|bulb|tube ?light|short ?circuit|spark/i, 'Electrical', 'Maintenance', 'Electrical fault'],
  [/wi-?fi|internet|network|router|\blan\b|server|portal/i, 'IT & Network', 'IT/Network', 'Network issue'],
  [/food|mess|canteen|meal|stale|insect in|hair in/i, 'Mess & Food', 'Food Quality', 'Food quality'],
  [/theft|stolen|unsafe|harass|fight|stray|dog|cctv|ragging|stranger/i, 'Security', 'Safety', 'Safety concern'],
  [/bus|transport|shuttle|vehicle/i, 'Transport', 'Administrative', 'Transport'],
  [/dirty|clean|garbage|waste|dustbin|smell|odou?r|mosquito|toilet|bathroom|sweep/i, 'Housekeeping & Sanitation', 'Hygiene', 'Cleanliness'],
  [/crack|wall|roof|ceiling|door|window|furniture|bench|road|pothole|paint|broken/i, 'Civil & Maintenance', 'Infrastructure', 'Structural damage'],
  [/room|allot|warden|hostel/i, 'Hostel Administration', 'Administrative', 'Hostel administration']
];

function heuristic(description) {
  for (const [re, department, problem_type, category] of RULES) {
    if (re.test(description)) {
      const priority = /spark|fire|short ?circuit|shock|harass|ragging|unsafe/i.test(description) ? 'critical' : 'medium';
      return { problem_type, category, department, priority, summary: description.slice(0, 90) };
    }
  }
  return { problem_type: 'Other', category: 'General', department: 'Hostel Administration', priority: 'medium', summary: description.slice(0, 90) };
}

export async function classify(description, location) {
  if (!KEY) return heuristic(description);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Location: ${location || 'unknown'}\nComplaint: ${description}` }
        ]
      })
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    const out = JSON.parse(data.choices[0].message.content);
    const fallback = heuristic(description);
    return {
      problem_type: out.problem_type || fallback.problem_type,
      category: out.category || fallback.category,
      department: DEPARTMENTS.includes(out.department) ? out.department : fallback.department,
      priority: PRIORITIES.includes(out.priority) ? out.priority : 'medium',
      summary: (out.summary || fallback.summary).slice(0, 160)
    };
  } catch (e) {
    console.error('classify failed, using keyword fallback:', e.message);
    return heuristic(description);
  }
}

// Cheap local embedding (hashing trick) used only when no API key is configured.
function hashEmbed(text, dim = 256) {
  const v = new Array(dim).fill(0);
  for (const tok of text.toLowerCase().match(/[a-z0-9]+/g) || []) {
    let h = 5381;
    for (let i = 0; i < tok.length; i++) h = ((h << 5) + h + tok.charCodeAt(i)) >>> 0;
    v[h % dim] += 1;
  }
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export async function embed(text) {
  if (!KEY) return hashEmbed(text);
  try {
    const res = await fetch(`${BASE}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: text })
    });
    if (!res.ok) throw new Error(`Embeddings ${res.status}`);
    return (await res.json()).data[0].embedding;
  } catch (e) {
    console.error('embed failed, using local fallback:', e.message);
    return hashEmbed(text);
  }
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// Optional second layer for the abuse filter: asks the LLM whether a text is abusive.
// Fails open (returns false) on any error or when no key is set, so it never blocks honest users by accident.
export async function llmFlagsAbuse(text) {
  if (!KEY) return false;
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(4000),
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You moderate a campus grievance portal. Reply ONLY with JSON {"abusive": true|false}. ' +
              'abusive = true only for profanity, slurs, personal insults, threats or harassment aimed at people. ' +
              'Angry, blunt or critical complaints about facilities, food, services or staff work are NOT abusive.'
          },
          { role: 'user', content: text.slice(0, 1500) }
        ]
      })
    });
    if (!res.ok) return false;
    const out = JSON.parse((await res.json()).choices[0].message.content);
    return out.abusive === true;
  } catch {
    return false;
  }
}
