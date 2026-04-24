export default function StatusBadge({ status, label }) {
  const cls =
    status === 'ok' ? 'badge-ok' :
    status === 'warning' ? 'badge-warn' :
    status === 'critical' ? 'badge-crit' : 'badge-unknown';
  const text = label || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');
  return <span className={cls}>{text}</span>;
}

export function daysBadge(days) {
  if (days === null || days === undefined) return { cls: 'badge-unknown', text: '—' };
  if (days < 0) return { cls: 'badge-crit', text: `${Math.abs(days)}d expired` };
  if (days < 7) return { cls: 'badge-crit', text: `${days}d` };
  if (days < 30) return { cls: 'badge-warn', text: `${days}d` };
  return { cls: 'badge-ok', text: `${days}d` };
}
