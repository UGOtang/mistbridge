import { Hono } from "hono";
import { config } from "../config";
import { audit, getDb, now, type DeviceRow, type TunnelRow } from "../db";
import { safeEqual, safeEqualHash } from "../crypto";
import type { AppEnv } from "../http";

export const frpPluginRoutes = new Hono<AppEnv>();

interface PluginBody {
  content?: Record<string, unknown>;
}

function contentUser(value: unknown): { id: string; metas: Record<string, unknown> } | null {
  if (typeof value === "string") return { id: value, metas: {} };
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.user === "string" ? record.user : "";
  const metas = record.metas && typeof record.metas === "object" ? (record.metas as Record<string, unknown>) : {};
  return id ? { id, metas } : null;
}

function tokenFrom(metas: Record<string, unknown>): string {
  const value = metas.token ?? metas.deviceToken ?? metas.device_token;
  return typeof value === "string" ? value : "";
}

function clientIpFrom(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, 80);
}

function proxyTunnelId(proxyName: unknown): string | null {
  if (typeof proxyName !== "string") return null;
  const base = proxyName.includes(".") ? proxyName.slice(proxyName.lastIndexOf(".") + 1) : proxyName;
  return base.startsWith("mb_") ? base.slice(3) : null;
}

function allow() {
  return { reject: false, unchange: true };
}

function reject(reason: string) {
  return { reject: true, reject_reason: reason };
}

function findDevice(deviceId: string): DeviceRow | null {
  return getDb().query("SELECT * FROM devices WHERE id = ?").get(deviceId) as DeviceRow | null;
}

function validateDevice(deviceId: string, token: string): DeviceRow | null {
  if (!deviceId || !token) return null;
  const device = findDevice(deviceId);
  if (!device || device.status !== "active") return null;
  if (!safeEqualHash(token, device.token_hash)) return null;
  return device;
}

function markSeen(device: DeviceRow, ip: string): void {
  getDb()
    .query("UPDATE devices SET last_seen_at = ?, last_ip = COALESCE(NULLIF(?, ''), last_ip), updated_at = ? WHERE id = ?")
    .run(now(), ip, now(), device.id);
}

function findTunnelForDevice(tunnelId: string | null, deviceId: string): TunnelRow | null {
  if (!tunnelId) return null;
  const tunnel = getDb().query("SELECT * FROM tunnels WHERE id = ? AND device_id = ?").get(tunnelId, deviceId) as
    | TunnelRow
    | null;
  return tunnel;
}

function summarize(body: PluginBody): { op: string; content: Record<string, unknown> } {
  return {
    op: "",
    content: body.content && typeof body.content === "object" ? body.content : {},
  };
}

frpPluginRoutes.post("/:secret", async (c) => {
  if (!safeEqual(c.req.param("secret"), config.frpPluginSecret)) {
    return c.text("Not found", 404);
  }
  const op = (c.req.query("op") ?? "").trim();
  let body: PluginBody;
  try {
    body = (await c.req.json()) as PluginBody;
  } catch {
    return c.json(reject("invalid plugin payload"));
  }
  const content = summarize(body).content;

  try {
    if (op === "Login") {
      const user = contentUser(content.user);
      const token = tokenFrom((content.metas as Record<string, unknown> | undefined) ?? {});
      if (!user) return c.json(reject("invalid device identity"));
      const device = validateDevice(user.id, token);
      if (!device) {
        audit({
          actorName: "frp",
          action: "device.login.rejected",
          targetType: "device",
          targetId: user.id,
          detail: "设备凭据无效或设备已吊销",
          ip: clientIpFrom(content.client_address),
        });
        return c.json(reject("设备凭据无效或已吊销"));
      }
      markSeen(device, clientIpFrom(content.client_address));
      audit({
        actorId: device.owner_id,
        actorName: device.name,
        action: "device.connected",
        targetType: "device",
        targetId: device.id,
        detail: `Agent 已连接（${typeof content.os === "string" ? content.os : "unknown"}）`,
        ip: clientIpFrom(content.client_address),
      });
      return c.json(allow());
    }

    if (op === "NewProxy") {
      const user = contentUser(content.user);
      const token = user ? tokenFrom(user.metas) : "";
      const device = user ? validateDevice(user.id, token) : null;
      if (!user || !device) return c.json(reject("设备凭据无效或已吊销"));
      const tunnelId = proxyTunnelId(content.proxy_name);
      const tunnel = findTunnelForDevice(tunnelId, device.id);
      if (!tunnel || !tunnel.enabled) return c.json(reject("隧道不存在或已停用"));
      if (Number(content.remote_port) !== tunnel.public_port) return c.json(reject("公网端口未分配给该设备"));
      if (content.proxy_type && content.proxy_type !== "tcp") return c.json(reject("仅允许 TCP 隧道"));
      markSeen(device, "");
      const wasOnline = tunnel.status === "online";
      getDb().query("UPDATE tunnels SET status = 'online', last_connected_at = ?, updated_at = ? WHERE id = ?").run(
        now(),
        now(),
        tunnel.id,
      );
      if (!wasOnline) {
        audit({
          actorId: device.owner_id,
          actorName: device.name,
          action: "tunnel.connected",
          targetType: "tunnel",
          targetId: tunnel.id,
          detail: `${tunnel.name} @ ${tunnel.public_port}`,
          ip: clientIpFrom(content.client_address),
        });
      }
      return c.json(allow());
    }

    if (op === "CloseProxy") {
      const user = contentUser(content.user);
      const token = user ? tokenFrom(user.metas) : "";
      const device = user ? validateDevice(user.id, token) : null;
      if (!user || !device) return c.json(allow());
      const tunnelId = proxyTunnelId(content.proxy_name);
      const tunnel = findTunnelForDevice(tunnelId, device.id);
      if (tunnel) {
        getDb().query("UPDATE tunnels SET status = 'offline', updated_at = ? WHERE id = ?").run(now(), tunnel.id);
      }
      return c.json(allow());
    }

    if (op === "Ping") {
      const user = contentUser(content.user);
      const token = user ? tokenFrom(user.metas) : "";
      const device = user ? validateDevice(user.id, token) : null;
      if (!user || !device) return c.json(reject("设备凭据无效或已吊销"));
      markSeen(device, "");
      return c.json(allow());
    }

    if (op === "NewUserConn") {
      const user = contentUser(content.user);
      const token = user ? tokenFrom(user.metas) : "";
      const device = user ? validateDevice(user.id, token) : null;
      if (!user || !device) return c.json(reject("设备凭据无效或已吊销"));
      const tunnelId = proxyTunnelId(content.proxy_name);
      const tunnel = findTunnelForDevice(tunnelId, device.id);
      if (!tunnel || !tunnel.enabled) return c.json(reject("隧道已停用"));
      const last = tunnel.last_connected_at ?? 0;
      if (Date.now() - last > 10_000) {
        getDb().query("UPDATE tunnels SET last_connected_at = ? WHERE id = ?").run(now(), tunnel.id);
        audit({
          actorId: device.owner_id,
          actorName: device.name,
          action: "tunnel.visitor",
          targetType: "tunnel",
          targetId: tunnel.id,
          detail: `公网访问 ${tunnel.public_port}${typeof content.remote_addr === "string" ? ` ← ${content.remote_addr.slice(0, 80)}` : ""}`,
          ip: clientIpFrom(content.remote_addr),
        });
      }
      return c.json(allow());
    }

    return c.json(allow());
  } catch (error) {
    console.error("frp plugin error", error);
    return c.json(reject("internal auth error"));
  }
});
