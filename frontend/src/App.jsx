import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Domains from './pages/Domains.jsx';
import Categories from './pages/Categories.jsx';
import Users from './pages/Users.jsx';
import Alerts from './pages/Alerts.jsx';

export default function App() {
  return (
    <ToastProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/domains" element={<Domains />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/users" element={<Users />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </ToastProvider>
  );
}
