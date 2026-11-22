import { Hono } from "hono";
import { z } from "zod";
import { buildAgentCommands, buildFrpcConfig } from "../agentConfig";
import { audit, getDb, now, type DeviceRow, type TunnelRow } from "../db";
import { decryptSecret, encryptSecret, randomId, randomToken, sha256 } from "../crypto";
import {
  ApiError,
  canManage,
  checkOrigin,
  getClientIp,
  requireCsrf,
  requireReady,
  type AppEnv,
} from "../http";
import { serializeDevice, serializeTunnel } from "../serializers";

export const deviceRoutes = new Hono<AppEnv>();

type DeviceJoined = DeviceRow & { owner_name: string | null; tunnel_count: number };

function loadDevice(c: { get: (key: "user") => import("../db").UserRow | undefined }, id: string): DeviceJoined {
  const user = c.get("user");
  if (!user) throw new ApiError(401, "请先登录", "unauthenticated");
  const row = getDb()
    .query(
      `SELECT d.*, u.display_name AS owner_name,
        (SELECT COUNT(*) FROM tunnels t WHERE t.device_id = d.id) AS tunnel_count
       FROM devices d JOIN users u ON u.id = d.owner_id WHERE d.id = ?`,
    )
    .get(id) as DeviceJoined | null;
  if (!row) throw new ApiError(404, "设备不存在", "not_found");
  if (user.role !== "admin" && row.owner_id !== user.id) {
    throw new ApiError(404, "设备不存在", "not_found");
  }
  return row;
}

const deviceNameSchema = z.string().trim().min(2, "设备名称至少 2 个字符").max(60, "设备名称最多 60 个字符").regex(/^[A-Za-z0-9\u4e00-\u9fa5 _.-]+$/, "设备名称包含不支持的字符");

const createSchema = z.object({
  name: deviceNameSchema,
  description: z.string().trim().max(300, "描述最多 300 个字符").optional().default(""),
  os: z.enum(["linux", "windows", "macos"]).default("linux"),
});

const patchSchema = z.object({
  name: deviceNameSchema.optional(),
  description: z.string().trim().max(300).optional(),
  os: z.enum(["linux", "windows", "macos"]).optional(),
  status: z.enum(["active", "revoked"]).optional(),
});

deviceRoutes.get("/", (c) => {
  const user = requireReady(c);
  const db = getDb();
  const search = (c.req.query("q") ?? "").trim();
  const params: unknown[] = [];
  let where = "";
  if (user.role !== "admin") {
    where = "WHERE d.owner_id = ?";
    params.push(user.id);
  }
  if (search) {
    where += `${where ? " AND" : "WHERE"} (d.name LIKE ? OR d.description LIKE ? OR d.id LIKE ?)`;
    const term = `%${search.slice(0, 80)}%`;
    params.push(term, term, term);
  }
  const rows = db
    .query(
      `SELECT d.*, u.display_name AS owner_name,
        (SELECT COUNT(*) FROM tunnels t WHERE t.device_id = d.id) AS tunnel_count
       FROM devices d JOIN users u ON u.id = d.owner_id
       ${where}
       ORDER BY d.created_at DESC LIMIT 200`,
    )
    .all(...(params as never[])) as DeviceJoined[];
  return c.json({ devices: rows.map(serializeDevice) });
});

