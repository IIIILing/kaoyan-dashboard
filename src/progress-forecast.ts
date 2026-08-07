import type { Phase, PhaseProgressSnapshot } from "./study-state";

const DAY_MS = 24 * 60 * 60_000;

function dateValue(date: string) {
  const value = new Date(`${date}T00:00:00`).getTime();
  return Number.isFinite(value) ? value : NaN;
}

function dayDistance(from: string, to: string) {
  const start = dateValue(from);
  const end = dateValue(to);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / DAY_MS) : NaN;
}

function offsetDate(date: string, days: number) {
  const value = dateValue(date);
  if (!Number.isFinite(value)) return "";
  const next = new Date(value + days * DAY_MS);
  const offset = next.getTimezoneOffset();
  return new Date(next.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function recordPhaseProgress(phase: Phase, progress: number, date: string) {
  const normalized = Math.min(100, Math.max(0, Math.round(progress)));
  const history = (phase.progressHistory ?? [])
    .filter((snapshot) => snapshot.date !== date)
    .concat({ date, progress: normalized })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-180);
  return { ...phase, progress: normalized, progressHistory: history };
}

export type PhaseForecast = {
  configured: boolean;
  expectedProgress: number;
  progressDelta: number;
  scheduleDays: number;
  recentDailySpeed: number | null;
  estimatedCompletionDate: string | null;
  targetProgress: number;
};

export function phaseForecast(phase: Phase, today: string): PhaseForecast {
  const startDate = phase.startDate ?? "";
  const targetDate = phase.targetDate ?? "";
  const targetProgress = Math.min(100, Math.max(1, Number(phase.targetProgress) || 100));
  const totalDays = dayDistance(startDate, targetDate);
  if (!startDate || !targetDate || !Number.isFinite(totalDays) || totalDays <= 0) {
    return { configured: false, expectedProgress: 0, progressDelta: 0, scheduleDays: 0, recentDailySpeed: null, estimatedCompletionDate: null, targetProgress };
  }

  const elapsedDays = Math.min(totalDays, Math.max(0, dayDistance(startDate, today)));
  const expectedProgress = Math.round(targetProgress * elapsedDays / totalDays);
  const progressDelta = phase.progress - expectedProgress;
  const plannedDailySpeed = targetProgress / totalDays;
  const scheduleDays = plannedDailySpeed > 0 ? Math.round(progressDelta / plannedDailySpeed) : 0;
  const cutoff = offsetDate(today, -13);
  const snapshots: PhaseProgressSnapshot[] = (phase.progressHistory ?? [])
    .filter((snapshot) => snapshot.date >= cutoff && snapshot.date <= today)
    .concat({ date: today, progress: phase.progress })
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((snapshot, index, items) => index === items.length - 1 || snapshot.date !== items[index + 1].date);
  const first = snapshots[0];
  const last = snapshots.at(-1);
  const speedDays = first && last ? dayDistance(first.date, last.date) : 0;
  const recentDailySpeed = first && last && speedDays > 0
    ? Math.max(0, (last.progress - first.progress) / speedDays)
    : null;
  const remaining = Math.max(0, targetProgress - phase.progress);
  const estimatedCompletionDate = remaining === 0
    ? today
    : recentDailySpeed && recentDailySpeed > 0
      ? offsetDate(today, Math.ceil(remaining / recentDailySpeed))
      : null;

  return { configured: true, expectedProgress, progressDelta, scheduleDays, recentDailySpeed, estimatedCompletionDate, targetProgress };
}
