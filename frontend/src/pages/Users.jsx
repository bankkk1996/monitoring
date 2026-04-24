import { useEffect, useState } from 'react';
import { UsersAPI } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../components/Toast.jsx';

const emptyForm = { name: '', line_token: '', email: '', active: true };

export default function Users() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setRows(await UsersAPI.list());
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openNew() { setForm(emptyForm); setEditing('new'); }
  function openEdit(u) {
    setForm({ name: u.name, line_token: u.line_token || '', email: u.email || '', active: !!u.active });
    setEditing(u);
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.line_token && !form.email) { toast.error('Provide at least one of: LINE token or email'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        line_token: form.line_token.trim() || null,
        email: form.email.trim() || null,
        active: !!form.active,
      };
      if (editing === 'new') await UsersAPI.create(payload);
      else await UsersAPI.update(editing.id, payload);
      toast.success('Saved');
      setEditing(null);
      await load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function remove(u) {
    if (!confirm(`Delete user ${u.name}?`)) return;
    try { await UsersAPI.remove(u.id); toast.success('Deleted'); await load(); }
    catch (err) { toast.error(err.message); }
  }

  async function test(u) {
    setTestingId(u.id);
    try {
      const r = await UsersAPI.test(u.id);
      toast.success(`LINE: ${r.line} · Email: ${r.email}`);
    } catch (err) { toast.error(err.message); }
    finally { setTestingId(null); }
  }

  async function toggleActive(u) {
    try {
      await UsersAPI.update(u.id, { active: !u.active });
      await load();
    } catch (err) { toast.error(err.message); }
  }

  if (loading) return <div className="py-20 text-center"><Spinner className="w-8 h-8 mx-auto text-brand-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={openNew}>+ Add User</button>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState title="No alert receivers" hint="Add someone who should receive LINE or email alerts." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>LINE token</th>
                  <th>Email</th>
                  <th>Active</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.name}</td>
                    <td className="text-xs font-mono text-slate-500">{u.line_token ? `${u.line_token.slice(0, 6)}…` : '—'}</td>
                    <td>{u.email || '—'}</td>
                    <td>
                      <button
                        onClick={() => toggleActive(u)}
                        className={`w-11 h-6 rounded-full flex items-center p-0.5 transition ${u.active ? 'bg-green-500 justify-end' : 'bg-slate-400 justify-start'}`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white" />
                      </button>
                    </td>
                    <td className="text-right">
                      <button className="btn-ghost" disabled={testingId === u.id} onClick={() => test(u)}>
                        {testingId === u.id ? <Spinner className="w-4 h-4" /> : 'Test'}
                      </button>
                      <button className="btn-ghost" onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn-ghost text-red-600" onClick={() => remove(u)}>Delete</button>
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
        title={editing === 'new' ? 'Add user' : `Edit ${editing?.name || ''}`}
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
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">LINE Notify token</label>
            <input className="input" placeholder="personal access token" value={form.line_token}
              onChange={(e) => setForm({ ...form, line_token: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="person@example.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span>Active</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
