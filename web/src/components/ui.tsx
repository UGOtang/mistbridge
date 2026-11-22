import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";
import { useToast } from "./Toast";
import { copyText } from "../lib/format";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  iconRight,
  full,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cx("btn", `btn-${variant}`, `btn-${size}`, full && "btn-full", className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size={15} /> : icon ? <Icon name={icon} size={size === "sm" ? 15 : 17} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={16} /> : null}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  tone?: "default" | "danger";
  size?: number;
}

export function IconButton({ icon, label, tone = "default", size = 17, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cx("icon-btn", tone === "danger" && "icon-btn-danger", className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Card({
  children,
  className,
  padding,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return <div className={cx("card", padding && "card-padded", className)}>{children}</div>;
}

export function Badge({
  children,
  tone = "neutral",
  dot,
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral" | "info" | "teal";
  dot?: boolean;
}) {
  return (
    <span className={cx("badge", `badge-${tone}`)}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("field", className)}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("input", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("input select", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("input textarea", className)} {...props} />;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "搜索…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Icon name="search" size={16} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="清空搜索" className="search-clear">
          <Icon name="close" size={13} />
        </button>
      )}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  // Keep the latest callback without making it an effect dependency. Re-running
  // the focus effect on every parent render steals focus from inputs/selects.
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusSelector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const focusTimer = window.setTimeout(() => {
      // Respect an autoFocus field inside the dialog; otherwise focus the
      // dialog itself so mobile keyboards do not open unexpectedly.
      if (panel && !panel.contains(document.activeElement)) panel.focus();
    }, 0);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusSelector)).filter(
        (element) => element.getClientRects().length > 0,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || active === panel || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      const previous = previousFocusRef.current;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={cx("modal", `modal-${size}`)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon="close" label="关闭" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  tone = "danger",
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="confirm-copy">{description}</p>
    </Modal>
  );
}

export function CopyButton({
  value,
  label = "复制",
  className,
  compact,
}: {
  value: string;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cx(compact ? "icon-btn" : "btn btn-ghost btn-sm", className)}
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await copyText(value);
          setCopied(true);
          push("已复制到剪贴板", "success");
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          push("复制失败，请手动选择", "error");
        }
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={compact ? 16 : 15} />
      {!compact && (copied ? "已复制" : label)}
    </button>
  );
}

export function CodeBlock({
  value,
  title,
  filename,
  maxHeight,
}: {
  value: string;
  title?: string;
  filename?: string;
  maxHeight?: number;
}) {
  return (
    <div className="code-block">
      <div className="code-head">
        <span>
          <Icon name="terminal" size={14} />
          {title ?? filename ?? "配置"}
        </span>
        <CopyButton value={value} compact label="复制内容" />
      </div>
      <pre style={maxHeight ? { maxHeight } : undefined}>
        <code>{value}</code>
      </pre>
    </div>
  );
}

export function EmptyState({
  icon = "sparkles",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-wrap" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton-line" style={{ width: `${88 - (index % 3) * 13}%` }} />
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx("toggle", checked && "toggle-on")}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span />
    </button>
  );
}

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const cleaned = name.trim();
  const text = cleaned ? cleaned.slice(0, 2).toUpperCase() : "MB";
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {text}
    </span>
  );
}

export function Tabs<T extends string>({
  items,
  active,
  onChange,
  className,
}: {
  items: Array<{ id: T; label: string; icon?: IconName; badge?: string }>;
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("tabs", className)} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={cx("tab", active === item.id && "tab-active")}
          onClick={() => onChange(item.id)}
        >
          {item.icon && <Icon name={item.icon} size={15} />}
          {item.label}
          {item.badge && <span className="tab-badge">{item.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <span>
        共 {total} 条 · 第 {page} / {pages} 页
      </span>
      <div className="pagination-actions">
        <Button variant="ghost" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          上一页
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>
          下一页
        </Button>
      </div>
    </div>
  );
}

const RULES = [
  { test: (value: string) => value.length >= 12, label: "至少 12 位" },
  { test: (value: string) => /[a-z]/.test(value), label: "小写字母" },
  { test: (value: string) => /[A-Z]/.test(value), label: "大写字母" },
  { test: (value: string) => /[0-9]/.test(value), label: "数字" },
  { test: (value: string) => /[^A-Za-z0-9]/.test(value), label: "符号" },
];

export function StrengthMeter({ password }: { password: string }) {
  const passed = RULES.filter((rule) => rule.test(password)).length;
  const score = Math.min(4, Math.max(0, passed - 1));
  return (
    <div className="strength">
      <div className="strength-bars">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={index < score ? `strength-${score}` : ""} />
        ))}
      </div>
      <div className="strength-labels">
        {RULES.map((rule) => (
          <span key={rule.label} className={rule.test(password) ? "rule-ok" : ""}>
            <Icon name={rule.test(password) ? "check" : "close"} size={11} />
            {rule.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-banner" role="alert">
      <Icon name="alert" size={16} />
      <span>{message}</span>
    </div>
  );
}

export function InfoBanner({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return (
    <div className={cx("info-banner", tone === "warning" && "info-banner-warning")}>
      <Icon name={tone === "warning" ? "alert" : "info"} size={16} />
      <span>{children}</span>
    </div>
  );
}

export function usePasswordId(prefix: string): string {
  return useId().replace(/:/g, "") + prefix;
}
