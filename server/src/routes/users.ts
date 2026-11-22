import { Hono } from "hono";
import { z } from "zod";
import { audit, getDb, now, type UserRow } from "../db";
import { generatePassword, hashPassword, randomId } from "../crypto";
import { ApiError, checkOrigin, getClientIp, requireAdmin, requireCsrf, type AppEnv } from "../http";
import { serializeUserRow } from "../serializers";
import { revokeUserSessions } from "../auth";

export const userRoutes = new Hono<AppEnv>();

const usernameSchema = z
  .string()
  .trim()
  .min(3, "用户名至少 3 个字符")
  .max(32, "用户名最多 32 个字符")
  .regex(/^[A-Za-z0-9_.-]+$/, "用户名仅支持字母、数字、下划线、点和中划线");

const createSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "请输入显示名称").max(60, "显示名称最多 60 个字符"),
  role: z.enum(["admin", "operator", "viewer"]).default("operator"),
});

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  role: z.enum(["admin", "operator", "viewer"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

function activeAdminCount(exceptId?: string): number {
  const row = exceptId
    ? (getDb()
        .query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active' AND id <> ?")
        .get(exceptId) as { count: number })
    : (getDb().query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'").get() as {
        count: number;
      });
  return row.count;
}

function loadUser(id: string): UserRow {
  const user = getDb().query("SELECT * FROM users WHERE id = ?").get(id) as UserRow | null;
  if (!user) throw new ApiError(404, "用户不存在", "not_found");
  return user;
}

userRoutes.get("/", (c) => {
  requireAdmin(c);
  const rows = getDb()
    .query(
      `SELECT u.*, (SELECT COUNT(*) FROM devices d WHERE d.owner_id = u.id) AS device_count
       FROM users u ORDER BY u.created_at ASC`,
    )
    .all() as Array<UserRow & { device_count: number }>;
  return c.json({ users: rows.map(serializeUserRow) });
});

userRoutes.post("/", async (c) => {
  checkOrigin(c);
  const actor = requireAdmin(c);
  requireCsrf(c);
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "参数错误", "invalid_request");
  const { username, displayName, role } = parsed.data;
  const db = getDb();
  const existing = db.query("SELECT id FROM users WHERE username = ?").get(username) as { id: string } | null;
  if (existing) throw new ApiError(409, "用户名已存在", "duplicate_username");
  const initialPassword = generatePassword(18);
  const passwordHash = await hashPassword(initialPassword);
  const id = randomId("usr", 9);
  const timestamp = now();
  db.query(
    `INSERT INTO users (id, username, display_name, role, status, password_hash, must_change_password, totp_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, 1, 0, ?, ?)`,
  ).run(id, username, displayName, role, passwordHash, timestamp, timestamp);
  audit({
    actorId: actor.id,
    actorName: actor.username,
    action: "user.created",
    targetType: "user",
    targetId: id,
    detail: `${username} / ${role}（首次登录需改密码并绑定 2FA）`,
    ip: getClientIp(c),
  });
  return c.json(
    {
      user: serializeUserRow({ ...loadUser(id), device_count: 0 }),
      initialPassword,
    },
    201,
  );
});

userRoutes.patch("/:id", async (c) => {
  checkOrigin(c);
  const actor = requireAdmin(c);
  requireCsrf(c);
  const target = loadUser(c.req.param("id"));
  const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "参数错误", "invalid_request");
  const fields = parsed.data;

  if (target.id === actor.id && (fields.role || fields.status)) {
    throw new ApiError(400, "不能修改自己的角色或状态", "self_lockout");
  }
  if (
    (fields.role && fields.role !== "admin" && target.role === "admin" && target.status === "active") ||
    (fields.status === "disabled" && target.role === "admin" && target.status === "active")
  ) {
    if (activeAdminCount(target.id) === 0) {
      throw new ApiError(409, "至少保留一个可用的管理员账号", "last_admin");
    }
  }
  const db = getDb();
  const timestamp = now();
  if (fields.displayName !== undefined) {
    db.query("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?").run(fields.displayName, timestamp, target.id);
  }
  if (fields.role !== undefined) {
    db.query("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").run(fields.role, timestamp, target.id);
  }
  if (fields.status !== undefined) {
    db.query("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").run(fields.status, timestamp, target.id);
    if (fields.status === "disabled") revokeUserSessions(target.id);
  }
  audit({
    actorId: actor.id,
    actorName: actor.username,
    action: "user.updated",
    targetType: "user",
    targetId: target.id,
    detail: JSON.stringify(fields),
    ip: getClientIp(c),
  });
  return c.json({ user: serializeUserRow({ ...loadUser(target.id), device_count: 0 }) });
});

userRoutes.post("/:id/reset-password", async (c) => {
  checkOrigin(c);
  const actor = requireAdmin(c);
  requireCsrf(c);
  const target = loadUser(c.req.param("id"));
  if (target.id === actor.id) throw new ApiError(400, "请使用个人设置修改自己的密码", "self_reset");
  const initialPassword = generatePassword(18);
  const passwordHash = await hashPassword(initialPassword);
  const db = getDb();
  db.query(
    `UPDATE users SET password_hash = ?, must_change_password = 1, totp_secret_enc = NULL,
      totp_enabled = 0, recovery_codes = '[]', failed_attempts = 0, locked_until = NULL, updated_at = ?
     WHERE id = ?`,
  ).run(passwordHash, Date.now(), target.id);
  revokeUserSessions(target.id);
  audit({
    actorId: actor.id,
    actorName: actor.username,
    action: "user.password.reset",
    targetType: "user",
    targetId: target.id,
    detail: "管理员重置密码并重置 2FA，所有会话已撤销",
    ip: getClientIp(c),
  });
  return c.json({ initialPassword });
});

userRoutes.post("/:id/reset-2fa", (c) => {
  checkOrigin(c);
  const actor = requireAdmin(c);
  requireCsrf(c);
  const target = loadUser(c.req.param("id"));
  if (target.id === actor.id) throw new ApiError(400, "不能在这里重置自己的 2FA", "self_reset");
  getDb()
    .query(
      "UPDATE users SET totp_secret_enc = NULL, totp_enabled = 0, recovery_codes = '[]', updated_at = ? WHERE id = ?",
    )
    .run(Date.now(), target.id);
  revokeUserSessions(target.id);
  audit({
    actorId: actor.id,
    actorName: actor.username,
    action: "user.2fa.reset",
    targetType: "user",
    targetId: target.id,
    detail: "管理员重置 2FA，用户下次登录需重新绑定",
    ip: getClientIp(c),
  });
  return c.json({ ok: true });
});

userRoutes.delete("/:id", (c) => {
  checkOrigin(c);
  const actor = requireAdmin(c);
  requireCsrf(c);
  const target = loadUser(c.req.param("id"));
  if (target.id === actor.id) throw new ApiError(400, "不能删除自己的账号", "self_delete");
  if (target.role === "admin" && target.status === "active" && activeAdminCount(target.id) === 0) {
    throw new ApiError(409, "至少保留一个可用的管理员账号", "last_admin");
  }
  getDb().query("DELETE FROM users WHERE id = ?").run(target.id);
  audit({
    actorId: actor.id,
    actorName: actor.username,
    action: "user.deleted",
    targetType: "user",
    targetId: target.id,
    detail: target.username,
    ip: getClientIp(c),
  });
  return c.json({ ok: true });
});
