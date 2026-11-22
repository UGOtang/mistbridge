import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { actionLabel, formatFullDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { Icon, type IconName } from "../components/Icon";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
} from "../components/ui";

const ACTIONS = [
  ["", "全部事件"],
  ["auth.login", "登录成功"],
  ["auth.login.failed", "登录失败"],
  ["auth.password.changed", "修改密码"],
  ["auth.2fa.enabled", "启用 2FA"],
  ["device.created", "创建设备"],
  ["device.connected", "设备上线"],
  ["device.login.rejected", "设备认证失败"],
  ["device.token.rotated", "轮换凭据"],
  ["device.config.download", "下载配置"],
  ["tunnel.created", "创建隧道"],
  ["tunnel.connected", "隧道上线"],
  ["tunnel.visitor", "公网访问"],
  ["tunnel.updated", "更新隧道"],
  ["user.created", "创建成员"],
  ["user.password.reset", "重置成员密码"],
  ["user.2fa.reset", "重置成员 2FA"],
] as const;

function logTone(action: string): "success" | "warning" | "danger" | "neutral" | "info" | "teal" {
  if (action.includes("failed") || action.includes("rejected") || action.includes("deleted")) return "danger";
  if (action.includes("reset")) return "warning";
  if (action.startsWith("auth")) return "teal";
  if (action.includes("connected") || action.includes("created")) return "success";
  return "neutral";
}

function logIcon(action: string): IconName {
  if (action.startsWith("auth")) return "shield";
  if (action.startsWith("device")) return "devices";
  if (action.startsWith("tunnel")) return "route";
  if (action.startsWith("user")) return "users";
  return "activity";
}

export function AuditPage() {
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [action, setAction] = useState("");

  const { data, loading, error, reload } = useAsync(
    () => api.audit(page, pageSize, appliedSearch, action),
    [page, action, appliedSearch],
  );

  if (me?.role !== "admin") return <Navigate to="/" replace />;

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  return (
    <div className="audit-page">
      <PageHeader
        eyebrow="AUDIT TRAIL"
        title="审计日志"
        description="所有登录、设备、隧道和成员操作都会记录在案。日志只读，用于安全追踪与事后复盘。"
        actions={<Button variant="secondary" icon="refresh" onClick={() => void reload()}>刷新</Button>}
      />

      <Card className="audit-filter-card">
        <form className="audit-filters" onSubmit={submitSearch}>
          <div className="search-input">
            <Icon name="search" size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索操作者、详情或目标 ID…" aria-label="搜索审计日志" />
          </div>
          <Select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} aria-label="按事件类型筛选">
            {ACTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </Select>
          <Button variant="secondary" type="submit" icon="search">查询</Button>
        </form>
        <div className="audit-summary">
          <span><Icon name="audit" size={14} /> 共 {total} 条记录</span>
          <span className="audit-retention"><Icon name="shield" size={13} /> 审计数据仅管理员可见</span>
        </div>
      </Card>

      {loading && !data ? (
        <Card><Skeleton rows={8} /></Card>
      ) : error && !data ? (
        <Card>
          <EmptyState
            icon="alert"
            title="审计日志加载失败"
            description={error}
            action={<Button variant="secondary" icon="refresh" onClick={() => void reload()}>重试</Button>}
          />
        </Card>
      ) : logs.length === 0 ? (
        <Card><EmptyState icon="audit" title="没有匹配的日志" description="调整筛选条件或清空搜索后再试。" /></Card>
      ) : (
        <Card className="table-card">
          <div className="data-table audit-table">
            <div className="data-table-head">
              <span>时间</span><span>事件</span><span>操作者</span><span>目标</span><span>来源 IP</span><span>详情</span>
            </div>
            {logs.map((log) => (
              <div className="data-table-row" key={log.id}>
                <span className="audit-time">{formatFullDate(log.createdAt)}</span>
                <div className="audit-event">
                  <span className={`audit-icon tone-${logTone(log.action)}`}><Icon name={logIcon(log.action)} size={14} /></span>
                  <Badge tone={logTone(log.action)}>{actionLabel(log.action)}</Badge>
                </div>
                <span className="audit-actor">{log.actorName}</span>
                <span className="audit-target">{log.targetType ? `${log.targetType} · ${log.targetId?.slice(0, 16) ?? "—"}` : "—"}</span>
                <code className="mono-cell">{log.ip ?? "—"}</code>
                <span className="audit-detail" title={log.detail ?? ""}>{log.detail ?? "—"}</span>
              </div>
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
        </Card>
      )}
    </div>
  );
}
