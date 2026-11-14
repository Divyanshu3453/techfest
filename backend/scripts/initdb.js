import 'dotenv/config';
import fs from 'fs';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
await pool.query(sql);
console.log('Schema ready');
await pool.end();
