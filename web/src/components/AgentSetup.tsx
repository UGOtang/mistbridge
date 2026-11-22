import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { copyText, downloadText } from "../lib/format";
import { useToast } from "./Toast";
import { Button, CodeBlock, InfoBanner, Spinner, Tabs } from "./ui";
import { Icon } from "./Icon";

type OsTab = "linux" | "windows" | "macos";

export function AgentSetup({
  deviceId,
  deviceName,
  os,
  commands,
  initialConfig,
}: {
  deviceId: string;
  deviceName: string;
  os: string;
  commands: string[];
  initialConfig?: string;
}) {
  const { push } = useToast();
  const [tab, setTab] = useState<OsTab>(os === "windows" ? "windows" : os === "macos" ? "macos" : "linux");
  const [config, setConfig] = useState<string | null>(initialConfig ?? null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const commandText = commands.join("\n");

  const ensureConfig = async (): Promise<string | null> => {
    if (config) return config;
    setLoadingConfig(true);
    try {
      const result = await api.downloadDeviceConfig(deviceId);
      setConfig(result.text);
      return result.text;
    } catch (err) {
      push(err instanceof ApiError ? err.message : "无法读取 Agent 配置", "error");
      return null;
    } finally {
      setLoadingConfig(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const result = await api.downloadDeviceConfig(deviceId);
      setConfig(result.text);
      downloadText(result.filename ?? `${deviceName}.toml`, result.text);
      push("Agent 配置已下载，请妥善保管", "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "下载失败", "error");
    } finally {
      setDownloading(false);
    }
  };

  const revealConfig = async () => {
    if (!config) {
      const loaded = await ensureConfig();
      if (!loaded) return;
    }
    setShowConfig((value) => !value);
  };

  return (
    <div className="agent-setup">
      <InfoBanner tone="warning">
        配置文件包含设备凭据，等同于设备密码。请通过安全渠道传输，不要提交到公开仓库或发送到群聊。
      </InfoBanner>

      <div className="agent-task">
        <span className="agent-task-index">1</span>
        <div className="agent-task-copy">
          <strong>下载设备配置</strong>
          <small>包含这台设备的独立凭据，只对它有效。</small>
        </div>
        <Button variant="primary" size="sm" icon="download" loading={downloading} onClick={() => void download()}>
          下载配置
        </Button>
      </div>

      <div className="agent-task">
        <span className="agent-task-index">2</span>
        <div className="agent-task-copy">
          <strong>安装 frp 并启动 Agent</strong>
          <small>选择设备系统，复制命令在设备终端执行。</small>
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { id: "linux", label: "Linux" },
          { id: "windows", label: "Windows" },
          { id: "macos", label: "macOS" },
        ]}
      />

      <div className="agent-command">
        <div className="agent-command-head">
          <span><Icon name="terminal" size={14} /> 在 {tab === "windows" ? "PowerShell" : "终端"} 中运行</span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              void copyText(commandText)
                .then(() => push("命令已复制", "success"))
                .catch(() => push("复制失败，请手动选择命令", "error"));
            }}
          >
            <Icon name="copy" size={13} /> 复制命令
          </button>
        </div>
        <pre>{commandText}</pre>
      </div>

      <div className="agent-actions">
        <Button variant="ghost" size="sm" icon="eye" loading={loadingConfig} onClick={() => void revealConfig()}>
          {showConfig ? "隐藏配置内容" : "查看配置内容"}
        </Button>
        <span className="agent-status-hint">
          <Icon name="activity" size={14} /> 看到设备变为“在线”后即可创建隧道
        </span>
      </div>

      {showConfig && (
        <div className="agent-config-reveal">
          {loadingConfig && !config ? (
            <div className="setup-loading"><Spinner size={18} /><span>读取配置…</span></div>
          ) : (
            <CodeBlock value={config ?? ""} title="frpc.toml" maxHeight={300} />
          )}
        </div>
      )}
    </div>
  );
}
