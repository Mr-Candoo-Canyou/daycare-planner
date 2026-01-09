import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ParentDashboard from './pages/ParentDashboard';
import DaycareDashboard from './pages/DaycareDashboard';
import FunderDashboard from './pages/FunderDashboard';
import ApplicationForm from './pages/ApplicationForm';

function App() {
  const { isAuthenticated, user } = useAuthStore();

  const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
    if (!isAuthenticated) {
      return <Navigate to="/login" />;
    }

    if (user && !allowedRoles.includes(user.role)) {
      return <Navigate to="/" />;
    }

    return <>{children}</>;
  };

  const getDashboardForRole = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'parent':
        return '/parent/dashboard';
      case 'daycare_admin':
        return '/daycare/dashboard';
      case 'funder':
        return '/funder/dashboard';
      default:
        return '/login';
    }
  };

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={
        isAuthenticated ? <Navigate to={getDashboardForRole()} /> : <Navigate to="/login" />
      } />

      <Route path="/parent" element={
        <ProtectedRoute allowedRoles={['parent']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<ParentDashboard />} />
        <Route path="apply" element={<ApplicationForm />} />
      </Route>

      <Route path="/daycare" element={
        <ProtectedRoute allowedRoles={['daycare_admin']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<DaycareDashboard />} />
      </Route>

      <Route path="/funder" element={
        <ProtectedRoute allowedRoles={['funder']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<FunderDashboard />} />
      </Route>
    </Routes>
  );
}

export default App;
