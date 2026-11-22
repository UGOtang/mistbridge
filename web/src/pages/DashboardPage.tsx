import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useAuth } from "../lib/auth";
import { actionLabel, formatDate, osLabel } from "../lib/format";
import { Icon, type IconName } from "../components/Icon";
import { Badge, Button, Card, CopyButton, EmptyState, Skeleton } from "../components/ui";

function actionIcon(action: string): IconName {
  if (action.startsWith("device")) return "devices";
  if (action.startsWith("tunnel")) return "route";
  if (action.startsWith("auth")) return "shield";
  if (action.startsWith("user")) return "users";
  return "activity";
}

export function DashboardPage() {
  const { data, loading, error, reload } = useAsync(() => api.dashboard(), []);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role !== "viewer";

  if (loading && !data) {
    return (
      <div className="dashboard-skeleton">
        <div className="stat-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="stat-card">
              <Skeleton rows={2} />
            </Card>
          ))}
        </div>
        <Card className="panel"><Skeleton rows={5} /></Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <EmptyState
          icon="alert"
          title="总览数据加载失败"
          description={error}
          action={<Button variant="secondary" icon="refresh" onClick={() => void reload()}>重试</Button>}
        />
      </Card>
    );
  }

  if (!data) return null;
  const { stats, devices, recent, server } = data;
  const portPercent = Math.min(100, Math.round((stats.portsUsed / Math.max(1, stats.portsTotal)) * 100));

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">OPERATIONS OVERVIEW</p>
          <h2>连接，保持安静地运行。</h2>
          <p>你的边缘节点、设备和隧道状态都汇聚在这里。无需刷新页面，关键变化一眼可见。</p>
        </div>
        <div className="hero-actions">
          <Button variant="secondary" icon="refresh" onClick={() => void reload()}>刷新</Button>
          {canManage && <Button icon="plus" onClick={() => navigate("/devices?new=1")}>添加设备</Button>}
        </div>
      </section>

      <section className="stat-grid">
        <Card className="stat-card">
          <div className="stat-icon stat-icon-teal"><Icon name="devices" size={20} /></div>
          <div className="stat-main">
            <span>在线设备</span>
            <strong>{stats.devicesOnline}<small> / {stats.devices}</small></strong>
            <p>{stats.devices === 0 ? "还没有注册设备" : stats.devicesOnline > 0 ? "Agent 正在保持心跳" : "等待设备上线"}</p>
          </div>
          <span className={`stat-pulse ${stats.devicesOnline > 0 ? "on" : ""}`} />
        </Card>
        <Card className="stat-card">
          <div className="stat-icon stat-icon-blue"><Icon name="route" size={20} /></div>
          <div className="stat-main">
            <span>活跃隧道</span>
            <strong>{stats.tunnelsOnline}<small> / {stats.tunnels}</small></strong>
            <p>{stats.tunnels - stats.tunnelsOnline} 条待连接或已停用</p>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="stat-icon stat-icon-amber"><Icon name="globe" size={20} /></div>
          <div className="stat-main">
            <span>公网端口</span>
            <strong>{stats.portsUsed}<small> / {stats.portsTotal}</small></strong>
            <p>可用 {Math.max(0, stats.portsTotal - stats.portsUsed)} 个端口</p>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="stat-icon stat-icon-violet"><Icon name="users" size={20} /></div>
          <div className="stat-main">
            <span>{stats.users === null ? "账号安全" : "平台成员"}</span>
            <strong>{stats.users === null ? "已启用" : stats.users}</strong>
            <p>{stats.users === null ? "2FA 与密码策略生效" : "包含管理员与运维角色"}</p>
          </div>
        </Card>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <Card className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-eyebrow">EDGE NODE</p>
                <h3>边缘节点</h3>
              </div>
              <Badge tone="success" dot>运行中</Badge>
            </div>
            <div className="edge-detail-grid">
              <div className="edge-detail">
                <span>Agent 接入地址</span>
                <div className="copy-line"><code>{server.serverAddr}:{server.controlPort}</code><CopyButton value={`${server.serverAddr}:${server.controlPort}`} compact label="复制接入地址" /></div>
              </div>
              <div className="edge-detail">
                <span>公网端口范围</span>
                <code>{server.publicPortMin} – {server.publicPortMax}</code>
              </div>
              <div className="edge-detail">
                <span>frp 版本</span>
                <code>v{server.frpVersion}</code>
              </div>
              <div className="edge-detail">
                <span>默认访问域名</span>
                <code>{server.serverAddr}</code>
              </div>
            </div>
            <div className="port-usage">
              <div className="port-usage-head">
                <span>端口使用率</span>
                <strong>{portPercent}%</strong>
              </div>
              <div className="port-bar"><span style={{ width: `${Math.max(portPercent, stats.portsUsed > 0 ? 2 : 0)}%` }} /></div>
              <p>{stats.portsUsed} 个已分配 · {Math.max(0, stats.portsTotal - stats.portsUsed)} 个可用于新隧道</p>
            </div>
          </Card>

          <Card className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-eyebrow">DEVICE FLEET</p>
                <h3>设备状态</h3>
              </div>
              <Link to="/devices" className="panel-link">查看全部 <Icon name="chevronRight" size={14} /></Link>
            </div>
            {devices.length === 0 ? (
              <EmptyState
                icon="devices"
                title="还没有连接设备"
                description="注册第一台设备，下载专属 Agent 配置，即可开始建立隧道。"
                action={canManage ? <Button icon="plus" onClick={() => navigate("/devices?new=1")}>注册第一台设备</Button> : undefined}
              />
            ) : (
              <div className="device-mini-list">
                {devices.map((device) => (
                  <Link to={`/devices/${device.id}`} key={device.id} className="device-mini">
                    <span className={`device-os os-${device.os}`}>
                      <Icon name={device.os === "windows" ? "monitor" : "server"} size={18} />
                    </span>
                    <span className="device-mini-main">
                      <strong>{device.name}</strong>
                      <small>{osLabel(device.os)} · {device.tunnelCount} 条隧道</small>
                    </span>
                    <span className="device-mini-status">
                      <span className={`status-dot ${device.online ? "online" : ""}`} />
                      {device.online ? "在线" : device.status === "revoked" ? "已吊销" : "离线"}
                    </span>
                    <Icon name="chevronRight" size={15} className="device-mini-arrow" />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="dashboard-side">
          <Card className="panel activity-panel">
            <div className="panel-head">
              <div>
                <p className="panel-eyebrow">RECENT ACTIVITY</p>
                <h3>最近动态</h3>
              </div>
              <button type="button" className="icon-btn" onClick={() => void reload()} aria-label="刷新动态">
                <Icon name="refresh" size={15} />
              </button>
            </div>
            {recent.length === 0 ? (
              <p className="quiet-empty">还没有审计事件。</p>
            ) : (
              <div className="activity-list">
                {recent.map((item) => (
                  <div className="activity-item" key={item.id}>
                    <span className="activity-icon"><Icon name={actionIcon(item.action)} size={15} /></span>
                    <div>
                      <strong>{actionLabel(item.action)}</strong>
                      <small>{item.actorName}{item.detail ? ` · ${item.detail}` : ""}</small>
                    </div>
                    <time>{formatDate(item.createdAt)}</time>
                  </div>
                ))}
              </div>
            )}
            {recent.length > 0 && <Link to="/audit" className="panel-link activity-link">打开完整审计日志 <Icon name="arrowUpRight" size={13} /></Link>}
          </Card>

          <Card className="panel quick-panel">
            <div className="panel-head">
              <div>
                <p className="panel-eyebrow">QUICK START</p>
                <h3>建立第一条隧道</h3>
              </div>
            </div>
            <ol className="quick-steps">
              <li><span>01</span><div><strong>注册设备</strong><p>为每台本地设备生成独立凭据。</p></div></li>
              <li><span>02</span><div><strong>创建隧道</strong><p>指定本地端口与公网端口。</p></div></li>
              <li><span>03</span><div><strong>运行 Agent</strong><p>下载 frpc 配置并启动，即刻连通。</p></div></li>
            </ol>
            <Button variant="secondary" full icon="route" onClick={() => navigate("/tunnels")}>管理隧道</Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}
