import type {
  DailyPlan,
  ExamRecord,
  PlanItem,
  PlanTemplate,
  ReviewItem,
  ScheduleDay,
  StudySession,
  StudyState,
} from "./study-state";
import { normalizeExamRecords } from "./exam-data";
import { minutesBetween, minutesToTime, timeToMinutes } from "./lib/format";
import { normalizeReviewItems } from "./review-data";

export type DateRange = { from: string; to: string };

export type ImportReport = {
  added: number;
  duplicates: number;
  shifted: number;
  skipped: number;
};

export type ScheduleImportCandidate = {
  sessions: StudySession[];
  plans: DailyPlan[];
  planTemplates: PlanTemplate[];
  examRecords: ExamRecord[];
  reviewItems: ReviewItem[];
  source: "schedule" | "state" | "plan-archive" | "daily-plan";
};

export type ScheduleArchive = {
  kind: "kaoyan-schedule-archive";
  version: 2;
  exportedAt: string;
  range: DateRange;
  profile: StudyState["profile"];
  scoring: StudyState["scoring"];
  appearance: StudyState["appearance"];
  lifeActivities: StudyState["lifeActivities"];
  subjects: StudyState["subjects"];
  sessions: StudySession[];
  plans: DailyPlan[];
  schedule: ScheduleDay[];
  days: ScheduleDay[];
  planTemplates: PlanTemplate[];
  examRecords: ExamRecord[];
  reviewItems: ReviewItem[];
};

type UnknownRecord = Record<string, unknown>;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function newId() {
  return crypto.randomUUID();
}

function legacyId(prefix: string, parts: string[]) {
  let hash = 2166136261;
  for (const character of parts.join("\u001f")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function normalizedTask(task: string) {
  return task.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

function normalizePlanItem(value: unknown): PlanItem | null {
  if (!isRecord(value)) return null;
  const start = text(value.start);
  const end = text(value.end);
  const subjectId = text(value.subjectId);
  const task = text(value.task).trim();
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end) || !subjectId || !task) return null;
  if (minutesBetween(start, end, subjectId === "sleep") <= 0) return null;
  return {
    id: text(value.id) || legacyId("legacy-plan", [start, end, subjectId, task, text(value.note)]),
    start,
    end,
    subjectId,
    task,
    note: text(value.note),
  };
}

function normalizeSession(value: unknown, fallbackDate = ""): StudySession | null {
  if (!isRecord(value)) return null;
  const date = text(value.date) || fallbackDate;
  const start = text(value.start);
  const end = text(value.end);
  const subjectId = text(value.subjectId);
  const task = text(value.task).trim();
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(start) || !TIME_PATTERN.test(end) || !subjectId || !task) return null;
  const duration = minutesBetween(start, end, subjectId === "sleep");
  if (duration <= 0) return null;
  return {
    id: text(value.id) || legacyId("legacy-session", [date, start, end, subjectId, task, text(value.note)]),
    planItemId: text(value.planItemId) || undefined,
    date,
    start,
    end,
    subjectId,
    task,
    plannedMinutes: numberOr(value.plannedMinutes, duration),
    actualMinutes: numberOr(value.actualMinutes, duration),
    completion: numberOr(value.completion, 100),
    focus: numberOr(value.focus, 3),
    note: text(value.note),
  };
}

function normalizePlan(value: unknown): DailyPlan | null {
  if (!isRecord(value)) return null;
  const date = text(value.date);
  if (!DATE_PATTERN.test(date) || !Array.isArray(value.items)) return null;
  return {
    date,
    items: value.items.map(normalizePlanItem).filter((item): item is PlanItem => Boolean(item)),
  };
}

function normalizeTemplate(value: unknown): PlanTemplate | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const name = text(value.name).trim();
  if (!name) return null;
  return {
    id: text(value.id) || newId(),
    name,
    items: value.items.map(normalizePlanItem).filter((item): item is PlanItem => Boolean(item)),
  };
}

function collapsePlans(plans: DailyPlan[]) {
  const byDate = new Map<string, PlanItem[]>();
  plans.forEach((plan) => {
    byDate.set(plan.date, [...(byDate.get(plan.date) ?? []), ...plan.items]);
  });
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}

