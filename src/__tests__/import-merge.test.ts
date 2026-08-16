import { describe, expect, it } from "vitest";
import { computeImportMerge } from "../import-merge";
import type { ScheduleImportCandidate } from "../schedule-data";
import { defaultStudyState } from "../study-state";
import type { ExamRecord, PlanItem, PlanTemplate, ReviewItem, StudySession, StudyState } from "../study-state";

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

function item(overrides: Partial<PlanItem> = {}): PlanItem {
  return { id: "p1", start: "08:00", end: "09:00", subjectId: "math", task: "1000 题", note: "", ...overrides };
}

function examRecord(overrides: Partial<ExamRecord> = {}): ExamRecord {
  return {
    id: "e1",
    subjectId: "math",
    date: "2026-08-10",
    paperType: "mock",
    paperName: "模拟卷一",
    score: 120,
    fullScore: 150,
    durationMinutes: 180,
    correctRate: 80,
    wrongCount: 8,
    sections: [],
    note: "",
    ...overrides,
  };
}

function reviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: "r1",
    subjectId: "math",
    kind: "knowledge",
    title: "泰勒公式",
    detail: "",
    source: "",
    mastery: 3,
    nextReviewDate: "2026-08-15",
    reviewCount: 1,
    createdAt: "2026-08-01",
    ...overrides,
  };
}

function template(overrides: Partial<PlanTemplate> = {}): PlanTemplate {
  return { id: "t1", name: "标准上午", items: [item()], ...overrides };
}

function stateWith(overrides: Partial<StudyState>): StudyState {
  return { ...defaultStudyState, ...overrides };
}

function candidate(overrides: Partial<ScheduleImportCandidate> = {}): ScheduleImportCandidate {
  return {
    sessions: [],
    plans: [],
    planTemplates: [],
    examRecords: [],
    reviewItems: [],
    source: "schedule",
    ...overrides,
  };
}

const RANGE = { from: "2026-08-01", to: "2026-08-31" };

describe("computeImportMerge", () => {
  it("时间记录按日期范围筛选,并透传去重/顺延 report", () => {
    const state = stateWith({ sessions: [session({ id: "existing" })] });
    const result = computeImportMerge(
      state,
      candidate({
        sessions: [
          session({ id: "dup" }), // 与已有记录完全重复(同日期同起止同任务)
          session({ id: "new", date: "2026-08-02", start: "10:00", end: "11:00", task: "英语阅读" }), // 范围内新增
          session({ id: "out", date: "2026-09-01", task: "政治" }), // 范围外,不应计入
        ],
      }),
      RANGE,
    );
    expect(result.sessions.report).toEqual({ added: 1, duplicates: 1, shifted: 0, skipped: 0 });
    expect(result.sessions.sessions).toHaveLength(2);
    expect(result.sessions.sessions.some((item) => item.id === "out")).toBe(false);
  });

  it("计划与成绩记录同样按日期范围筛选", () => {
    const result = computeImportMerge(
      stateWith({}),
      candidate({
        plans: [
          { date: "2026-08-01", items: [item({ id: "in" })] },
          { date: "2026-09-01", items: [item({ id: "out" })] },
        ],
        examRecords: [
          examRecord({ id: "in" }),
          examRecord({ id: "out", date: "2026-09-10" }),
        ],
      }),
      RANGE,
    );
    expect(result.plans.report.added).toBe(1);
    expect(result.plans.plans.some((plan) => plan.items.some((entry) => entry.id === "out"))).toBe(false);
    expect(result.exams.added).toBe(1);
    expect(result.exams.records.some((record) => record.id === "out")).toBe(false);
  });

  it("计划模板与复习项不做范围过滤,全量并入", () => {
    const result = computeImportMerge(
      stateWith({}),
      candidate({
        planTemplates: [template()],
        reviewItems: [reviewItem({ id: "out-range", nextReviewDate: "2026-09-15" })],
      }),
      RANGE,
    );
    expect(result.templates.added).toBe(1);
    expect(result.templates.duplicates).toBe(0);
    expect(result.reviews.added).toBe(1);
    expect(result.reviews.items.some((item) => item.id === "out-range")).toBe(true);
  });
});
