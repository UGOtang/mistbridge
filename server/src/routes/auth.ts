import { Hono } from "hono";
import { z } from "zod";
import QRCode from "qrcode";
import { config } from "../config";
import {
  checkPasswordStrength,
  decryptSecret,
  encryptSecret,
  hashPassword,
  safeEqualHash,
  sha256,
  verifyPassword,
} from "../crypto";
import { audit, getDb, now, type UserRow } from "../db";
import { clearSessionCookie, createSession, replaceSession, writeSessionCookie } from "../auth";
import {
  ApiError,
  checkOrigin,
  getClientIp,
  publicUser,
  requireCsrf,
  requireUser,
  type AppEnv,
} from "../http";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  otpauthUrl,
  verifyTotp,
} from "../totp";

export const authRoutes = new Hono<AppEnv>();

const loginSchema = z.object({
  username: z.string().trim().min(1, "请输入用户名").max(64, "用户名过长"),
  password: z.string().min(1, "请输入密码").max(128, "密码过长"),
  totp: z.string().trim().max(20).optional(),
  recoveryCode: z.string().trim().max(40).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码").max(128, "密码过长"),
  password: z.string().min(1, "请输入新密码").max(128, "密码过长"),
  confirmPassword: z.string().min(1, "请再次输入新密码").max(128, "密码过长"),
});

const totpCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "请输入 6 位动态验证码"),
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_IP_ATTEMPTS = 30;
const LOGIN_MAX_USER_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function rateLimitLogin(ip: string): void {
  const current = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= current) {
    loginAttempts.set(ip, { count: 1, resetAt: current + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > LOGIN_MAX_IP_ATTEMPTS) {
    throw new ApiError(429, "登录尝试过于频繁，请稍后再试", "rate_limited");
  }
}

function loadUserById(id: string): UserRow {
  const user = getDb().query("SELECT * FROM users WHERE id = ?").get(id) as UserRow | null;
  if (!user) throw new ApiError(404, "用户不存在", "not_found");
  return user;
}

function userFlags(user: UserRow) {
  return {
    mustChangePassword: Boolean(user.must_change_password),
    mustSetup2fa: !user.totp_enabled,
  };
}

function recordLoginFailure(user: UserRow | null, username: string, ip: string, reason: string): void {
  const db = getDb();
  if (user) {
    const failed = user.failed_attempts + 1;
    db.query("UPDATE users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?").run(
      failed,
      failed >= LOGIN_MAX_USER_ATTEMPTS ? Date.now() + LOGIN_LOCK_MS : user.locked_until,
      Date.now(),
      user.id,
    );
  }
  audit({
    actorId: user?.id ?? null,
    actorName: username || "unknown",
    action: "auth.login.failed",
    targetType: "user",
    targetId: user?.username ?? username,
    detail: reason,
    ip,
  });
}

authRoutes.post("/login", async (c) => {
  checkOrigin(c);
  const ip = getClientIp(c);
  rateLimitLogin(ip);
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "参数错误", "invalid_request");
  const { username, password, totp, recoveryCode } = parsed.data;
  const db = getDb();
  const user = db.query("SELECT * FROM users WHERE username = ?").get(username) as UserRow | null;

  if (!user || user.status !== "active") {
    recordLoginFailure(user, username, ip, "账号不存在或已停用");
    throw new ApiError(401, "用户名或密码错误", "invalid_credentials");
  }
  if (user.locked_until && user.locked_until > Date.now()) {
    throw new ApiError(423, "账号暂时锁定，请稍后再试", "account_locked");
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    recordLoginFailure(user, username, ip, "密码错误");
    throw new ApiError(401, "用户名或密码错误", "invalid_credentials");
  }

  if (user.totp_enabled) {
    const hasCode = Boolean(totp?.trim() || recoveryCode?.trim());
    if (!hasCode) {
      throw new ApiError(401, "请输入动态验证码", "totp_required");
    }
    let secondFactorOk = false;
    if (totp?.trim()) {
      const secret = user.totp_secret_enc ? decryptSecret(user.totp_secret_enc) : "";
      secondFactorOk = Boolean(secret) && verifyTotp(secret, totp.trim());
    } else if (recoveryCode?.trim()) {
      let codes: Array<{ hash: string; used: boolean }> = [];
      try {
        codes = JSON.parse(user.recovery_codes || "[]") as Array<{ hash: string; used: boolean }>;
      } catch {
        codes = [];
      }
      const normalized = normalizeRecoveryCode(recoveryCode);
      const matchIndex = codes.findIndex((code) => !code.used && safeEqualHash(normalized + ":" + user.id, code.hash));
      secondFactorOk = matchIndex >= 0;
      if (secondFactorOk) {
        const target = codes[matchIndex]!;
        target.used = true;
        db.query("UPDATE users SET recovery_codes = ?, updated_at = ? WHERE id = ?").run(
          JSON.stringify(codes),
          Date.now(),
          user.id,
        );
      }
    }
    if (!secondFactorOk) {
      recordLoginFailure(user, username, ip, "二次验证失败");
      throw new ApiError(401, "动态验证码或恢复码错误", "invalid_totp");
    }
  }

  db.query("UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?").run(
    Date.now(),
    Date.now(),
    user.id,
  );
  const session = await createSession(c, user.id, ip, c.req.header("user-agent") ?? "");
  writeSessionCookie(c, session.token);
  audit({
    actorId: user.id,
    actorName: user.username,
    action: "auth.login",
    targetType: "user",
    targetId: user.id,
    detail: user.totp_enabled ? "密码 + 2FA" : "首次登录（待完成安全设置）",
    ip,
  });
  const fresh = loadUserById(user.id);
  return c.json({
    user: publicUser(fresh),
    csrfToken: session.csrfToken,
    ...userFlags(fresh),
  });
});

