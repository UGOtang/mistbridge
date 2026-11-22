import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate, formatFullDate, osLabel } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import type { Tunnel } from "../lib/types";
import { AgentSetup } from "../components/AgentSetup";
import { Icon } from "../components/Icon";
import { TunnelDialog } from "../components/TunnelDialog";
import { useToast } from "../components/Toast";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  ErrorBanner,
  Field,
  IconButton,
  InfoBanner,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from "../components/ui";

export function DeviceDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const { data, loading, error, reload } = useAsync(() => api.getDevice(id), [id]);
  const [tunnelOpen, setTunnelOpen] = useState(false);
  const [editingTunnel, setEditingTunnel] = useState<Tunnel | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editOs, setEditOs] = useState("linux");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotated, setRotated] = useState<{ config: string; commands: string[] } | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [tunnelToDelete, setTunnelToDelete] = useState<Tunnel | null>(null);

  if (loading && !data) {
    return (
      <Card>
        <Skeleton rows={7} />
      </Card>
    );
  }
  if (error && !data) {
    return (
      <Card>
        <EmptyState
          icon="alert"
          title="设备加载失败"
          description={error}
          action={<Button variant="secondary" onClick={() => navigate("/devices")}>返回设备列表</Button>}
        />
      </Card>
    );
  }
  if (!data) return null;

  const { device, tunnels, commands, canManage } = data;
  const revoked = device.status === "revoked";

  const openEdit = () => {
    setEditName(device.name);
    setEditDescription(device.description);
    setEditOs(device.os);
    setEditError("");
    setEditOpen(true);
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    setEditError("");
    if (editName.trim().length < 2) {
      setEditError("设备名称至少 2 个字符");
      return;
    }
    setSavingEdit(true);
    try {
      await api.updateDevice(device.id, { name: editName.trim(), description: editDescription.trim(), os: editOs });
      push("设备信息已更新", "success");
      setEditOpen(false);
      await reload();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "保存失败");
    } finally {
      setSavingEdit(false);
    }
  };

  const rotate = async () => {
    setRotating(true);
    try {
      const result = await api.rotateDevice(device.id);
      setRotated({ config: result.config, commands: result.commands });
      setRotateOpen(false);
      push("设备凭据已轮换，旧 Agent 将无法重连", "success");
      await reload();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "轮换失败", "error");
    } finally {
      setRotating(false);
    }
  };

  const changeStatus = async () => {
    setWorking(true);
    try {
      await api.updateDevice(device.id, { status: revoked ? "active" : "revoked" });
      push(revoked ? "设备已恢复，可以重新连接" : "设备已吊销，公网访问将被拒绝", "success");
      setStatusOpen(false);
      await reload();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "操作失败", "error");
    } finally {
      setWorking(false);
    }
  };

  const deleteDevice = async () => {
    setWorking(true);
    try {
      await api.deleteDevice(device.id);
      push("设备已删除", "success");
      navigate("/devices", { replace: true });
    } catch (err) {
      push(err instanceof ApiError ? err.message : "删除失败", "error");
      setWorking(false);
    }
  };

  const deleteTunnel = async () => {
    if (!tunnelToDelete) return;
    setWorking(true);
    try {
      await api.deleteTunnel(tunnelToDelete.id);
      push("隧道已删除，请重新加载 Agent 配置", "success");
      setTunnelToDelete(null);
      await reload();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "删除失败", "error");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="device-detail">
      <Link to="/devices" className="back-link"><Icon name="arrowLeft" size={15} /> 返回设备列表</Link>

      <header className="detail-header">
        <div className="detail-title">
          <span className={`device-os large os-${device.os}`}><Icon name={device.os === "windows" ? "monitor" : "server"} size={25} /></span>
          <div>
            <div className="detail-title-line">
              <h1>{device.name}</h1>
              <Badge tone={revoked ? "danger" : device.online ? "success" : "neutral"} dot={device.online || revoked}>
                {revoked ? "已吊销" : device.online ? "在线" : "离线"}
              </Badge>
            </div>
            <p>{osLabel(device.os)} · 设备 ID <code>{device.id}</code></p>
          </div>
        </div>
        {canManage && (
          <div className="detail-actions">
            <Button variant="secondary" icon="edit" onClick={openEdit}>编辑</Button>
            <Button variant="secondary" icon="key" onClick={() => setRotateOpen(true)}>轮换凭据</Button>
            <Button
              variant="secondary"
              className={revoked ? "restore-action" : "danger-outline"}
              icon={revoked ? "checkCircle" : "lock"}
              onClick={() => setStatusOpen(true)}
            >
              {revoked ? "恢复设备" : "吊销设备"}
            </Button>
            <IconButton icon="trash" label="删除设备" tone="danger" onClick={() => setDeleteOpen(true)} />
          </div>
        )}
      </header>

      {revoked && (
        <InfoBanner tone="warning">
          该设备已被吊销。Agent 无法重新登录，已有隧道不再接受新的公网连接。恢复设备或轮换凭据后可重新接入。
        </InfoBanner>
      )}

      <section className="detail-facts">
        <Card className="fact-card"><span>最近在线</span><strong>{formatDate(device.lastSeenAt)}</strong><small>{formatFullDate(device.lastSeenAt)}</small></Card>
        <Card className="fact-card"><span>最近 IP</span><strong className="mono-value">{device.lastIp ?? "—"}</strong><small>由 frps 报告</small></Card>
        <Card className="fact-card"><span>凭据前缀</span><strong className="mono-value">{device.tokenPrefix}••••</strong><small>完整 Token 仅在配置中</small></Card>
        <Card className="fact-card"><span>隧道</span><strong>{tunnels.length}</strong><small>{tunnels.filter((tunnel) => tunnel.status === "online").length} 条在线</small></Card>
      </section>

      <div className="detail-columns">
        <section className="detail-main">
          <Card className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-eyebrow">TUNNELS</p>
                <h3>隧道</h3>
              </div>
              {canManage && (
                <Button size="sm" icon="plus" onClick={() => { setEditingTunnel(null); setTunnelOpen(true); }} disabled={revoked}>
                  新建隧道
                </Button>
              )}
            </div>
            {tunnels.length === 0 ? (
              <EmptyState
                icon="route"
                title="还没有隧道"
                description="创建一条隧道，把本地服务映射到公网端口。"
                action={canManage ? <Button icon="plus" onClick={() => setTunnelOpen(true)} disabled={revoked}>创建隧道</Button> : undefined}
              />
            ) : (
              <div className="tunnel-table">
                <div className="tunnel-table-head">
                  <span>隧道</span><span>本地服务</span><span>公网入口</span><span>状态</span><span />
                </div>
                {tunnels.map((tunnel) => (
                  <div className="tunnel-table-row" key={tunnel.id}>
                    <div className="tunnel-name-cell">
                      <span className="tunnel-icon"><Icon name="route" size={16} /></span>
                      <div><strong>{tunnel.name}</strong><small>{tunnel.protocol.toUpperCase()} · {formatDate(tunnel.lastConnectedAt)} 访问</small></div>
                    </div>
                    <code className="mono-cell">{tunnel.localIp}:{tunnel.localPort}</code>
                    <div className="public-url-cell">
                      <code>{tunnel.publicUrl}</code>
                      <CopyButton value={tunnel.publicUrl} compact label="复制公网地址" />
                    </div>
                    <Badge tone={tunnel.status === "online" ? "success" : tunnel.status === "disabled" ? "neutral" : "warning"} dot={tunnel.status === "online"}>
                      {tunnel.status === "online" ? "在线" : tunnel.status === "disabled" ? "已停用" : "离线"}
                    </Badge>
                    <div className="row-actions">
                      {canManage && (
                        <>
                          <IconButton icon="edit" label="编辑隧道" onClick={() => { setEditingTunnel(tunnel); setTunnelOpen(true); }} />
                          <IconButton icon="trash" label="删除隧道" tone="danger" onClick={() => setTunnelToDelete(tunnel)} />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {!revoked && data.configAvailable && canManage && (
            <Card className="panel">
              <div className="panel-head">
                <div>
                  <p className="panel-eyebrow">AGENT SETUP</p>
                  <h3>在设备上运行 Agent</h3>
                </div>
                <Badge tone="info">frp {data.device.os === "windows" ? "Windows" : "Unix"}</Badge>
              </div>
              <p className="panel-copy">
                下载包含这台设备凭据的 <code>frpc.toml</code>，按下方命令启动。新建设备或修改隧道后，请重新下载配置并重启 Agent。
              </p>
              <AgentSetup deviceId={device.id} deviceName={device.name} os={device.os} commands={commands} />
            </Card>
          )}
        </section>

        <aside className="detail-side">
          <Card className="panel">
            <div className="panel-head"><div><p className="panel-eyebrow">IDENTITY</p><h3>设备信息</h3></div></div>
            <dl className="meta-list">
              <div><dt>所有者</dt><dd>{device.ownerName ?? "—"}</dd></div>
              <div><dt>创建时间</dt><dd>{formatFullDate(device.createdAt)}</dd></div>
              <div><dt>更新时间</dt><dd>{formatFullDate(device.updatedAt)}</dd></div>
              <div><dt>操作系统</dt><dd>{osLabel(device.os)}</dd></div>
              <div><dt>状态</dt><dd>{revoked ? "已吊销" : "正常"}</dd></div>
            </dl>
          </Card>
          <Card className="panel security-panel">
            <div className="security-head"><span className="security-icon"><Icon name="shield" size={18} /></span><div><strong>凭据安全</strong><span>Per-device credential</span></div></div>
            <p>每台设备使用独立 Token。轮换后旧 Agent 立即失效，需要下载新配置才能重连。</p>
            <div className="security-list">
              <span><Icon name="check" size={13} /> frps 插件校验设备 Token</span>
              <span><Icon name="check" size={13} /> 公网端口与设备强绑定</span>
              <span><Icon name="check" size={13} /> 所有操作写入审计日志</span>
            </div>
          </Card>
        </aside>
      </div>

      <TunnelDialog
        open={tunnelOpen}
        onClose={() => { setTunnelOpen(false); setEditingTunnel(null); }}
        onSaved={() => void reload()}
        devices={[device]}
        defaultDeviceId={device.id}
        tunnel={editingTunnel}
      />

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="编辑设备"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>取消</Button>
            <Button type="submit" form="edit-device-form" loading={savingEdit} icon="check">保存</Button>
          </>
        }
      >
        <form id="edit-device-form" className="form-stack" onSubmit={saveEdit}>
          {editError && <ErrorBanner message={editError} />}
          <Field label="设备名称" htmlFor="edit-device-name">
            <Input id="edit-device-name" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={60} />
          </Field>
          <Field label="描述" htmlFor="edit-device-desc">
            <Textarea id="edit-device-desc" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={3} maxLength={300} />
          </Field>
          <Field label="操作系统" htmlFor="edit-device-os">
            <Select id="edit-device-os" value={editOs} onChange={(event) => setEditOs(event.target.value)}>
              <option value="linux">Linux</option>
              <option value="windows">Windows</option>
              <option value="macos">macOS</option>
            </Select>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        onConfirm={() => void rotate()}
        loading={rotating}
        title="轮换设备凭据？"
        confirmLabel="轮换凭据"
        description="现有 Agent 会立即失去认证能力，所有隧道中断。你必须下载新配置并在设备上重启 Agent。"
      />

      <Modal
        open={Boolean(rotated)}
        onClose={() => setRotated(null)}
        title="新凭据已生成"
        subtitle="旧 Agent 已失效。请用新配置重启设备上的 Agent。"
        size="lg"
        footer={<Button onClick={() => setRotated(null)}>我已了解</Button>}
      >
        {rotated && (
          <AgentSetup
            deviceId={device.id}
            deviceName={device.name}
            os={device.os}
            commands={rotated.commands}
            initialConfig={rotated.config}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onConfirm={() => void changeStatus()}
        loading={working}
        tone={revoked ? "primary" : "danger"}
        title={revoked ? "恢复这台设备？" : "吊销这台设备？"}
        confirmLabel={revoked ? "恢复设备" : "吊销设备"}
        description={
          revoked
            ? "设备将恢复为正常状态，但 Agent 必须使用有效配置重新连接。"
            : "Agent 将无法重新登录，已有隧道会停止接受新的公网连接。你可以稍后恢复设备。"
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void deleteDevice()}
        loading={working}
        title="删除设备？"
        confirmLabel="永久删除"
        description={`这会删除「${device.name}」及其所有隧道，且无法恢复。建议先吊销设备并确认没有业务依赖。`}
      />

      <ConfirmDialog
        open={Boolean(tunnelToDelete)}
        onClose={() => setTunnelToDelete(null)}
        onConfirm={() => void deleteTunnel()}
        loading={working}
        title="删除隧道？"
        confirmLabel="删除隧道"
        description={`「${tunnelToDelete?.name ?? ""}」的公网入口将立即失效。请记得在设备上重新加载 Agent 配置。`}
      />
    </div>
  );
}
