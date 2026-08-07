import type { StudySession } from "./study-state";

export type AbsoluteTimeRange = {
  start: number;
  end: number;
};

export function sessionTimeRange(session: Pick<StudySession, "date" | "start" | "actualMinutes">): AbsoluteTimeRange | null {
  const start = new Date(`${session.date}T${session.start}:00`).getTime();
  const minutes = Number(session.actualMinutes);
  if (!Number.isFinite(start) || !Number.isFinite(minutes) || minutes <= 0) return null;
  return { start, end: start + minutes * 60_000 };
}

export function timeRangesOverlap(first: AbsoluteTimeRange, second: AbsoluteTimeRange) {
  return first.start < second.end && second.start < first.end;
}

export function findOverlappingSessions(
  range: AbsoluteTimeRange,
  sessions: StudySession[],
  excludedIds: ReadonlySet<string> = new Set(),
) {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.start >= range.end) return [];
  return sessions.filter((session) => {
    if (excludedIds.has(session.id)) return false;
    const existing = sessionTimeRange(session);
    return existing ? timeRangesOverlap(range, existing) : false;
  });
}
