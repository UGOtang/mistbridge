import { Hono } from "hono";
import { config } from "../config";
import { getDb, type DeviceRow, type TunnelRow } from "../db";
import { requireReady, type AppEnv } from "../http";
import { deviceOnline, serializeAudit, serializeDevice, serverMeta } from "../serializers";

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get("/", (c) => {
  const user = requireReady(c);
  const db = getDb();
  const ownerFilter = user.role === "admin" ? "" : "WHERE d.owner_id = ?";
  const ownerParams = user.role === "admin" ? [] : [user.id];

  const devices = db
    .query(
      `SELECT d.*, u.display_name AS owner_name,
        (SELECT COUNT(*) FROM tunnels t WHERE t.device_id = d.id) AS tunnel_count
       FROM devices d JOIN users u ON u.id = d.owner_id
       ${ownerFilter} ORDER BY d.created_at DESC`,
    )
    .all(...(ownerParams as never[])) as Array<DeviceRow & { owner_name: string; tunnel_count: number }>;
  const tunnels = db
    .query(
      `SELECT t.*, d.name AS device_name FROM tunnels t
       JOIN devices d ON d.id = t.device_id
       ${user.role === "admin" ? "" : "WHERE d.owner_id = ?"}
       ORDER BY t.public_port ASC`,
    )
    .all(...(ownerParams as never[])) as Array<TunnelRow & { device_name: string }>;

  const onlineDevices = devices.filter((device) => deviceOnline(device)).length;
  const onlineTunnels = tunnels.filter((tunnel) => tunnel.enabled && tunnel.status === "online").length;
  const recent = db
    .query(
      user.role === "admin"
        ? "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 8"
        : "SELECT * FROM audit_logs WHERE actor_id = ? ORDER BY created_at DESC LIMIT 8",
    )
    .all(...(user.role === "admin" ? [] : [user.id]) as never[]) as Array<import("../db").AuditRow>;
  const users = user.role === "admin"
    ? (db.query("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count
    : null;

  return c.json({
    stats: {
      devices: devices.length,
      devicesOnline: onlineDevices,
      tunnels: tunnels.length,
      tunnelsOnline: onlineTunnels,
      portsUsed: tunnels.length,
      portsTotal: config.publicPortMax - config.publicPortMin + 1,
      users,
    },
    devices: devices.slice(0, 6).map(serializeDevice),
    tunnels: tunnels.slice(0, 6).map((tunnel) => ({
      id: tunnel.id,
      name: tunnel.name,
      deviceName: tunnel.device_name,
      publicPort: tunnel.public_port,
      localPort: tunnel.local_port,
      enabled: Boolean(tunnel.enabled),
      status: tunnel.enabled ? tunnel.status : "disabled",
      publicUrl: `http://${config.frpServerAddr}:${tunnel.public_port}`,
    })),
    recent: recent.map(serializeAudit),
    server: serverMeta,
  });
});

export const auditRoutes = new Hono<AppEnv>();

auditRoutes.get("/", (c) => {
  const user = requireReady(c);
  if (user.role !== "admin") return c.json({ logs: [], total: 0, page: 1, pageSize: 20 });
  const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? 20) || 20));
  const action = (c.req.query("action") ?? "").trim();
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  const params: unknown[] = [];
  let where = "WHERE 1=1";
  if (action) {
    where += " AND action = ?";
    params.push(action);
  }
  if (q) {
    where += " AND (actor_name LIKE ? OR detail LIKE ? OR target_id LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const db = getDb();
  const total = (db.query(`SELECT COUNT(*) AS count FROM audit_logs ${where}`).get(...(params as never[])) as { count: number }).count;
  const rows = db
    .query(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...(params as never[]), pageSize, (page - 1) * pageSize) as Array<import("../db").AuditRow>;
  return c.json({ logs: rows.map(serializeAudit), total, page, pageSize });
});

export const metaRoutes = new Hono();

metaRoutes.get("/", (c) =>
  c.json({
    product: "MistBridge",
    tagline: "把内网服务，安全地带到公网。",
    server: serverMeta,
  }),
);

metaRoutes.get("/health", (c) => {
  try {
    getDb().query("SELECT 1").get();
    return c.json({ ok: true, service: "mistbridge-api", time: new Date().toISOString() });
  } catch {
    return c.json({ ok: false }, 503);
  }
});
