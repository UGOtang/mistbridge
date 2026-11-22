import path from "node:path";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const publicBaseUrl = (process.env.PUBLIC_BASE_URL?.trim() || "http://47.96.73.32:20500").replace(/\/+$/, "");
const allowedOrigins = (
  process.env.APP_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? [
    publicBaseUrl,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]
).map((value) => value.replace(/\/+$/, ""));

export const config = {
  port: numberEnv("PORT", 4000),
  dataDir: process.env.DATA_DIR?.trim() || path.resolve(import.meta.dir, "..", "data"),
  publicBaseUrl,
  allowedOrigins,
  cookieSecure: process.env.COOKIE_SECURE === "1",
  cookieName: "mistbridge_session",
  sessionTtlMs: numberEnv("SESSION_TTL_HOURS", 12) * 60 * 60 * 1000,
  initialAdminUsername: process.env.INITIAL_ADMIN_USERNAME?.trim() || "admin",
  initialAdminPassword: required("INITIAL_ADMIN_PASSWORD"),
  frpAuthToken: required("FRP_AUTH_TOKEN"),
  frpPluginSecret: required("FRP_PLUGIN_SECRET"),
  encryptionKey: required("APP_ENCRYPTION_KEY"),
  frpServerAddr: process.env.FRP_SERVER_ADDR?.trim() || "47.96.73.32",
  frpControlPort: numberEnv("FRP_CONTROL_PORT", 23333),
  publicPortMin: numberEnv("PUBLIC_PORT_MIN", 21000),
  publicPortMax: numberEnv("PUBLIC_PORT_MAX", 21999),
  frpVersion: process.env.FRP_VERSION?.trim() || "0.72.0",
  downloadBaseUrl: (process.env.DOWNLOAD_BASE_URL?.trim() || `${publicBaseUrl}/downloads`).replace(/\/+$/, ""),
} as const;

if (config.publicPortMin > config.publicPortMax) {
  throw new Error("PUBLIC_PORT_MIN must be <= PUBLIC_PORT_MAX");
}

const key = Buffer.from(config.encryptionKey, "base64");
if (key.length !== 32) {
  throw new Error("APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
}