function readScheduleDays(value: unknown) {
  if (!Array.isArray(value)) return null;
  const sessions: StudySession[] = [];
  const plans: DailyPlan[] = [];
  value.forEach((entry) => {
    if (!isRecord(entry)) return;
    const date = text(entry.date);
    if (!DATE_PATTERN.test(date)) return;
    const rawSessions = Array.isArray(entry.sessions) ? entry.sessions : [];
    sessions.push(...rawSessions.map((item) => normalizeSession(item, date)).filter((item): item is StudySession => Boolean(item)));
    const rawItems = Array.isArray(entry.planItems)
      ? entry.planItems
      : Array.isArray(entry.items)
        ? entry.items
        : [];
    plans.push({
      date,
      items: rawItems.map(normalizePlanItem).filter((item): item is PlanItem => Boolean(item)),
    });
  });
  return { sessions, plans: collapsePlans(plans) };
}

export function buildScheduleDays(sessions: StudySession[], plans: DailyPlan[]): ScheduleDay[] {
  const dates = new Set<string>();
  sessions.forEach((session) => dates.add(session.date));
  plans.forEach((plan) => dates.add(plan.date));
  return [...dates]
    .sort()
    .map((date) => ({
      date,
      planItems: plans.find((plan) => plan.date === date)?.items ?? [],
      sessions: sessions.filter((session) => session.date === date),
    }));
}

export function withUnifiedSchedule(state: StudyState): StudyState {
  return {
    ...state,
    version: 3,
    schedule: buildScheduleDays(state.sessions, state.plans),
  };
}

export function createScheduleArchive(state: StudyState, range: DateRange): ScheduleArchive {
  const sessions = state.sessions.filter((item) => item.date >= range.from && item.date <= range.to);
  const plans = state.plans.filter((item) => item.date >= range.from && item.date <= range.to);
  const examRecords = state.examRecords.filter((item) => item.date >= range.from && item.date <= range.to);
  const days = buildScheduleDays(sessions, plans);
  return {
    kind: "kaoyan-schedule-archive",
    version: 2,
    exportedAt: new Date().toISOString(),
    range,
    profile: state.profile,
    scoring: state.scoring,
    appearance: state.appearance,
    lifeActivities: state.lifeActivities,
    subjects: state.subjects,
    sessions,
    plans,
    schedule: days,
    days,
    planTemplates: state.planTemplates,
    examRecords,
    reviewItems: state.reviewItems,
  };
}

export function parseScheduleImport(value: unknown): ScheduleImportCandidate | null {
  if (!isRecord(value)) return null;
  const kind = text(value.kind);
  const rawDays = Array.isArray(value.days) ? value.days : value.schedule;
  const dayData = readScheduleDays(rawDays);
  const useDays = Boolean(dayData) && (
    kind === "kaoyan-schedule-archive" ||
    (Array.isArray(rawDays) && rawDays.length > 0)
  );

  let sessions = useDays
    ? dayData!.sessions
    : Array.isArray(value.sessions)
      ? value.sessions.map((item) => normalizeSession(item)).filter((item): item is StudySession => Boolean(item))
      : [];
  let plans = useDays
    ? dayData!.plans
    : Array.isArray(value.plans)
      ? value.plans.map(normalizePlan).filter((item): item is DailyPlan => Boolean(item))
      : [];

  let source: ScheduleImportCandidate["source"] = "state";
  const recognizedState = Array.isArray(value.sessions) && (Array.isArray(value.subjects) || value.version === 1 || value.version === 2 || value.version === 3);
  if (kind === "kaoyan-schedule-archive") {
    source = "schedule";
  } else if (kind === "kaoyan-plan-archive" || (!Array.isArray(value.sessions) && Array.isArray(value.plans))) {
    source = "plan-archive";
  } else if (Array.isArray(value.items) && text(value.date)) {
    const dailyPlan = normalizePlan(value);
    plans = dailyPlan ? [dailyPlan] : [];
    sessions = [];
    source = "daily-plan";
  } else if (!recognizedState && !dayData) {
    return null;
  }

  const planTemplates = Array.isArray(value.planTemplates)
    ? value.planTemplates.map(normalizeTemplate).filter((item): item is PlanTemplate => Boolean(item))
    : [];
  const examRecords = normalizeExamRecords(value.examRecords);
  const reviewItems = normalizeReviewItems(value.reviewItems);
  return { sessions, plans: collapsePlans(plans), planTemplates, examRecords, reviewItems, source };
}

function itemsOverlap(a: Pick<PlanItem, "start" | "end">, b: Pick<PlanItem, "start" | "end">) {
  return timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end);
}

function findFreeSlot(items: Pick<PlanItem, "start" | "end">[], start: string, duration: number) {
  let candidate = timeToMinutes(start);
  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start));
  while (candidate + duration <= 23 * 60 + 59) {
    const conflict = sorted.find(
      (item) => candidate < timeToMinutes(item.end) && timeToMinutes(item.start) < candidate + duration,
    );
    if (!conflict) return { start: minutesToTime(candidate), end: minutesToTime(candidate + duration) };
    candidate = timeToMinutes(conflict.end);
  }
  return null;
}

