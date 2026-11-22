import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { initials, roleLabel } from "../lib/format";
import type { ServerMeta } from "../lib/types";
import { BrandMark, Icon, type IconName } from "./Icon";
import { Avatar } from "./ui";

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
}

const NAV: Array<{ section: string; items: NavEntry[] }> = [
  {
    section: "工作台",
    items: [
      { to: "/", label: "网络总览", icon: "dashboard" },
      { to: "/devices", label: "设备", icon: "devices" },
      { to: "/tunnels", label: "隧道", icon: "route" },
    ],
  },
  {
    section: "管理",
    items: [
      { to: "/team", label: "团队成员", icon: "users", adminOnly: true },
      { to: "/audit", label: "审计日志", icon: "audit", adminOnly: true },
      { to: "/settings", label: "平台设置", icon: "settings" },
    ],
  },
];

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "网络总览", subtitle: "所有设备、隧道与安全事件，一目了然。" },
  "/devices": { title: "设备", subtitle: "登记运行 Agent 的设备并管理访问凭据。" },
  "/tunnels": { title: "隧道", subtitle: "将内网服务安全地映射到边缘公网端口。" },
  "/team": { title: "团队成员", subtitle: "管理平台成员、角色与登录安全。" },
  "/audit": { title: "审计日志", subtitle: "追踪平台上的每一次关键操作。" },
  "/settings": { title: "平台设置", subtitle: "查看边缘节点、安全策略与 Agent 资源。" },
  "/profile": { title: "个人设置", subtitle: "维护你的账号密码与双重验证状态。" },
};

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [meta, setMeta] = useState<ServerMeta | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api
      .meta()
      .then((result) => setMeta(result.server))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const pageMeta = PAGE_META[location.pathname] ?? {
    title: location.pathname.startsWith("/devices/") ? "设备详情" : "MistBridge",
    subtitle: "安全地连接每一个内网服务。",
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (!user) return null;

  return (
    <div className="app-shell">
      <div
        className={`sidebar-scrim ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <BrandMark size={36} />
          <div>
            <strong>MISTBRIDGE</strong>
            <span>雾桥 · Tunnel Console</span>
          </div>
          <button type="button" className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="关闭菜单">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="sidebar-edge">
          <div className="edge-status">
            <span className="live-dot" />
            <span>Edge node</span>
            <span className="edge-label">RUNNING</span>
          </div>
          <div className="edge-address">
            {meta ? `${meta.serverAddr}:${meta.controlPort}` : "正在获取节点…"}
          </div>
          <div className="edge-range">
            {meta ? `公网端口 ${meta.publicPortMin}–${meta.publicPortMax}` : "安全 TLS 数据通道"}
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          {NAV.map((group) => {
            const items = group.items.filter((item) => !item.adminOnly || user.role === "admin");
            if (items.length === 0) return null;
            return (
              <div className="nav-group" key={group.section}>
                <p className="nav-section">{group.section}</p>
                {items.map((item) => {
                  const active =
                    item.to === "/"
                      ? location.pathname === "/"
                      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={`nav-item ${active ? "nav-item-active" : ""}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon name={item.icon} size={18} />
                      <span>{item.label}</span>
                      {active && <span className="nav-active-mark" />}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/profile" className={({ isActive }) => `sidebar-user ${isActive ? "sidebar-user-active" : ""}`}>
            <Avatar name={user.displayName || user.username} size={34} />
            <span className="sidebar-user-info">
              <strong>{user.displayName || user.username}</strong>
              <small>{roleLabel(user.role)}</small>
            </span>
            <Icon name="chevronRight" size={15} />
          </NavLink>
          <div className="sidebar-version">
            <span>MISTBRIDGE v1.0</span>
            <span className="secure-mark">
              <Icon name="shield" size={12} /> TLS
            </span>
          </div>
        </div>
      </aside>

      <div className="main-pane">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="打开导航">
              <Icon name="menu" size={20} />
            </button>
            <div className="topbar-title">
              <span className="topbar-eyebrow">
                <Icon name="route" size={13} /> Secure tunnel fabric
              </span>
              <h1>{pageMeta.title}</h1>
            </div>
          </div>
          <div className="topbar-right">
            <div className="topbar-status">
              <span className="live-dot" />
              <span>边缘节点在线</span>
            </div>
            <div className="user-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="user-menu-button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <Avatar name={user.displayName || user.username} size={32} />
                <span className="user-menu-name">{user.displayName || user.username}</span>
                <Icon name="chevronDown" size={14} />
              </button>
              {menuOpen && (
                <div className="user-menu" role="menu">
                  <div className="user-menu-head">
                    <strong>{user.displayName || user.username}</strong>
                    <span>@{user.username} · {roleLabel(user.role)}</span>
                  </div>
                  <button type="button" role="menuitem" onClick={() => navigate("/profile")}>
                    <Icon name="profile" size={16} /> 个人设置
                  </button>
                  {user.role === "admin" && (
                    <button type="button" role="menuitem" onClick={() => navigate("/settings")}>
                      <Icon name="settings" size={16} /> 平台设置
                    </button>
                  )}
                  <div className="menu-separator" />
                  <button type="button" role="menuitem" className="menu-danger" onClick={() => void handleLogout()}>
                    <Icon name="logout" size={16} /> 退出登录
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="main-content">
          <div className="content-inner">
            <div className="page-subtitle-row">
              <span>{pageMeta.subtitle}</span>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function userInitials(name: string): string {
  return initials(name);
}
