import { useEffect, useMemo, useRef, useState } from 'react';
import { DomainsAPI, CategoriesAPI, UsersAPI } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge, { daysBadge } from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';

const emptyForm = { domain: '', name: '', admin_user_id: '', category_id: '', note: '' };

function daysFromIso(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (isNaN(ms)) return null;
  return Math.ceil((ms - Date.now()) / (24 * 3600 * 1000));
}

function worstStatus(ssl, dom) {
  const arr = [ssl, dom];
  if (arr.includes('critical')) return 'critical';
  if (arr.includes('warning')) return 'warning';
  if (arr.includes('unknown')) return 'unknown';
  return 'ok';
}

function statusOf(days) {
  if (days === null) return 'unknown';
  if (days < 7) return 'critical';
  if (days < 30) return 'warning';
  return 'ok';
}

export default function Domains() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [sortBy, setSortBy] = useState('expiry'); // expiry | domain
  const [editing, setEditing] = useState(null); // null | 'new' | object
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [settingUpId, setSettingUpId] = useState(null);
  const fileRef = useRef(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [d, c, u] = await Promise.all([DomainsAPI.list(), CategoriesAPI.list(), UsersAPI.list()]);
      setRows(d);
      setCats(c);
      setUsers(u);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = rows;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) =>
      r.domain.toLowerCase().includes(q) ||
      (r.name || '').toLowerCase().includes(q) ||
      (r.admin_name || '').toLowerCase().includes(q) ||
      (r.note || '').toLowerCase().includes(q)
    );
    if (categoryFilter) list = list.filter((r) => String(r.category_id) === String(categoryFilter));
    if (adminFilter) list = list.filter((r) => String(r.admin_user_id) === String(adminFilter));
    list = [...list];
    if (sortBy === 'domain') {
      list.sort((a, b) => a.domain.localeCompare(b.domain));
    } else {
      list.sort((a, b) => {
        const aMin = Math.min(
          daysFromIso(a.ssl_expiry) ?? Infinity,
          daysFromIso(a.domain_expiry) ?? Infinity
        );
        const bMin = Math.min(
          daysFromIso(b.ssl_expiry) ?? Infinity,
          daysFromIso(b.domain_expiry) ?? Infinity
        );
        return aMin - bMin;
      });
    }
    return list;
  }, [rows, search, categoryFilter, adminFilter, sortBy]);

  function openNew() { setForm(emptyForm); setEditing('new'); }
  function openEdit(row) {
    setForm({
      domain: row.domain,
      name: row.name || '',
      admin_user_id: row.admin_user_id || '',
      category_id: row.category_id || '',
      note: row.note || '',
    });
    setEditing(row);
  }

  async function save() {
    if (!form.domain.trim()) { toast.error('Domain is required'); return; }
    setSaving(true);
    try {
      const payload = {
        domain: form.domain.trim(),
        name: form.name.trim() || null,
        admin_user_id: form.admin_user_id ? Number(form.admin_user_id) : null,
        category_id: form.category_id ? Number(form.category_id) : null,
        note: form.note || null,
      };
      if (editing === 'new') {
        await DomainsAPI.create(payload);
        toast.success('Domain added');
      } else {
        await DomainsAPI.update(editing.id, payload);
        toast.success('Domain updated');
      }
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    const label = row.name ? `${row.name} (${row.domain})` : row.domain;
    if (!confirm(`Delete ${label}? This removes its alerts too.`)) return;
    try {
      await DomainsAPI.remove(row.id);
      toast.success('Deleted');
      setRows((r) => r.filter((x) => x.id !== row.id));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function checkOne(row) {
    const label = row.name || row.domain;
    setCheckingId(row.id);
    try {
      const res = await DomainsAPI.runCheck(row.id);
      const r = res?.results?.[0];
      if (r?.ssl_error || r?.domain_error) {
        const parts = [];
        if (r.ssl_error) parts.push(`SSL: ${r.ssl_error}`);
        if (r.domain_error) parts.push(`Domain: ${r.domain_error}`);
        toast.error(`${label} — ${parts.join(' · ')}`);
      } else {
        toast.success(`${label} checked`);
      }
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckingId(null);
    }
  }

  async function setupAlerts(row) {
    if (!row.admin_user_id) { toast.error('Assign an admin first'); return; }
    setSettingUpId(row.id);
    try {
      const r = await DomainsAPI.setupAdminAlerts(row.id);
      toast.success(`${row.admin_name}: ${r.created} alert(s) created, ${r.skipped} already existed`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSettingUpId(null);
    }
  }

  async function importCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await DomainsAPI.importCsv(file);
      let msg = `Imported ${res.inserted}, skipped ${res.skipped}`;
      if (res.unmatched_admins?.length) {
        msg += ` · unknown admins: ${res.unmatched_admins.join(', ')}`;
      }
      toast.success(msg);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      e.target.value = '';
    }
  }

  if (loading) return <div className="py-20 text-center"><Spinner className="w-8 h-8 mx-auto text-brand-600" /></div>;
  if (error) return <div className="card p-6 text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search by website, domain, admin, note..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[12rem]" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input max-w-[12rem]" value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)}>
          <option value="">All admins</option>
          <option value="__none__" disabled>— with admin —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="input max-w-[10rem]" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="expiry">Sort: Expiry</option>
          <option value="domain">Sort: A–Z</option>
        </select>
        <div className="ml-auto flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Import CSV</button>
          <button className="btn-primary" onClick={openNew}>+ Add Domain</button>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <EmptyState title="No domains" hint="Add your first domain to start monitoring." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Website / Domain</th>
                  <th>Category</th>
                  <th>Admin</th>
                  <th>SSL days left</th>
                  <th>Domain days left</th>
                  <th>Status</th>
                  <th>Last checked</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const sslDays = daysFromIso(r.ssl_expiry);
                  const domDays = daysFromIso(r.domain_expiry);
                  const sslB = daysBadge(sslDays);
                  const domB = daysBadge(domDays);
                  const status = worstStatus(statusOf(sslDays), statusOf(domDays));
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="font-medium">{r.name || r.domain}</div>
                        <div className="text-xs text-slate-500">{r.domain}</div>
                        {r.note && <div className="text-xs text-slate-400 mt-0.5">{r.note}</div>}
                      </td>
                      <td>
                        {r.category_name ? (
                          <span className="badge" style={{ background: `${r.category_color}22`, color: r.category_color }}>
                            {r.category_name}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="text-sm">
                        {r.admin_name ? (
                          <div className="space-y-0.5">
                            <div className={r.admin_active === 0 ? 'text-slate-400 line-through' : ''}>
                              {r.admin_name}
                            </div>
                            <div className="flex gap-1 text-[10px]">
                              {r.admin_has_line === 1 && <span className="badge bg-green-100 text-green-800">LINE</span>}
                              {r.admin_email && <span className="badge bg-blue-100 text-blue-800" title={r.admin_email}>Email</span>}
                            </div>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className={sslB.cls} title={r.ssl_expiry || ''}>{sslB.text}</span>
                          {r.ssl_error && !r.ssl_expiry && (
                            <span title={r.ssl_error} className="text-red-500 cursor-help">⚠</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className={domB.cls} title={r.domain_expiry || ''}>{domB.text}</span>
                          {r.domain_error && !r.domain_expiry && (
                            <span title={r.domain_error} className="text-red-500 cursor-help">⚠</span>
                          )}
                        </div>
                      </td>
                      <td><StatusBadge status={status} /></td>
                      <td className="text-xs text-slate-500">{r.last_checked ? new Date(r.last_checked).toLocaleString() : '—'}</td>
                      <td className="text-right">
                        <div className="inline-flex gap-1">
                          <button className="btn-ghost" disabled={checkingId === r.id} onClick={() => checkOne(r)}>
                            {checkingId === r.id ? <Spinner className="w-4 h-4" /> : 'Check'}
                          </button>
                          {r.admin_user_id && (
                            <button
                              className="btn-ghost"
                              title="Create default alert rules (30d, 7d SSL + domain) for admin"
                              disabled={settingUpId === r.id}
                              onClick={() => setupAlerts(r)}
                            >
                              {settingUpId === r.id ? <Spinner className="w-4 h-4" /> : '🔔'}
                            </button>
                          )}
                          <button className="btn-ghost" onClick={() => openEdit(r)}>Edit</button>
                          <button className="btn-ghost text-red-600" onClick={() => remove(r)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add domain' : `Edit ${editing?.name || editing?.domain || ''}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={save}>
              {saving && <Spinner className="w-4 h-4" />} Save
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Domain</label>
            <input className="input" placeholder="example.com" value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })} />
          </div>
          <div>
            <label className="label">Website name (ชื่อเว็บ)</label>
            <input className="input" placeholder="e.g. Corporate Site" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Administrator (ผู้ดูแลเว็บ)</label>
            <select
              className="input"
              value={form.admin_user_id}
              onChange={(e) => setForm({ ...form, admin_user_id: e.target.value })}
            >
              <option value="">— No admin —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id} disabled={!u.active}>
                  {u.name}{!u.active ? ' (inactive)' : ''}
                  {u.line_token ? ' · LINE' : ''}
                  {u.email ? ' · Email' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Admin จะเชื่อมโยงกับช่องทาง LINE / Email ของผู้ใช้คนนั้นโดยอัตโนมัติ
              — กดปุ่ม 🔔 ในตารางเพื่อสร้างกฎแจ้งเตือนมาตรฐาน (SSL/Domain 30d + 7d) ให้ admin
            </p>
            {users.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                ยังไม่มี user ในระบบ — ไปเพิ่มที่หน้า Users ก่อน
              </p>
            )}
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">No category</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Note</label>
            <textarea className="input" rows={3} value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
