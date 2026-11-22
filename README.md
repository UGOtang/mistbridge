# MistBridge · 雾桥

MistBridge is a self-hosted, multi-device reverse-tunnel management platform. It combines a hardened **frp** edge with a **Bun + TypeScript** control plane and a **React** management console.

- Console: `http://47.96.73.32:20500/`
- frps Agent endpoint: `47.96.73.32:23333`
- Public tunnel pool: `21000–21999` (TCP)
- Product UI: “MistBridge / 雾桥 Tunnel Console”

## What it does

1. Register a local device in the console. It receives a unique device ID and secret token.
2. Download the generated `frpc.toml` and start the official `frpc` Agent on that device.
3. Create TCP tunnels (local host/port → allocated public port).
4. Reload the Agent configuration. Visitors can now reach the local service through the edge port.
5. Manage access, rotate credentials, revoke devices, inspect audit history, and manage team members.

## Architecture

```
Browser ──HTTPS/HTTP──▶ nginx (20500) ──▶ React static + /api → Bun API
                                                         │
Local service ◀── frpc Agent ──TLS──▶ frps (23333) ──▶ plugin auth (127.0.0.1:4000)
                                          │
                                          └── public TCP ports 21000–21999
```

### Security model

- Default `admin` account is seeded with a **one-time complex initial password**.
- First login is locked to the setup flow: change password → bind TOTP 2FA → save recovery codes. Normal APIs return `setup_required` until these steps finish.
- Argon2id password hashing; 12-hour opaque server-side sessions; HttpOnly + SameSite=Strict cookies; per-session CSRF token required on every mutating request.
- TOTP secrets are encrypted at rest using AES-256-GCM. Recovery codes are salted hashes and single-use.
- Per-device tokens are hashed and encrypted at rest. frps asks the MistBridge plugin on `Login`, `NewProxy`, `Ping` and `NewUserConn`; the plugin validates the device token and enforces the exact public-port ownership.
- A stolen global frp token alone cannot log in: the per-device plugin token is mandatory.
- Disabling/revoking a device or tunnel blocks new public connections.
- All security-relevant actions are written to an append-only audit log.
- Docker services run non-root, read-only, with all capabilities dropped. The edge is the only component with host networking (needed for the public port pool); the API is published only on loopback.

## Local development

Requirements: Bun 1.2+, Docker (for production), and the official frp 0.72.0 binaries for an end-to-end tunnel test.

```bash
bun install
cp server/.env.example server/.env
# edit server/.env with real local secrets

bun run dev:server     # Bun API on :4000
bun run dev:web        # Vite on :5173, proxies /api to :4000
```

Open `http://127.0.0.1:5173/login`. The first account uses `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` from `.env` and must complete security setup.

Run checks:

```bash
bun test               # TOTP, encryption, password policy
bun run typecheck      # server + web strict TypeScript
bun run build          # production React bundle
```

Build the deployable API bundle:

```bash
bun build server/src/index.ts --target=bun --outfile=server/dist/server.js --minify
```

## Deployment layout

The production deployment is under `/root/mistbridge`:

```
docker-compose.yml
.env                     # secrets, mode 600
frps.toml                # frps config, mode 600, owned by uid 1001
data/                    # SQLite volume, owned by uid 1001
deploy/backend/          # bundled server.js + Dockerfile
deploy/frps/             # frps binary + Dockerfile
deploy/nginx.conf
deploy/security-headers.conf
deploy/backup.sh
web/dist/                # React build (includes downloads/)
```

Start:

```bash
cd /root/mistbridge
docker compose build
docker compose up -d
docker compose ps
curl http://127.0.0.1:20500/api/health
```

The production env is intentionally not committed. See `deploy/.env.example`.

When replacing `web/dist` with a fresh Vite build, copy the `downloads/` folder into the new bundle (Vite clears its output directory). The download links are served from `web/dist/downloads/`.

### Key ports

| Port | Purpose | Exposure |
| --- | --- | --- |
| 20500 | React console + API | public |
| 23333 | frps Agent control | public |
| 21000–21999 | Tunnel public TCP ports | public |
| 4000 | Bun API | loopback only |

## Agent setup

1. In the console open a device → **下载 frpc 配置**.
2. Download the matching official archive from the Console settings or the edge `/downloads/` directory.
3. Start `frpc` with the generated config.

```bash
# Linux
curl -fL http://47.96.73.32:20500/downloads/frp_0.72.0_linux_amd64.tar.gz -o frp.tar.gz
tar -xzf frp.tar.gz
./frp_0.72.0_linux_amd64/frpc -c ./frpc.toml
```

The config contains the device secret. Never commit it or share it in chat. Use **轮换凭据** if it is exposed.

## Backups

`deploy/backup.sh` uses SQLite `VACUUM INTO` for a consistent online snapshot and archives the edge config. Cron runs daily at 03:50 with 14-day retention under `/root/mistbridge-backups`.

```bash
/root/mistbridge/deploy/backup.sh
```

## Operational notes

- The management console is currently served over **HTTP**. For long-term public use, bind a domain and enable HTTPS/TLS; then set `COOKIE_SECURE=1` and update `PUBLIC_BASE_URL` / `APP_ORIGINS`.
- `frps` still uses its built-in TLS for the Agent control/data channel (`transport.tls.force = true`), independent of the console's HTTP endpoint.
- `auth.additionalScopes` is intentionally **not** set in `frps.toml`: with frp 0.72 it propagates a token that the client rejects, causing a reconnect loop. The plugin `Ping` and `NewUserConn` callbacks still work without it.
- Tunnel changes (port, local target, enabled state) require re-downloading the Agent config and restarting `frpc`; the console warns about this. This is a deliberate trade-off to avoid exposing an Agent-side admin API.
- The public port pool must be reachable through the cloud firewall/security group.
- The initial admin password is a bootstrap credential only. It is invalidated by the forced password change.

## Verified

- First-login password change, TOTP setup, recovery-code login and single-use enforcement.
- Invalid device token and unallocated public port are rejected by the frps plugin.
- Real external TCP forwarding tested on the edge (`21000`).
- Disabling a tunnel or revoking a device blocks new public traffic.
- Desktop and 390 px mobile layouts, no page-level horizontal overflow.
- Device registration keeps input focus across parent re-renders; OS selection works with mouse, touch, Tab and arrow keys. Mobile uses a bottom sheet, single-column OS cards and 16 px inputs to avoid iOS focus zoom.
- Backup snapshot created successfully while the API stayed online.