export function mergeImportedSessions(existing: StudySession[], incoming: StudySession[]) {
  const merged = [...existing];
  const report: ImportReport = { added: 0, duplicates: 0, shifted: 0, skipped: 0 };

  [...incoming].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)).forEach((item) => {
    const duplicate = merged.some(
      (current) =>
        (Boolean(current.id) && Boolean(item.id) && current.id === item.id) ||
        (
          current.date === item.date &&
          current.start === item.start &&
          current.end === item.end &&
          normalizedTask(current.task) === normalizedTask(item.task)
        ),
    );
    if (duplicate) {
      report.duplicates += 1;
      return;
    }

    const daySessions = merged.filter((current) => current.date === item.date);
    if (!daySessions.some((current) => itemsOverlap(current, item))) {
      merged.push({ ...item });
      report.added += 1;
      return;
    }

    const duration = Math.max(1, item.actualMinutes || minutesBetween(item.start, item.end, item.subjectId === "sleep"));
    const free = findFreeSlot(daySessions, item.start, duration);
    if (!free) {
      report.skipped += 1;
      return;
    }
    const adjustment = `导入冲突调整：原时段 ${item.start}-${item.end} 与已有记录重叠，已顺延至 ${free.start}-${free.end}。`;
    merged.push({
      ...item,
      start: free.start,
      end: free.end,
      plannedMinutes: duration,
      actualMinutes: duration,
      note: item.note.trim() ? `${item.note.trim()}\n${adjustment}` : adjustment,
    });
    report.added += 1;
    report.shifted += 1;
  });

  return { sessions: merged, report };
}

export function mergeImportedPlans(existing: DailyPlan[], incoming: DailyPlan[]) {
  const byDate = new Map<string, PlanItem[]>();
  existing.forEach((plan) => {
    byDate.set(plan.date, [...(byDate.get(plan.date) ?? []), ...plan.items]);
  });
  const report: ImportReport = { added: 0, duplicates: 0, shifted: 0, skipped: 0 };

  incoming
    .flatMap((plan) => plan.items.map((item) => ({ date: plan.date, item })))
    .sort((a, b) => `${a.date}${a.item.start}`.localeCompare(`${b.date}${b.item.start}`))
    .forEach(({ date, item }) => {
      const dayItems = byDate.get(date) ?? [];
      const duplicate = dayItems.some(
        (current) =>
          (Boolean(current.id) && Boolean(item.id) && current.id === item.id) ||
          (
            current.start === item.start &&
            current.end === item.end &&
            normalizedTask(current.task) === normalizedTask(item.task)
          ),
      );
      if (duplicate) {
        report.duplicates += 1;
        return;
      }

      let nextItem = { ...item };
      if (dayItems.some((current) => itemsOverlap(current, item))) {
        const duration = Math.max(1, minutesBetween(item.start, item.end, item.subjectId === "sleep"));
        const free = findFreeSlot(dayItems, item.start, duration);
        if (!free) {
          report.skipped += 1;
          return;
        }
        const adjustment = `导入冲突调整：原计划 ${item.start}-${item.end} 与已有计划重叠，已顺延至 ${free.start}-${free.end}。`;
        nextItem = {
          ...nextItem,
          start: free.start,
          end: free.end,
          note: item.note.trim() ? `${item.note.trim()}\n${adjustment}` : adjustment,
        };
        report.shifted += 1;
      }
      byDate.set(date, [...dayItems, nextItem]);
      report.added += 1;
    });

  return {
    plans: [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items })),
    report,
  };
}

function planItemKey(item: PlanItem) {
  return [item.start, item.end, item.subjectId, normalizedTask(item.task), item.note.trim()].join("|");
}

export function mergeImportedTemplates(existing: PlanTemplate[], incoming: PlanTemplate[]) {
  const templates = [...existing];
  let added = 0;
  let duplicates = 0;
  incoming.forEach((template) => {
    const key = `${normalizedTask(template.name)}:${template.items.map(planItemKey).sort().join(";")}`;
    const duplicate = templates.some(
      (current) => `${normalizedTask(current.name)}:${current.items.map(planItemKey).sort().join(";")}` === key,
    );
    if (duplicate) {
      duplicates += 1;
      return;
    }
    templates.push({
      ...template,
      id: newId(),
      items: template.items.map((item) => ({ ...item, id: newId() })),
    });
    added += 1;
  });
  return { templates, added, duplicates };
}
