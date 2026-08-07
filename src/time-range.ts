import type { DailyPlan, PlanItem } from "./study-state";

export type AbsoluteTimeRange = {
  start: number;
  end: number;
};

export type PlanConflict = {
  date: string;
  item: PlanItem;
};

export function scheduledTimeRange(date: string, start: string, end: string, allowOvernight = false): AbsoluteTimeRange | null {
  const startAt = new Date(`${date}T${start}:00`).getTime();
  let endAt = new Date(`${date}T${end}:00`).getTime();
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) return null;
  if (allowOvernight && endAt <= startAt) endAt += 24 * 60 * 60_000;
  return endAt > startAt ? { start: startAt, end: endAt } : null;
}

export function timeRangesOverlap(first: AbsoluteTimeRange, second: AbsoluteTimeRange) {
  return first.start < second.end && second.start < first.end;
}

export function findOverlappingPlanItems(
  range: AbsoluteTimeRange,
  plans: DailyPlan[],
  excludedIds: ReadonlySet<string> = new Set(),
) {
  const conflicts: PlanConflict[] = [];
  for (const plan of plans) {
    for (const item of plan.items) {
      if (excludedIds.has(item.id)) continue;
      const existing = scheduledTimeRange(plan.date, item.start, item.end, item.subjectId === "sleep");
      if (existing && timeRangesOverlap(range, existing)) conflicts.push({ date: plan.date, item });
    }
  }
  return conflicts;
}
