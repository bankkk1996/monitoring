import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', icon: 'M3 12l2-2 4 4 8-8 2 2-10 10-6-6z' },
  { to: '/domains', label: 'Domains', icon: 'M4 6h16M4 12h16M4 18h16' },
  { to: '/categories', label: 'Categories', icon: 'M7 7h10v10H7z' },
  { to: '/users', label: 'Users', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0H5z' },
  { to: '/alerts', label: 'Alerts', icon: 'M12 2a7 7 0 017 7v4l2 3H3l2-3V9a7 7 0 017-7z' },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed z-40 inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform lg:relative lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded bg-brand-600 text-white flex items-center justify-center font-bold">M</div>
          <span className="ml-2 font-semibold text-slate-900 dark:text-white">Monitor</span>
        </div>
        <nav className="p-3 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d={l.icon} />
              </svg>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
