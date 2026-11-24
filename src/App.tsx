import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import Layout from '@/components/Layout';
import { Spinner } from '@/components/ui';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import ReportPage from '@/pages/ReportPage';
import ComplaintsPage from '@/pages/ComplaintsPage';
import ComplaintDetailPage from '@/pages/ComplaintDetailPage';
import MapPage from '@/pages/MapPage';
import ProfilePage from '@/pages/ProfilePage';
import AcceptInvitePage from '@/pages/AcceptInvitePage';
import AdminComplaintsPage from '@/pages/AdminComplaintsPage';
import AdminAnalyticsPage from '@/pages/AdminAnalyticsPage';
import AdminPeoplePage from '@/pages/AdminPeoplePage';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading StreetWise…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!roles.includes(role ?? '')) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route element={<Protected />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/report"
          element={
            <RequireRole roles={['citizen']}>
              <ReportPage />
            </RequireRole>
          }
        />
        <Route
          path="/complaints"
          element={
            <RequireRole roles={['citizen']}>
              <ComplaintsPage />
            </RequireRole>
          }
        />
        <Route
          path="/queue"
          element={
            <RequireRole roles={['authority']}>
              <ComplaintsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/complaints"
          element={
            <RequireRole roles={['admin']}>
              <AdminComplaintsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <RequireRole roles={['admin']}>
              <AdminAnalyticsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/people"
          element={
            <RequireRole roles={['admin']}>
              <AdminPeoplePage />
            </RequireRole>
          }
        />
        <Route path="/complaints/:id" element={<ComplaintDetailPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
