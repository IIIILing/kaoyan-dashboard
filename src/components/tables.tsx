import { Pencil, Play, Trash2 } from "lucide-react";
import { lifeActivity } from "../lib/activities";
import { formatMinutes, minutesBetween, minutesToTime, timeToMinutes } from "../lib/format";
import type { PlanItem, StudySession, StudyState } from "../study-state";

export function SessionTable({ sessions, state, onEdit, onDelete }: { sessions: StudySession[]; state: StudyState; onEdit: (session: StudySession) => void; onDelete: (id: string) => void }) {
  return <div className="session-table">{sessions.map((session) => { const subject = state.subjects.find((item) => item.id === session.subjectId); const activity = lifeActivity(session.subjectId, state.lifeActivities); return <div className="session-row" key={session.id}><span className="subject-indicator" style={{ background: subject?.accent ?? activity?.accent }} /><time>{session.start}–{session.end}</time><div><strong>{session.task}</strong><span>{subject?.name ?? activity?.name ?? "其他"}{session.note ? ` · ${session.note}` : ""}</span></div><span className="session-duration">{formatMinutes(session.actualMinutes)}</span><span className="category-pill">{activity ? "活动" : "科目"}</span><button onClick={() => onDelete(session.id)} aria-label="删除记录"><Trash2 size={16} /></button></div>; })}</div>;
}

export function EditableSessionTable({ sessions, state, onEdit, onDelete }: { sessions: StudySession[]; state: StudyState; onEdit: (session: StudySession) => void; onDelete: (id: string) => void }) {
  return <div className="session-table">{sessions.map((session) => {
    const subject = state.subjects.find((item) => item.id === session.subjectId);
    const activity = lifeActivity(session.subjectId, state.lifeActivities);
    return <div className="session-row" key={session.id}>
      <span className="subject-indicator" style={{ background: subject?.accent ?? activity?.accent }} />
      <time>{session.start}–{session.end}</time>
      <div><strong>{session.task}</strong><span>{subject?.name ?? activity?.name ?? "其他"}{session.note ? ` · ${session.note}` : ""}</span></div>
      <span className="session-duration">{formatMinutes(session.actualMinutes)}</span>
      <span className="category-pill">{activity ? "活动" : "科目"}</span>
      <span className="row-actions">
        <button type="button" onClick={() => onEdit(session)} aria-label="编辑记录"><Pencil size={15} /></button>
        <button type="button" onClick={() => onDelete(session.id)} aria-label="删除记录"><Trash2 size={16} /></button>
      </span>
    </div>;
  })}</div>;
}

export function EditablePlanTable({ items, sessions, state, canStart, onStart, onEdit, onDelete }: { items: PlanItem[]; sessions: StudySession[]; state: StudyState; canStart: boolean; onStart: (item: PlanItem) => void; onEdit: (item: PlanItem) => void; onDelete: (id: string) => void }) {
  return <div className="plan-list">{[...items].sort((a, b) => a.start.localeCompare(b.start)).map((item) => {
    const subject = state.subjects.find((entry) => entry.id === item.subjectId);
    const activity = lifeActivity(item.subjectId, state.lifeActivities);
    const linkedSessions = sessions.filter((session) => session.planItemId === item.id);
    const plannedMinutes = minutesBetween(item.start, item.end, item.subjectId === "sleep");
    const actualMinutes = linkedSessions.reduce((sum, session) => sum + session.actualMinutes, 0);
    const completion = actualMinutes > 0
      ? Math.round(linkedSessions.reduce((sum, session) => sum + session.completion * session.actualMinutes, 0) / actualMinutes)
      : 0;
    const variance = actualMinutes - plannedMinutes;
    const varianceLabel = variance > 0 ? `超时 +${variance} min` : variance < 0 ? `提前 ${Math.abs(variance)} min` : "与计划一致";
    return <div className="plan-list-row execution-plan-row" key={item.id}>
      <span className="subject-indicator" style={{ background: subject?.accent ?? activity?.accent }} />
      <time>{item.start}–{item.end}</time>
      <div><strong>{item.task}</strong><span>{subject?.name ?? activity?.name ?? "其他"}{item.note ? ` · ${item.note}` : ""}</span></div>
      <div className={`plan-execution-summary ${linkedSessions.length ? "has-records" : ""}`}>
        {linkedSessions.length ? <><strong>计划 {plannedMinutes} min → 实际 {actualMinutes} min</strong><span>完成度 {completion}% · {varianceLabel} · 已关联 {linkedSessions.length} 段</span></> : <><strong>计划 {plannedMinutes} min</strong><span>尚未开始执行</span></>}
      </div>
      <span className="row-actions">
        <button type="button" className="start-plan-button" disabled={!canStart} onClick={() => onStart(item)} aria-label={`开始此任务：${item.task}`} title={canStart ? "进入计时器并自动关联计划" : "只能从今天的计划开始计时"}><Play size={14} fill="currentColor" />{linkedSessions.length ? "继续计时" : "开始此任务"}</button>
        <button type="button" onClick={() => onEdit(item)} aria-label="编辑计划"><Pencil size={15} /></button>
        <button type="button" onClick={() => onDelete(item.id)} aria-label="删除计划"><Trash2 size={16} /></button>
      </span>
    </div>;
  })}</div>;
}

