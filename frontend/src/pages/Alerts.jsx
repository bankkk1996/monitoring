import { useEffect, useState } from 'react';
import { AlertsAPI, DomainsAPI, UsersAPI } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../components/Toast.jsx';

const emptyForm = {
  domain_id: '',
  user_id: '',
  type: 'ssl',
  days_before: 30,
  repeat_daily: false,
};

export default function Alerts() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [domains, setDomains] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const [a, d, u] = await Promise.all([AlertsAPI.list(), DomainsAPI.list(), UsersAPI.list()]);
      setRows(a); setDomains(d); setUsers(u);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openNew() { setForm(emptyForm); setEditing('new'); }
  function openEdit(a) {
    setForm({
      domain_id: a.domain_id,
      user_id: a.user_id,
      type: a.type,
      days_before: a.days_before,
      repeat_daily: !!a.repeat_daily,
    });
    setEditing(a);
  }

  async function save() {
    if (!form.domain_id || !form.user_id) { toast.error('Select domain and user'); return; }
    setSaving(true);
    try {
      const payload = {
        domain_id: Number(form.domain_id),
        user_id: Number(form.user_id),
        type: form.type,
        days_before: Number(form.days_before),
        repeat_daily: !!form.repeat_daily,
      };
      if (editing === 'new') await AlertsAPI.create(payload);
      else await AlertsAPI.update(editing.id, payload);
      toast.success('Saved');
      setEditing(null);
      await load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function remove(a) {
    if (!confirm('Delete this alert?')) return;
    try { await AlertsAPI.remove(a.id); toast.success('Deleted'); await load(); }
    catch (err) { toast.error(err.message); }
  }

  if (loading) return <div className="py-20 text-center"><Spinner className="w-8 h-8 mx-auto text-brand-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={openNew} disabled={domains.length === 0 || users.length === 0}>
          + Add Alert
        </button>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState
            title="No alerts configured"
            hint={domains.length === 0 || users.length === 0
              ? 'Add at least one domain and one user first.'
              : 'Set up alerts so you are notified before expiry.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Website</th>
                  <th>User</th>
                  <th>Type</th>
                  <th>Days before</th>
                  <th>Repeat daily</th>
                  <th>Last sent</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="font-medium">{a.website_name || a.domain_name}</div>
                      {a.website_name && <div className="text-xs text-slate-500">{a.domain_name}</div>}
                    </td>
                    <td>{a.user_name}</td>
                    <td>
                      <span className={a.type === 'ssl' ? 'badge bg-blue-100 text-blue-800' : 'badge bg-purple-100 text-purple-800'}>
                        {a.type.toUpperCase()}
                      </span>
                    </td>
                    <td>{a.days_before}</td>
                    <td>{a.repeat_daily ? 'Yes' : 'No'}</td>
                    <td className="text-xs text-slate-500">{a.last_sent ? new Date(a.last_sent).toLocaleString() : '—'}</td>
                    <td className="text-right">
                      <button className="btn-ghost" onClick={() => openEdit(a)}>Edit</button>
                      <button className="btn-ghost text-red-600" onClick={() => remove(a)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add alert' : 'Edit alert'}
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
            <label className="label">Website</label>
            <select className="input" value={form.domain_id} onChange={(e) => setForm({ ...form, domain_id: e.target.value })}>
              <option value="">Select a website</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name ? `${d.name} (${d.domain})` : d.domain}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">User</label>
            <select className="input" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
              <option value="">Select a user</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="ssl">SSL</option>
                <option value="domain">Domain</option>
              </select>
            </div>
            <div>
              <label className="label">Days before</label>
              <input className="input" type="number" min="1" max="365" value={form.days_before}
                onChange={(e) => setForm({ ...form, days_before: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.repeat_daily} onChange={(e) => setForm({ ...form, repeat_daily: e.target.checked })} />
            <span>Repeat daily until resolved</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
