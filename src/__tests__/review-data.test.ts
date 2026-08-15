import { describe, expect, it } from "vitest";
import { completeReviewItem, mergeReviewItems, nextReviewInterval, normalizeReviewItems } from "../review-data";
import type { ReviewItem } from "../study-state";

function item(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: "r1",
    subjectId: "math",
    kind: "mistake",
    title: "中值定理错题",
    detail: "",
    source: "1000 题",
    mastery: 3,
    nextReviewDate: "2026-08-04",
    reviewCount: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeReviewItems", () => {
  it("合法条目保留,非法日期丢弃", () => {
    const items = normalizeReviewItems([item(), item({ id: "bad", nextReviewDate: "2026/08/04" })]);
    expect(items).toHaveLength(1);
  });

  it("未知 kind 回退 knowledge,精通度钳制 1–5", () => {
    const items = normalizeReviewItems([item({ kind: "unknown" as never, mastery: 9 })]);
    expect(items[0].kind).toBe("knowledge");
    expect(items[0].mastery).toBe(5);
  });
});

describe("nextReviewInterval", () => {
  it("按复习次数递增间隔 3 → 7 → 14 并封顶", () => {
    expect(nextReviewInterval({ reviewCount: 0 })).toBe(3);
    expect(nextReviewInterval({ reviewCount: 1 })).toBe(7);
    expect(nextReviewInterval({ reviewCount: 2 })).toBe(14);
    expect(nextReviewInterval({ reviewCount: 99 })).toBe(14);
  });
});

describe("completeReviewItem", () => {
  it("完成一次复习:次数 +1、下次日期按间隔顺延", () => {
    const done = completeReviewItem(item(), "2026-08-01");
    expect(done.reviewCount).toBe(1);
    expect(done.nextReviewDate).toBe("2026-08-04");
    expect(done.lastReviewedAt).toBeTruthy();
  });

  it("第二次复习间隔变为 7 天", () => {
    const done = completeReviewItem(item({ reviewCount: 1 }), "2026-08-04");
    expect(done.nextReviewDate).toBe("2026-08-11");
  });

  it("精通度钳制 1–5", () => {
    expect(completeReviewItem(item(), "2026-08-01", 8).mastery).toBe(5);
    expect(completeReviewItem(item(), "2026-08-01", 0).mastery).toBe(1);
  });
});

describe("mergeReviewItems", () => {
  it("按 id 或 科目+标题+来源 判重", () => {
    const existing = [item()];
    const result = mergeReviewItems(existing, [item({ id: "dup" }), item({ id: "new", title: "另一道错题" })]);
    expect(result.added).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.items).toHaveLength(2);
  });
});
