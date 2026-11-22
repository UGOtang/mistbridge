import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatFullDate, roleLabel } from "../lib/format";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  StrengthMeter,
} from "../components/ui";

export function ProfilePage() {
  const { user, applySession, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (password !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    setBusy(true);
    try {
      const session = await api.changePassword({ currentPassword, password, confirmPassword });
      applySession(session);
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      push("密码已更新，其他会话已退出", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "修改密码失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-page">
      <PageHeader eyebrow="YOUR ACCOUNT" title="个人设置" description="管理登录密码与账号安全状态。团队成员权限由管理员维护。" />

      <div className="profile-grid">
        <section className="profile-main">
          <Card className="panel profile-identity-card">
            <div className="profile-identity">
              <Avatar name={user.displayName || user.username} size={64} />
              <div>
                <div className="profile-name-line">
                  <h2>{user.displayName || user.username}</h2>
                  <Badge tone={user.role === "admin" ? "teal" : "info"}>{roleLabel(user.role)}</Badge>
                </div>
                <p>@{user.username}</p>
              </div>
              <div className="profile-login-meta">
                <span>最近登录</span>
                <strong>{formatFullDate(user.lastLoginAt)}</strong>
              </div>
            </div>
          </Card>

          <Card className="panel">
            <div className="panel-head">
              <div><p className="panel-eyebrow">PASSWORD</p><h3>修改密码</h3></div>
            </div>
            <form className="form-stack" onSubmit={submit}>
              {error && <ErrorBanner message={error} />}
              <Field label="当前密码" htmlFor="profile-current">
                <Input id="profile-current" type={show ? "text" : "password"} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="输入当前密码" />
              </Field>
              <Field label="新密码" htmlFor="profile-new">
                <Input id="profile-new" type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 12 位，三类字符" />
              </Field>
              <StrengthMeter password={password} />
              <Field label="确认新密码" htmlFor="profile-confirm">
                <Input id="profile-confirm" type={show ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入新密码" />
              </Field>
              <label className="checkline">
                <input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} />
                <span>显示密码</span>
              </label>
              <div className="form-actions">
                <Button type="submit" loading={busy} icon="lock">更新密码</Button>
                <span className="form-hint-inline"><Icon name="info" size={13} /> 修改后其他设备上的会话会退出</span>
              </div>
            </form>
          </Card>
        </section>

        <aside className="profile-side">
          <Card className="panel">
            <div className="panel-head"><div><p className="panel-eyebrow">SECURITY</p><h3>安全状态</h3></div></div>
            <div className="security-status-list">
              <div className="security-status">
                <span className="security-status-icon ok"><Icon name="shield" size={18} /></span>
                <div><strong>双重验证</strong><span>{user.totpEnabled ? "TOTP 已启用" : "尚未启用"}</span></div>
                <Badge tone={user.totpEnabled ? "success" : "warning"}>{user.totpEnabled ? "受保护" : "待设置"}</Badge>
              </div>
              <div className="security-status">
                <span className="security-status-icon ok"><Icon name="lock" size={18} /></span>
                <div><strong>密码策略</strong><span>强密码 · 12 位以上</span></div>
                <Badge tone="success">已生效</Badge>
              </div>
              <div className="security-status">
                <span className="security-status-icon ok"><Icon name="clock" size={18} /></span>
                <div><strong>会话有效期</strong><span>12 小时后自动过期</span></div>
                <Badge tone="info">自动</Badge>
              </div>
            </div>
            <div className="profile-tip">
              <Icon name="info" size={14} />
              <p>如果丢失身份验证器，请让管理员重置你的 2FA。恢复码在绑定 2FA 时只显示一次。</p>
            </div>
          </Card>

          <Card className="panel">
            <div className="panel-head"><div><p className="panel-eyebrow">SESSION</p><h3>当前会话</h3></div></div>
            <p className="panel-copy">退出后需要重新使用密码与动态验证码登录。</p>
            <Button
              variant="secondary"
              full
              icon="logout"
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
            >
              退出当前账号
            </Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}
