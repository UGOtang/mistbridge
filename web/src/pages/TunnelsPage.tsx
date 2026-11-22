import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useAuth } from "../lib/auth";
import type { Tunnel } from "../lib/types";
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
  IconButton,
  InfoBanner,
  PageHeader,
  SearchInput,
  Skeleton,
  Toggle,
} from "../components/ui";

export function TunnelsPage() {
  const { data, loading, error, reload } = useAsync(
    async () => {
      const [tunnelResult, deviceResult] = await Promise.all([api.tunnels(), api.devices()]);
      return { tunnels: tunnelResult.tunnels, devices: deviceResult.devices };
    },
    [],
  );
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tunnel | null>(null);
  const [deleting, setDeleting] = useState<Tunnel | null>(null);
  const [working, setWorking] = useState(false);
  const { push } = useToast();
  const { user } = useAuth();
  const canManage = user?.role !== "viewer";

  const tunnels = data?.tunnels ?? [];
  const devices = data?.devices ?? [];
  const query = search.trim().toLowerCase();
  const filtered = query
    ? tunnels.filter(
        (tunnel) =>
          tunnel.name.toLowerCase().includes(query) ||
          (tunnel.deviceName ?? "").toLowerCase().includes(query) ||
          String(tunnel.publicPort).includes(query),
      )
    : tunnels;
  const online = tunnels.filter((tunnel) => tunnel.status === "online").length;

  const toggleTunnel = async (tunnel: Tunnel) => {
    try {
      await api.updateTunnel(tunnel.id, { enabled: !tunnel.enabled });
      push(tunnel.enabled ? "隧道已停用" : "隧道已启用，请重新加载 Agent 配置", "success");
      await reload();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "操作失败", "error");
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setWorking(true);
    try {
      await api.deleteTunnel(deleting.id);
      push("隧道已删除", "success");
      setDeleting(null);
      await reload();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "删除失败", "error");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="tunnels-page">
      <PageHeader
        eyebrow="TUNNEL FABRIC"
        title="隧道"
        description="每一条隧道都是一条受控的 TCP 通道。公网访问会先经过 frps 的设备认证与端口校验。"
        actions={
          <>
            <div className="header-chip"><span className="live-dot" />{online} 条在线</div>
            {canManage && <Button icon="plus" onClick={() => { setEditing(null); setDialogOpen(true); }}>创建隧道</Button>}
          </>
        }
      />

      <InfoBanner>
        管理端修改端口或启停状态后，需要在对应设备上重新下载并加载 Agent 配置；正在运行的旧 Agent 不会自动同步。
      </InfoBanner>

      <div className="list-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="搜索隧道、设备或公网端口…" />
        <span className="toolbar-count">{filtered.length} 条隧道</span>
      </div>

      {loading && !data ? (
        <Card><Skeleton rows={6} /></Card>
      ) : error && !data ? (
        <Card>
          <EmptyState
            icon="alert"
            title="隧道加载失败"
            description={error}
            action={<Button variant="secondary" icon="refresh" onClick={() => void reload()}>重试</Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="route"
            title={query ? "没有匹配的隧道" : "还没有隧道"}
            description={query ? "换一个关键词试试。" : "选择一台设备，把它本地的一个端口映射到公网。"}
            action={query ? <Button variant="secondary" onClick={() => setSearch("")}>清空搜索</Button> : canManage ? <Button icon="plus" onClick={() => { setEditing(null); setDialogOpen(true); }}>创建第一条隧道</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="table-card">
          <div className="data-table tunnel-list-table">
            <div className="data-table-head">
              <span>隧道</span><span>设备</span><span>本地服务</span><span>公网入口</span><span>状态</span><span>启用</span><span />
            </div>
            {filtered.map((tunnel) => (
              <div className="data-table-row" key={tunnel.id}>
                <div className="table-primary">
                  <span className="tunnel-icon"><Icon name="route" size={16} /></span>
                  <div><strong>{tunnel.name}</strong><small>{tunnel.protocol.toUpperCase()} · {formatDate(tunnel.lastConnectedAt)} 访问</small></div>
                </div>
                <div className="table-device">
                  <Link to={`/devices/${tunnel.deviceId}`}>{tunnel.deviceName ?? "—"}</Link>
                </div>
                <code className="mono-cell">{tunnel.localIp}:{tunnel.localPort}</code>
                <div className="public-url-cell">
                  <code>{tunnel.publicUrl}</code>
                  <CopyButton value={tunnel.publicUrl} compact label="复制公网地址" />
                </div>
                <Badge tone={tunnel.status === "online" ? "success" : tunnel.status === "disabled" ? "neutral" : "warning"} dot={tunnel.status === "online"}>
                  {tunnel.status === "online" ? "在线" : tunnel.status === "disabled" ? "已停用" : "离线"}
                </Badge>
                {canManage ? <Toggle checked={tunnel.enabled} onChange={() => void toggleTunnel(tunnel)} label={`${tunnel.enabled ? "停用" : "启用"}隧道 ${tunnel.name}`} /> : <span className="muted-cell">{tunnel.enabled ? "已启用" : "已停用"}</span>}
                <div className="row-actions">
                  {canManage && (
                    <>
                      <IconButton icon="edit" label="编辑隧道" onClick={() => { setEditing(tunnel); setDialogOpen(true); }} />
                      <IconButton icon="trash" label="删除隧道" tone="danger" onClick={() => setDeleting(tunnel)} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <TunnelDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSaved={() => void reload()}
        devices={devices}
        tunnel={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
        loading={working}
        title="删除隧道？"
        confirmLabel="删除隧道"
        description={`「${deleting?.name ?? ""}」的公网入口将立即失效，之后需要在设备上重新加载配置。`}
      />
    </div>
  );
}
