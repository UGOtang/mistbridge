import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import { useToast } from "./Toast";
import type { Device, Tunnel } from "../lib/types";
import { Button, ErrorBanner, Field, InfoBanner, Input, Modal, Select, Toggle } from "./ui";
import { Icon } from "./Icon";

export function TunnelDialog({
  open,
  onClose,
  onSaved,
  devices,
  defaultDeviceId,
  tunnel,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  devices: Device[];
  defaultDeviceId?: string;
  tunnel?: Tunnel | null;
}) {
  const { push } = useToast();
  const editing = Boolean(tunnel);
  const [deviceId, setDeviceId] = useState(defaultDeviceId ?? devices[0]?.id ?? "");
  const [name, setName] = useState("");
  const [localIp, setLocalIp] = useState("127.0.0.1");
  const [localPort, setLocalPort] = useState("");
  const [publicPort, setPublicPort] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setDeviceId(tunnel?.deviceId ?? defaultDeviceId ?? devices[0]?.id ?? "");
    setName(tunnel?.name ?? "");
    setLocalIp(tunnel?.localIp ?? "127.0.0.1");
    setLocalPort(tunnel ? String(tunnel.localPort) : "");
    setPublicPort(tunnel ? String(tunnel.publicPort) : "");
    setEnabled(tunnel ? tunnel.enabled : true);
  }, [open, tunnel, defaultDeviceId, devices]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!deviceId) {
      setError("请选择设备");
      return;
    }
    if (name.trim().length < 2) {
      setError("请输入至少 2 个字符的隧道名称");
      return;
    }
    const localPortNumber = Number(localPort);
    if (!Number.isInteger(localPortNumber) || localPortNumber < 1 || localPortNumber > 65535) {
      setError("本地端口必须是 1–65535 之间的整数");
      return;
    }
    const publicPortNumber = publicPort.trim() ? Number(publicPort) : undefined;
    if (publicPortNumber !== undefined && (!Number.isInteger(publicPortNumber) || publicPortNumber < 1 || publicPortNumber > 65535)) {
      setError("公网端口必须是 1–65535 之间的整数");
      return;
    }
    if (!/^[A-Za-z0-9_.:-]+$/.test(localIp.trim())) {
      setError("内网地址格式不正确");
      return;
    }
    setBusy(true);
    try {
      if (editing && tunnel) {
        const result = await api.updateTunnel(tunnel.id, {
          name: name.trim(),
          localIp: localIp.trim(),
          localPort: localPortNumber,
          ...(publicPortNumber !== undefined ? { publicPort: publicPortNumber } : {}),
          enabled,
        });
        push("隧道配置已更新，请在设备上重新加载 Agent", "success");
        if (result.needsAgentReload) push("运行中的 Agent 仍使用旧配置", "info");
      } else {
        await api.createTunnel({
          deviceId,
          name: name.trim(),
          localIp: localIp.trim(),
          localPort: localPortNumber,
          ...(publicPortNumber !== undefined ? { publicPort: publicPortNumber } : {}),
          enabled,
        });
        push("隧道已创建，请重新下载并加载设备配置", "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存隧道失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "编辑隧道" : "创建隧道"}
      subtitle={editing ? "修改后需要在设备上重新加载 Agent 配置才能生效。" : "把设备上的本地端口映射到一个公网端口。"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>取消</Button>
          <Button type="submit" form="tunnel-form" loading={busy} icon={editing ? "check" : "plus"}>
            {editing ? "保存修改" : "创建隧道"}
          </Button>
        </>
      }
    >
      <form id="tunnel-form" className="form-stack" onSubmit={submit}>
        {error && <ErrorBanner message={error} />}
        <Field label="设备" htmlFor="tunnel-device">
          <Select
            id="tunnel-device"
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            disabled={editing}
          >
            {devices.length === 0 && <option value="">请先注册设备</option>}
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}{device.status === "revoked" ? "（已吊销）" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="隧道名称" htmlFor="tunnel-name" hint="仅用于控制台展示，不暴露在公网">
          <Input id="tunnel-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：家庭 NAS · Web UI" maxLength={60} />
        </Field>
        <div className="form-row">
          <Field label="内网地址" htmlFor="tunnel-local-ip" hint="通常保持 127.0.0.1">
            <Input id="tunnel-local-ip" value={localIp} onChange={(event) => setLocalIp(event.target.value)} placeholder="127.0.0.1" />
          </Field>
          <Field label="本地端口" htmlFor="tunnel-local-port">
            <Input id="tunnel-local-port" inputMode="numeric" value={localPort} onChange={(event) => setLocalPort(event.target.value.replace(/\D/g, ""))} placeholder="8080" />
          </Field>
        </div>
        <Field label="公网端口" htmlFor="tunnel-public-port" hint="留空则从平台端口池自动分配">
          <Input id="tunnel-public-port" inputMode="numeric" value={publicPort} onChange={(event) => setPublicPort(event.target.value.replace(/\D/g, ""))} placeholder="自动分配" />
        </Field>
        <div className="toggle-row">
          <div>
            <strong>启用隧道</strong>
            <span>停用后，frps 会拒绝新的公网访问。</span>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} label="启用隧道" />
        </div>
        <InfoBanner>
          <span>
            <Icon name="info" size={13} /> TCP 隧道会原样转发流量，本地服务需自行处理 HTTP/HTTPS 与鉴权。
          </span>
        </InfoBanner>
      </form>
    </Modal>
  );
}
