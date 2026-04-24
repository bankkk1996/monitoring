export default function SummaryCard({ label, value, tone = 'default', hint }) {
  const tones = {
    default: 'text-slate-900 dark:text-white',
    ok: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    critical: 'text-red-600 dark:text-red-400',
  };
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${tones[tone] || tones.default}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
