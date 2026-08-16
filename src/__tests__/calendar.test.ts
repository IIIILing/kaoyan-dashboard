import { describe, expect, it } from "vitest";
import {
  buildMonthCalendar,
  buildYearCalendar,
  calendarLevel,
  calendarYearRange,
  currentStreak,
  longestStreak,
  studyActivityIds,
} from "../lib/calendar";
import type { StudySession } from "../study-state";

const ACTIVITIES = new Set(["sleep", "exercise", "entertainment"]);

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: "s1",
    date: "2026-08-01",
    start: "08:00",
    end: "09:00",
    subjectId: "math",
    task: "高数",
    plannedMinutes: 60,
    actualMinutes: 60,
    completion: 100,
    focus: 4,
    note: "",
    ...overrides,
  };
}

describe("studyActivityIds", () => {
  it("只保留启用中的生活活动 id", () => {
    const ids = studyActivityIds([
      { id: "sleep", name: "睡觉", accent: "#000", active: true },
      { id: "old", name: "已停用", accent: "#000", active: false },
    ]);
    expect(ids.has("sleep")).toBe(true);
    expect(ids.has("old")).toBe(false);
  });
});

describe("buildYearCalendar", () => {
  it("2026 年(平年)生成 53 周,1 月 1 日(周四)前有 4 个空槽", () => {
    const calendar = buildYearCalendar(2026, [], ACTIVITIES);
    expect(calendar.weeks.length).toBe(53);
    expect(calendar.weeks[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(calendar.weeks[0][4]?.date).toBe("2026-01-01");
  });

  it("按天聚合有效学习分钟,生活活动不计入", () => {
    const sessions = [
      session({ id: "a", date: "2026-08-01", actualMinutes: 150 }),
      session({ id: "b", date: "2026-08-01", subjectId: "sleep", task: "睡觉", actualMinutes: 480 }),
      session({ id: "c", date: "2026-08-02", actualMinutes: 30 }),
    ];
    const calendar = buildYearCalendar(2026, sessions, ACTIVITIES);
    const flat = calendar.weeks.flat().filter((cell): cell is NonNullable<typeof cell> => Boolean(cell));
    const aug1 = flat.find((cell) => cell.date === "2026-08-01");
    const aug2 = flat.find((cell) => cell.date === "2026-08-02");
    const aug3 = flat.find((cell) => cell.date === "2026-08-03");
    expect(aug1).toMatchObject({ minutes: 150, count: 1, hasRecords: true });
    expect(aug2).toMatchObject({ minutes: 30, count: 1 });
    expect(aug3).toMatchObject({ minutes: 0, count: 0, hasRecords: false });
  });

  it("月份标签位置正确(1 月在第 0 列)", () => {
    const calendar = buildYearCalendar(2026, [], ACTIVITIES);
    expect(calendar.monthLabels[0]).toEqual({ weekIndex: 0, label: "1月" });
    expect(calendar.monthLabels[11].label).toBe("12月");
  });
});

describe("buildMonthCalendar", () => {
  it("2026 年 8 月(1 日为周六)生成 6 个空槽 + 31 天", () => {
    const cells = buildMonthCalendar("2026-08", [], ACTIVITIES);
    expect(cells).toHaveLength(37);
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]?.date).toBe("2026-08-01");
    expect(cells.at(-1)?.date).toBe("2026-08-31");
  });

  it("月视图同样聚合分钟并排除生活活动", () => {
    const cells = buildMonthCalendar("2026-08", [
      session({ id: "a", date: "2026-08-15", actualMinutes: 200 }),
      session({ id: "b", date: "2026-08-15", subjectId: "exercise", task: "跑步", actualMinutes: 30 }),
    ], ACTIVITIES);
    const day = cells.find((cell) => cell?.date === "2026-08-15");
    expect(day).toMatchObject({ minutes: 200, count: 1, hasRecords: true });
  });
});

describe("calendarYearRange", () => {
  it("返回最早记录年份到当前年份", () => {
    const sessions = [
      session({ id: "old", date: "2025-03-01" }),
      session({ id: "new", date: "2026-08-01" }),
    ];
    expect(calendarYearRange(sessions, "2026-08-15")).toEqual([2025, 2026]);
  });

  it("无记录时只返回当前年份", () => {
    expect(calendarYearRange([], "2026-08-15")).toEqual([2026]);
  });
});

describe("calendarLevel", () => {
  it("按分钟数分级", () => {
    expect(calendarLevel(0)).toBe(0);
    expect(calendarLevel(59)).toBe(1);
    expect(calendarLevel(60)).toBe(2);
    expect(calendarLevel(239)).toBe(2);
    expect(calendarLevel(240)).toBe(3);
    expect(calendarLevel(479)).toBe(3);
    expect(calendarLevel(480)).toBe(4);
  });
});

describe("streak", () => {
  it("计算最长连续天数", () => {
    const dates = new Set(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-05", "2026-08-06"]);
    expect(longestStreak(dates)).toBe(3);
    expect(longestStreak(new Set())).toBe(0);
  });

  it("从锚点往前数当前连续天数", () => {
    const dates = new Set(["2026-08-03", "2026-08-04", "2026-08-05"]);
    expect(currentStreak(dates, "2026-08-05")).toBe(3);
    expect(currentStreak(dates, "2026-08-06")).toBe(0);
    expect(currentStreak(new Set(), "2026-08-05")).toBe(0);
  });
});