export function DayScheduleChart({ entries, state, mode }: {
  entries: (StudySession | PlanItem)[];
  state: StudyState;
  mode: "planned" | "actual";
}) {
  const durationFor = (entry: StudySession | PlanItem) => {
    const stored = mode === "planned"
      ? "plannedMinutes" in entry ? entry.plannedMinutes : minutesBetween(entry.start, entry.end, entry.subjectId === "sleep")
      : "actualMinutes" in entry ? entry.actualMinutes : minutesBetween(entry.start, entry.end, entry.subjectId === "sleep");
    return Math.min(24 * 60, Math.max(0, Number(stored) || minutesBetween(entry.start, entry.end, entry.subjectId === "sleep")));
  };
  const chartEntries = entries.filter((entry) => durationFor(entry) > 0);
  const hours = [0, 6, 12, 18, 24];

  if (!chartEntries.length) {
    return <div className="schedule-empty">暂无可生成图表的时段,新增记录后会自动绘制。</div>;
  }

  return (
    <div className="day-schedule" aria-label={mode === "planned" ? "今日计划安排图" : "实际时间记录图"}>
      <div className="schedule-axis-label" />
      <div className="schedule-axis">{hours.map((hour) => <span key={hour} style={{ left: `${hour / 24 * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}</div>
      {chartEntries.map((entry) => {
        const subject = state.subjects.find((item) => item.id === entry.subjectId);
        const activity = lifeActivity(entry.subjectId, state.lifeActivities);
        const duration = durationFor(entry);
        const start = timeToMinutes(entry.start);
        const firstDuration = Math.min(duration, 24 * 60 - start);
        const wrappedDuration = Math.max(0, duration - firstDuration);
        const end = (start + duration) % (24 * 60);
        const endLabel = minutesToTime(end);
        const color = subject?.accent ?? activity?.accent ?? "var(--accent)";
        const title = `${entry.task} · ${entry.start}–${endLabel} · ${formatMinutes(duration)}`;
        return (
          <div className="schedule-row" key={entry.id}>
            <div className="schedule-row-label"><strong>{entry.task}</strong><span>{entry.start}–{endLabel}</span></div>
            <div className="schedule-track">
              {hours.map((hour) => <i className="schedule-gridline" key={hour} style={{ left: `${hour / 24 * 100}%` }} />)}
              <span className="schedule-block" title={title} style={{ left: `${start / (24 * 60) * 100}%`, width: `${firstDuration / (24 * 60) * 100}%`, background: color }} />
              {wrappedDuration > 0 && <span className="schedule-block" title={title} style={{ left: 0, width: `${wrappedDuration / (24 * 60) * 100}%`, background: color }} />}
            </div>
          </div>
        );
      })}
      <div className="schedule-legend"><span><i />{mode === "planned" ? "计划时段" : "实际记录"}</span><small>横轴为 00:00–24:00,悬停色块可查看详情</small></div>
    </div>
  );
}
