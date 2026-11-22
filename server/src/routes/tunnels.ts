import { Hono } from "hono";
import { z } from "zod";
import { audit, getDb, now, type DeviceRow, type TunnelRow } from "../db";
import { randomId } from "../crypto";
import { allocatePublicPort, portInRange, portIsTaken } from "../ports";
import {
  ApiError,
  canManage,
  checkOrigin,
  getClientIp,
  requireCsrf,
  requireReady,
  type AppEnv,
} from "../http";
import { serializeTunnel } from "../serializers";

export const tunnelRoutes = new Hono<AppEnv>();

type TunnelJoined = TunnelRow & { device_name: string; owner_id: string; device_status: string };

function loadTunnel(c: { get: (key: "user") => import("../db").UserRow | undefined }, id: string): TunnelJoined {
  const user = c.get("user");
  if (!user) throw new ApiError(401, "请先登录", "unauthenticated");
  const row = getDb()
    .query(
      `SELECT t.*, d.name AS device_name, d.owner_id AS owner_id, d.status AS device_status
       FROM tunnels t JOIN devices d ON d.id = t.device_id WHERE t.id = ?`,
    )
    .get(id) as TunnelJoined | null;
  if (!row) throw new ApiError(404, "隧道不存在", "not_found");
  if (user.role !== "admin" && row.owner_id !== user.id) throw new ApiError(404, "隧道不存在", "not_found");
  return row;
}

function loadAccessibleDevice(user: import("../db").UserRow, id: string): DeviceRow {
  const device = getDb().query("SELECT * FROM devices WHERE id = ?").get(id) as DeviceRow | null;
  if (!device) throw new ApiError(404, "设备不存在", "not_found");
  if (user.role !== "admin" && device.owner_id !== user.id) throw new ApiError(404, "设备不存在", "not_found");
  return device;
}

const localHostSchema = z
  .string()
  .trim()
  .min(1, "请输入内网地址")
  .max(253, "内网地址过长")
  .regex(/^[A-Za-z0-9_.:-]+$/, "内网地址格式不正确");

const tunnelNameSchema = z.string().trim().min(2, "隧道名称至少 2 个字符").max(60, "隧道名称最多 60 个字符").regex(/^[A-Za-z0-9\u4e00-\u9fa5 _.-]+$/, "隧道名称包含不支持的字符");

const createSchema = z.object({
  deviceId: z.string().trim().min(1, "请选择设备"),
  name: tunnelNameSchema,
  localIp: localHostSchema.default("127.0.0.1"),
  localPort: z.coerce.number().int().min(1, "本地端口范围 1-65535").max(65535, "本地端口范围 1-65535"),
  publicPort: z.coerce.number().int().min(1).max(65535).optional(),
  enabled: z.boolean().optional().default(true),
});

const patchSchema = z.object({
  name: tunnelNameSchema.optional(),
  localIp: localHostSchema.optional(),
  localPort: z.coerce.number().int().min(1).max(65535).optional(),
  publicPort: z.coerce.number().int().min(1).max(65535).optional(),
  enabled: z.boolean().optional(),
});

tunnelRoutes.get("/", (c) => {
  const user = requireReady(c);
  const db = getDb();
  const params: unknown[] = [];
  let where = "WHERE 1=1";
  if (user.role !== "admin") {
    where += " AND d.owner_id = ?";
    params.push(user.id);
  }
  const deviceId = c.req.query("deviceId")?.trim();
  if (deviceId) {
    where += " AND t.device_id = ?";
    params.push(deviceId);
  }
  const rows = db
    .query(
      `SELECT t.*, d.name AS device_name FROM tunnels t
       JOIN devices d ON d.id = t.device_id
       ${where} ORDER BY t.public_port ASC LIMIT 500`,
    )
    .all(...(params as never[])) as Array<TunnelRow & { device_name: string }>;
  return c.json({ tunnels: rows.map((row) => serializeTunnel(row)) });
});

