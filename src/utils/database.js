import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'database.sqlite'));

export function initDatabase() {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS subscriptions (
            user_id TEXT PRIMARY KEY,
            plan TEXT,
            start_date TEXT,
            end_date TEXT,
            next_reminder_date TEXT,
            active INTEGER
        )
    `).run();
    console.log('Database initialized');
}

export default db;