authRoutes.get("/me", (c) => {
  const user = c.get("user");
  const session = c.get("session");
  if (!user || !session) throw new ApiError(401, "请先登录", "unauthenticated");
  return c.json({
    user: publicUser(user),
    csrfToken: c.get("csrfToken") ?? null,
    ...userFlags(user),
  });
});

authRoutes.post("/logout", (c) => {
  checkOrigin(c);
  const session = c.get("session");
  const user = c.get("user");
  if (session) {
    requireCsrf(c);
    getDb().query("DELETE FROM sessions WHERE id = ?").run(session.id);
    audit({
      actorId: user?.id,
      actorName: user?.username ?? "unknown",
      action: "auth.logout",
      targetType: "session",
      targetId: session.id,
      ip: getClientIp(c),
    });
  }
  clearSessionCookie(c);
  return c.body(null, 204);
});

authRoutes.post("/setup/password", async (c) => {
  checkOrigin(c);
  const user = requireUser(c);
  requireCsrf(c);
  if (!user.must_change_password) throw new ApiError(409, "密码已经修改过", "already_done");
  const parsed = passwordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "参数错误", "invalid_request");
  const { currentPassword, password, confirmPassword } = parsed.data;
  if (password !== confirmPassword) throw new ApiError(400, "两次输入的新密码不一致", "password_mismatch");
  if (!(await verifyPassword(currentPassword, user.password_hash))) {
    throw new ApiError(401, "当前密码不正确", "invalid_password");
  }
  const strength = checkPasswordStrength(password, user.username);
  if (!strength.ok) throw new ApiError(400, strength.message ?? "密码强度不足", "weak_password");
  const db = getDb();
  const passwordHash = await hashPassword(password);
  db.query("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?").run(
    passwordHash,
    Date.now(),
    user.id,
  );
  db.query("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(user.id, c.get("session")?.id ?? "");
  const fresh = loadUserById(user.id);
  const session = await replaceSession(c, fresh, getClientIp(c), c.req.header("user-agent") ?? "");
  audit({
    actorId: user.id,
    actorName: user.username,
    action: "auth.password.changed",
    targetType: "user",
    targetId: user.id,
    detail: "完成首次密码修改",
    ip: getClientIp(c),
  });
  return c.json({ user: publicUser(fresh), csrfToken: session.csrfToken, ...userFlags(fresh) });
});

