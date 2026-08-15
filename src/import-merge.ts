// 导入合并的统一入口:按日期范围筛选后用纯函数 merge,得到一份可复用的合并结果。
// BackupDialog 用它做导入预览(dry-run),App.importData 用它做真正的合并,
// 两者共用同一份计算,保证"预览数字"与"实际导入结果"完全一致。
import { isInRange } from "./lib/dates";
import type { DateRange, ImportReport, ScheduleImportCandidate } from "./schedule-data";
import { mergeImportedPlans, mergeImportedSessions, mergeImportedTemplates } from "./schedule-data";
import { mergeExamRecords } from "./exam-data";
import { mergeReviewItems } from "./review-data";
import type { DailyPlan, ExamRecord, PlanTemplate, ReviewItem, StudySession, StudyState } from "./study-state";

export type ImportMergeResult = {
  sessions: { sessions: StudySession[]; report: ImportReport };
  plans: { plans: DailyPlan[]; report: ImportReport };
  templates: { templates: PlanTemplate[]; added: number; duplicates: number };
  exams: { records: ExamRecord[]; added: number; duplicates: number };
  reviews: { items: ReviewItem[]; added: number; duplicates: number };
};

export function computeImportMerge(state: StudyState, candidate: ScheduleImportCandidate, range: DateRange): ImportMergeResult {
  // 与历史行为保持一致:时间记录 / 今日计划 / 成绩记录按日期范围筛选,
  // 计划模板与复习项不做范围过滤(模板无日期;复习项按 id 去重,全量并入)。
  const selectedSessions = candidate.sessions.filter((item) => isInRange(item.date, range));
  const selectedPlans = candidate.plans.filter((item) => isInRange(item.date, range));
  const selectedExamRecords = candidate.examRecords.filter((item) => isInRange(item.date, range));
  return {
    sessions: mergeImportedSessions(state.sessions, selectedSessions),
    plans: mergeImportedPlans(state.plans, selectedPlans),
    templates: mergeImportedTemplates(state.planTemplates, candidate.planTemplates),
    exams: mergeExamRecords(state.examRecords, selectedExamRecords),
    reviews: mergeReviewItems(state.reviewItems, candidate.reviewItems),
  };
}
