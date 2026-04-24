import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { DashboardAPI, DomainsAPI } from '../services/api.js';
import SummaryCard from '../components/SummaryCard.jsx';
import StatusBadge, { daysBadge } from '../components/StatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../components/Toast.jsx';

ChartJS.register(ArcElement, Tooltip, Legend);

const REFRESH_MS = 24 * 60 * 60 * 1000;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const toast = useToast();
  const abortRef = useRef(null);

  async function load() {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setError(null);
      const d = await DashboardAPI.get(controller.signal);
      setData(d);
    } catch (err) {
      if (err.name !== 'ApiError' || err.message !== 'Request timeout after 20000ms') {
        // ignore aborts
        if (!controller.signal.aborted) setError(err.message || 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCheck() {
    setRunning(true);
    try {
      const res = await DomainsAPI.runCheck();
      toast.success(`Checked ${res.checked} domain(s) in ${res.duration_ms}ms`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Check failed');
    } finally {
      setRunning(false);
    }
  }

  const chartData = useMemo(() => {
    const s = data?.summary;
    if (!s) return null;
    return {
      labels: ['OK', 'Warning', 'Critical', 'Unknown'],
      datasets: [
        {
          data: [s.ok, s.warning, s.critical, s.unknown],
          backgroundColor: ['#16a34a', '#eab308', '#dc2626', '#94a3b8'],
          borderWidth: 0,
        },
      ],
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="w-8 h-8 text-brand-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 card">
        <div className="text-red-600">{error}</div>
        <button className="mt-3 btn-secondary" onClick={load}>Retry</button>
      </div>
    );
  }

  const summary = data?.summary || {};
  const expiring = data?.expiring || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">Auto-refreshes every 60 seconds.</p>
        <button className="btn-primary" onClick={runCheck} disabled={running}>
          {running && <Spinner className="w-4 h-4" />} Run check now
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total domains" value={summary.total ?? 0} />
        <SummaryCard label="Expiring < 30d" value={summary.expiring_30 ?? 0} tone="warning" />
        <SummaryCard label="Critical < 7d" value={summary.critical_7 ?? 0} tone="critical" />
        <SummaryCard label="Healthy" value={summary.ok ?? 0} tone="ok" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="p-5 card lg:col-span-1">
          <h3 className="mb-3 font-semibold">Status distribution</h3>
          {chartData && summary.total > 0 ? (
            <div className="max-w-[260px] mx-auto">
              <Pie data={chartData} options={{ plugins: { legend: { position: 'bottom' } } }} />
            </div>
          ) : (
            <EmptyState title="No domains yet" hint="Add a domain to see status." />
          )}
        </div>

        <div className="p-5 card lg:col-span-2">
          <h3 className="mb-3 font-semibold">Expiring soon</h3>
          {expiring.length === 0 ? (
            <EmptyState title="Nothing expiring" hint="All monitored domains look healthy." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Category</th>
                    <th>SSL</th>
                    <th>Domain</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.slice(0, 15).map((d) => {
                    const ssl = daysBadge(d.ssl_days_left);
                    const dom = daysBadge(d.domain_days_left);
                    return (
                      <tr key={d.id}>
                        <td>
                          <div className="font-medium">{d.name || d.domain}</div>
                          {d.name && <div className="text-xs text-slate-500">{d.domain}</div>}
                          {d.admin_name && (
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                              <span>👤 {d.admin_name}</span>
                              {d.admin_has_line === 1 && <span className="badge bg-green-100 text-green-800 text-[9px] px-1 py-0">LINE</span>}
                              {d.admin_email && <span className="badge bg-blue-100 text-blue-800 text-[9px] px-1 py-0">Email</span>}
                            </div>
                          )}
                        </td>
                        <td>
                          {d.category_name ? (
                            <span
                              className="badge"
                              style={{ background: `${d.category_color}22`, color: d.category_color }}
                            >
                              {d.category_name}
                            </span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td><span className={ssl.cls}>{ssl.text}</span></td>
                        <td><span className={dom.cls}>{dom.text}</span></td>
                        <td><StatusBadge status={d.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
