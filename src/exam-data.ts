import type { ExamPaperType, ExamRecord, ExamSection } from "./study-state";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAPER_TYPES: ExamPaperType[] = ["past", "mock", "chapter", "other"];

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeSection(value: unknown): ExamSection | null {
  const item = recordValue(value);
  if (!item || !text(item.name).trim()) return null;
  const fullScore = Math.max(0, finiteNumber(item.fullScore));
  return {
    id: text(item.id) || crypto.randomUUID(),
    name: text(item.name).trim(),
    score: Math.min(fullScore || Number.MAX_SAFE_INTEGER, Math.max(0, finiteNumber(item.score))),
    fullScore,
    wrongCount: Math.max(0, Math.round(finiteNumber(item.wrongCount))),
  };
}

export function normalizeExamRecord(value: unknown): ExamRecord | null {
  const item = recordValue(value);
  if (!item) return null;
  const subjectId = text(item.subjectId);
  const date = text(item.date);
  const paperName = text(item.paperName).trim();
  const fullScore = Math.max(1, finiteNumber(item.fullScore, 100));
  if (!subjectId || !DATE_PATTERN.test(date) || !paperName) return null;
  const paperType = PAPER_TYPES.includes(item.paperType as ExamPaperType) ? item.paperType as ExamPaperType : "other";
  return {
    id: text(item.id) || crypto.randomUUID(),
    subjectId,
    date,
    paperType,
    paperName,
    score: Math.min(fullScore, Math.max(0, finiteNumber(item.score))),
    fullScore,
    durationMinutes: Math.max(1, Math.round(finiteNumber(item.durationMinutes, 120))),
    correctRate: Math.min(100, Math.max(0, finiteNumber(item.correctRate))),
    wrongCount: Math.max(0, Math.round(finiteNumber(item.wrongCount))),
    sections: Array.isArray(item.sections) ? item.sections.map(normalizeSection).filter((section): section is ExamSection => Boolean(section)) : [],
    note: text(item.note),
  };
}

export function normalizeExamRecords(value: unknown) {
  return Array.isArray(value) ? value.map(normalizeExamRecord).filter((record): record is ExamRecord => Boolean(record)) : [];
}

export function scoreRate(record: Pick<ExamRecord, "score" | "fullScore">) {
  return record.fullScore > 0 ? Math.round(record.score / record.fullScore * 100) : 0;
}

export function mergeExamRecords(existing: ExamRecord[], incoming: ExamRecord[]) {
  const records = [...existing];
  let added = 0;
  let duplicates = 0;
  for (const record of incoming) {
    const duplicate = records.some((item) => item.id === record.id || (
      item.subjectId === record.subjectId
      && item.date === record.date
      && item.paperName.trim().toLocaleLowerCase() === record.paperName.trim().toLocaleLowerCase()
    ));
    if (duplicate) duplicates += 1;
    else {
      records.push(record);
      added += 1;
    }
  }
  return { records, added, duplicates };
}
