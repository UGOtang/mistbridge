import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, ApiError } from "../lib/api";
import { formatDate, osLabel } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import type { Device } from "../lib/types";
import { AgentSetup } from "../components/AgentSetup";
import { Icon } from "../components/Icon";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  InfoBanner,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Skeleton,
  Textarea,
} from "../components/ui";

interface CreatedDevice {
  device: Device;
  config: string;
  commands: string[];
}

const NAME_SUGGESTIONS = ["办公室 NAS", "家庭服务器", "测试机"];

const OS_OPTIONS = [
  {
    value: "linux",
    label: "Linux",
    description: "Ubuntu / Debian / CentOS / NAS",
    icon: "terminal" as const,
  },
  {
    value: "windows",
    label: "Windows",
    description: "Windows 10 / 11 / Server",
    icon: "monitor" as const,
  },
  {
    value: "macos",
    label: "macOS",
    description: "Intel 或 Apple Silicon",
    icon: "monitor" as const,
  },
];

function OnboardingSteps({ current }: { current: number }) {
  const steps = ["填写信息", "运行 Agent", "创建隧道"];
  return (
    <ol className="onboarding-steps" aria-label="设备接入步骤">
      {steps.map((label, index) => (
        <li
          key={label}
          className={index < current ? "done" : index === current ? "active" : ""}
          aria-current={index === current ? "step" : undefined}
        >
          <span className="onboarding-index">
            {index < current ? <Icon name="check" size={12} /> : `0${index + 1}`}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function DevicesPage() {
  const { data, loading, error, reload } = useAsync(() => api.devices(), []);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<CreatedDevice | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [os, setOs] = useState("linux");
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const openedFromQuery = useRef(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role !== "viewer";

  useEffect(() => {
    if (searchParams.get("new") === "1" && !openedFromQuery.current) {
      openedFromQuery.current = true;
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const devices = data?.devices ?? [];
  const query = search.trim().toLowerCase();
  const filtered = query
    ? devices.filter(
        (device) =>
          device.name.toLowerCase().includes(query) ||
          device.description.toLowerCase().includes(query) ||
          device.id.toLowerCase().includes(query),
      )
    : devices;

  const resetCreate = () => {
    setCreated(null);
    setName("");
    setDescription("");
    setOs("linux");
    setNameError("");
    setFormError("");
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setFormError("");
    setNameError("");
    if (name.trim().length < 2) {
      setNameError("请输入至少 2 个字符的设备名称");
      document.getElementById("device-name")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.createDevice({ name: name.trim(), description: description.trim(), os });
      setCreated(result);
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "注册设备失败，请稍后重试");
      document.getElementById("create-device-form")?.scrollIntoView({ block: "start", behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };

  const finishToDevice = () => {
    const deviceId = created?.device.id;
    setCreateOpen(false);
    resetCreate();
    if (deviceId) navigate(`/devices/${deviceId}`);
  };

  const onlineCount = devices.filter((device) => device.online).length;

  return (
    <div className="devices-page">
      <PageHeader
        eyebrow="DEVICE FLEET"
        title="设备"
        description="每台设备拥有独立的 Agent 凭据。设备上线后，即可通过分配的公网端口访问本地服务。"
        actions={
          <>
            <div className="header-chip"><span className="live-dot" />{onlineCount} 台在线</div>
            {canManage && <Button icon="plus" onClick={() => setCreateOpen(true)}>注册设备</Button>}
          </>
        }
      />

      <div className="list-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="搜索设备名称、描述或 ID…" />
        <span className="toolbar-count">{filtered.length} 台设备</span>
      </div>

      {loading && !data ? (
        <div className="device-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="device-card"><Skeleton rows={3} /></Card>
          ))}
        </div>
      ) : error && !data ? (
        <Card>
          <EmptyState
            icon="alert"
            title="设备列表加载失败"
            description={error}
            action={<Button variant="secondary" icon="refresh" onClick={() => void reload()}>重试</Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="devices"
            title={query ? "没有匹配的设备" : "还没有注册设备"}
            description={query ? "换一个关键词试试，或清空搜索。" : "把运行服务的本地设备接入雾桥，创建第一条隧道。"}
            action={query ? <Button variant="secondary" onClick={() => setSearch("")}>清空搜索</Button> : canManage ? <Button icon="plus" onClick={() => setCreateOpen(true)}>注册第一台设备</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="device-grid">
          {filtered.map((device) => (
            <Card key={device.id} className="device-card" padding={false}>
              <button
                type="button"
                className="device-card-main"
                onClick={() => navigate(`/devices/${device.id}`)}
              >
                <div className="device-card-head">
                  <span className={`device-os os-${device.os}`}><Icon name={device.os === "windows" ? "monitor" : "server"} size={21} /></span>
                  <div className="device-card-title">
                    <strong>{device.name}</strong>
                    <span>{osLabel(device.os)} · <code>{device.id.slice(0, 14)}</code></span>
                  </div>
                  <Badge tone={device.status === "revoked" ? "danger" : device.online ? "success" : "neutral"} dot={device.online || device.status === "revoked"}>
                    {device.status === "revoked" ? "已吊销" : device.online ? "在线" : "离线"}
                  </Badge>
                </div>
                <p className="device-card-desc">{device.description || "暂无描述"}</p>
                <div className="device-card-meta">
                  <span><Icon name="route" size={14} /> {device.tunnelCount} 条隧道</span>
                  <span><Icon name="clock" size={14} /> {formatDate(device.lastSeenAt)}</span>
                  {device.ownerName && <span><Icon name="profile" size={14} /> {device.ownerName}</span>}
                </div>
                <div className="device-card-foot">
                  <span className="token-hint"><Icon name="key" size={13} /> Token {device.tokenPrefix}••••</span>
                  <span className="card-arrow"><Icon name="arrowUpRight" size={16} /></span>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={createOpen && !created}
        onClose={() => {
          setCreateOpen(false);
          resetCreate();
        }}
        title="注册新设备"
        subtitle="为这台设备生成独立的 Agent 凭据与配置文件。"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); resetCreate(); }}>取消</Button>
            <Button type="submit" form="create-device-form" loading={submitting} icon="plus">生成设备</Button>
          </>
        }
      >
        <form id="create-device-form" className="form-stack" onSubmit={submitCreate}>
          <OnboardingSteps current={0} />
          {formError && <ErrorBanner message={formError} />}

          <Field
            label="设备名称"
            htmlFor="device-name"
            hint="建议使用容易识别的名称，之后在设备列表和隧道里都会显示它。"
            error={nameError}
          >
            <Input
              id="device-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (event.target.value.trim().length >= 2) setNameError("");
              }}
              placeholder="例如：办公室 NAS"
              maxLength={60}
              autoComplete="off"
              enterKeyHint="next"
              aria-invalid={Boolean(nameError)}
            />
            <div className="suggestion-chips" aria-label="名称示例">
              {NAME_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => setName(suggestion)}
                >
                  <Icon name="plus" size={11} />
                  {suggestion}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="设备描述"
            htmlFor="device-description"
            hint={`可选 · ${description.length} / 300`}
          >
            <Textarea
              id="device-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="这台设备承载什么服务？例如：照片备份、开发测试环境…"
              rows={2}
              maxLength={300}
            />
          </Field>

          <fieldset className="os-field">
            <legend className="field-label">Agent 运行系统</legend>
            <p className="field-hint">选择设备本身的操作系统；在哪个系统上打开管理台不影响这里。</p>
            <div className="os-choice-grid" role="radiogroup" aria-label="选择设备操作系统">
              {OS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`os-choice ${os === option.value ? "os-choice-selected" : ""}`}
                >
                  <input
                    className="os-choice-input"
                    type="radio"
                    name="device-os"
                    value={option.value}
                    checked={os === option.value}
                    onChange={() => setOs(option.value)}
                  />
                  <span className="os-choice-icon"><Icon name={option.icon} size={21} /></span>
                  <span className="os-choice-copy">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  <span className="os-choice-check"><Icon name="check" size={12} /></span>
                </label>
              ))}
            </div>
          </fieldset>

          <InfoBanner>
            生成后会立即创建独立凭据。下一步下载 <code>frpc.toml</code>，在设备上运行 Agent，再回来创建隧道。
          </InfoBanner>
        </form>
      </Modal>

      <Modal
        open={Boolean(created)}
        onClose={() => {
          setCreateOpen(false);
          resetCreate();
        }}
        title="设备已就绪"
        subtitle="按下面三步完成接入：下载配置 → 运行 Agent → 创建隧道。"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); resetCreate(); }}>稍后完成</Button>
            <Button iconRight="arrowUpRight" onClick={finishToDevice}>进入设备，创建隧道</Button>
          </>
        }
      >
        {created && (
          <div className="created-device">
            <OnboardingSteps current={1} />
            <div className="created-banner">
              <span className="created-icon"><Icon name="checkCircle" size={23} /></span>
              <div>
                <strong>{created.device.name}</strong>
                <span>设备 ID：<code>{created.device.id}</code></span>
              </div>
              <Badge tone="info">等待首次连接</Badge>
            </div>
            <div className="created-guidance">
              <span className="guidance-index">02</span>
              <div>
                <strong>在设备上下载并运行 Agent</strong>
                <p>配置文件只对这台设备有效。启动后，控制台会自动显示在线状态。</p>
              </div>
            </div>
            <AgentSetup
              deviceId={created.device.id}
              deviceName={created.device.name}
              os={created.device.os}
              commands={created.commands}
              initialConfig={created.config}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
