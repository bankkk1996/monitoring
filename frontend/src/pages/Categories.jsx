import { useEffect, useState } from 'react';
import { CategoriesAPI } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../components/Toast.jsx';

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

const emptyForm = { name: '', color: '#3b82f6' };

export default function Categories() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const r = await CategoriesAPI.list();
      setRows(r);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openNew() { setForm(emptyForm); setEditing('new'); }
  function openEdit(c) { setForm({ name: c.name, color: c.color }); setEditing(c); }

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editing === 'new') await CategoriesAPI.create(form);
      else await CategoriesAPI.update(editing.id, form);
      toast.success('Saved');
      setEditing(null);
      await load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function remove(c) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try { await CategoriesAPI.remove(c.id); toast.success('Deleted'); await load(); }
    catch (err) { toast.error(err.message); }
  }

  if (loading) return <div className="py-20 text-center"><Spinner className="w-8 h-8 mx-auto text-brand-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={openNew}>+ Add Category</button>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState title="No categories" hint="Create categories to group your domains." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Color</th>
                  <th>Domains</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 rounded" style={{ background: c.color }} />
                        <span className="text-xs text-slate-500">{c.color}</span>
                      </span>
                    </td>
                    <td>{c.domain_count}</td>
                    <td className="text-right">
                      <button className="btn-ghost" onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn-ghost text-red-600" onClick={() => remove(c)}>Delete</button>
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
        title={editing === 'new' ? 'Add category' : `Edit ${editing?.name || ''}`}
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
            <label className="label">Color</label>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((p) => (
                <button
                  key={p} type="button"
                  onClick={() => setForm({ ...form, color: p })}
                  className={`w-7 h-7 rounded-full border-2 ${form.color === p ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
                  style={{ background: p }}
                />
              ))}
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-9 h-9 rounded cursor-pointer border border-slate-300 dark:border-slate-700" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
