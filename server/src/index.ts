import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { logger } from "hono/logger";
import { config } from "./config";
import { currentSession } from "./auth";
import { decryptSecret } from "./crypto";
import { initDb, purgeExpiredSessions } from "./db";
import { ApiError, type AppEnv } from "./http";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes, auditRoutes } from "./routes/dashboard";
import { deviceRoutes } from "./routes/devices";
import { frpPluginRoutes } from "./routes/frpPlugin";
import { tunnelRoutes } from "./routes/tunnels";
import { userRoutes } from "./routes/users";

await initDb();
purgeExpiredSessions();
setInterval(purgeExpiredSessions, 10 * 60 * 1000).unref?.();

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("/api/*", bodyLimit({ maxSize: 512 * 1024, onError: (c) => c.json({ error: "请求体过大", code: "body_too_large" }, 413) }));
app.use("/api/*", async (c, next) => {
  const found = currentSession(c);
  if (found) {
    c.set("user", found.user);
    c.set("session", found.session);
    try {
      c.set("csrfToken", decryptSecret(found.session.csrf_enc));
    } catch {
      // A bad/rotated encryption key should not authenticate the session.
      c.set("user", undefined);
      c.set("session", undefined);
    }
  }
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  await next();
});

app.get("/api/health", (c) => {
  try {
    // The meta route is mounted below; this endpoint is intentionally public.
    return c.json({ ok: true, service: "mistbridge-api", time: new Date().toISOString() });
  } catch {
    return c.json({ ok: false }, 503);
  }
});

app.get("/api/meta", (c) =>
  c.json({
    product: "MistBridge",
    tagline: "把内网服务，安全地带到公网。",
    server: {
      serverAddr: config.frpServerAddr,
      controlPort: config.frpControlPort,
      publicPortMin: config.publicPortMin,
      publicPortMax: config.publicPortMax,
      frpVersion: config.frpVersion,
      downloadBaseUrl: config.downloadBaseUrl,
    },
  }),
);

app.route("/api/auth", authRoutes);
app.route("/api/devices", deviceRoutes);
app.route("/api/tunnels", tunnelRoutes);
app.route("/api/users", userRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/audit", auditRoutes);
app.route("/internal/frp", frpPluginRoutes);

app.notFound((c) => c.json({ error: "接口不存在", code: "not_found" }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return new Response(
      JSON.stringify({
        error: err.message,
        code: err.code,
        ...(err.details ? { details: err.details } : {}),
      }),
      {
        status: err.status,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      },
    );
  }
  console.error("[api]", err);
  return new Response(JSON.stringify({ error: "服务器内部错误，请稍后再试", code: "internal_error" }), {
    status: 500,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
});

const server = Bun.serve({
  port: config.port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
});

console.log(`MistBridge API listening on :${server.port}`);
