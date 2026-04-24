import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, type: 'info', duration: 3500, ...toast };
    setToasts((prev) => [...prev, t]);
    if (t.duration > 0) {
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), t.duration);
    }
  }, []);

  const api = {
    success: (msg) => push({ type: 'success', message: msg }),
    error: (msg) => push({ type: 'error', message: msg, duration: 5000 }),
    info: (msg) => push({ type: 'info', message: msg }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[60] space-y-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md shadow-lg px-4 py-3 text-sm text-white ${
              t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-slate-800'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
