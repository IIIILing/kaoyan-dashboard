import { describe, expect, it } from "vitest";
import {
  clampRatio,
  dailyMetrics,
  exerciseTimeWeight,
  periodSummary,
  sessionsForDate,
  studyTimeWeight,
} from "../lib/scoring";
import { defaultLifeActivities, defaultStudyState, type StudySession } from "../study-state";

const WEIGHTS = defaultStudyState.scoring.weights;
const ACTIVITIES = defaultLifeActivities;
const WEEKLY_RULES = defaultStudyState.scoring.weeklyRules;

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: "s1",
    date: "2026-08-01",
    start: "08:00",
    end: "16:30",
    subjectId: "math",
    task: "高数强化",
    plannedMinutes: 510,
    actualMinutes: 510,
    completion: 100,
    focus: 5,
    note: "今日完成高数强化一轮",
    ...overrides,
  };
}

/** 完美一天:8.5h 目标内的高质量学习(08:00–16:30)+ 8h 睡眠 + 17:00 运动 30 分钟。 */
function perfectDaySessions(date: string): StudySession[] {
  return [
    session({ id: `${date}-study`, date, subjectId: "math", task: "高数强化", actualMinutes: 510, plannedMinutes: 510 }),
    session({ id: `${date}-sleep`, date, start: "23:00", end: "07:00", subjectId: "sleep", task: "睡觉", actualMinutes: 480, plannedMinutes: 480, completion: 100, focus: 3, note: "" }),
    session({ id: `${date}-exercise`, date, start: "17:00", end: "17:30", subjectId: "exercise", task: "跑步", actualMinutes: 30, plannedMinutes: 30, completion: 100, focus: 3, note: "" }),
  ];
}

describe("clampRatio", () => {
  it("钳制在 0–1", () => {
    expect(clampRatio(-0.5)).toBe(0);
    expect(clampRatio(0.5)).toBe(0.5);
    expect(clampRatio(1.5)).toBe(1);
  });
});

describe("studyTimeWeight / exerciseTimeWeight", () => {
  it("学习时段权重边界值", () => {
    expect(studyTimeWeight(5 * 60 + 29)).toBe(0.15);
    expect(studyTimeWeight(5 * 60 + 30)).toBe(0.9);
    expect(studyTimeWeight(8 * 60)).toBe(1.05);
    expect(studyTimeWeight(12 * 60)).toBe(0.85);
    expect(studyTimeWeight(14 * 60)).toBe(1.05);
    expect(studyTimeWeight(18 * 60)).toBe(1);
    expect(studyTimeWeight(22 * 60 + 30)).toBe(0.7);
    expect(studyTimeWeight(23 * 60 + 30)).toBe(0.3);
  });

  it("运动时段权重边界值", () => {
    expect(exerciseTimeWeight(6 * 60)).toBe(1);
    expect(exerciseTimeWeight(16 * 60)).toBe(1);
    expect(exerciseTimeWeight(20 * 60 + 30)).toBe(0.6);
    expect(exerciseTimeWeight(23 * 60 + 30)).toBe(0);
    expect(exerciseTimeWeight(5 * 60)).toBe(0);
    expect(exerciseTimeWeight(12 * 60)).toBe(0.35);
  });
});

