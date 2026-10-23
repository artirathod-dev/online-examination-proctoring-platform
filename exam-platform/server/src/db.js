import 'dotenv/config';
import pg from 'pg';
pg.types.setTypeParser(20, (v) => parseInt(v, 10)); // bigint -> number
pg.types.setTypeParser(1700, (v) => parseFloat(v)); // numeric -> number
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const q = (text, params) => pool.query(text, params).then((r) => r.rows);
