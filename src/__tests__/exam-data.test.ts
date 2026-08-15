import { describe, expect, it } from "vitest";
import { mergeExamRecords, normalizeExamRecord, normalizeExamRecords, scoreRate } from "../exam-data";
import type { ExamRecord } from "../study-state";

const VALID_RECORD: ExamRecord = {
  id: "e1",
  subjectId: "math",
  date: "2026-08-01",
  paperType: "past",
  paperName: "2023 年真题",
  score: 90,
  fullScore: 100,
  durationMinutes: 180,
  correctRate: 90,
  wrongCount: 3,
  sections: [],
  note: "",
};

describe("normalizeExamRecord", () => {
  it("合法记录原样保留", () => {
    const record = normalizeExamRecord(VALID_RECORD);
    expect(record).not.toBeNull();
    expect(record!.paperType).toBe("past");
    expect(record!.score).toBe(90);
  });

  it("缺科目/日期/卷名时拒绝", () => {
    expect(normalizeExamRecord({ ...VALID_RECORD, subjectId: "" })).toBeNull();
    expect(normalizeExamRecord({ ...VALID_RECORD, date: "2026/08/01" })).toBeNull();
    expect(normalizeExamRecord({ ...VALID_RECORD, paperName: "  " })).toBeNull();
  });

  it("分数钳制到满分以内,未知卷型回退 other", () => {
    const record = normalizeExamRecord({ ...VALID_RECORD, score: 120, paperType: "weird" });
    expect(record!.score).toBe(100);
    expect(record!.paperType).toBe("other");
  });

  it("批量归一化丢弃脏数据", () => {
    const records = normalizeExamRecords([VALID_RECORD, { id: "bad" }]);
    expect(records).toHaveLength(1);
  });
});

describe("scoreRate", () => {
  it("计算正确率百分比", () => {
    expect(scoreRate({ score: 90, fullScore: 100 })).toBe(90);
    expect(scoreRate({ score: 45, fullScore: 150 })).toBe(30);
  });

  it("满分为 0 时返回 0", () => {
    expect(scoreRate({ score: 10, fullScore: 0 })).toBe(0);
  });
});

describe("mergeExamRecords", () => {
  it("按 id 判重", () => {
    const result = mergeExamRecords([VALID_RECORD], [{ ...VALID_RECORD, paperName: "重名新卷" }]);
    expect(result.added).toBe(0);
    expect(result.duplicates).toBe(1);
  });

  it("按科目+日期+卷名判重", () => {
    const result = mergeExamRecords([VALID_RECORD], [{ ...VALID_RECORD, id: "new-id" }]);
    expect(result.added).toBe(0);
    expect(result.duplicates).toBe(1);
  });

  it("不同记录正常新增", () => {
    const result = mergeExamRecords([VALID_RECORD], [{ ...VALID_RECORD, id: "e2", date: "2026-08-02" }]);
    expect(result.added).toBe(1);
    expect(result.records).toHaveLength(2);
  });
});
