import { config } from "./config";
import { getDb, now } from "./db";

export function portInRange(port: number): boolean {
  return Number.isInteger(port) && port >= config.publicPortMin && port <= config.publicPortMax;
}

export function portIsTaken(port: number, exceptTunnelId?: string): boolean {
  const row = exceptTunnelId
    ? (getDb().query("SELECT 1 AS found FROM tunnels WHERE public_port = ? AND id <> ?").get(port, exceptTunnelId) as
        | { found: number }
        | null)
    : (getDb().query("SELECT 1 AS found FROM tunnels WHERE public_port = ?").get(port) as { found: number } | null);
  return Boolean(row);
}

export function allocatePublicPort(preferred?: number, exceptTunnelId?: string): number {
  if (preferred !== undefined) {
    if (!portInRange(preferred)) {
      throw new Error(`端口必须在 ${config.publicPortMin}-${config.publicPortMax} 之间`);
    }
    if (portIsTaken(preferred, exceptTunnelId)) throw new Error("这个公网端口已被占用");
    return preferred;
  }
  const used = new Set(
    (getDb().query("SELECT public_port FROM tunnels").all() as Array<{ public_port: number }>).map((row) => row.public_port),
  );
  for (let port = config.publicPortMin; port <= config.publicPortMax; port += 1) {
    if (!used.has(port)) return port;
  }
  throw new Error("可用公网端口已经耗尽");
}

export function tunnelStatusLabel(enabled: number, status: string): string {
  if (!enabled) return "已停用";
  if (status === "online") return "在线";
  if (status === "error") return "异常";
  return "离线";
}

export function setupTimestamp(): number {
  return now();
}
