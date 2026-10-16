import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const filename = resolve(/* turbopackIgnore: true */ process.env.LABAI_AUTH_DB || "data/auth.sqlite");
const sessionAge = 60 * 60 * 24 * 7;

type UserRow = { id: number; email: string; name: string; password_hash: string };
type SessionRow = { id: number; email: string; name: string };

function database() {
  if (!existsSync(/* turbopackIgnore: true */ filename)) return null;
  return new DatabaseSync(filename);
}

function passwordMatches(password: string, encoded: string) {
  const [scheme, salt, expected] = encoded.split(":");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  if (expectedBuffer.length !== 64) return false;
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(expectedBuffer, actual);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function authenticate(email: string, password: string) {
  const db = database();
  if (!db) return { status: "unavailable" as const };
  try {
    const now = Math.floor(Date.now() / 1000);
    const key = createHash("sha256").update(email).digest("hex");
    db.prepare("DELETE FROM login_attempts WHERE attempted_at < ?").run(now - 900);
    const attempts = db.prepare("SELECT COUNT(*) AS count FROM login_attempts WHERE key = ?").get(key) as { count: number };
    if (attempts.count >= 5) return { status: "limited" as const };

    const user = db.prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?").get(email) as UserRow | undefined;
    const valid = user ? passwordMatches(password, user.password_hash) : false;
    if (!valid || !user) {
      db.prepare("INSERT INTO login_attempts (key, attempted_at) VALUES (?, ?)").run(key, now);
      return { status: "invalid" as const };
    }

    db.prepare("DELETE FROM login_attempts WHERE key = ?").run(key);
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
    const token = randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(tokenHash(token), user.id, now + sessionAge);
    return { status: "ok" as const, token, maxAge: sessionAge, user: { name: user.name, email: user.email } };
  } finally {
    db.close();
  }
}

export function getSession(token: string | undefined) {
  if (!token) return null;
  const db = database();
  if (!db) return null;
  try {
    return db.prepare(`SELECT users.id, users.email, users.name FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?`)
      .get(tokenHash(token), Math.floor(Date.now() / 1000)) as SessionRow | undefined || null;
  } finally {
    db.close();
  }
}

export function endSession(token: string | undefined) {
  if (!token) return;
  const db = database();
  if (!db) return;
  try {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  } finally {
    db.close();
  }
}