deviceRoutes.post("/", async (c) => {
  checkOrigin(c);
  const user = requireReady(c);
  requireCsrf(c);
  if (!canManage(user)) throw new ApiError(403, "没有管理设备的权限", "forbidden");
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "参数错误", "invalid_request");
  const { name, description, os } = parsed.data;

  const db = getDb();
  const id = randomId("dev", 9);
  const token = randomToken(32);
  const tokenEnc = encryptSecret(token);
  const timestamp = now();
  db.query(
    `INSERT INTO devices (id, name, description, os, owner_id, token_hash, token_enc, token_prefix, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run(id, name, description, os, user.id, sha256(token), tokenEnc, token.slice(0, 10), timestamp, timestamp);

  const row: DeviceJoined = {
    id,
    name,
    description,
    os,
    owner_id: user.id,
    token_hash: sha256(token),
    token_enc: tokenEnc,
    token_prefix: token.slice(0, 10),
    status: "active",
    last_seen_at: null,
    last_ip: null,
    created_at: timestamp,
    updated_at: timestamp,
    owner_name: user.display_name,
    tunnel_count: 0,
  };
  audit({
    actorId: user.id,
    actorName: user.username,
    action: "device.created",
    targetType: "device",
    targetId: id,
    detail: `${name} (${os})`,
    ip: getClientIp(c),
  });
  return c.json(
    {
      device: serializeDevice(row),
      config: buildFrpcConfig(row, [], token),
      commands: buildAgentCommands(name, os),
    },
    201,
  );
});

deviceRoutes.get("/:id", (c) => {
  const user = requireReady(c);
  const device = loadDevice(c, c.req.param("id"));
  const tunnels = getDb()
    .query("SELECT * FROM tunnels WHERE device_id = ? ORDER BY public_port ASC")
    .all(device.id) as TunnelRow[];
  return c.json({
    device: serializeDevice(device),
    tunnels: tunnels.map((tunnel) => serializeTunnel(tunnel)),
    commands: buildAgentCommands(device.name, device.os),
    configAvailable: device.status === "active",
    ownerName: device.owner_name,
    canManage: canManage(user) && (user.role === "admin" || device.owner_id === user.id),
  });
});

deviceRoutes.get("/:id/config", (c) => {
  const user = requireReady(c);
  const device = loadDevice(c, c.req.param("id"));
  if (!canManage(user)) throw new ApiError(403, "只读成员不能下载设备凭据", "forbidden");
  if (device.status !== "active") throw new ApiError(409, "设备已吊销，请先恢复设备", "device_revoked");
  const token = decryptSecret(device.token_enc);
  const tunnels = getDb()
    .query("SELECT * FROM tunnels WHERE device_id = ? ORDER BY public_port ASC")
    .all(device.id) as TunnelRow[];
  const config = buildFrpcConfig(device, tunnels, token);
  audit({
    actorId: user.id,
    actorName: user.username,
    action: "device.config.download",
    targetType: "device",
    targetId: device.id,
    detail: "下载设备配置（含凭据）",
    ip: getClientIp(c),
  });
  const safeFilename = device.name.replace(/[^A-Za-z0-9_.-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "mistbridge";
  const filename = `${safeFilename}.toml`;
  return c.body(config, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
});

deviceRoutes.post("/:id/rotate-token", (c) => {
  checkOrigin(c);
  const user = requireReady(c);
  requireCsrf(c);
  if (!canManage(user)) throw new ApiError(403, "没有管理设备的权限", "forbidden");
  const device = loadDevice(c, c.req.param("id"));
  const token = randomToken(32);
  const timestamp = now();
  const db = getDb();
  db.query(
    `UPDATE devices SET token_hash = ?, token_enc = ?, token_prefix = ?, status = 'active', last_seen_at = NULL, last_ip = NULL, updated_at = ? WHERE id = ?`,
  ).run(sha256(token), encryptSecret(token), token.slice(0, 10), timestamp, device.id);
  db.query("UPDATE tunnels SET status = 'offline', updated_at = ? WHERE device_id = ?").run(timestamp, device.id);
  const tunnels = db
    .query("SELECT * FROM tunnels WHERE device_id = ? ORDER BY public_port ASC")
    .all(device.id) as TunnelRow[];
  audit({
    actorId: user.id,
    actorName: user.username,
    action: "device.token.rotated",
    targetType: "device",
    targetId: device.id,
    detail: "设备凭据已轮换，旧 Agent 将无法重连",
    ip: getClientIp(c),
  });
  const fresh = { ...device, status: "active" as const, last_seen_at: null, last_ip: null, updated_at: timestamp, token_prefix: token.slice(0, 10) };
  return c.json({
    device: serializeDevice(fresh),
    config: buildFrpcConfig(fresh, tunnels, token),
    commands: buildAgentCommands(device.name, device.os),
  });
});

deviceRoutes.patch("/:id", async (c) => {
  checkOrigin(c);
  const user = requireReady(c);
  requireCsrf(c);
  if (!canManage(user)) throw new ApiError(403, "没有管理设备的权限", "forbidden");
  const device = loadDevice(c, c.req.param("id"));
  const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "参数错误", "invalid_request");
  const db = getDb();
  const timestamp = now();
  const fields = parsed.data;
  if (fields.name !== undefined) db.query("UPDATE devices SET name = ?, updated_at = ? WHERE id = ?").run(fields.name, timestamp, device.id);
  if (fields.description !== undefined) db.query("UPDATE devices SET description = ?, updated_at = ? WHERE id = ?").run(fields.description, timestamp, device.id);
  if (fields.os !== undefined) db.query("UPDATE devices SET os = ?, updated_at = ? WHERE id = ?").run(fields.os, timestamp, device.id);
  if (fields.status !== undefined) {
    db.query("UPDATE devices SET status = ?, updated_at = ? WHERE id = ?").run(fields.status, timestamp, device.id);
    if (fields.status === "revoked") {
      db.query("UPDATE tunnels SET status = 'offline', updated_at = ? WHERE device_id = ?").run(timestamp, device.id);
    }
  }
  const fresh = loadDevice(c, device.id);
  audit({
    actorId: user.id,
    actorName: user.username,
    action: fields.status ? "device.status.changed" : "device.updated",
    targetType: "device",
    targetId: device.id,
    detail: fields.status ? `状态调整为 ${fields.status}` : "设备信息已更新",
    ip: getClientIp(c),
  });
  return c.json({ device: serializeDevice(fresh), needsAgentReload: fields.status !== undefined });
});

deviceRoutes.delete("/:id", (c) => {
  checkOrigin(c);
  const user = requireReady(c);
  requireCsrf(c);
  if (!canManage(user)) throw new ApiError(403, "没有管理设备的权限", "forbidden");
  const device = loadDevice(c, c.req.param("id"));
  getDb().query("DELETE FROM devices WHERE id = ?").run(device.id);
  audit({
    actorId: user.id,
    actorName: user.username,
    action: "device.deleted",
    targetType: "device",
    targetId: device.id,
    detail: device.name,
    ip: getClientIp(c),
  });
  return c.json({ ok: true });
});
