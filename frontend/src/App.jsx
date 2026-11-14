import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Layout from './Layout.jsx';
import Auth from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import Report from './pages/Report.jsx';
import Ticket from './pages/Ticket.jsx';
import DeptHead from './pages/DeptHead.jsx';
import Admin from './pages/Admin.jsx';
import MyIssues from './pages/MyIssues.jsx';
import Notifications from './pages/Notifications.jsx';

function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function Landing() {
  const { user } = useAuth();
  if (user.role === 'dept_head') return <Navigate to="/head" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Home />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/register" element={<Auth mode="register" />} />
      <Route path="/" element={<Guard><Landing /></Guard>} />
      <Route path="/ongoing" element={<Guard roles={['student']}><MyIssues kind="ongoing" /></Guard>} />
      <Route path="/closed" element={<Guard roles={['student']}><MyIssues kind="closed" /></Guard>} />
      <Route path="/notifications" element={<Guard><Notifications /></Guard>} />
      <Route path="/report" element={<Guard roles={['student']}><Report /></Guard>} />
      <Route path="/ticket/:id" element={<Guard><Ticket /></Guard>} />
      <Route path="/head" element={<Guard roles={['dept_head', 'admin']}><DeptHead /></Guard>} />
      <Route path="/admin" element={<Guard roles={['admin']}><Admin /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
