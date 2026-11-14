import pg from 'pg';
import Redis from 'ioredis';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
export const STREAM = 'complaints:new';
