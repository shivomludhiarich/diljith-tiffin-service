import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import ProtectedRoute from './ProtectedRoute';
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';
import UserDashboard from '../pages/user/UserDashboard';
import AdminLayout from '../layouts/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminSubscriptions from '../pages/admin/AdminSubscriptions';
import ComingSoon from '../pages/ComingSoon';

import Login from '../pages/Login';
import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';

const soon = (title, stage) => <ComingSoon title={title} stage={stage} />;

// The admin portal has its own layout (no public navbar/footer).
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/plans" element={<Navigate to="/#rates" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute role="user" />}>
          <Route path="/user/dashboard" element={<UserDashboard />} />
          <Route path="/user/subscription" element={soon('My subscription', 'Stage 4')} />
          <Route path="/user/orders" element={soon('My orders', 'Stage 4')} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<ProtectedRoute role="admin" />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
        </Route>
      </Route>
    </Routes>
  );
}
