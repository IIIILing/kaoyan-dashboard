import { describe, expect, it } from "vitest";
import { findOverlappingPlanItems, scheduledTimeRange, timeRangesOverlap } from "../time-range";
import type { DailyPlan, PlanItem } from "../study-state";

function item(overrides: Partial<PlanItem> = {}): PlanItem {
  return { id: "p1", start: "08:00", end: "09:00", subjectId: "math", task: "1000 题", note: "", ...overrides };
}

function plan(date: string, items: PlanItem[]): DailyPlan {
  return { date, items };
}

describe("scheduledTimeRange", () => {
  it("正常时段换算成毫秒区间", () => {
    const range = scheduledTimeRange("2026-08-01", "08:00", "10:00");
    expect(range).not.toBeNull();
    expect(range!.start).toBe(new Date("2026-08-01T08:00:00").getTime());
    expect(range!.end).toBe(new Date("2026-08-01T10:00:00").getTime());
  });

  it("跨夜时段需显式允许(如睡眠)", () => {
    expect(scheduledTimeRange("2026-08-01", "23:00", "07:00")).toBeNull();
    const range = scheduledTimeRange("2026-08-01", "23:00", "07:00", true);
    expect(range).not.toBeNull();
    expect(range!.end).toBe(new Date("2026-08-02T07:00:00").getTime());
  });

  it("非法日期返回 null", () => {
    expect(scheduledTimeRange("bad", "08:00", "10:00")).toBeNull();
  });
});

describe("timeRangesOverlap", () => {
  it("基础重叠判断", () => {
    expect(timeRangesOverlap({ start: 0, end: 10 }, { start: 5, end: 15 })).toBe(true);
    expect(timeRangesOverlap({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
  });
});

describe("findOverlappingPlanItems", () => {
  it("跨日期找到冲突的计划时段", () => {
    const plans = [
      plan("2026-08-01", [item({ id: "a", start: "08:00", end: "09:00" })]),
      plan("2026-08-02", [item({ id: "b", start: "20:00", end: "22:00" })]),
    ];
    const range = { start: new Date("2026-08-02T21:00:00").getTime(), end: new Date("2026-08-02T23:00:00").getTime() };
    const conflicts = findOverlappingPlanItems(range, plans);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].date).toBe("2026-08-02");
    expect(conflicts[0].item.id).toBe("b");
  });

  it("跨夜睡眠计划(23:00–07:00)与次日凌晨区间重叠", () => {
    const plans = [plan("2026-08-01", [item({ id: "sleep", start: "23:00", end: "07:00", subjectId: "sleep" })])];
    const range = { start: new Date("2026-08-02T02:00:00").getTime(), end: new Date("2026-08-02T03:00:00").getTime() };
    expect(findOverlappingPlanItems(range, plans)).toHaveLength(1);
  });

  it("排除指定 id", () => {
    const plans = [plan("2026-08-01", [item({ id: "a", start: "08:00", end: "09:00" })])];
    const range = { start: new Date("2026-08-01T08:00:00").getTime(), end: new Date("2026-08-01T09:00:00").getTime() };
    expect(findOverlappingPlanItems(range, plans, new Set(["a"]))).toHaveLength(0);
  });
});
