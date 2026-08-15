import { describe, expect, it } from "vitest";
import {
  createScheduleArchive,
  mergeImportedPlans,
  mergeImportedSessions,
  mergeImportedTemplates,
  parseScheduleImport,
  withUnifiedSchedule,
} from "../schedule-data";
import type { DailyPlan, PlanItem, PlanTemplate, StudySession } from "../study-state";
import { defaultStudyState } from "../study-state";

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

describe("parseScheduleImport", () => {
  it("识别 v2 日程归档(days 结构)", () => {
    const parsed = parseScheduleImport({
      kind: "kaoyan-schedule-archive",
      version: 2,
      days: [
        {
          date: "2026-08-01",
          planItems: [{ id: "p1", start: "08:00", end: "09:00", subjectId: "math", task: "1000 题", note: "" }],
          sessions: [{ id: "s1", date: "2026-08-01", start: "08:00", end: "09:00", subjectId: "math", task: "高数基础", plannedMinutes: 60, actualMinutes: 60, completion: 100, focus: 4, note: "" }],
        },
      ],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.source).toBe("schedule");
    expect(parsed!.sessions).toHaveLength(1);
    expect(parsed!.plans).toHaveLength(1);
    expect(parsed!.plans[0].items[0].task).toBe("1000 题");
  });

  it("识别旧版整站备份(sessions/plans 平铺)", () => {
    const parsed = parseScheduleImport({
      version: 2,
      sessions: [session()],
      plans: [{ date: "2026-08-01", items: [item()] }],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.source).toBe("state");
    expect(parsed!.sessions).toHaveLength(1);
    expect(parsed!.plans[0].items).toHaveLength(1);
  });

  it("识别单日计划(items + date)", () => {
    const parsed = parseScheduleImport({
      date: "2026-08-01",
      items: [item()],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.source).toBe("daily-plan");
    expect(parsed!.sessions).toHaveLength(0);
    expect(parsed!.plans).toHaveLength(1);
  });

  it("无法识别的输入返回 null", () => {
    expect(parseScheduleImport(null)).toBeNull();
    expect(parseScheduleImport({ foo: 1 })).toBeNull();
  });

  it("被识别的备份中,字段缺失的脏记录被丢弃", () => {
    const parsed = parseScheduleImport({
      version: 2,
      sessions: [{ id: "x", task: "缺字段" }, session({ id: "ok" })],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.sessions).toHaveLength(1);
    expect(parsed!.sessions[0].id).toBe("ok");
  });
});

describe("mergeImportedSessions", () => {
  it("无冲突时直接新增", () => {
    const result = mergeImportedSessions([], [session()]);
    expect(result.sessions).toHaveLength(1);
    expect(result.report).toEqual({ added: 1, duplicates: 0, shifted: 0, skipped: 0 });
  });

  it("同日期同起止时间同任务名判重", () => {
    const existing = [session({ id: "keep" })];
    const result = mergeImportedSessions(existing, [session({ id: "dup" })]);
    expect(result.sessions).toHaveLength(1);
    expect(result.report.duplicates).toBe(1);
  });

  it("重叠时段顺延到当天最早空闲时段并写入调整备注", () => {
    const existing = [session({ id: "a", date: "2026-08-01", start: "08:00", end: "09:00", task: "已有记录" })];
    const incoming = session({ id: "b", date: "2026-08-01", start: "08:30", end: "09:30", task: "待导入" });
    const result = mergeImportedSessions(existing, [incoming]);
    expect(result.report).toEqual({ added: 1, duplicates: 0, shifted: 1, skipped: 0 });
    const merged = result.sessions.find((item) => item.id === "b");
    expect(merged).toBeDefined();
    expect(merged!.start).toBe("09:00");
    expect(merged!.end).toBe("10:00");
    expect(merged!.note).toContain("导入冲突调整");
  });

  it("全天无空位时跳过", () => {
    const existing = [
      session({ id: "a", date: "2026-08-01", start: "00:00", end: "12:00", task: "早段" }),
      session({ id: "c", date: "2026-08-01", start: "12:00", end: "23:59", task: "晚段" }),
    ];
    const incoming = session({ id: "b", date: "2026-08-01", start: "10:00", end: "11:00", task: "无处安放" });
    const result = mergeImportedSessions(existing, [incoming]);
    expect(result.report.skipped).toBe(1);
    expect(result.sessions).toHaveLength(2);
  });
});

describe("mergeImportedPlans", () => {
  it("新增并保持日期排序", () => {
    const result = mergeImportedPlans([], [{ date: "2026-08-02", items: [item({ id: "p2" })] }]);
    expect(result.plans).toHaveLength(1);
    expect(result.report.added).toBe(1);
  });

  it("同名同时段判重", () => {
    const existing = [{ date: "2026-08-01", items: [item({ id: "p1" })] }];
    const result = mergeImportedPlans(existing, [{ date: "2026-08-01", items: [item({ id: "dup" })] }]);
    expect(result.report.duplicates).toBe(1);
    expect(result.plans[0].items).toHaveLength(1);
  });

  it("重叠计划顺延", () => {
    const existing = [{ date: "2026-08-01", items: [item({ id: "p1", start: "08:00", end: "09:00" })] }];
    const result = mergeImportedPlans(existing, [
      { date: "2026-08-01", items: [item({ id: "p2", start: "08:30", end: "09:30", task: "待导入" })] },
    ]);
    expect(result.report.shifted).toBe(1);
    const merged = result.plans[0].items.find((entry) => entry.id === "p2");
    expect(merged!.start).toBe("09:00");
    expect(merged!.note).toContain("导入冲突调整");
  });
});

describe("mergeImportedTemplates", () => {
  it("相同名称与内容判重", () => {
    const existing: PlanTemplate[] = [{ id: "t1", name: "高强度数学日", items: [item()] }];
    const incoming: PlanTemplate[] = [{ id: "t2", name: "高强度数学日", items: [item()] }];
    const result = mergeImportedTemplates(existing, incoming);
    expect(result.added).toBe(0);
    expect(result.duplicates).toBe(1);
  });

  it("内容不同的同名模板视为新增并重新生成 id", () => {
    const existing: PlanTemplate[] = [{ id: "t1", name: "高强度数学日", items: [item()] }];
    const incoming: PlanTemplate[] = [{ id: "t2", name: "高强度数学日", items: [item({ start: "10:00", end: "12:00" })] }];
    const result = mergeImportedTemplates(existing, incoming);
    expect(result.added).toBe(1);
    expect(result.templates[1].id).not.toBe("t2");
  });
});

describe("createScheduleArchive / withUnifiedSchedule", () => {
  it("按日期范围筛选导出内容", () => {
    const state = {
      ...defaultStudyState,
      sessions: [session({ id: "in", date: "2026-08-01" }), session({ id: "out", date: "2026-09-01" })],
    };
    const archive = createScheduleArchive(state, { from: "2026-07-01", to: "2026-08-31" });
    expect(archive.sessions.map((item) => item.id)).toEqual(["in"]);
    expect(archive.kind).toBe("kaoyan-schedule-archive");
  });

  it("withUnifiedSchedule 生成按日期聚合的 schedule", () => {
    const state = {
      ...defaultStudyState,
      sessions: [session({ id: "s1", date: "2026-08-01" })],
      plans: [{ date: "2026-08-01", items: [item()] }],
    };
    const unified = withUnifiedSchedule(state);
    const schedule = unified.schedule ?? [];
    expect(schedule).toHaveLength(1);
    expect(schedule[0].sessions).toHaveLength(1);
    expect(schedule[0].planItems).toHaveLength(1);
  });
});
