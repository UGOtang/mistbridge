import { config } from "./config";
import type { DeviceRow, TunnelRow } from "./db";

export function proxyName(tunnelId: string): string {
  return `mb_${tunnelId}`;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function safeComment(value: string): string {
  return value.replace(/[\r\n\u0000-\u001f]/g, " ").slice(0, 100);
}

export function publicUrl(port: number): string {
  return `http://${config.frpServerAddr}:${port}`;
}

export function buildFrpcConfig(device: DeviceRow, tunnels: TunnelRow[], token: string): string {
  const lines: string[] = [
    `# MistBridge agent — ${safeComment(device.name)}`,
    `# Device ID: ${device.id}`,
    `# Public ports are managed by the MistBridge console.`,
    `serverAddr = ${tomlString(config.frpServerAddr)}`,
    `serverPort = ${config.frpControlPort}`,
    `user = ${tomlString(device.id)}`,
    ``,
    `auth.method = "token"`,
    `auth.token = ${tomlString(config.frpAuthToken)}`,
    ``,
    `loginFailExit = true`,
    `transport.tls.enable = true`,
    `transport.heartbeatInterval = 30`,
    `transport.heartbeatTimeout = 90`,
    `log.to = "console"`,
    `log.level = "info"`,
    `log.disablePrintColor = true`,
    ``,
    `# Per-device credential consumed by the MistBridge auth plugin.`,
    `metadatas.token = ${tomlString(token)}`,
    ``,
  ];

  for (const tunnel of tunnels) {
    if (!tunnel.enabled) continue;
    lines.push(
      `[[proxies]]`,
      `# ${safeComment(tunnel.name)} — public ${publicUrl(tunnel.public_port)}`,
      `name = ${tomlString(proxyName(tunnel.id))}`,
      `type = "tcp"`,
      `localIP = ${tomlString(tunnel.local_ip)}`,
      `localPort = ${tunnel.local_port}`,
      `remotePort = ${tunnel.public_port}`,
      ``,
    );
  }
  if (tunnels.filter((tunnel) => tunnel.enabled).length === 0) {
    lines.push(`# No enabled tunnels yet. Add one in the console, then download this file again.`);
  }
  return lines.join("\n");
}

export function buildAgentCommands(deviceName: string, os: string): string[] {
  const safeName = deviceName.replace(/[^A-Za-z0-9_.-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "mistbridge";
  const configFile = `${safeName}.toml`;
  const base = config.downloadBaseUrl;
  if (os === "windows") {
    return [
      `# Windows PowerShell`,
      `Invoke-WebRequest ${base}/frp_${config.frpVersion}_windows_amd64.zip -OutFile frp.zip`,
      `Expand-Archive frp.zip -DestinationPath . -Force`,
      `# Place ${configFile} next to frpc.exe, then run:`,
      `.\\frp_${config.frpVersion}_windows_amd64\\frpc.exe -c .\\${configFile}`,
    ];
  }
  if (os === "macos") {
    return [
      `# macOS (Apple Silicon / Intel)`,
      `curl -fL ${base}/frp_${config.frpVersion}_darwin_arm64.tar.gz -o frp.tar.gz # Apple Silicon`,
      `# curl -fL ${base}/frp_${config.frpVersion}_darwin_amd64.tar.gz -o frp.tar.gz # Intel`,
      `tar -xzf frp.tar.gz`,
      `./frp_${config.frpVersion}_darwin_arm64/frpc -c ./${configFile}`,
    ];
  }
  return [
    `# Linux (amd64)`,
    `curl -fL ${base}/frp_${config.frpVersion}_linux_amd64.tar.gz -o frp.tar.gz`,
    `tar -xzf frp.tar.gz`,
    `./frp_${config.frpVersion}_linux_amd64/frpc -c ./${configFile}`,
  ];
}
