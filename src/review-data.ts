import type { ReviewItem, ReviewItemKind } from "./study-state";
import { dateOffset, localDate } from "./lib/dates";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REVIEW_INTERVALS = [3, 7, 14] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function reviewKind(value: unknown): ReviewItemKind {
  return value === "mistake" || value === "exam" ? value : "knowledge";
}

export function normalizeReviewItems(value: unknown): ReviewItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ReviewItem[] => {
    if (!isRecord(entry)) return [];
    const title = text(entry.title).trim();
    const subjectId = text(entry.subjectId);
    const nextReviewDate = text(entry.nextReviewDate);
    if (!title || !subjectId || !DATE_PATTERN.test(nextReviewDate)) return [];
    const createdAt = text(entry.createdAt);
    return [{
      id: text(entry.id) || crypto.randomUUID(),
      subjectId,
      kind: reviewKind(entry.kind),
      title,
      detail: text(entry.detail),
      source: text(entry.source),
      mastery: Math.round(numberInRange(entry.mastery, 3, 1, 5)),
      nextReviewDate,
      reviewCount: Math.round(numberInRange(entry.reviewCount, 0, 0, 999)),
      createdAt: createdAt || new Date().toISOString(),
      lastReviewedAt: text(entry.lastReviewedAt) || undefined,
    }];
  });
}

export function completeReviewItem(item: ReviewItem, date = localDate(), mastery = item.mastery): ReviewItem {
  const interval = REVIEW_INTERVALS[Math.min(item.reviewCount, REVIEW_INTERVALS.length - 1)];
  return {
    ...item,
    mastery: Math.min(5, Math.max(1, Math.round(mastery))),
    reviewCount: item.reviewCount + 1,
    lastReviewedAt: new Date().toISOString(),
    nextReviewDate: dateOffset(date, interval),
  };
}

export function nextReviewInterval(item: Pick<ReviewItem, "reviewCount">) {
  return REVIEW_INTERVALS[Math.min(item.reviewCount, REVIEW_INTERVALS.length - 1)];
}

export function mergeReviewItems(existing: ReviewItem[], incoming: ReviewItem[]) {
  const items = [...existing];
  let added = 0;
  let duplicates = 0;
  incoming.forEach((item) => {
    const duplicate = items.some((current) => current.id === item.id || (
      current.subjectId === item.subjectId
      && current.title.trim().toLocaleLowerCase("zh-CN") === item.title.trim().toLocaleLowerCase("zh-CN")
      && current.source.trim().toLocaleLowerCase("zh-CN") === item.source.trim().toLocaleLowerCase("zh-CN")
    ));
    if (duplicate) {
      duplicates += 1;
    } else {
      items.push({ ...item });
      added += 1;
    }
  });
  return { items, added, duplicates };
}
