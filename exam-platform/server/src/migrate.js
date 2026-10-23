import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from './db.js';
const dir = path.dirname(fileURLToPath(import.meta.url));
await pool.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
console.log('✔ Database schema ready');
await pool.end();