describe("dailyMetrics", () => {
  it("无记录时得分为 0 且 hasRecords 为 false", () => {
    const metrics = dailyMetrics([], 8.5, WEIGHTS, ACTIVITIES);
    expect(metrics.hasRecords).toBe(false);
    expect(metrics.score).toBe(0);
    expect(metrics.actualMinutes).toBe(0);
  });

  it("完美一天得满分:510 分钟高质量学习 + 8 小时睡眠 + 30 分钟运动", () => {
    const metrics = dailyMetrics(perfectDaySessions("2026-08-01"), 8.5, WEIGHTS, ACTIVITIES);
    expect(metrics.hasRecords).toBe(true);
    expect(metrics.actualMinutes).toBe(510);
    expect(metrics.sleepMinutes).toBe(480);
    expect(metrics.exerciseMinutes).toBe(30);
    expect(metrics.hourRatio).toBe(1);
    // 注意:completion/focus 返回原始值(百分比 / 5 分制),内部计算 componentRatios 时才归一化。
    expect(metrics.completion).toBe(100);
    expect(metrics.focus).toBe(5);
    expect(metrics.review).toBe(1);
    expect(metrics.score).toBe(100);
  });

  it("生活活动不计入有效学习时长,但计入对应统计", () => {
    const metrics = dailyMetrics(
      [session({ id: "ent", subjectId: "entertainment", task: "打游戏", actualMinutes: 120, plannedMinutes: 120 })],
      8.5,
      WEIGHTS,
      ACTIVITIES,
    );
    expect(metrics.actualMinutes).toBe(0);
    expect(metrics.entertainmentMinutes).toBe(120);
  });

  it("深夜学习只统计 23:30 之后的分钟", () => {
    const metrics = dailyMetrics(
      [session({ id: "late", start: "23:00", end: "00:30", actualMinutes: 90, plannedMinutes: 90 })],
      8.5,
      WEIGHTS,
      ACTIVITIES,
    );
    expect(metrics.lateStudyMinutes).toBe(60);
  });

  it("夜间短时段、低完成度时得分明显低于满分", () => {
    const metrics = dailyMetrics(
      [session({ id: "short", start: "22:00", end: "23:00", actualMinutes: 60, plannedMinutes: 60, completion: 50, focus: 3, note: "" })],
      8.5,
      WEIGHTS,
      ACTIVITIES,
    );
    expect(metrics.completion).toBe(50);
    expect(metrics.focus).toBe(3);
    expect(metrics.score).toBeGreaterThan(0);
    expect(metrics.score).toBeLessThan(100);
  });
});

describe("sessionsForDate", () => {
  it("按日期过滤并按开始时间排序", () => {
    const sessions = [
      session({ id: "a", date: "2026-08-02", start: "09:00" }),
      session({ id: "b", date: "2026-08-01", start: "10:00" }),
      session({ id: "c", date: "2026-08-01", start: "08:00" }),
    ];
    expect(sessionsForDate(sessions, "2026-08-01").map((item) => item.id)).toEqual(["c", "b"]);
  });
});

describe("periodSummary", () => {
  const sevenDates = [
    "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04",
    "2026-08-05", "2026-08-06", "2026-08-07",
  ];

  it("完美一周得满分:记录覆盖 100%、作息平衡 100%、周报 100 分", () => {
    const sessions = sevenDates.flatMap((date) => perfectDaySessions(date));
    const summary = periodSummary(sessions, sevenDates, 8.5, WEIGHTS, WEEKLY_RULES, ACTIVITIES);
    expect(summary.periodScore).toBe(100);
    expect(summary.recordRate).toBe(1);
    expect(summary.averageDailyScore).toBe(100);
    expect(summary.healthySleepRate).toBe(1);
    expect(summary.exerciseMinutes).toBe(210);
    expect(summary.exerciseTarget).toBe(150);
    expect(summary.routineBalance).toBeCloseTo(1);
    expect(summary.ruleResults).toHaveLength(3);
  });

  it("无记录的一周周期得分极低(记录覆盖 0)", () => {
    const summary = periodSummary([], sevenDates, 8.5, WEIGHTS, WEEKLY_RULES, ACTIVITIES);
    expect(summary.recordRate).toBe(0);
    expect(summary.averageDailyScore).toBe(0);
    expect(summary.periodScore).toBeLessThan(10);
  });

  it("记录覆盖率按有记录的天数占比计算", () => {
    const sessions = perfectDaySessions("2026-08-01");
    const summary = periodSummary(sessions, sevenDates, 8.5, WEIGHTS, WEEKLY_RULES, ACTIVITIES);
    expect(summary.recordRate).toBeCloseTo(1 / 7);
    expect(summary.averageDailyScore).toBe(100);
  });
});
