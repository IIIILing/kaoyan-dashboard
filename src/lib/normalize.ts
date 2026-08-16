import { normalizeExperiences } from "../experience-data";
import { normalizeExamRecords } from "../exam-data";
import { normalizeReviewItems } from "../review-data";
import { parseScheduleImport, withUnifiedSchedule } from "../schedule-data";
import {
  defaultLifeActivities,
  defaultStudyState,
  type StudyState,
} from "../study-state";

/**
 * 把任意版本(1/2/3)的本机存档归一化为 v3:
 * - 用默认值补齐缺失字段,丢弃无法识别的记录;
 * - v1/v2 的老阶段 id(如 eng-word)会按 legacyProgressSource 迁移到新阶段,并保留进度/资料;
 * - 防御异常数据:科目缺少 phases 或阶段不是对象时不会抛异常,而是归一为空/丢弃。
 * 返回 null 表示输入完全无法识别(应由调用方回退到全新状态)。
 */
export function normalizeStudyState(value: unknown): StudyState | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as StudyState;
  if (
    (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3)
    || !Array.isArray(parsed.subjects)
    || !Array.isArray(parsed.sessions)
  ) return null;

  const scheduleImport = parseScheduleImport(parsed);
  const normalized: StudyState = withUnifiedSchedule({
    ...parsed,
    version: 3,
    profile: {
      ...defaultStudyState.profile,
      ...parsed.profile,
      sidebarIcon: parsed.profile?.sidebarIcon ?? defaultStudyState.profile.sidebarIcon,
    },
    scoring: {
      weights: {
        ...defaultStudyState.scoring.weights,
        ...parsed.scoring?.weights,
      },
      weeklyRules: Array.isArray(parsed.scoring?.weeklyRules)
        ? parsed.scoring.weeklyRules
        : defaultStudyState.scoring.weeklyRules,
    },
    appearance: {
      ...defaultStudyState.appearance,
      ...parsed.appearance,
      customLight: {
        ...defaultStudyState.appearance.customLight,
        ...parsed.appearance?.customLight,
      },
      customDark: {
        ...defaultStudyState.appearance.customDark,
        ...parsed.appearance?.customDark,
      },
    },
    lifeActivities: Array.isArray(parsed.lifeActivities)
      ? parsed.lifeActivities.map((activity) => ({ ...activity, active: activity.active !== false }))
      : defaultLifeActivities,
    subjects: parsed.subjects.map((subject) => ({
      ...subject,
      phases: Array.isArray(subject.phases)
        ? subject.phases
            .filter((phase) => phase && typeof phase === "object")
            .map((phase) => ({
              ...phase,
              startDate: typeof phase.startDate === "string" ? phase.startDate : undefined,
              targetDate: typeof phase.targetDate === "string" ? phase.targetDate : undefined,
              targetProgress: Number.isFinite(Number(phase.targetProgress)) ? Math.min(100, Math.max(1, Number(phase.targetProgress))) : 100,
              progressHistory: Array.isArray(phase.progressHistory)
                ? phase.progressHistory.filter((snapshot) => snapshot && typeof snapshot.date === "string" && Number.isFinite(Number(snapshot.progress))).map((snapshot) => ({ date: snapshot.date, progress: Math.min(100, Math.max(0, Number(snapshot.progress))) }))
                : [],
              resources: Array.isArray(phase.resources) ? phase.resources : [],
            }))
        : [],
    })),
    sessions: scheduleImport?.sessions ?? parsed.sessions,
    plans: scheduleImport?.plans ?? (Array.isArray(parsed.plans) ? parsed.plans : []),
    schedule: [],
    planTemplates: Array.isArray(parsed.planTemplates) ? parsed.planTemplates : [],
    examRecords: normalizeExamRecords(parsed.examRecords),
    reviewItems: normalizeReviewItems(parsed.reviewItems),
    dataSafety: {
      ...defaultStudyState.dataSafety,
      ...parsed.dataSafety,
    },
    experiences: normalizeExperiences(parsed.experiences),
    fastestExperienceId: typeof parsed.fastestExperienceId === "string"
      && normalizeExperiences(parsed.experiences).some((item) => item.id === parsed.fastestExperienceId)
      ? parsed.fastestExperienceId
      : defaultStudyState.fastestExperienceId,
  });

  if (parsed.version === 3) return normalized;

  const legacyProgressSource: Record<string, string[]> = {
    "eng-word-first": ["eng-word-first", "eng-word", "eng-word-second"],
    "eng-real": ["eng-real", "eng-read"],
    "eng-translation": ["eng-other"],
    "eng-mock": ["eng-mock"],
    "eng-writing": ["eng-writing", "eng-write"],
    "cir-first": ["cir-first", "cir-basic"],
    "cir-chapter": ["cir-chapter", "cir-exercise"],
    "cir-real": ["cir-real"],
    "cir-material": ["cir-material", "cir-mock"],
  };
  const supersededPhaseIds = new Set([
    "eng-word", "eng-word-second", "eng-read", "eng-other", "eng-write",
    "cir-basic", "cir-exercise", "cir-mock",
  ]);
  return {
    ...normalized,
    subjects: normalized.subjects.map((subject) => {
      const rapid = defaultStudyState.subjects.find((item) => item.id === subject.id);
      if (!rapid) return subject;
      const phaseById = new Map(subject.phases.map((phase) => [phase.id, phase]));
      const progressById = new Map(subject.phases.map((phase) => [phase.id, phase.progress]));
      const resourcesById = new Map(subject.phases.map((phase) => [phase.id, phase.resources]));
      const rapidIds = new Set(rapid.phases.map((phase) => phase.id));
      const migratedPhases = rapid.phases.map((phase) => {
        const candidates = legacyProgressSource[phase.id] ?? [phase.id];
        const savedPhase = candidates.map((id) => phaseById.get(id)).find((item) => item?.startDate || item?.targetDate || item?.progressHistory?.length);
        const savedProgress = candidates
          .map((id) => progressById.get(id))
          .filter((value): value is number => typeof value === "number");
        const savedResources = candidates.flatMap((id) => resourcesById.get(id) ?? []);
        const resources = [...phase.resources];
        for (const resource of savedResources) {
          const index = resources.findIndex((item) => item.id === resource.id);
          if (index >= 0) resources[index] = resource;
          else resources.push(resource);
        }
        return {
          ...phase,
          progress: savedProgress.length ? Math.max(...savedProgress) : phase.progress,
          startDate: savedPhase?.startDate,
          targetDate: savedPhase?.targetDate,
          targetProgress: savedPhase?.targetProgress ?? 100,
          progressHistory: savedPhase?.progressHistory ?? [],
          resources,
        };
      });
      const customPhases = subject.phases.filter((phase) =>
        !rapidIds.has(phase.id) && !supersededPhaseIds.has(phase.id),
      );
      return { ...subject, note: rapid.note, phases: [...migratedPhases, ...customPhases] };
    }),
  };
}