authRoutes.post("/setup/2fa/init", async (c) => {
  checkOrigin(c);
  const user = requireUser(c);
  requireCsrf(c);
  if (user.must_change_password) throw new ApiError(403, "请先修改初始密码", "password_required");
  if (user.totp_enabled) throw new ApiError(409, "已启用双重验证", "already_enabled");
  const secret = generateTotpSecret();
  const uri = otpauthUrl(secret, user.username, "MistBridge");
  const qr = await QRCode.toDataURL(uri, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
    color: { dark: "#0a2c33", light: "#ffffff" },
  });
  getDb().query("UPDATE users SET totp_secret_enc = ?, updated_at = ? WHERE id = ?").run(
    encryptSecret(secret),
    Date.now(),
    user.id,
  );
  return c.json({ secret, otpauth: uri, qr });
});

authRoutes.post("/setup/2fa/enable", async (c) => {
  checkOrigin(c);
  const user = requireUser(c);
  requireCsrf(c);
  if (user.must_change_password) throw new ApiError(403, "请先修改初始密码", "password_required");
  if (user.totp_enabled) throw new ApiError(409, "已启用双重验证", "already_enabled");
  if (!user.totp_secret_enc) throw new ApiError(409, "请先获取验证码二维码", "totp_not_initialized");
  const parsed = totpCodeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "验证码格式错误", "invalid_request");
  const secret = decryptSecret(user.totp_secret_enc);
  if (!verifyTotp(secret, parsed.data.code)) throw new ApiError(401, "动态验证码错误，请重试", "invalid_totp");

  const recoveryCodes = generateRecoveryCodes(10);
  const stored = recoveryCodes.map((code) => ({
    hash: sha256(normalizeRecoveryCode(code) + ":" + user.id),
    used: false,
  }));
  getDb()
    .query(
      "UPDATE users SET totp_enabled = 1, recovery_codes = ?, totp_secret_enc = ?, updated_at = ? WHERE id = ?",
    )
    .run(JSON.stringify(stored), encryptSecret(secret), Date.now(), user.id);
  getDb().query("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(user.id, c.get("session")?.id ?? "");
  const fresh = loadUserById(user.id);
  audit({
    actorId: user.id,
    actorName: user.username,
    action: "auth.2fa.enabled",
    targetType: "user",
    targetId: user.id,
    detail: "启用 TOTP 双重验证",
    ip: getClientIp(c),
  });
  return c.json({
    user: publicUser(fresh),
    csrfToken: c.get("csrfToken") ?? "",
    recoveryCodes,
    ...userFlags(fresh),
  });
});

authRoutes.post("/profile/password", async (c) => {
  checkOrigin(c);
  const user = requireUser(c);
  requireCsrf(c);
  if (user.must_change_password || !user.totp_enabled) {
    throw new ApiError(403, "请先完成安全设置", "setup_required");
  }
  const parsed = passwordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "参数错误", "invalid_request");
  const { currentPassword, password, confirmPassword } = parsed.data;
  if (password !== confirmPassword) throw new ApiError(400, "两次输入的新密码不一致", "password_mismatch");
  if (!(await verifyPassword(currentPassword, user.password_hash))) {
    throw new ApiError(401, "当前密码不正确", "invalid_password");
  }
  const strength = checkPasswordStrength(password, user.username);
  if (!strength.ok) throw new ApiError(400, strength.message ?? "密码强度不足", "weak_password");
  const passwordHash = await hashPassword(password);
  getDb().query("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(passwordHash, Date.now(), user.id);
  const fresh = loadUserById(user.id);
  const session = await replaceSession(c, fresh, getClientIp(c), c.req.header("user-agent") ?? "");
  audit({
    actorId: user.id,
    actorName: user.username,
    action: "auth.password.changed",
    targetType: "user",
    targetId: user.id,
    detail: "用户主动修改密码",
    ip: getClientIp(c),
  });
  return c.json({ user: publicUser(fresh), csrfToken: session.csrfToken, ...userFlags(fresh) });
});

export function setupRecoveryCodeHashes(codes: string[], userId: string) {
  return codes.map((code) => ({ hash: sha256(normalizeRecoveryCode(code) + ":" + userId), used: false }));
}

export { config };
