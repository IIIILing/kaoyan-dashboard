import { describe, expect, it } from "vitest";
import { phaseForecast, recordPhaseProgress } from "../progress-forecast";
import type { Phase } from "../study-state";

function phase(overrides: Partial<Phase> = {}): Phase {
  return {
    id: "math-basic",
    name: "第一轮",
    weight: 30,
    progress: 50,
    startDate: "2026-07-01",
    targetDate: "2026-09-01",
    targetProgress: 100,
    progressHistory: [{ date: "2026-07-15", progress: 20 }],
    resources: [],
    ...overrides,
  };
}

describe("recordPhaseProgress", () => {
  it("写入快照并按日期排序去重", () => {
    const result = recordPhaseProgress(phase(), 60, "2026-08-01");
    expect(result.progress).toBe(60);
    expect(result.progressHistory.map((item) => item.date)).toEqual(["2026-07-15", "2026-08-01"]);
  });

  it("同一天重复记录时覆盖旧快照", () => {
    const result = recordPhaseProgress(phase({ progressHistory: [{ date: "2026-08-01", progress: 40 }] }), 80, "2026-08-01");
    expect(result.progressHistory).toEqual([{ date: "2026-08-01", progress: 80 }]);
  });

  it("进度钳制在 0–100 并取整", () => {
    expect(recordPhaseProgress(phase(), 150, "2026-08-01").progress).toBe(100);
    expect(recordPhaseProgress(phase(), -5, "2026-08-01").progress).toBe(0);
    expect(recordPhaseProgress(phase(), 33.6, "2026-08-01").progress).toBe(34);
  });

  it("快照上限 180 条", () => {
    const history = Array.from({ length: 200 }, (_, index) => ({ date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`, progress: index % 100 }));
    const result = recordPhaseProgress(phase({ progressHistory: history }), 50, "2026-08-01");
    expect(result.progressHistory.length).toBeLessThanOrEqual(180);
  });
});

describe("phaseForecast", () => {
  it("缺少日期时返回未配置", () => {
    expect(phaseForecast(phase({ startDate: undefined, targetDate: undefined }), "2026-08-01").configured).toBe(false);
  });

  it("按线性进度计算应达进度与差值", () => {
    // 7/1 → 9/1 共 62 天;8/1 已过 31 天,应达 50%
    const forecast = phaseForecast(phase({ progress: 40 }), "2026-08-01");
    expect(forecast.configured).toBe(true);
    expect(forecast.expectedProgress).toBe(50);
    expect(forecast.progressDelta).toBe(-10);
  });

  it("按近 14 天快照估算速度与预计完成日期", () => {
    const forecast = phaseForecast(
      phase({
        progress: 50,
        progressHistory: [
          { date: "2026-07-20", progress: 20 },
          { date: "2026-07-30", progress: 40 },
        ],
      }),
      "2026-08-01",
    );
    // 快照会拼入「今天 50%」:7/20→8/1 共 12 天涨 30%,速度 2.5%/天;剩余 50% → 20 天后完成
    expect(forecast.recentDailySpeed).toBe(2.5);
    expect(forecast.estimatedCompletionDate).toBe("2026-08-21");
  });

  it("已达标时预计完成日期为今天", () => {
    const forecast = phaseForecast(phase({ progress: 100 }), "2026-08-01");
    expect(forecast.estimatedCompletionDate).toBe("2026-08-01");
  });
});
