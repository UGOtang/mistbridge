import { mkdirSync } from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { config } from "./config";
import { hashPassword } from "./crypto";

export type Role = "admin" | "operator" | "viewer";
export type UserStatus = "active" | "disabled";
export type DeviceStatus = "active" | "revoked";
export type TunnelStatus = "offline" | "online" | "error";

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  status: UserStatus;
  password_hash: string;
  must_change_password: number;
  totp_secret_enc: string | null;
  totp_enabled: number;
  recovery_codes: string;
  failed_attempts: number;
  locked_until: number | null;
  last_login_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  csrf_hash: string;
  csrf_enc: string;
  expires_at: number;
  created_at: number;
  ip: string;
  user_agent: string;
}

export interface DeviceRow {
  id: string;
  name: string;
  description: string;
  os: string;
  owner_id: string;
  token_hash: string;
  token_enc: string;
  token_prefix: string;
  status: DeviceStatus;
  last_seen_at: number | null;
  last_ip: string | null;
  created_at: number;
  updated_at: number;
}

export interface TunnelRow {
  id: string;
  device_id: string;
  name: string;
  local_ip: string;
  local_port: number;
  public_port: number;
  protocol: string;
  enabled: number;
  status: TunnelStatus;
  last_connected_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface AuditRow {
  id: number;
  actor_id: string | null;
  actor_name: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: string | null;
  ip: string | null;
  created_at: number;
}

let database: Database | null = null;

export function getDb(): Database {
  if (!database) throw new Error("Database has not been initialized");
  return database;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','operator','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  totp_secret_enc TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  recovery_codes TEXT NOT NULL DEFAULT '[]',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  csrf_enc TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT 'linux',
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  token_enc TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  last_seen_at INTEGER,
  last_ip TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_id);

CREATE TABLE IF NOT EXISTS tunnels (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  local_ip TEXT NOT NULL DEFAULT '127.0.0.1',
  local_port INTEGER NOT NULL,
  public_port INTEGER NOT NULL UNIQUE,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('offline','online','error')),
  last_connected_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tunnels_device ON tunnels(device_id);
CREATE INDEX IF NOT EXISTS idx_tunnels_public_port ON tunnels(public_port);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
`;

export async function initDb(): Promise<Database> {
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(config.dataDir, "tunnel.db");
  const db = new Database(file, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);

  const count = (db.query("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;
  if (count === 0) {
    const now = Date.now();
    const passwordHash = await hashPassword(config.initialAdminPassword);
    db.query(
      `INSERT INTO users
        (id, username, display_name, role, status, password_hash, must_change_password, totp_enabled, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', 'active', ?, 1, 0, ?, ?)`,
    ).run(`usr_${randomUUID()}`, config.initialAdminUsername, "平台管理员", passwordHash, now, now);
    db.query(
      `INSERT INTO audit_logs (actor_id, actor_name, action, target_type, target_id, detail, ip, created_at)
       VALUES (NULL, 'system', 'system.bootstrap', 'user', ?, ?, 'local', ?)`,
    ).run(config.initialAdminUsername, "初始化默认管理员，首次登录必须修改密码并绑定 2FA", now);
  }

  database = db;
  return db;
}

export function closeDb(): void {
  database?.close();
  database = null;
}

export function now(): number {
  return Date.now();
}

export interface AuditInput {
  actorId?: string | null;
  actorName: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: string | null;
  ip?: string | null;
}

export function audit(input: AuditInput): void {
  try {
    getDb()
      .query(
        `INSERT INTO audit_logs (actor_id, actor_name, action, target_type, target_id, detail, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.actorId ?? null,
        input.actorName.slice(0, 80),
        input.action.slice(0, 80),
        input.targetType ?? null,
        input.targetId ?? null,
        input.detail?.slice(0, 500) ?? null,
        input.ip ?? null,
        Date.now(),
      );
  } catch (error) {
    console.error("audit write failed", error);
  }
}

export function purgeExpiredSessions(): void {
  try {
    getDb().query("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  } catch {
    // ignore
  }
}

export function userIsOnline(lastSeenAt: number | null): boolean {
  return Boolean(lastSeenAt && Date.now() - lastSeenAt < 45_000);
}
