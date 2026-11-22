export type Role = "admin" | "operator" | "viewer";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  status: "active" | "disabled";
  totpEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: number | null;
  createdAt?: number;
  deviceCount?: number;
}

export interface Device {
  id: string;
  name: string;
  description: string;
  os: "linux" | "windows" | "macos" | string;
  status: "active" | "revoked";
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

export interface Tunnel {
  id: string;
  deviceId: string;
  deviceName: string | null;
  name: string;
  localIp: string;
  localPort: number;
  publicPort: number;
  protocol: string;
  enabled: boolean;
  status: "online" | "offline" | "error" | "disabled";
  publicUrl: string;
  lastConnectedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface AuditLog {
  id: number;
  actorId: string | null;
  actorName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: number;
}

export interface ServerMeta {
  product: string;
  serverAddr: string;
  controlPort: number;
  publicPortMin: number;
  publicPortMax: number;
  frpVersion: string;
  downloadBaseUrl: string;
  baseUrl?: string;
}

export interface DashboardData {
  stats: {
    devices: number;
    devicesOnline: number;
    tunnels: number;
    tunnelsOnline: number;
    portsUsed: number;
    portsTotal: number;
    users: number | null;
  };
  devices: Device[];
  tunnels: Array<{
    id: string;
    name: string;
    deviceName: string;
    publicPort: number;
    localPort: number;
    enabled: boolean;
    status: string;
    publicUrl: string;
  }>;
  recent: AuditLog[];
  server: ServerMeta;
}

export interface AuthResponse {
  user: User;
  csrfToken: string;
  mustChangePassword: boolean;
  mustSetup2fa: boolean;
}
