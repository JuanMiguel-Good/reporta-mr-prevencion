import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { CameraPage } from './pages/CameraPage';
import { GalleryPage } from './pages/GalleryPage';
import { UsersPage } from './pages/UsersPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { PlansPage } from './pages/PlansPage';
import { MultiCompanyManagersPage } from './pages/MultiCompanyManagersPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { HelpPage } from './pages/HelpPage';
import MetricsPage from './pages/MetricsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import { Loading } from './components/common/Loading';
import { GlobalNotificationManager } from './components/common/GlobalNotificationManager';
import { BadgeInstallGuide } from './components/common/BadgeInstallGuide';
import { AndroidBadgeWarning } from './components/common/AndroidBadgeWarning';
import { RegistrationWelcome } from './components/common/RegistrationWelcome';

function AppRoutes() {
  const { user, loading, isImpersonating } = useAuth();

  if (loading) {
    return <Loading fullScreen />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const getDefaultRoute = () => {
    if (user.role === 'super_admin' && !isImpersonating) {
      return '/companies';
    }
    if (user.role === 'worker') {
      return '/camera';
    }
    return '/gallery';
  };

  const defaultRoute = getDefaultRoute();

  const canAccessOperational = user.role !== 'super_admin' || isImpersonating;

  return (
    <>
      <GlobalNotificationManager />
      <BadgeInstallGuide />
      <AndroidBadgeWarning />
      <RegistrationWelcome />
      <Routes>
        {canAccessOperational && (
        <Route
          path="/camera"
          element={
            <ProtectedRoute>
              <CameraPage />
            </ProtectedRoute>
          }
        />
      )}

      {canAccessOperational && (
        <Route
          path="/gallery"
          element={
            <ProtectedRoute>
              <AppLayout>
                <GalleryPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
      )}

      <Route path="/" element={<Navigate to={defaultRoute} replace />} />

      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['sst_manager', 'super_admin']}>
            <AppLayout>
              <UsersPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/configuration"
        element={
          <ProtectedRoute allowedRoles={['sst_manager', 'hr_observer', 'super_admin']}>
            <AppLayout>
              <ConfigurationPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/metrics"
        element={
          <ProtectedRoute allowedRoles={['sst_manager', 'hr_observer']}>
            <AppLayout>
              <MetricsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'sst_manager', 'hr_observer']}>
            <AppLayout>
              <AnalyticsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/plans"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <AppLayout>
              <PlansPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/companies"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <AppLayout>
              <CompaniesPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/multi-company-managers"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <AppLayout>
              <MultiCompanyManagersPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/announcements"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <AppLayout>
              <AnnouncementsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <AppLayout>
              <HelpPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
