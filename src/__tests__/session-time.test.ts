import { describe, expect, it } from "vitest";
import { findOverlappingSessions, sessionTimeRange, timeRangesOverlap } from "../session-time";
import type { StudySession } from "../study-state";

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: "s1",
    date: "2026-08-01",
    start: "08:00",
    end: "09:00",
    subjectId: "math",
    task: "高数基础",
    plannedMinutes: 60,
    actualMinutes: 60,
    completion: 100,
    focus: 4,
    note: "",
    ...overrides,
  };
}

describe("sessionTimeRange", () => {
  it("把日期/开始时间/实际分钟换算成毫秒区间", () => {
    const range = sessionTimeRange({ date: "2026-08-01", start: "08:00", actualMinutes: 90 });
    expect(range).not.toBeNull();
    expect(range!.start).toBe(new Date("2026-08-01T08:00:00").getTime());
    expect(range!.end).toBe(new Date("2026-08-01T08:00:00").getTime() + 90 * 60_000);
  });

  it("非法日期返回 null", () => {
    expect(sessionTimeRange({ date: "not-a-date", start: "08:00", actualMinutes: 60 })).toBeNull();
  });

  it("时长为 0 或负数返回 null", () => {
    expect(sessionTimeRange({ date: "2026-08-01", start: "08:00", actualMinutes: 0 })).toBeNull();
    expect(sessionTimeRange({ date: "2026-08-01", start: "08:00", actualMinutes: -5 })).toBeNull();
  });
});

describe("timeRangesOverlap", () => {
  it("区间相交返回 true", () => {
    expect(timeRangesOverlap({ start: 0, end: 100 }, { start: 50, end: 150 })).toBe(true);
  });

  it("首尾相接不算重叠", () => {
    expect(timeRangesOverlap({ start: 0, end: 100 }, { start: 100, end: 200 })).toBe(false);
  });

  it("完全不相交返回 false", () => {
    expect(timeRangesOverlap({ start: 0, end: 100 }, { start: 200, end: 300 })).toBe(false);
  });
});

describe("findOverlappingSessions", () => {
  it("只返回与目标区间重叠的记录", () => {
    const sessions = [
      session({ id: "a", start: "08:00", end: "09:00", actualMinutes: 60 }),
      session({ id: "b", start: "09:00", end: "10:00", actualMinutes: 60 }),
      session({ id: "c", start: "10:30", end: "11:00", actualMinutes: 30 }),
    ];
    const range = { start: new Date("2026-08-01T08:30:00").getTime(), end: new Date("2026-08-01T09:30:00").getTime() };
    const conflicts = findOverlappingSessions(range, sessions);
    expect(conflicts.map((item) => item.id).sort()).toEqual(["a", "b"]);
  });

  it("排除指定 id(编辑场景自身不冲突)", () => {
    const sessions = [session({ id: "a", start: "08:00", end: "09:00", actualMinutes: 60 })];
    const range = { start: new Date("2026-08-01T08:00:00").getTime(), end: new Date("2026-08-01T09:00:00").getTime() };
    expect(findOverlappingSessions(range, sessions, new Set(["a"]))).toHaveLength(0);
    expect(findOverlappingSessions(range, sessions)).toHaveLength(1);
  });

  it("非法区间返回空数组", () => {
    expect(findOverlappingSessions({ start: 100, end: 0 }, [session()])).toEqual([]);
  });
});
