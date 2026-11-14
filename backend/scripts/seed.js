import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { DEPARTMENTS } from '../src/constants.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
await pool.query(
  `INSERT INTO users (name, enrollment, password_hash, role)
   VALUES ('Administrator', $1, $2, 'admin') ON CONFLICT (enrollment) DO NOTHING`,
  [process.env.ADMIN_ENROLLMENT || 'admin', adminHash]
);

const headHash = await bcrypt.hash(process.env.HEAD_DEFAULT_PASSWORD || 'head123', 10);
for (const dept of DEPARTMENTS) {
  const slug = dept.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '');
  await pool.query(
    `INSERT INTO users (name, enrollment, password_hash, role, head_department)
     VALUES ($1, $2, $3, 'dept_head', $4) ON CONFLICT (enrollment) DO NOTHING`,
    [`${dept} Head`, `head-${slug}`, headHash, dept]
  );
}
console.log('Seeded admin + one department head per department (login id: head-<department>, e.g. head-electrical)');
await pool.end();
