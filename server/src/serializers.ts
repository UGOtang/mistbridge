import type { AuditRow, DeviceRow, TunnelRow, UserRow } from "./db";
import { config } from "./config";
import { publicUrl } from "./agentConfig";

export interface DeviceView {
  id: string;
  name: string;
  description: string;
  os: string;
  status: string;
  online: boolean;
  lastSeenAt: number | null;
  lastIp: string | null;
  tokenPrefix: string;
  ownerId: string;
  ownerName: string | null;
  tunnelCount: number;
  createdAt: number;
  updatedAt: number;
}

export function deviceOnline(row: Pick<DeviceRow, "status" | "last_seen_at">): boolean {
  return row.status === "active" && Boolean(row.last_seen_at && Date.now() - row.last_seen_at < 45_000);
}

export function serializeDevice(
  row: DeviceRow & { owner_name?: string | null; tunnel_count?: number | null },
): DeviceView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    os: row.os,
    status: row.status,
    online: deviceOnline(row),
    lastSeenAt: row.last_seen_at,
    lastIp: row.last_ip,
    tokenPrefix: row.token_prefix,
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? null,
    tunnelCount: Number(row.tunnel_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeTunnel(row: TunnelRow & { device_name?: string | null }) {
  return {
    id: row.id,
    deviceId: row.device_id,
    deviceName: row.device_name ?? null,
    name: row.name,
    localIp: row.local_ip,
    localPort: row.local_port,
    publicPort: row.public_port,
    protocol: row.protocol,
    enabled: Boolean(row.enabled),
    status: !row.enabled ? "disabled" : row.status,
    publicUrl: publicUrl(row.public_port),
    lastConnectedAt: row.last_connected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeAudit(row: AuditRow) {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    detail: row.detail,
    ip: row.ip,
    createdAt: row.created_at,
  };
}

export function serializeUserRow(row: UserRow & { device_count?: number | null }) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    totpEnabled: Boolean(row.totp_enabled),
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    deviceCount: Number(row.device_count ?? 0),
  };
}

export const serverMeta = {
  product: "MistBridge",
  serverAddr: config.frpServerAddr,
  controlPort: config.frpControlPort,
  publicPortMin: config.publicPortMin,
  publicPortMax: config.publicPortMax,
  frpVersion: config.frpVersion,
  downloadBaseUrl: config.downloadBaseUrl,
  baseUrl: config.publicBaseUrl,
};
