import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config();
const file = resolve(process.env.DATABASE_FILE || './server/data/rural-health.sqlite');
mkdirSync(dirname(file), { recursive: true });
const db = new DatabaseSync(file);
export default db;
