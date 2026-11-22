import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { copyText, downloadText } from "../lib/format";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { Button, CopyButton, ErrorBanner, Field, Input, Spinner, StrengthMeter } from "../components/ui";

type Phase = "password" | "totp" | "recovery";

export function SetupPage() {
  const { user, loading, applySession, mustChangePassword, mustSetup2fa } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const [phase, setPhase] = useState<Phase>(() =>
    mustChangePassword ? "password" : !user?.totpEnabled ? "totp" : "recovery",
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [initError, setInitError] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const initStarted = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (mustChangePassword) setPhase("password");
    else if (!user.totpEnabled) setPhase("totp");
  }, [user, mustChangePassword]);

  useEffect(() => {
    if (phase !== "totp" || initStarted.current || user?.totpEnabled) return;
    initStarted.current = true;
    setInitError("");
    void api
      .setup2faInit()
      .then((result) => {
        setQr(result.qr);
        setSecret(result.secret);
        setOtpauth(result.otpauth);
      })
      .catch((err) => {
        initStarted.current = false;
        setInitError(err instanceof ApiError ? err.message : "无法生成 2FA 二维码，请刷新重试");
      });
  }, [phase, user?.totpEnabled]);

  if (loading) {
    return (
      <div className="auth-loading">
        <Spinner size={22} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!mustChangePassword && !mustSetup2fa && codes.length === 0) {
    return <Navigate to="/" replace />;
  }

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (password !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    setBusy(true);
    try {
      const session = await api.setupPassword({ currentPassword, password, confirmPassword });
      applySession(session);
      setCurrentPassword("");
      setPhase("totp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "修改密码失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  const submitTotp = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!/^\d{6}$/.test(code.trim())) {
      setError("请输入身份验证器中的 6 位动态码");
      return;
    }
    setBusy(true);
    try {
      const session = await api.setup2faEnable(code.trim());
      applySession(session);
      setCodes(session.recoveryCodes);
      setPhase("recovery");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "启用双重验证失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    { id: "password", label: "修改初始密码", done: !mustChangePassword },
    { id: "totp", label: "绑定身份验证器", done: Boolean(user.totpEnabled) },
    { id: "recovery", label: "保存恢复码", done: false },
  ];
  const activeStep = phase === "password" ? 0 : phase === "totp" ? 1 : 2;

  return (
    <div className="setup-layout">
      <aside className="setup-aside">
        <div>
          <div className="setup-brand">
            <span className="setup-brand-mark">
              <Icon name="shield" size={20} />
            </span>
            <div>
              <strong>安全设置</strong>
              <span>MistBridge account protection</span>
            </div>
          </div>
          <h1>在你进入控制台之前，<em>先保护它。</em></h1>
          <p className="setup-lead">
            这是一个强制的安全初始化流程。完成后，你的账号将由密码与 TOTP 双重验证共同保护。
          </p>
        </div>
        <ol className="setup-steps">
          {steps.map((step, index) => (
            <li key={step.id} className={index === activeStep ? "active" : step.done || index < activeStep ? "done" : ""}>
              <span className="setup-step-index">
                {step.done || index < activeStep ? <Icon name="check" size={14} /> : `0${index + 1}`}
              </span>
              <span>
                <strong>{step.label}</strong>
                <small>
                  {index === 0 ? "设置一个只有你知道的强密码" : index === 1 ? "使用任意 TOTP 身份验证器" : "只显示一次，请妥善保存"}
                </small>
              </span>
            </li>
          ))}
        </ol>
        <div className="setup-aside-foot">
          <Icon name="lock" size={15} />
          <span>设置完成前，控制台 API 将保持锁定状态。</span>
        </div>
      </aside>

      <main className="setup-main">
        <div className="setup-card">
          {phase === "password" && (
            <>
              <div className="setup-card-head">
                <span className="setup-step-pill">STEP 01 / 03</span>
                <h2>替换初始密码</h2>
                <p>管理员初始密码只用于第一次登录。新密码至少 12 位，并包含大小写字母、数字、符号中的三类。</p>
              </div>
              <form className="setup-form" onSubmit={submitPassword}>
                {error && <ErrorBanner message={error} />}
                <Field label="当前初始密码" htmlFor="current-password">
                  <Input
                    id="current-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="输入登录时使用的初始密码"
                  />
                </Field>
                <Field label="新密码" htmlFor="new-password">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="设置一个强密码"
                  />
                </Field>
                <StrengthMeter password={password} />
                <Field label="确认新密码" htmlFor="confirm-password">
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="再次输入新密码"
                  />
                </Field>
                <label className="checkline">
                  <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
                  <span>显示密码</span>
                </label>
                <Button type="submit" size="lg" full loading={busy} iconRight="arrowUpRight">
                  保存新密码，继续
                </Button>
              </form>
            </>
          )}

          {phase === "totp" && (
            <>
              <div className="setup-card-head">
                <span className="setup-step-pill">STEP 02 / 03</span>
                <h2>绑定身份验证器</h2>
                <p>使用 Google Authenticator、1Password、Microsoft Authenticator 或任意兼容 TOTP 的应用扫描下方二维码。</p>
              </div>
              {initError && <ErrorBanner message={initError} />}
              {!qr && !initError ? (
                <div className="setup-loading">
                  <Spinner size={22} />
                  <span>正在生成一次性密钥…</span>
                </div>
              ) : (
                <div className="totp-setup">
                  {qr && (
                    <div className="qr-card">
                      <img src={qr} alt="TOTP 二维码" width={220} height={220} />
                      <span>扫描后输入应用显示的 6 位动态码</span>
                    </div>
                  )}
                  <div className="totp-details">
                    <p className="totp-manual-label">无法扫描？手动输入密钥</p>
                    {secret && (
                      <div className="secret-row">
                        <code>{secret.match(/.{1,4}/g)?.join(" ")}</code>
                        <CopyButton value={secret} compact label="复制密钥" />
                      </div>
                    )}
                    {otpauth && (
                      <p className="totp-meta">
                        <Icon name="info" size={13} /> 类型 TOTP · 30 秒刷新 · SHA1 · 6 位
                      </p>
                    )}
                    <form className="setup-form compact" onSubmit={submitTotp}>
                      {error && <ErrorBanner message={error} />}
                      <Field label="动态验证码" htmlFor="setup-totp">
                        <Input
                          id="setup-totp"
                          className="otp-input"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="000000"
                          value={code}
                          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          autoFocus
                        />
                      </Field>
                      <Button type="submit" size="lg" full loading={busy} iconRight="shield">
                        验证并启用 2FA
                      </Button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}

          {phase === "recovery" && (
            <>
              <div className="setup-card-head">
                <span className="setup-step-pill">STEP 03 / 03</span>
                <h2>保存你的恢复码</h2>
                <p>如果丢失身份验证器，恢复码是唯一的备用登录方式。每个恢复码只能使用一次，请将它们保存在安全的地方。</p>
              </div>
              <div className="recovery-panel">
                <div className="recovery-grid">
                  {codes.map((item, index) => (
                    <span key={item}>
                      <small>{String(index + 1).padStart(2, "0")}</small>
                      <code>{item}</code>
                    </span>
                  ))}
                </div>
                <div className="recovery-actions">
                  <Button
                    variant="secondary"
                    icon="copy"
                    onClick={() => {
                      void copyText(codes.join("\n"))
                        .then(() => push("恢复码已复制，请妥善保存", "success"))
                        .catch(() => push("复制失败，请改为下载 txt", "error"));
                    }}
                  >
                    复制全部
                  </Button>
                  <Button
                    variant="secondary"
                    icon="download"
                    onClick={() =>
                      downloadText(
                        "mistbridge-recovery-codes.txt",
                        `MistBridge 恢复码\n账号：${user.username}\n生成时间：${new Date().toLocaleString()}\n\n${codes.join("\n")}\n\n每个恢复码只能使用一次。请离线保存。`,
                      )
                    }
                  >
                    下载 txt
                  </Button>
                </div>
              </div>
              <label className="checkline recovery-confirm">
                <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
                <span>我已将恢复码保存在安全的位置，并理解它们不会再次显示。</span>
              </label>
              <Button
                type="button"
                size="lg"
                full
                disabled={!saved}
                iconRight="arrowUpRight"
                onClick={() => navigate("/", { replace: true })}
              >
                进入控制台
              </Button>
            </>
          )}
        </div>
        <p className="setup-footer">
          <Icon name="shield" size={13} /> 所有安全设置都会立即生效
        </p>
      </main>
    </div>
  );
}
