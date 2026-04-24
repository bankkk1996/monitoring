import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

const titles = {
  '/': 'Dashboard',
  '/domains': 'Domains',
  '/categories': 'Categories',
  '/users': 'Users',
  '/alerts': 'Alerts',
};

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const title = titles[pathname] || 'Monitor';

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
