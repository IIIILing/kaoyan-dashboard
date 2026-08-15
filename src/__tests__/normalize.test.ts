import { describe, expect, it } from "vitest";
import { normalizeStudyState } from "../lib/normalize";
import { defaultStudyState } from "../study-state";

describe("normalizeStudyState", () => {
  it("无法识别的输入返回 null", () => {
    expect(normalizeStudyState(null)).toBeNull();
    expect(normalizeStudyState({ foo: 1 })).toBeNull();
    expect(normalizeStudyState({ version: 99, subjects: [], sessions: [] })).toBeNull();
  });

  it("v3 状态直接通过,缺失字段用默认值补齐", () => {
    const result = normalizeStudyState({
      version: 3,
      profile: { name: "Jimmy" },
      subjects: [],
      sessions: [],
    });
    expect(result).not.toBeNull();
    expect(result!.version).toBe(3);
    expect(result!.profile.name).toBe("Jimmy");
    expect(result!.profile.examDate).toBe(defaultStudyState.profile.examDate);
    expect(result!.scoring.weights).toEqual(defaultStudyState.scoring.weights);
    expect(result!.lifeActivities.length).toBeGreaterThan(0);
    expect(result!.sessions).toEqual([]);
    // schedule 聚合会由 withUnifiedSchedule 重建
    expect(result!.schedule).toEqual([]);
  });

  it("v2 的老阶段 id 迁移到新阶段并保留进度,自定义阶段保留,废弃 id 删除", () => {
    const result = normalizeStudyState({
      version: 2,
      profile: { name: "老用户" },
      subjects: [
        {
          id: "english",
          name: "英语一",
          shortName: "英一",
          weight: 20,
          accent: "#5b7f70",
          note: "旧备注",
          phases: [
            { id: "eng-word", name: "旧词汇阶段", weight: 15, progress: 40, resources: [] },
            { id: "my-custom", name: "自定义阶段", weight: 10, progress: 25, resources: [] },
          ],
        },
      ],
      sessions: [],
    });
    expect(result).not.toBeNull();
    const english = result!.subjects.find((subject) => subject.id === "english");
    expect(english).toBeDefined();
    // 备注被默认快线文案覆盖
    expect(english!.note).toBe(defaultStudyState.subjects.find((item) => item.id === "english")!.note);
    const phaseIds = english!.phases.map((phase) => phase.id);
    // 老 id eng-word 被废弃,新 id eng-word-first 继承其进度 40
    expect(phaseIds).not.toContain("eng-word");
    expect(phaseIds).toContain("eng-word-first");
    expect(phaseIds).toContain("my-custom");
    expect(english!.phases.find((phase) => phase.id === "eng-word-first")!.progress).toBe(40);
    expect(english!.phases.find((phase) => phase.id === "my-custom")!.progress).toBe(25);
    // 未迁移的阶段保持默认进度 0
    expect(english!.phases.find((phase) => phase.id === "eng-real")!.progress).toBe(0);
  });

  it("科目缺少 phases 时不抛异常,归一为空阶段列表(防静默丢账号数据)", () => {
    const result = normalizeStudyState({
      version: 3,
      subjects: [
        { id: "x", name: "坏科目", shortName: "X", weight: 0, accent: "#000000", note: "", phases: null },
      ],
      sessions: [],
    });
    expect(result).not.toBeNull();
    expect(result!.subjects[0].phases).toEqual([]);
  });

  it("阶段不是对象时被过滤", () => {
    const result = normalizeStudyState({
      version: 3,
      subjects: [
        {
          id: "x",
          name: "X",
          shortName: "X",
          weight: 0,
          accent: "#000000",
          note: "",
          phases: [null, "junk"],
        },
      ],
      sessions: [],
    });
    expect(result).not.toBeNull();
    expect(result!.subjects[0].phases).toEqual([]);
  });

  it("字段残缺的时间记录在归一化时被丢弃", () => {
    const result = normalizeStudyState({
      version: 3,
      subjects: [],
      sessions: [
        { id: "bad", task: "缺字段" },
        {
          id: "good",
          date: "2026-08-01",
          start: "08:00",
          end: "09:00",
          subjectId: "math",
          task: "高数",
        },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.sessions).toHaveLength(1);
    expect(result!.sessions[0].id).toBe("good");
  });
});
