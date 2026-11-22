export function formatDate(value: number | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  const now = Date.now();
  const diff = now - value;
  if (diff >= 0 && diff < 60_000) return "刚刚";
  if (diff >= 0 && diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff >= 0 && diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatFullDate(value: number | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function roleLabel(role: string): string {
  if (role === "admin") return "管理员";
  if (role === "operator") return "运维人员";
  return "只读成员";
}

export function osLabel(os: string): string {
  if (os === "windows") return "Windows";
  if (os === "macos") return "macOS";
  return "Linux";
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "MB";
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export function statusTone(status: string): "success" | "warning" | "danger" | "neutral" | "info" {
  if (status === "online" || status === "active") return "success";
  if (status === "offline" || status === "disabled" || status === "revoked") return "neutral";
  if (status === "error") return "danger";
  return "info";
}

export function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    "auth.login": "登录成功",
    "auth.login.failed": "登录失败",
    "auth.logout": "退出登录",
    "auth.password.changed": "修改密码",
    "auth.2fa.enabled": "启用 2FA",
    "system.bootstrap": "系统初始化",
    "device.created": "创建设备",
    "device.updated": "更新设备",
    "device.deleted": "删除设备",
    "device.connected": "设备上线",
    "device.login.rejected": "设备认证失败",
    "device.token.rotated": "轮换设备凭据",
    "device.status.changed": "调整设备状态",
    "device.config.download": "下载设备配置",
    "tunnel.created": "创建隧道",
    "tunnel.updated": "更新隧道",
    "tunnel.deleted": "删除隧道",
    "tunnel.connected": "隧道上线",
    "tunnel.visitor": "公网访问",
    "user.created": "创建成员",
    "user.updated": "更新成员",
    "user.password.reset": "重置成员密码",
    "user.2fa.reset": "重置成员 2FA",
    "user.deleted": "删除成员",
  };
  return labels[action] ?? action;
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Clipboard API is unavailable on insecure origins / denied permissions.
      // Fall through to the legacy selection-based copy path.
    }
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.width = "1px";
  area.style.height = "1px";
  area.style.padding = "0";
  area.style.border = "0";
  area.style.opacity = "0";
  area.style.pointerEvents = "none";
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, area.value.length);
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("copy command was rejected");
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
