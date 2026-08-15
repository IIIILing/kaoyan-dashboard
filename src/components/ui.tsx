import { ChevronRight, Clock3 } from "lucide-react";

export function ProgressRing({ value, label, compact = false, color }: { value: number; label?: string; compact?: boolean; color?: string }) {
  return <div className={`progress-ring ${compact ? "compact" : ""}`} style={{ "--progress": `${Math.min(100, Math.max(0, value)) * 3.6}deg`, "--ring-color": color ?? "var(--accent)" } as React.CSSProperties}><div><strong>{value}%</strong>{label && <span>{label}</span>}</div></div>;
}

export function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="score-row"><span>{label}</span><div className="mini-track"><i style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} /></div><strong>{value}<small>/{max}</small></strong></div>;
}

export function EmptyState({ icon: Icon, title, detail, action, onAction }: { icon: typeof Clock3; title: string; detail: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><div><Icon size={25} /></div><strong>{title}</strong><p>{detail}</p><button className="text-button" onClick={onAction}>{action}<ChevronRight size={15} /></button></div>;
}

export function ScoreGuide({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="guide-item"><span>{number}</span><div><strong>{title}</strong><p>{detail}</p></div></div>;
}

export function MiniTrend({ label, value, detail, values, color }: { label: string; value: string; detail: string; values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  const points = values.map((item, index) => `${values.length === 1 ? 50 : index / (values.length - 1) * 100},${38 - item / max * 32}`).join(" ");
  return <article className="mini-trend-card"><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="38" x2="100" y2="38" /><polyline points={points} style={{ stroke: color }} /></svg></article>;
}
