import type { StudySession, StudyState } from "./study-state";
import { timeToMinutes } from "./lib/format";

export type HeatmapMetric = "minutes" | "focus" | "completion";

export type HeatmapCell = {
  weekday: number;
  hour: number;
  minutes: number;
  focus: number;
  completion: number;
};

function plannedMinutes(start: string, end: string) {
  const difference = timeToMinutes(end) - timeToMinutes(start);
  return difference >= 0 ? difference : difference + 24 * 60;
}

function dateAtNoon(date: string) {
  return new Date(`${date}T12:00:00`);
}

function weekdayIndex(date: string) {
  return (dateAtNoon(date).getDay() + 6) % 7;
}

function offsetDate(date: string, days: number) {
  const next = dateAtNoon(date);
  next.setDate(next.getDate() + days);
  const offset = next.getTimezoneOffset() * 60_000;
  return new Date(next.getTime() - offset).toISOString().slice(0, 10);
}

function distributeSession(session: StudySession, onSlice: (date: string, hour: number, minutes: number) => void) {
  const start = timeToMinutes(session.start);
  let end = timeToMinutes(session.end);
  if (end <= start) end += 24 * 60;
  const clockMinutes = Math.max(1, end - start);
  const scale = Math.max(0, session.actualMinutes) / clockMinutes;
  for (let cursor = start; cursor < end;) {
    const nextBoundary = Math.min(end, (Math.floor(cursor / 60) + 1) * 60);
    const dayOffset = Math.floor(cursor / (24 * 60));
    onSlice(offsetDate(session.date, dayOffset), Math.floor((cursor % (24 * 60)) / 60), (nextBoundary - cursor) * scale);
    cursor = nextBoundary;
  }
}

export function buildStudyHeatmap(sessions: StudySession[], subjectIds: Set<string>, from?: string, to?: string): HeatmapCell[] {
  const buckets = Array.from({ length: 7 * 24 }, (_, index) => ({
    weekday: Math.floor(index / 24),
    hour: index % 24,
    minutes: 0,
    focusWeighted: 0,
    completionWeighted: 0,
  }));
  sessions.filter((session) => subjectIds.has(session.subjectId) && (!from || session.date >= from) && (!to || session.date <= to)).forEach((session) => {
    distributeSession(session, (date, hour, minutes) => {
      if ((from && date < from) || (to && date > to)) return;
      const bucket = buckets[weekdayIndex(date) * 24 + hour];
      bucket.minutes += minutes;
      bucket.focusWeighted += minutes * session.focus;
      bucket.completionWeighted += minutes * session.completion;
    });
  });
  return buckets.map((bucket) => ({
    weekday: bucket.weekday,
    hour: bucket.hour,
    minutes: Math.round(bucket.minutes),
    focus: bucket.minutes ? Math.round((bucket.focusWeighted / bucket.minutes) * 10) / 10 : 0,
    completion: bucket.minutes ? Math.round(bucket.completionWeighted / bucket.minutes) : 0,
  }));
}

export function heatmapValue(cell: HeatmapCell, metric: HeatmapMetric) {
  return metric === "minutes" ? cell.minutes : metric === "focus" ? cell.focus : cell.completion;
}

export function buildWeeklyDiagnosis(state: StudyState, from: string, to: string) {
  const subjectIds = new Set(state.subjects.map((subject) => subject.id));
  const plans = state.plans.filter((plan) => plan.date >= from && plan.date <= to);
  const sessions = state.sessions.filter((session) => session.date >= from && session.date <= to && subjectIds.has(session.subjectId));
  const plannedBySubject = new Map<string, number>();
  const actualBySubject = new Map<string, number>();
  const plannedByItem = new Map<string, number>();
  plans.forEach((plan) => plan.items.forEach((item) => {
    if (!subjectIds.has(item.subjectId)) return;
    const minutes = plannedMinutes(item.start, item.end);
    plannedBySubject.set(item.subjectId, (plannedBySubject.get(item.subjectId) ?? 0) + minutes);
    plannedByItem.set(item.id, minutes);
  }));
  sessions.forEach((session) => actualBySubject.set(session.subjectId, (actualBySubject.get(session.subjectId) ?? 0) + session.actualMinutes));
  const subjects = state.subjects.map((subject) => {
    const planned = Math.round(plannedBySubject.get(subject.id) ?? 0);
    const actual = Math.round(actualBySubject.get(subject.id) ?? 0);
    return { id: subject.id, name: subject.name, shortName: subject.shortName, accent: subject.accent, planned, actual, deficit: planned - actual };
  }).filter((subject) => subject.planned || subject.actual).sort((a, b) => b.deficit - a.deficit);
  const linkedSessions = sessions.filter((session) => session.planItemId && plannedByItem.has(session.planItemId));
  const linkedPlanIds = new Set(linkedSessions.map((session) => session.planItemId!));
  const linkedPlanned = [...linkedPlanIds].reduce((sum, id) => sum + (plannedByItem.get(id) ?? 0), 0);
  const linkedActual = linkedSessions.reduce((sum, session) => sum + session.actualMinutes, 0);
  const estimateRatio = linkedPlanned ? linkedActual / linkedPlanned : 1;
  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: 0, focusWeighted: 0, completionWeighted: 0 }));
  sessions.forEach((session) => distributeSession(session, (date, hour, minutes) => {
    if (date < from || date > to) return;
    const bucket = hourBuckets[hour];
    bucket.minutes += minutes;
    bucket.focusWeighted += minutes * session.focus;
    bucket.completionWeighted += minutes * session.completion;
  }));
  const sampledHours = hourBuckets.filter((bucket) => bucket.minutes >= 30).map((bucket) => ({
    hour: bucket.hour,
    minutes: Math.round(bucket.minutes),
    focus: Math.round((bucket.focusWeighted / bucket.minutes) * 10) / 10,
    completion: Math.round(bucket.completionWeighted / bucket.minutes),
  })).sort((a, b) => b.focus - a.focus || b.completion - a.completion);
  const totalPlanned = subjects.reduce((sum, subject) => sum + subject.planned, 0);
  const totalActual = subjects.reduce((sum, subject) => sum + subject.actual, 0);
  const largestDeficit = subjects.find((subject) => subject.deficit > 0);
  const bestHour = sampledHours[0] ?? null;
  const worstHour = sampledHours.at(-1) ?? null;
  const underestimatePercent = Math.round((estimateRatio - 1) * 100);
  const multiplier = Math.round(Math.min(2, Math.max(0.5, estimateRatio)) * 10) / 10;
  const recommendations = [
    largestDeficit ? `${largestDeficit.name}尚缺 ${largestDeficit.deficit} 分钟，优先补到下一份计划。` : "本周各科计划投入没有明显缺口。",
    linkedPlanned ? (underestimatePercent > 5 ? `历史执行比计划长 ${underestimatePercent}%，同类任务建议按 ×${multiplier} 预估。` : underestimatePercent < -5 ? `历史执行比计划短 ${Math.abs(underestimatePercent)}%，可以适当压缩同类任务时长。` : "计划时长与实际执行基本一致。") : "完成几次“从计划开始计时”后，系统会给出时长估计偏差。",
    bestHour ? `把高难度任务优先放在 ${String(bestHour.hour).padStart(2, "0")}:00–${String((bestHour.hour + 1) % 24).padStart(2, "0")}:00。` : "积累至少 30 分钟学习记录后，会识别最佳专注时段。",
  ];
  return { subjects, totalPlanned, totalActual, linkedPlanned, linkedActual, underestimatePercent, multiplier, bestHour, worstHour, recommendations };
}
