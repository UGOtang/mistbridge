import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { Icon } from "../components/Icon";
import { Badge, Button, Card, CopyButton, EmptyState, PageHeader, Skeleton } from "../components/ui";

export function SettingsPage() {
  const { data, loading, error, reload } = useAsync(() => api.meta(), []);

  if (loading && !data) {
    return <Card><Skeleton rows={8} /></Card>;
  }
  if (error && !data) {
    return (
      <Card>
        <EmptyState
          icon="alert"
          title="平台信息加载失败"
          description={error}
          action={<Button variant="secondary" onClick={() => void reload()}>重试</Button>}
        />
      </Card>
    );
  }
  if (!data) return null;

  const { server } = data;
  const downloads = [
    { os: "Linux · amd64", file: `frp_${server.frpVersion}_linux_amd64.tar.gz`, icon: "server" as const },
    { os: "Windows · amd64", file: `frp_${server.frpVersion}_windows_amd64.zip`, icon: "monitor" as const },
    { os: "macOS · Apple Silicon", file: `frp_${server.frpVersion}_darwin_arm64.tar.gz`, icon: "monitor" as const },
    { os: "macOS · Intel", file: `frp_${server.frpVersion}_darwin_amd64.tar.gz`, icon: "monitor" as const },
  ];

  return (
    <div className="settings-page">
      <PageHeader
        eyebrow="PLATFORM"
        title="平台设置"
        description="边缘节点和 Agent 的接入参数。设备凭据由控制台单独生成，不在此处展示。"
      />

      <div className="settings-grid">
        <section className="settings-main">
          <Card className="panel">
            <div className="panel-head">
              <div><p className="panel-eyebrow">EDGE ENDPOINT</p><h3>边缘节点参数</h3></div>
              <Badge tone="success" dot>在线</Badge>
            </div>
            <div className="settings-rows">
              <div className="settings-row">
                <span>Agent 接入地址</span>
                <div className="copy-line"><code>{server.serverAddr}:{server.controlPort}</code><CopyButton value={`${server.serverAddr}:${server.controlPort}`} compact label="复制" /></div>
              </div>
              <div className="settings-row">
                <span>公网端口池</span>
                <code>{server.publicPortMin} – {server.publicPortMax}</code>
              </div>
              <div className="settings-row">
                <span>frp 版本</span>
                <code>v{server.frpVersion}</code>
              </div>
              <div className="settings-row">
                <span>控制台地址</span>
                <code>{server.baseUrl ?? `${window.location.protocol}//${window.location.host}`}</code>
              </div>
            </div>
          </Card>

          <Card className="panel">
            <div className="panel-head">
              <div><p className="panel-eyebrow">ARCHITECTURE</p><h3>流量如何工作</h3></div>
            </div>
            <div className="architecture">
              <div className="arch-node">
                <span className="arch-icon"><Icon name="devices" size={20} /></span>
                <strong>本地设备</strong>
                <small>frpc Agent</small>
              </div>
              <div className="arch-link"><span>TLS</span><i /></div>
              <div className="arch-node arch-node-accent">
                <span className="arch-icon"><Icon name="shield" size={20} /></span>
                <strong>MistBridge Edge</strong>
                <small>frps + Auth plugin</small>
              </div>
              <div className="arch-link"><span>TCP</span><i /></div>
              <div className="arch-node">
                <span className="arch-icon"><Icon name="globe" size={20} /></span>
                <strong>公网访问</strong>
                <small>Server:Port</small>
              </div>
            </div>
            <p className="panel-copy">
              公网请求先到达 frps，由 MistBridge 认证插件校验设备凭据和端口归属，再通过 TLS 控制链路转发到设备上的 frpc，最终访问本地服务。
            </p>
          </Card>

          <Card className="panel">
            <div className="panel-head">
              <div><p className="panel-eyebrow">AGENT DOWNLOADS</p><h3>Agent 资源</h3></div>
              <Badge tone="info">frp v{server.frpVersion}</Badge>
            </div>
            <p className="panel-copy">官方 frp 二进制资源，由平台镜像分发。下载后请配合设备专属配置使用。</p>
            <div className="download-grid">
              {downloads.map((item) => (
                <a key={item.file} className="download-item" href={`${server.downloadBaseUrl}/${item.file}`} target="_blank" rel="noreferrer">
                  <span className="download-icon"><Icon name={item.icon} size={19} /></span>
                  <span><strong>{item.os}</strong><small>{item.file}</small></span>
                  <Icon name="download" size={17} />
                </a>
              ))}
            </div>
          </Card>
        </section>

        <aside className="settings-side">
          <Card className="panel">
            <div className="panel-head"><div><p className="panel-eyebrow">SECURITY</p><h3>安全策略</h3></div></div>
            <div className="policy-list">
              <div><span className="policy-check"><Icon name="check" size={12} /></span><p><strong>强制 2FA</strong><span>所有账号必须绑定 TOTP 后才能访问控制台。</span></p></div>
              <div><span className="policy-check"><Icon name="check" size={12} /></span><p><strong>强密码策略</strong><span>至少 12 位，需包含三类字符，且不能包含用户名。</span></p></div>
              <div><span className="policy-check"><Icon name="check" size={12} /></span><p><strong>设备级凭据</strong><span>每台设备独立 Token，轮换后旧 Agent 立即失效。</span></p></div>
              <div><span className="policy-check"><Icon name="check" size={12} /></span><p><strong>端口强绑定</strong><span>frps 插件只允许访问分配给该设备的公网端口。</span></p></div>
              <div><span className="policy-check"><Icon name="check" size={12} /></span><p><strong>完整审计</strong><span>登录、配置、设备连接与公网访问均有记录。</span></p></div>
              <div><span className="policy-check"><Icon name="check" size={12} /></span><p><strong>会话保护</strong><span>HttpOnly、SameSite=Strict Cookie，12 小时自动过期。</span></p></div>
            </div>
          </Card>

          <Card className="panel">
            <div className="panel-head"><div><p className="panel-eyebrow">ACCOUNT</p><h3>你的账号</h3></div></div>
            <div className="settings-account-links">
              <Link to="/profile"><span><Icon name="profile" size={16} /> 个人设置</span><Icon name="chevronRight" size={15} /></Link>
              <Link to="/audit"><span><Icon name="audit" size={16} /> 审计日志</span><Icon name="chevronRight" size={15} /></Link>
            </div>
          </Card>

          <Card className="panel notice-panel">
            <span className="notice-icon"><Icon name="info" size={18} /></span>
            <div>
              <strong>生产环境建议</strong>
              <p>当前控制台通过 HTTP 提供。若要在公网长期使用，建议绑定域名并启用 HTTPS，以保护登录凭据与 Cookie。</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
