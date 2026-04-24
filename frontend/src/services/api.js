const DEFAULT_TIMEOUT = 20000;
const BASE = import.meta.env.VITE_API_BASE || '';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = 'GET', body, headers = {}, timeout = DEFAULT_TIMEOUT, signal, isForm = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeout);

  // Allow caller's signal to cancel as well
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }

  const init = { method, signal: controller.signal, headers: { ...headers } };

  if (body !== undefined && body !== null) {
    if (isForm || body instanceof FormData) {
      init.body = body;
    } else {
      init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
      init.body = JSON.stringify(body);
    }
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      throw new ApiError(`Request timeout after ${timeout}ms`, 0, null);
    }
    throw new ApiError(err.message || 'Network error', 0, null);
  }
  clearTimeout(timer);

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const msg = (data && data.error) || res.statusText || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  upload: (path, formData, opts) => request(path, { ...opts, method: 'POST', body: formData, isForm: true }),
};

export { ApiError };

// Convenience endpoint wrappers
export const DomainsAPI = {
  list: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
    return api.get(`/api/domains${q ? `?${q}` : ''}`);
  },
  get: (id) => api.get(`/api/domains/${id}`),
  create: (data) => api.post('/api/domains', data),
  update: (id, data) => api.put(`/api/domains/${id}`, data),
  remove: (id) => api.del(`/api/domains/${id}`),
  runCheck: (id) => api.post('/api/domains/check/run', id ? { id } : {}, { timeout: 120000 }),
  setupAdminAlerts: (id) => api.post(`/api/domains/${id}/setup-admin-alerts`, {}),
  importCsv: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload('/api/domains/import', fd);
  },
};

export const CategoriesAPI = {
  list: () => api.get('/api/categories'),
  create: (data) => api.post('/api/categories', data),
  update: (id, data) => api.put(`/api/categories/${id}`, data),
  remove: (id) => api.del(`/api/categories/${id}`),
};

export const UsersAPI = {
  list: () => api.get('/api/users'),
  create: (data) => api.post('/api/users', data),
  update: (id, data) => api.put(`/api/users/${id}`, data),
  remove: (id) => api.del(`/api/users/${id}`),
  test: (id) => api.post(`/api/users/${id}/test`, {}),
};

export const AlertsAPI = {
  list: () => api.get('/api/alerts'),
  create: (data) => api.post('/api/alerts', data),
  update: (id, data) => api.put(`/api/alerts/${id}`, data),
  remove: (id) => api.del(`/api/alerts/${id}`),
};

export const DashboardAPI = {
  get: (signal) => api.get('/api/dashboard', { signal }),
};
