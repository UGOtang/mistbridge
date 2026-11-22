import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { ServerMeta } from "../lib/types";
import { BrandMark, Icon } from "../components/Icon";
import { Button, ErrorBanner, Field, Input, Spinner } from "../components/ui";

export function LoginPage() {
  const { user, loading, login, mustChangePassword, mustSetup2fa } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [meta, setMeta] = useState<ServerMeta | null>(null);

  useEffect(() => {
    void api
      .meta()
      .then((result) => setMeta(result.server))
      .catch(() => undefined);
  }, []);

  if (loading) {
    return (
      <div className="auth-loading">
        <BrandMark size={44} />
        <Spinner size={20} />
      </div>
    );
  }

  if (user) {
    return <Navigate to={mustChangePassword || mustSetup2fa ? "/setup" : "/"} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (!username.trim() || !password) {
      setError("请输入用户名和密码");
      return;
    }
    if (needsTotp && !useRecovery && !/^\d{6}$/.test(totp.trim())) {
      setError("请输入 6 位动态验证码");
      return;
    }
    setSubmitting(true);
    try {
      const session = await login({
        username: username.trim(),
        password,
        ...(needsTotp
          ? useRecovery
            ? { recoveryCode: recoveryCode.trim() }
            : { totp: totp.trim() }
          : {}),
      });
      navigate(session.mustChangePassword || session.mustSetup2fa ? "/setup" : "/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "totp_required") {
        setNeedsTotp(true);
        setError("该账号已启用双重验证，请输入身份验证器中的动态码。");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("登录失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <section className="auth-brand-panel">
        <div className="auth-grid" aria-hidden="true" />
        <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
        <div className="auth-orbit auth-orbit-two" aria-hidden="true" />

        <div className="auth-brand-top">
          <BrandMark size={42} />
          <div className="auth-wordmark">
            <strong>MISTBRIDGE</strong>
            <span>雾桥 · Secure Tunnel Fabric</span>
          </div>
        </div>

        <div className="auth-hero">
          <p className="auth-kicker">
            <span className="kicker-line" /> Enterprise connectivity
          </p>
          <h1>
            让内网服务，
            <br />
            <em>安全地</em>走到公网。
          </h1>
          <p className="auth-lead">
            在一个克制的控制台里，管理设备、分配端口、观察每一条隧道。每一个连接都有凭据，每一次操作都有记录。
          </p>

          <div className="auth-network" aria-hidden="true">
            <svg viewBox="0 0 520 240" fill="none">
              <defs>
                <linearGradient id="line-glow" x1="40" y1="60" x2="480" y2="190" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#69d7c5" stopOpacity=".15" />
                  <stop offset=".5" stopColor="#69d7c5" stopOpacity=".8" />
                  <stop offset="1" stopColor="#69d7c5" stopOpacity=".12" />
                </linearGradient>
              </defs>
              <path d="M64 170C130 170 150 88 220 88s92 80 160 80 70-60 76-76" stroke="url(#line-glow)" strokeWidth="1.4" />
              <path d="M56 120C132 120 150 54 224 54s90 120 160 120 70-36 86-58" stroke="url(#line-glow)" strokeWidth="1" opacity=".55" />
              <path d="M72 210h380" stroke="#c7fff4" strokeOpacity=".08" />
              <circle cx="64" cy="170" r="5" fill="#69d7c5" />
              <circle cx="64" cy="170" r="12" stroke="#69d7c5" strokeOpacity=".25" />
              <circle cx="220" cy="88" r="5.5" fill="#d8fff7" />
              <circle cx="220" cy="88" r="15" stroke="#d8fff7" strokeOpacity=".2" />
              <circle cx="380" cy="168" r="5" fill="#69d7c5" />
              <circle cx="456" cy="92" r="4" fill="#d8fff7" />
              <circle cx="456" cy="92" r="10" stroke="#d8fff7" strokeOpacity=".18" />
              <rect x="198" y="66" width="44" height="44" rx="14" stroke="#8be0cf" strokeOpacity=".35" />
              <text x="232" y="115" fill="#b9eee6" fontSize="9" letterSpacing=".18em">EDGE</text>
              <text x="82" y="196" fill="#7eb4b4" fontSize="9" letterSpacing=".14em">DEVICE 01</text>
              <text x="390" y="201" fill="#7eb4b4" fontSize="9" letterSpacing=".14em">SERVICE</text>
            </svg>
          </div>

          <ul className="auth-features">
            <li>
              <span className="feature-icon"><Icon name="shield" size={16} /></span>
              <span><strong>TLS + 双重验证</strong><small>控制链路加密，登录强制 2FA</small></span>
            </li>
            <li>
              <span className="feature-icon"><Icon name="key" size={16} /></span>
              <span><strong>设备级凭据</strong><small>独立 Token，端口与设备强绑定</small></span>
            </li>
            <li>
              <span className="feature-icon"><Icon name="audit" size={16} /></span>
              <span><strong>全程可审计</strong><small>连接、配置、成员操作均有记录</small></span>
            </li>
          </ul>
        </div>

        <div className="auth-brand-footer">
          <span>Edge {meta ? `${meta.serverAddr}:${meta.controlPort}` : "securely provisioned"}</span>
          <span>Built for calm operations</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-form-heading">
            <span className="auth-mini-mark"><BrandMark size={30} /></span>
            <p className="eyebrow">Console access</p>
            <h2>登录雾桥控制台</h2>
            <p>使用管理员或团队成员账号继续。</p>
          </div>

          <form className="auth-form" onSubmit={submit} noValidate>
            {error && <ErrorBanner message={error} />}
            <Field label="用户名" htmlFor="username">
              <div className="input-with-icon">
                <Icon name="profile" size={17} />
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  placeholder="例如 admin"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoFocus
                />
              </div>
            </Field>
            <Field label="密码" htmlFor="password">
              <div className="input-with-icon">
                <Icon name="lock" size={17} />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="输入登录密码"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                </button>
              </div>
            </Field>

            {needsTotp && (
              <div className="totp-challenge">
                <div className="totp-challenge-head">
                  <span className="totp-icon"><Icon name="shield" size={16} /></span>
                  <div>
                    <strong>双重验证</strong>
                    <small>{useRecovery ? "输入一个未使用过的恢复码" : "打开身份验证器，输入当前的 6 位动态码"}</small>
                  </div>
                </div>
                {useRecovery ? (
                  <Field label="恢复码" htmlFor="recoveryCode">
                    <Input
                      id="recoveryCode"
                      inputMode="text"
                      autoComplete="one-time-code"
                      placeholder="例如 ABCDE-FGHIJ"
                      value={recoveryCode}
                      onChange={(event) => setRecoveryCode(event.target.value)}
                    />
                  </Field>
                ) : (
                  <Field label="动态验证码" htmlFor="totp">
                    <Input
                      id="totp"
                      className="otp-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      value={totp}
                      onChange={(event) => setTotp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </Field>
                )}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setUseRecovery((value) => !value);
                    setError("");
                  }}
                >
                  {useRecovery ? "使用动态验证码" : "无法使用验证器？使用恢复码"}
                </button>
              </div>
            )}

            <Button type="submit" size="lg" full loading={submitting} iconRight="arrowUpRight">
              安全登录
            </Button>
            <p className="auth-security-note">
              <Icon name="shield" size={14} />
              首次登录需要修改初始密码并绑定 TOTP 双重验证
            </p>
          </form>

          <div className="auth-form-footer">
            <span>受保护的内部管理平台</span>
            <span className="auth-footer-dot" />
            <span>v1.0</span>
          </div>
        </div>
      </section>
    </div>
  );
}
