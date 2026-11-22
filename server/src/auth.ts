import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { config } from "./config";
import { encryptSecret, randomToken, sha256 } from "./crypto";
import { getDb, type SessionRow, type UserRow } from "./db";
import type { AppEnv } from "./http";

export interface SessionBundle {
  token: string;
  csrfToken: string;
  expiresAt: number;
}

export async function createSession(
  c: Context<AppEnv>,
  userId: string,
  ip: string,
  userAgent: string,
): Promise<SessionBundle> {
  const db = getDb();
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const id = `ses_${crypto.randomUUID()}`;
  const now = Date.now();
  const expiresAt = now + config.sessionTtlMs;
  db.query(
    `INSERT INTO sessions (id, user_id, token_hash, csrf_hash, csrf_enc, expires_at, created_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, sha256(token), sha256(csrfToken), encryptSecret(csrfToken), expiresAt, now, ip, userAgent.slice(0, 300));
  return { token, csrfToken, expiresAt };
}

export function writeSessionCookie(c: Context<AppEnv>, token: string): void {
  setCookie(c, config.cookieName, token, {
    httpOnly: true,
    sameSite: "Strict",
    secure: config.cookieSecure,
    path: "/",
    maxAge: Math.floor(config.sessionTtlMs / 1000),
  });
}

export function clearSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, config.cookieName, { path: "/" });
}

export function currentSession(c: Context<AppEnv>): { user: UserRow; session: SessionRow } | null {
  const token = getCookie(c, config.cookieName);
  if (!token) return null;
  const db = getDb();
  const session = db
    .query("SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .get(sha256(token), Date.now()) as SessionRow | null;
  if (!session) return null;
  const user = db.query("SELECT * FROM users WHERE id = ?").get(session.user_id) as UserRow | null;
  if (!user || user.status !== "active") return null;
  return { user, session };
}

export function deleteCurrentSession(c: Context<AppEnv>): void {
  const session = c.get("session");
  if (!session) return;
  getDb().query("DELETE FROM sessions WHERE id = ?").run(session.id);
}

export function revokeUserSessions(userId: string, exceptSessionId?: string): void {
  if (exceptSessionId) {
    getDb().query("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(userId, exceptSessionId);
  } else {
    getDb().query("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }
}

export async function replaceSession(
  c: Context<AppEnv>,
  user: UserRow,
  ip: string,
  userAgent: string,
): Promise<SessionBundle> {
  deleteCurrentSession(c);
  const bundle = await createSession(c, user.id, ip, userAgent);
  writeSessionCookie(c, bundle.token);
  return bundle;
}
