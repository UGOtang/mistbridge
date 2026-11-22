import type { AuditLog, AuthResponse, DashboardData, Device, ServerMeta, Tunnel, User } from "./types";

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD" && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      method,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "无法连接服务，请检查网络后重试", "network_error");
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const body = (data ?? {}) as { error?: string; code?: string; details?: Record<string, unknown> };
    throw new ApiError(response.status, body.error ?? `请求失败（${response.status}）`, body.code, body.details);
  }
  return data as T;
}

async function requestText(path: string): Promise<{ text: string; filename: string | null }> {
  const response = await fetch(`/api${path}`, { credentials: "same-origin", headers: { Accept: "text/plain" } });
  if (!response.ok) {
    const text = await response.text();
    let body: { error?: string; code?: string } = {};
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      // ignore
    }
    throw new ApiError(response.status, body.error ?? `下载失败（${response.status}）`, body.code);
  }
  const disposition = response.headers.get("content-disposition");
  const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? null;
  return { text: await response.text(), filename };
}

export const api = {
  // Auth
  login: (payload: { username: string; password: string; totp?: string; recoveryCode?: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<AuthResponse>("/auth/me"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  setupPassword: (payload: { currentPassword: string; password: string; confirmPassword: string }) =>
    request<AuthResponse>("/auth/setup/password", { method: "POST", body: JSON.stringify(payload) }),
  setup2faInit: () =>
    request<{ secret: string; otpauth: string; qr: string }>("/auth/setup/2fa/init", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  setup2faEnable: (code: string) =>
    request<AuthResponse & { recoveryCodes: string[] }>("/auth/setup/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  changePassword: (payload: { currentPassword: string; password: string; confirmPassword: string }) =>
    request<AuthResponse>("/auth/profile/password", { method: "POST", body: JSON.stringify(payload) }),

  // Meta / dashboard
  meta: () => request<{ product: string; tagline: string; server: ServerMeta }>("/meta"),
  dashboard: () => request<DashboardData>("/dashboard"),

  // Devices
  devices: (q = "") => request<{ devices: Device[] }>(`/devices${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createDevice: (payload: { name: string; description: string; os: string }) =>
    request<{ device: Device; config: string; commands: string[] }>("/devices", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getDevice: (id: string) =>
    request<{
      device: Device;
      tunnels: Tunnel[];
      commands: string[];
      configAvailable: boolean;
      ownerName: string | null;
      canManage: boolean;
    }>(`/devices/${encodeURIComponent(id)}`),
  downloadDeviceConfig: (id: string) => requestText(`/devices/${encodeURIComponent(id)}/config`),
  rotateDevice: (id: string) =>
    request<{ device: Device; config: string; commands: string[] }>(`/devices/${encodeURIComponent(id)}/rotate-token`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  updateDevice: (id: string, payload: { name?: string; description?: string; os?: string; status?: string }) =>
    request<{ device: Device; needsAgentReload: boolean }>(`/devices/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteDevice: (id: string) =>
    request<{ ok: boolean }>(`/devices/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Tunnels
  tunnels: (deviceId = "") =>
    request<{ tunnels: Tunnel[] }>(`/tunnels${deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ""}`),
  createTunnel: (payload: {
    deviceId: string;
    name: string;
    localIp: string;
    localPort: number;
    publicPort?: number;
    enabled: boolean;
  }) => request<{ tunnel: Tunnel; needsAgentReload: boolean }>("/tunnels", { method: "POST", body: JSON.stringify(payload) }),
  updateTunnel: (
    id: string,
    payload: { name?: string; localIp?: string; localPort?: number; publicPort?: number; enabled?: boolean },
  ) =>
    request<{ tunnel: Tunnel; needsAgentReload: boolean }>(`/tunnels/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteTunnel: (id: string) =>
    request<{ ok: boolean; needsAgentReload: boolean }>(`/tunnels/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Team
  users: () => request<{ users: User[] }>("/users"),
  createUser: (payload: { username: string; displayName: string; role: string }) =>
    request<{ user: User; initialPassword: string }>("/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id: string, payload: { displayName?: string; role?: string; status?: string }) =>
    request<{ user: User }>(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  resetUserPassword: (id: string) =>
    request<{ initialPassword: string }>(`/users/${encodeURIComponent(id)}/reset-password`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  resetUser2fa: (id: string) =>
    request<{ ok: boolean }>(`/users/${encodeURIComponent(id)}/reset-2fa`, { method: "POST", body: JSON.stringify({}) }),
  deleteUser: (id: string) => request<{ ok: boolean }>(`/users/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Audit
  audit: (page = 1, pageSize = 20, q = "", action = "") => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q) params.set("q", q);
    if (action) params.set("action", action);
    return request<{ logs: AuditLog[]; total: number; page: number; pageSize: number }>(`/audit?${params.toString()}`);
  },
};
