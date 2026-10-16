import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const email = process.env.SEED_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_PASSWORD;
const name = process.env.SEED_NAME?.trim() || "Labai Admin";

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12) {
  console.error("Set SEED_EMAIL and SEED_PASSWORD (at least 12 characters) before running the seeder.");
  process.exit(1);
}

const filename = resolve(process.env.LABAI_AUTH_DB || "data/auth.sqlite");
mkdirSync(dirname(filename), { recursive: true });
const db = new DatabaseSync(filename);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT NOT NULL,
    attempted_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS login_attempts_key_time ON login_attempts(key, attempted_at);
`);
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex");
db.prepare(`INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash`)
  .run(email, name, `scrypt:${salt}:${hash}`);
db.prepare("DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)").run(email);
db.close();
console.log(`Seeded account ${email}. Existing sessions for this account were revoked.`);
