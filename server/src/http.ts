import type { Context, MiddlewareHandler } from "hono";
import type { SessionRow, UserRow } from "./db";
import { config } from "./config";
import { safeEqualHash } from "./crypto";

export interface AppEnv {
  Variables: {
    user?: UserRow;
    session?: SessionRow;
    csrfToken?: string;
  };
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, message: string, code = "request_failed", details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getClientIp(c: Context): string {
  const real = c.req.header("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 80);
  return "unknown";
}

export function checkOrigin(c: Context): void {
  const origin = c.req.header("origin");
  if (origin && !config.allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
    throw new ApiError(403, "请求来源不被允许", "bad_origin");
  }
  const site = c.req.header("sec-fetch-site");
  if (site === "cross-site") {
    throw new ApiError(403, "请求来源不被允许", "bad_origin");
  }
}

export function requireCsrf(c: Context<AppEnv>): void {
  const session = c.get("session");
  if (!session) throw new ApiError(401, "请先登录", "unauthenticated");
  const token = c.req.header("x-csrf-token")?.trim();
  if (!token || !safeEqualHash(token, session.csrf_hash)) {
    throw new ApiError(403, "安全校验失败，请刷新页面重试", "csrf_failed");
  }
}

export function requireUser(c: Context<AppEnv>): UserRow {
  const user = c.get("user");
  if (!user) throw new ApiError(401, "请先登录", "unauthenticated");
  if (user.status !== "active") throw new ApiError(403, "账号已停用", "account_disabled");
  return user;
}

export function requireReady(c: Context<AppEnv>): UserRow {
  const user = requireUser(c);
  if (user.must_change_password || !user.totp_enabled) {
    throw new ApiError(403, "请先完成安全设置", "setup_required", {
      mustChangePassword: Boolean(user.must_change_password),
      mustSetup2fa: !user.totp_enabled,
    });
  }
  return user;
}

export function requireAdmin(c: Context<AppEnv>): UserRow {
  const user = requireReady(c);
  if (user.role !== "admin") throw new ApiError(403, "需要管理员权限", "forbidden");
  return user;
}

export function canManage(user: UserRow): boolean {
  return user.role === "admin" || user.role === "operator";
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    status: user.status,
    totpEnabled: Boolean(user.totp_enabled),
    mustChangePassword: Boolean(user.must_change_password),
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
  };
}

export function authGuard(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    requireUser(c);
    await next();
  };
}