tunnelRoutes.post("/", async (c) => {
  checkOrigin(c);
  const user = requireReady(c);
  requireCsrf(c);
  if (!canManage(user)) throw new ApiError(403, "没有管理隧道的权限", "forbidden");
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "参数错误", "invalid_request");
  const fields = parsed.data;
  const device = loadAccessibleDevice(user, fields.deviceId);
  if (device.status !== "active") throw new ApiError(409, "设备已吊销，请先恢复设备", "device_revoked");

  const db = getDb();
  const duplicate = db
    .query("SELECT id FROM tunnels WHERE device_id = ? AND name = ?")
    .get(device.id, fields.name) as { id: string } | null;
  if (duplicate) throw new ApiError(409, "这个设备已经有同名隧道", "duplicate_name");

  let publicPort: number;
  try {
    publicPort = allocatePublicPort(fields.publicPort);
  } catch (error) {
    throw new ApiError(409, error instanceof Error ? error.message : "可用公网端口不足", "port_unavailable");
  }
  const id = randomId("tun", 9);
  const timestamp = now();
  try {
    db.query(
      `INSERT INTO tunnels (id, device_id, name, local_ip, local_port, public_port, protocol, enabled, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'tcp', ?, 'offline', ?, ?)`,
    ).run(
      id,
      device.id,
      fields.name,
      fields.localIp,
      fields.localPort,
      publicPort,
      fields.enabled ? 1 : 0,
      timestamp,
      timestamp,
    );
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new ApiError(409, "这个公网端口刚刚被占用，请重试", "port_unavailable");
    throw error;
  }
  const tunnel: TunnelJoined = {
    id,
    device_id: device.id,
    name: fields.name,
    local_ip: fields.localIp,
    local_port: fields.localPort,
    public_port: publicPort,
    protocol: "tcp",
    enabled: fields.enabled ? 1 : 0,
    status: "offline",
    last_connected_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    device_name: device.name,
    owner_id: device.owner_id,
    device_status: device.status,
  };
  audit({
    actorId: user.id,
    actorName: user.username,
    action: "tunnel.created",
    targetType: "tunnel",
    targetId: id,
    detail: `${device.name} → 127.0.0.1:${fields.localPort} @ ${publicPort}`,
    ip: getClientIp(c),
  });
  return c.json({ tunnel: serializeTunnel(tunnel), needsAgentReload: true }, 201);
});

tunnelRoutes.patch("/:id", async (c) => {
  checkOrigin(c);
  const user = requireReady(c);
  requireCsrf(c);
  if (!canManage(user)) throw new ApiError(403, "没有管理隧道的权限", "forbidden");
  const tunnel = loadTunnel(c, c.req.param("id"));
  const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "参数错误", "invalid_request");
  const fields = parsed.data;
  const db = getDb();
  const timestamp = now();
  const updates: string[] = [];
  const params: unknown[] = [];
  let requiresReload = false;
  let nextStatus = tunnel.status;

  if (fields.name !== undefined) {
    const duplicate = db
      .query("SELECT id FROM tunnels WHERE device_id = ? AND name = ? AND id <> ?")
      .get(tunnel.device_id, fields.name, tunnel.id) as { id: string } | null;
    if (duplicate) throw new ApiError(409, "这个设备已经有同名隧道", "duplicate_name");
    updates.push("name = ?");
    params.push(fields.name);
  }
  if (fields.localIp !== undefined) {
    updates.push("local_ip = ?");
    params.push(fields.localIp);
    requiresReload = true;
  }
  if (fields.localPort !== undefined) {
    updates.push("local_port = ?");
    params.push(fields.localPort);
    requiresReload = true;
  }
  if (fields.publicPort !== undefined && fields.publicPort !== tunnel.public_port) {
    if (!portInRange(fields.publicPort)) {
      throw new ApiError(400, "公网端口不在允许的范围内", "port_out_of_range");
    }
    if (portIsTaken(fields.publicPort, tunnel.id)) throw new ApiError(409, "这个公网端口已被占用", "port_unavailable");
    updates.push("public_port = ?");
    params.push(fields.publicPort);
    requiresReload = true;
  }
  if (fields.enabled !== undefined) {
    updates.push("enabled = ?");
    params.push(fields.enabled ? 1 : 0);
    requiresReload = true;
  }
  if (updates.length === 0) return c.json({ tunnel: serializeTunnel(tunnel), needsAgentReload: false });
  if (requiresReload) {
    nextStatus = "offline";
    updates.push("status = ?");
    params.push(nextStatus);
  }
  updates.push("updated_at = ?");
  params.push(timestamp);
  params.push(tunnel.id);
  db.query(`UPDATE tunnels SET ${updates.join(", ")} WHERE id = ?`).run(...(params as never[]));
  const fresh = loadTunnel(c, tunnel.id);
  audit({
    actorId: user.id,
    actorName: user.username,
    action: "tunnel.updated",
    targetType: "tunnel",
    targetId: tunnel.id,
    detail: "隧道配置已更新，需要在设备上重新加载 frpc 配置",
    ip: getClientIp(c),
  });
  return c.json({ tunnel: serializeTunnel(fresh), needsAgentReload: true });
});

tunnelRoutes.delete("/:id", (c) => {
  checkOrigin(c);
  const user = requireReady(c);
  requireCsrf(c);
  if (!canManage(user)) throw new ApiError(403, "没有管理隧道的权限", "forbidden");
  const tunnel = loadTunnel(c, c.req.param("id"));
  getDb().query("DELETE FROM tunnels WHERE id = ?").run(tunnel.id);
  audit({
    actorId: user.id,
    actorName: user.username,
    action: "tunnel.deleted",
    targetType: "tunnel",
    targetId: tunnel.id,
    detail: `${tunnel.device_name} / ${tunnel.name}`,
    ip: getClientIp(c),
  });
  return c.json({ ok: true, needsAgentReload: true });
});
