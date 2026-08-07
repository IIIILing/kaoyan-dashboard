import { AlertTriangle, Clock3, Lightbulb, Target } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { buildStudyHeatmap, buildWeeklyDiagnosis, heatmapValue, type HeatmapMetric } from "./weekly-insights";
import type { StudyState } from "./study-state";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const METRICS: { id: HeatmapMetric; label: string; unit: string }[] = [
  { id: "minutes", label: "学习分钟", unit: "分钟" },
  { id: "focus", label: "专注度", unit: "/ 5" },
  { id: "completion", label: "完成度", unit: "%" },
];

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}min`;
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? `${Math.round(minutes % 60)}min` : ""}`;
}

function subtractDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() - days);
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00–${String((hour + 1) % 24).padStart(2, "0")}:00`;
}

export default function WeeklyInsights({ state, from, to }: { state: StudyState; from: string; to: string }) {
  const [metric, setMetric] = useState<HeatmapMetric>("minutes");
  const diagnosis = useMemo(() => buildWeeklyDiagnosis(state, from, to), [state, from, to]);
  const heatmapFrom = subtractDays(to, 55);
  const heatmap = useMemo(() => buildStudyHeatmap(state.sessions, new Set(state.subjects.map((subject) => subject.id)), heatmapFrom, to), [state.sessions, state.subjects, heatmapFrom, to]);
  const max = metric === "minutes" ? Math.max(1, ...heatmap.map((cell) => cell.minutes)) : metric === "focus" ? 5 : 100;
  const selectedMetric = METRICS.find((item) => item.id === metric)!;
  const totalMax = Math.max(1, ...diagnosis.subjects.map((subject) => Math.max(subject.planned, subject.actual)));
  return <>
    <section className="panel weekly-diagnosis-panel">
      <div className="panel-heading"><div><p className="card-kicker">计划 × 实际</p><h2>本周执行诊断</h2></div><span className="muted">{from} 至 {to}</span></div>
      <div className="diagnosis-summary-grid">
        <article><span>计划投入</span><strong>{formatMinutes(diagnosis.totalPlanned)}</strong></article>
        <article><span>实际投入</span><strong>{formatMinutes(diagnosis.totalActual)}</strong></article>
        <article className={diagnosis.underestimatePercent > 5 ? "negative" : "positive"}><span>计划估时偏差</span><strong>{diagnosis.linkedPlanned ? `${diagnosis.underestimatePercent > 0 ? "+" : ""}${diagnosis.underestimatePercent}%` : "待积累"}</strong><small>{diagnosis.linkedPlanned ? `关联任务：计划 ${formatMinutes(diagnosis.linkedPlanned)} / 实际 ${formatMinutes(diagnosis.linkedActual)}` : "请从今日计划启动计时"}</small></article>
        <article><span>建议预估系数</span><strong>{diagnosis.linkedPlanned ? `×${diagnosis.multiplier}` : "—"}</strong></article>
      </div>
      {diagnosis.subjects.length ? <div className="diagnosis-subject-list">{diagnosis.subjects.map((subject) => <article key={subject.id}>
        <div><span className="subject-indicator" style={{ background: subject.accent }} /><strong>{subject.name}</strong><small className={subject.deficit > 0 ? "negative" : "positive"}>{subject.deficit > 0 ? `缺口 ${formatMinutes(subject.deficit)}` : subject.deficit < 0 ? `超出 ${formatMinutes(Math.abs(subject.deficit))}` : "刚好达成"}</small></div>
        <div className="diagnosis-bars"><span><i style={{ width: `${subject.planned / totalMax * 100}%` }} />计划 {formatMinutes(subject.planned)}</span><span><i style={{ width: `${subject.actual / totalMax * 100}%`, background: subject.accent }} />实际 {formatMinutes(subject.actual)}</span></div>
      </article>)}</div> : <div className="schedule-empty">本周还没有学习计划或学习记录。</div>}
      <div className="focus-slot-grid">
        <article><Target size={18} /><div><span>最佳专注时段</span><strong>{diagnosis.bestHour ? hourLabel(diagnosis.bestHour.hour) : "等待样本"}</strong><small>{diagnosis.bestHour ? `专注 ${diagnosis.bestHour.focus}/5 · 完成 ${diagnosis.bestHour.completion}%` : "单个小时累计 ≥30 分钟后计算"}</small></div></article>
        <article><AlertTriangle size={18} /><div><span>较弱专注时段</span><strong>{diagnosis.worstHour ? hourLabel(diagnosis.worstHour.hour) : "等待样本"}</strong><small>{diagnosis.worstHour ? `专注 ${diagnosis.worstHour.focus}/5 · 完成 ${diagnosis.worstHour.completion}%` : "单个小时累计 ≥30 分钟后计算"}</small></div></article>
      </div>
      <div className="diagnosis-recommendations"><div><Lightbulb size={18} /><strong>下周行动建议</strong></div><ol>{diagnosis.recommendations.map((item) => <li key={item}>{item}</li>)}</ol></div>
    </section>

    <section className="panel heatmap-panel">
      <div className="panel-heading"><div><p className="card-kicker">近 8 周 · 7 × 24</p><h2>学习时段热力图</h2></div><div className="mode-tabs">{METRICS.map((item) => <button className={metric === item.id ? "active" : ""} key={item.id} onClick={() => setMetric(item.id)}>{item.label}</button>)}</div></div>
      <p className="heatmap-copy">横轴为一天 24 小时，纵轴为星期；切换指标可区分“投入最多”和“质量最好”的时间。</p>
      <div className="heatmap-scroll"><div className="study-heatmap" role="img" aria-label={`近八周按${selectedMetric.label}显示的七乘二十四学习热力图`}>
        <span />{Array.from({ length: 24 }, (_, hour) => <span className="heatmap-hour" key={hour}>{hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}</span>)}
        {WEEKDAYS.map((weekday, weekdayIndex) => <div className="heatmap-row" key={weekday}>
          <strong>{weekday}</strong>
          {heatmap.filter((cell) => cell.weekday === weekdayIndex).map((cell) => {
            const value = heatmapValue(cell, metric);
            const opacity = value ? 0.16 + Math.min(1, value / max) * 0.84 : 0.04;
            const display = metric === "minutes" ? `${value} 分钟` : metric === "focus" ? `${value} / 5` : `${value}%`;
            return <span className="heatmap-cell" key={cell.hour} style={{ "--heat": opacity } as CSSProperties} title={`${weekday} ${hourLabel(cell.hour)}：${selectedMetric.label} ${display}；样本 ${cell.minutes} 分钟`}><i /></span>;
          })}
        </div>)}
      </div></div>
      <div className="heatmap-legend"><Clock3 size={15} /><span>浅</span><i /><i /><i /><i /><span>深 · {selectedMetric.label}（{selectedMetric.unit}）</span></div>
    </section>
  </>;
}
