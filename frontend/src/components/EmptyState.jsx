export default function EmptyState({ title = 'No data', hint, action }) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-6 4h4m5-12H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
