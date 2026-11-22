import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ToastProvider } from "./components/Toast";
import { BrandMark, Icon } from "./components/Icon";
import { Button, Card, EmptyState, Spinner } from "./components/ui";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DevicesPage } from "./pages/DevicesPage";
import { DeviceDetailPage } from "./pages/DeviceDetailPage";
import { TunnelsPage } from "./pages/TunnelsPage";
import { TeamPage } from "./pages/TeamPage";
import { AuditPage } from "./pages/AuditPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProfilePage } from "./pages/ProfilePage";

function FullScreenLoader() {
  return (
    <div className="auth-loading">
      <BrandMark size={46} />
      <Spinner size={20} />
      <span>正在建立安全会话…</span>
    </div>
  );
}

function RequireAuth() {
  const { user, loading, mustChangePassword, mustSetup2fa } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (mustChangePassword || mustSetup2fa) return <Navigate to="/setup" replace />;
  return <Outlet />;
}

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="notfound-page">
      <Card>
        <EmptyState
          icon="route"
          title="这条路没有通向任何地方"
          description="页面不存在，或者已经移动到别的位置。"
          action={<Button icon="arrowLeft" onClick={() => navigate("/")}>返回网络总览</Button>}
        />
      </Card>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="devices" element={<DevicesPage />} />
              <Route path="devices/:id" element={<DeviceDetailPage />} />
              <Route path="tunnels" element={<TunnelsPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}

export function AppFallback() {
  return (
    <div className="auth-loading">
      <BrandMark size={42} />
      <span>MistBridge console</span>
    </div>
  );
}

export function SecurityBadge() {
  return (
    <span className="secure-mark">
      <Icon name="shield" size={12} /> protected
    </span>
  );
}
