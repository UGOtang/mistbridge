import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, roleLabel } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import type { User } from "../lib/types";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  ErrorBanner,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  Toggle,
} from "../components/ui";

export function TeamPage() {
  const { user: me } = useAuth();
  const { push } = useToast();
  const { data, loading, error, reload } = useAsync(() => api.users(), []);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("operator");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [initialPassword, setInitialPassword] = useState<{ user: User; password: string } | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageRole, setManageRole] = useState("operator");
  const [manageActive, setManageActive] = useState(true);
  const [manageName, setManageName] = useState("");
  const [manageError, setManageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetResult, setResetResult] = useState<{ user: User; password: string } | null>(null);
  const [reset2faTarget, setReset2faTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [working, setWorking] = useState(false);

  if (me?.role !== "admin") return <Navigate to="/" replace />;

  const users = data?.users ?? [];
  const query = search.trim().toLowerCase();
  const filtered = query
    ? users.filter(
        (user) =>
          user.username.toLowerCase().includes(query) ||
          user.displayName.toLowerCase().includes(query) ||
          roleLabel(user.role).includes(query),
      )
    : users;

  const openManage = (user: User) => {
    setSelected(user);
    setManageName(user.displayName);
    setManageRole(user.role);
    setManageActive(user.status === "active");
    setManageError("");
    setManageOpen(true);
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (creating) return;
    setCreateError("");
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username.trim())) {
      setCreateError("用户名需为 3–32 位字母、数字、下划线、点或中划线");
      return;
    }
    if (!displayName.trim()) {
      setCreateError("请输入显示名称");
      return;
    }
    setCreating(true);
    try {
      const result = await api.createUser({ username: username.trim(), displayName: displayName.trim(), role });
      setInitialPassword({ user: result.user, password: result.initialPassword });
      setCreateOpen(false);
      setUsername("");
      setDisplayName("");
      setRole("operator");
      await reload();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "创建成员失败");
    } finally {
      setCreating(false);
    }
  };

  const saveManage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || saving) return;
    setManageError("");
    setSaving(true);
    try {
      await api.updateUser(selected.id, {
        displayName: manageName.trim(),
        ...(selected.id !== me?.id ? { role: manageRole, status: manageActive ? "active" : "disabled" } : {}),
      });
      push("成员信息已更新", "success");
      setManageOpen(false);
      await reload();
    } catch (err) {
      setManageError(err instanceof ApiError ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!resetTarget) return;
    setWorking(true);
    try {
      const result = await api.resetUserPassword(resetTarget.id);
      setResetResult({ user: resetTarget, password: result.initialPassword });
      setResetTarget(null);
      await reload();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "重置失败", "error");
    } finally {
      setWorking(false);
    }
  };

  const reset2fa = async () => {
    if (!reset2faTarget) return;
    setWorking(true);
    try {
      await api.resetUser2fa(reset2faTarget.id);
      push("成员 2FA 已重置，下次登录需重新绑定", "success");
      setReset2faTarget(null);
      await reload();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "重置失败", "error");
    } finally {
      setWorking(false);
    }
  };

  const removeUser = async () => {
    if (!deleteTarget) return;
    setWorking(true);
    try {
      await api.deleteUser(deleteTarget.id);
      push("成员已删除", "success");
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "删除失败", "error");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="team-page">
      <PageHeader
        eyebrow="ACCESS CONTROL"
        title="团队成员"
        description="管理员可以创建成员、分配角色，并重置密码或双重验证。所有成员首次登录都必须完成安全设置。"
        actions={<Button icon="plus" onClick={() => setCreateOpen(true)}>添加成员</Button>}
      />

      <div className="list-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="搜索用户名、姓名或角色…" />
        <span className="toolbar-count">{filtered.length} 位成员</span>
      </div>

      {loading && !data ? (
        <Card><Skeleton rows={5} /></Card>
      ) : error && !data ? (
        <Card>
          <EmptyState
            icon="alert"
            title="成员列表加载失败"
            description={error}
            action={<Button variant="secondary" icon="refresh" onClick={() => void reload()}>重试</Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon="users" title="没有匹配的成员" description="换一个关键词，或添加新的团队成员。" /></Card>
      ) : (
        <Card className="table-card">
          <div className="data-table team-table">
            <div className="data-table-head">
              <span>成员</span><span>角色</span><span>状态</span><span>2FA</span><span>设备</span><span>最近登录</span><span />
            </div>
            {filtered.map((user) => (
              <div className="data-table-row" key={user.id}>
                <div className="table-user">
                  <Avatar name={user.displayName} size={34} />
                  <div><strong>{user.displayName}{user.id === me?.id && <span className="self-tag">你</span>}</strong><small>@{user.username}</small></div>
                </div>
                <Badge tone={user.role === "admin" ? "teal" : user.role === "operator" ? "info" : "neutral"}>{roleLabel(user.role)}</Badge>
                <Badge tone={user.status === "active" ? "success" : "neutral"} dot={user.status === "active"}>{user.status === "active" ? "正常" : "已停用"}</Badge>
                <span className={`security-state ${user.totpEnabled ? "ok" : "warn"}`}>
                  <Icon name={user.totpEnabled ? "shield" : "alert"} size={14} />
                  {user.totpEnabled ? "已启用" : "待绑定"}
                </span>
                <span className="muted-cell">{user.deviceCount ?? 0}</span>
                <span className="muted-cell">{formatDate(user.lastLoginAt)}</span>
                <div className="row-actions">
                  <IconButton icon="settings" label="管理成员" onClick={() => openManage(user)} />
                  {user.id !== me?.id && (
                    <>
                      <IconButton icon="key" label="重置密码" onClick={() => setResetTarget(user)} />
                      <IconButton icon="shield" label="重置 2FA" onClick={() => setReset2faTarget(user)} />
                      <IconButton icon="trash" label="删除成员" tone="danger" onClick={() => setDeleteTarget(user)} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="添加团队成员"
        subtitle="新成员会收到一次性初始密码，首次登录后必须修改密码并绑定 2FA。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button type="submit" form="create-user-form" loading={creating} icon="plus">创建成员</Button>
          </>
        }
      >
        <form id="create-user-form" className="form-stack" onSubmit={submitCreate}>
          {createError && <ErrorBanner message={createError} />}
          <Field label="用户名" htmlFor="new-username" hint="用于登录，创建后不可修改">
            <Input id="new-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="例如 zhang.ops" />
          </Field>
          <Field label="显示名称" htmlFor="new-display-name">
            <Input id="new-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如 张晓明" />
          </Field>
          <Field label="角色" htmlFor="new-role" hint="管理员可管理成员；运维可管理设备与隧道；只读成员只能查看。">
            <Select id="new-role" value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="operator">运维人员</option>
              <option value="viewer">只读成员</option>
              <option value="admin">管理员</option>
            </Select>
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(initialPassword)}
        onClose={() => setInitialPassword(null)}
        title="成员已创建"
        subtitle="请通过安全渠道把初始密码交给成员。该密码只显示一次。"
        footer={<Button onClick={() => setInitialPassword(null)}>我已保存</Button>}
      >
        {initialPassword && (
          <div className="credential-reveal">
            <div className="credential-user">
              <Avatar name={initialPassword.user.displayName} size={40} />
              <div><strong>{initialPassword.user.displayName}</strong><span>@{initialPassword.user.username}</span></div>
              <Badge tone="info">{roleLabel(initialPassword.user.role)}</Badge>
            </div>
            <div className="credential-secret">
              <span>一次性初始密码</span>
              <code>{initialPassword.password}</code>
              <CopyButton value={initialPassword.password} label="复制密码" />
            </div>
            <p className="modal-note"><Icon name="info" size={14} /> 成员首次登录后必须立即修改密码并绑定 TOTP，之后这个密码将失效。</p>
          </div>
        )}
      </Modal>

      <Modal
        open={manageOpen && Boolean(selected)}
        onClose={() => setManageOpen(false)}
        title="管理成员"
        subtitle={selected ? `@${selected.username}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setManageOpen(false)}>取消</Button>
            <Button type="submit" form="manage-user-form" loading={saving} icon="check">保存</Button>
          </>
        }
      >
        {selected && (
          <form id="manage-user-form" className="form-stack" onSubmit={saveManage}>
            {manageError && <ErrorBanner message={manageError} />}
            <Field label="显示名称" htmlFor="manage-name">
              <Input id="manage-name" value={manageName} onChange={(event) => setManageName(event.target.value)} />
            </Field>
            <Field label="角色" htmlFor="manage-role" hint={selected.id === me?.id ? "不能修改自己的角色。" : undefined}>
              <Select id="manage-role" value={manageRole} onChange={(event) => setManageRole(event.target.value)} disabled={selected.id === me?.id}>
                <option value="admin">管理员</option>
                <option value="operator">运维人员</option>
                <option value="viewer">只读成员</option>
              </Select>
            </Field>
            {selected.id !== me?.id && (
              <div className="toggle-row">
                <div><strong>账号状态</strong><span>停用后该成员的所有会话会立即失效。</span></div>
                <Toggle checked={manageActive} onChange={setManageActive} label="启用成员账号" />
              </div>
            )}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        onConfirm={() => void resetPassword()}
        loading={working}
        title="重置成员密码？"
        confirmLabel="重置密码"
        description={`会为 @${resetTarget?.username ?? ""} 生成一次性密码，同时重置 2FA 并撤销全部会话。`}
      />

      <Modal
        open={Boolean(resetResult)}
        onClose={() => setResetResult(null)}
        title="新密码已生成"
        subtitle="请立即通过安全渠道发送给成员。该密码只显示一次。"
        footer={<Button onClick={() => setResetResult(null)}>我已保存</Button>}
      >
        {resetResult && (
          <div className="credential-reveal">
            <div className="credential-secret">
              <span>一次性初始密码</span>
              <code>{resetResult.password}</code>
              <CopyButton value={resetResult.password} label="复制密码" />
            </div>
            <p className="modal-note"><Icon name="info" size={14} /> 该成员的 2FA 已重置，旧会话已全部撤销，下次登录需重新完成安全设置。</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(reset2faTarget)}
        onClose={() => setReset2faTarget(null)}
        onConfirm={() => void reset2fa()}
        loading={working}
        title="重置成员 2FA？"
        confirmLabel="重置 2FA"
        description={`@${reset2faTarget?.username ?? ""} 的验证器绑定将被移除，所有会话会被撤销，成员下次登录需要重新绑定。`}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void removeUser()}
        loading={working}
        title="删除成员？"
        confirmLabel="永久删除"
        description={`这会永久删除 @${deleteTarget?.username ?? ""} 以及其拥有的所有设备与隧道，且无法恢复。`}
      />
    </div>
  );
}
