import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleGauge,
  Clock3,
  HardDrive,
  Download,
  FileUp,
  Home,
  ListTodo,
  Moon,
  NotebookText,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Settings,
  SlidersHorizontal,
  Sun,
  Target,
  TimerReset,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultStudyState,
  defaultLifeActivities,
  projectProgress,
  subjectProgress,
  type DailyPlan,
  type PlanItem,
  type PlanTemplate,
  type ScoreWeights,
  type StudySession,
  type LifeActivity,
  type StudyResource,
  type StudyState,
  type Subject,
  type ThemeColors,
  type WeeklyRuleMetric,
} from "./study-state";
import { applyThemePalette, COLOR_FIELDS, THEME_PALETTES } from "./theme-palettes";
import {
  benchmarkPhaseProgress,
  benchmarkProjectProgress,
  benchmarkSubjectProgress,
  normalizeExperiences,
} from "./experience-data";
import ExperiencesView from "./ExperiencesView";
import TimerView from "./TimerView";
import {
  createScheduleArchive,
  mergeImportedPlans,
  mergeImportedSessions,
  mergeImportedTemplates,
  parseScheduleImport,
  withUnifiedSchedule,
  type DateRange,
  type ScheduleImportCandidate,
} from "./schedule-data";
import { findOverlappingSessions } from "./session-time";

type View = "overview" | "today" | "timer" | "records" | "subjects" | "experiences" | "weekly" | "scoring" | "settings";
type SaveStatus = "loading" | "saving" | "saved";
type BackupMode = "export" | "import";
type DashboardAccount = {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
};
type AccountRegistry = {
  version: 1;
  activeAccountId: string;
  accounts: DashboardAccount[];
};

const NAV: { id: View; label: string; icon: typeof Home }[] = [
  { id: "overview", label: "总览", icon: Home },
  { id: "today", label: "今日计划", icon: ListTodo },
  { id: "timer", label: "专注计时", icon: TimerReset },
  { id: "records", label: "时间记录", icon: Clock3 },
  { id: "subjects", label: "科目进度", icon: BookOpen },
  { id: "experiences", label: "经验贴", icon: NotebookText },
  { id: "weekly", label: "周报", icon: BarChart3 },
  { id: "scoring", label: "评分标准", icon: SlidersHorizontal },
  { id: "settings", label: "设置", icon: Settings },
];

const SCORE_WEIGHT_FIELDS: { key: keyof ScoreWeights; label: string; detail: string }[] = [
  { key: "duration", label: "有效时长", detail: "按作息折算后的学习时长" },
  { key: "completion", label: "任务完成", detail: "按时长加权的完成度" },
  { key: "focus", label: "专注质量", detail: "按时长加权的专注度" },
  { key: "review", label: "复盘记录", detail: "有效复盘覆盖比例" },
  { key: "timing", label: "学习时段", detail: "健康学习时段占比" },
  { key: "sleep", label: "睡眠作息", detail: "7–9 小时为满分区间" },
  { key: "exercise", label: "运动安排", detail: "时长与时段综合评价" },
];

const WEEKLY_METRICS: { value: WeeklyRuleMetric; label: string }[] = [
  { value: "averageDailyScore", label: "记录日平均分" },
  { value: "recordRate", label: "记录覆盖率" },
  { value: "studyTarget", label: "学习目标达成率" },
  { value: "healthySleepRate", label: "健康睡眠达标率" },
  { value: "exerciseTarget", label: "运动目标达成率" },
  { value: "routineBalance", label: "作息平衡" },
];

const RESOURCE_TYPES = [
  { value: "book", label: "书本" },
  { value: "chapter", label: "章节" },
  { value: "paper", label: "试卷" },
  { value: "exercise", label: "习题集" },
  { value: "other", label: "其他" },
] as const;

const LEGACY_LOCAL_KEY = "kaoyan-dashboard-state-v1";
const ACCOUNT_REGISTRY_KEY = "kaoyan-dashboard-accounts-v1";
const ACCOUNT_STATE_PREFIX = "kaoyan-dashboard-account-state-v1:";
const THEME_KEY = "kaoyan-dashboard-theme";
const LIFE_ACTIVITIES = defaultLifeActivities;

function accountStateKey(accountId: string) {
  return `${ACCOUNT_STATE_PREFIX}${accountId}`;
}

function freshStudyState(name: string) {
  const next = JSON.parse(JSON.stringify(defaultStudyState)) as StudyState;
  next.profile.name = name;
  return next;
}

function isAccountRegistry(value: unknown): value is AccountRegistry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AccountRegistry>;
  return candidate.version === 1
    && typeof candidate.activeAccountId === "string"
    && Array.isArray(candidate.accounts)
    && candidate.accounts.length > 0
    && candidate.accounts.every((account) =>
      account
      && typeof account.id === "string"
      && typeof account.name === "string"
      && typeof account.createdAt === "string"
      && typeof account.lastActiveAt === "string",
    );
}

function normalizeStudyState(value: unknown): StudyState | null {
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
      phases: subject.phases.map((phase) => ({
        ...phase,
        resources: Array.isArray(phase.resources) ? phase.resources : [],
      })),
    })),
    sessions: scheduleImport?.sessions ?? parsed.sessions,
    plans: scheduleImport?.plans ?? (Array.isArray(parsed.plans) ? parsed.plans : []),
    schedule: [],
    planTemplates: Array.isArray(parsed.planTemplates) ? parsed.planTemplates : [],
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
      const progressById = new Map(subject.phases.map((phase) => [phase.id, phase.progress]));
      const resourcesById = new Map(subject.phases.map((phase) => [phase.id, phase.resources]));
      const rapidIds = new Set(rapid.phases.map((phase) => phase.id));
      const migratedPhases = rapid.phases.map((phase) => {
        const candidates = legacyProgressSource[phase.id] ?? [phase.id];
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

function lifeActivity(subjectId: string, activities: LifeActivity[] = LIFE_ACTIVITIES) {
  return activities.find((item) => item.id === subjectId && item.active !== false);
}

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function minutesBetween(start: string, end: string, allowOvernight = false) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const difference = eh * 60 + em - sh * 60 - sm;
  if (allowOvernight && difference < 0) return difference + 24 * 60;
  return Math.max(0, difference);
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function dateOffset(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
}

function presetRange(preset: "day" | "week" | "month", anchor: string): DateRange {
  if (preset === "day") return { from: anchor, to: anchor };
  const date = new Date(`${anchor}T12:00:00`);
  if (preset === "week") {
    const mondayOffset = (date.getDay() + 6) % 7;
    const from = dateOffset(anchor, -mondayOffset);
    return { from, to: dateOffset(from, 6) };
  }
  const from = `${anchor.slice(0, 7)}-01`;
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from, to: localDate(last) };
}

function isInRange(date: string, range: DateRange) {
  return date >= range.from && date <= range.to;
}

function downloadFile(content: string, filename: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function clonePlanItems(items: PlanItem[]) {
  return items.map((item) => ({ ...item, id: crypto.randomUUID() }));
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00`);
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86_400_000));
}

function clampRatio(value: number) {
  return Math.min(1, Math.max(0, value));
}

function studyTimeWeight(minute: number) {
  if (minute < 5 * 60 + 30) return 0.15;
  if (minute < 8 * 60) return 0.9;
  if (minute < 12 * 60) return 1.05;
  if (minute < 14 * 60) return 0.85;
  if (minute < 18 * 60) return 1.05;
  if (minute < 22 * 60 + 30) return 1;
  if (minute < 23 * 60 + 30) return 0.7;
  return 0.3;
}

function exerciseTimeWeight(minute: number) {
  const morning = minute >= 6 * 60 && minute < 9 * 60;
  const afternoon = minute >= 16 * 60 && minute < 20 * 60 + 30;
  if (morning || afternoon) return 1;
  if (
    (minute >= 9 * 60 && minute < 11 * 60 + 30) ||
    (minute >= 14 * 60 && minute < 16 * 60)
  ) return 0.75;
  if (minute >= 20 * 60 + 30 && minute < 22 * 60) return 0.6;
  if (minute >= 23 * 60 + 30 || minute < 5 * 60 + 30) return 0;
  return 0.35;
}

function sessionTimeWeight(session: StudySession, weightAt: (minute: number) => number) {
  const duration = Math.min(24 * 60, Math.max(0, Math.round(session.actualMinutes)));
  if (!duration) return 0;
  const start = timeToMinutes(session.start);
  let total = 0;
  for (let offset = 0; offset < duration; offset += 1) {
    total += weightAt((start + offset) % (24 * 60));
  }
  return total / duration;
}

function sleepQualityRatio(minutes: number) {
  if (minutes >= 7 * 60 && minutes <= 9 * 60) return 1;
  if (minutes < 7 * 60) return clampRatio((minutes - 5 * 60) / (2 * 60));
  return clampRatio((11 * 60 - minutes) / (2 * 60));
}

function sessionMinutesMatching(session: StudySession, matches: (minute: number) => boolean) {
  const duration = Math.min(24 * 60, Math.max(0, Math.round(session.actualMinutes)));
  const start = timeToMinutes(session.start);
  let total = 0;
  for (let offset = 0; offset < duration; offset += 1) {
    if (matches((start + offset) % (24 * 60))) total += 1;
  }
  return total;
}

function dailyMetrics(sessions: StudySession[], targetHours: number, weights: ScoreWeights, activities: LifeActivity[] = LIFE_ACTIVITIES) {
  const activityIds = new Set(activities.map((activity) => activity.id));
  const studySessions = sessions.filter((item) => !activityIds.has(item.subjectId));
  const sleepSessions = sessions.filter((item) => item.subjectId === "sleep");
  const exerciseSessions = sessions.filter((item) => item.subjectId === "exercise");
  const actualMinutes = studySessions.reduce((sum, item) => sum + item.actualMinutes, 0);
  const weightedStudyMinutes = studySessions.reduce(
    (sum, item) => sum + item.actualMinutes * sessionTimeWeight(item, studyTimeWeight),
    0,
  );
  const completion = actualMinutes
    ? studySessions.reduce((sum, item) => sum + item.completion * item.actualMinutes, 0) /
      actualMinutes
    : 0;
  const focus = actualMinutes
    ? studySessions.reduce((sum, item) => sum + item.focus * item.actualMinutes, 0) /
      actualMinutes
    : 0;
  const review = actualMinutes
    ? studySessions.reduce(
        (sum, item) => sum + (item.note.trim().length >= 6 ? item.actualMinutes : 0),
        0,
      ) / actualMinutes
    : 0;
  const hourRatio = clampRatio(weightedStudyMinutes / Math.max(1, targetHours * 60));
  const timingRatio = actualMinutes ? clampRatio(weightedStudyMinutes / actualMinutes) : 0;
  const sleepMinutes = sleepSessions.reduce((sum, item) => sum + item.actualMinutes, 0);
  const exerciseMinutes = exerciseSessions.reduce((sum, item) => sum + item.actualMinutes, 0);
  const entertainmentMinutes = sessions
    .filter((item) => item.subjectId === "entertainment")
    .reduce((sum, item) => sum + item.actualMinutes, 0);
  const lateStudyMinutes = studySessions.reduce(
    (sum, item) => sum + sessionMinutesMatching(
      item,
      (minute) => minute >= 23 * 60 + 30 || minute < 5 * 60 + 30,
    ),
    0,
  );
  const exerciseTimingRatio = exerciseMinutes
    ? exerciseSessions.reduce(
        (sum, item) => sum + item.actualMinutes * sessionTimeWeight(item, exerciseTimeWeight),
        0,
      ) / exerciseMinutes
    : 0;
  const exerciseDurationRatio = exerciseMinutes < 30
    ? exerciseMinutes / 30
    : exerciseMinutes <= 90
      ? 1
      : Math.max(0.7, 1 - (exerciseMinutes - 90) / 200);
  const componentRatios = {
    duration: hourRatio,
    completion: completion / 100,
    focus: focus / 5,
    review,
    timing: timingRatio,
    sleep: sleepQualityRatio(sleepMinutes),
    exercise: exerciseDurationRatio * (0.7 + exerciseTimingRatio * 0.3),
  };
  const scoreParts = {
    duration: componentRatios.duration * Math.max(0, weights.duration),
    completion: componentRatios.completion * Math.max(0, weights.completion),
    focus: componentRatios.focus * Math.max(0, weights.focus),
    review: componentRatios.review * Math.max(0, weights.review),
    timing: componentRatios.timing * Math.max(0, weights.timing),
    sleep: componentRatios.sleep * Math.max(0, weights.sleep),
    exercise: componentRatios.exercise * Math.max(0, weights.exercise),
  };
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  const score = Math.round(
    Object.values(scoreParts).reduce((sum, value) => sum + value, 0) / totalWeight * 100,
  );
  return {
    actualMinutes,
    weightedStudyMinutes,
    completion,
    focus,
    review,
    timingRatio,
    sleepMinutes,
    exerciseMinutes,
    entertainmentMinutes,
    lateStudyMinutes,
    scoreParts,
    score,
    hourRatio,
    hasRecords: sessions.length > 0,
  };
}

function sessionsForDate(sessions: StudySession[], date: string) {
  return sessions.filter((item) => item.date === date).sort((a, b) => a.start.localeCompare(b.start));
}

function recentDates(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return localDate(date);
  });
}

function periodSummary(
  sessions: StudySession[],
  dates: string[],
  targetHours: number,
  weights: ScoreWeights,
  weeklyRules = defaultStudyState.scoring.weeklyRules,
  activities: LifeActivity[] = LIFE_ACTIVITIES,
) {
  const days = dates.map((date) => dailyMetrics(sessionsForDate(sessions, date), targetHours, weights, activities));
  const recordedDays = days.filter((item) => item.hasRecords);
  const sleepDays = days.filter((item) => item.sleepMinutes > 0);
  const averageDailyScore = recordedDays.length
    ? recordedDays.reduce((sum, item) => sum + item.score, 0) / recordedDays.length
    : 0;
  const recordRate = recordedDays.length / Math.max(1, dates.length);
  const healthySleepRate = sleepDays.length
    ? sleepDays.filter((item) => item.sleepMinutes >= 7 * 60 && item.sleepMinutes <= 9 * 60).length /
      sleepDays.length
    : 0;
  const exerciseMinutes = days.reduce((sum, item) => sum + item.exerciseMinutes, 0);
  const exerciseTarget = dates.length / 7 * 150;
  const averageEntertainmentMinutes = Math.round(
    days.reduce((sum, item) => sum + item.entertainmentMinutes, 0) / Math.max(1, dates.length),
  );
  const totalStudyMinutes = days.reduce((sum, item) => sum + item.actualMinutes, 0);
  const lateStudyMinutes = days.reduce((sum, item) => sum + item.lateStudyMinutes, 0);
  const entertainmentBalance = averageEntertainmentMinutes <= 120
    ? 1
    : clampRatio((240 - averageEntertainmentMinutes) / 120);
  const lateStudyBalance = totalStudyMinutes
    ? clampRatio(1 - lateStudyMinutes / totalStudyMinutes)
    : 0;
  const routineBalance =
    healthySleepRate * 0.4 +
    clampRatio(exerciseMinutes / Math.max(1, exerciseTarget)) * 0.3 +
    entertainmentBalance * 0.15 +
    lateStudyBalance * 0.15;
  const metricRatios: Record<WeeklyRuleMetric, number> = {
    averageDailyScore: clampRatio(averageDailyScore / 100),
    recordRate,
    studyTarget: clampRatio(totalStudyMinutes / Math.max(1, dates.length * targetHours * 60)),
    healthySleepRate,
    exerciseTarget: clampRatio(exerciseMinutes / Math.max(1, exerciseTarget)),
    routineBalance,
  };
  const enabledRules = weeklyRules.filter((rule) => rule.enabled && rule.weight > 0);
  const ruleWeight = enabledRules.reduce((sum, rule) => sum + rule.weight, 0) || 1;
  const ruleResults = enabledRules.map((rule) => ({
    ...rule,
    ratio: metricRatios[rule.metric],
    points: metricRatios[rule.metric] * rule.weight,
  }));
  const periodScore = Math.round(ruleResults.reduce((sum, rule) => sum + rule.points, 0) / ruleWeight * 100);
  return {
    days: dates.length,
    periodScore,
    averageDailyScore: Math.round(averageDailyScore),
    recordRate,
    averageSleepMinutes: sleepDays.length
      ? Math.round(sleepDays.reduce((sum, item) => sum + item.sleepMinutes, 0) / sleepDays.length)
      : 0,
    healthySleepRate,
    exerciseMinutes,
    exerciseTarget: Math.round(exerciseTarget),
    exerciseDays: days.filter((item) => item.exerciseMinutes >= 20).length,
    averageEntertainmentMinutes,
    totalStudyMinutes,
    lateStudyMinutes,
    routineBalance,
    ruleResults,
  };
}

export default function Dashboard() {
  const [state, setState] = useState<StudyState>(defaultStudyState);
  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState("");
  const [view, setView] = useState<View>("overview");
  const [planDate, setPlanDate] = useState(localDate());
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [loaded, setLoaded] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordEditing, setRecordEditing] = useState<StudySession | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planEditing, setPlanEditing] = useState<PlanItem | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [backupMode, setBackupMode] = useState<BackupMode | null>(null);
  const [importCandidate, setImportCandidate] = useState<ScheduleImportCandidate | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    const initial =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    queueMicrotask(() => setTheme(initial));
    document.documentElement.dataset.theme = initial;

    let registry: AccountRegistry | null = null;
    const storedRegistry = window.localStorage.getItem(ACCOUNT_REGISTRY_KEY);
    if (storedRegistry) {
      try {
        const parsedRegistry = JSON.parse(storedRegistry) as unknown;
        if (isAccountRegistry(parsedRegistry)) registry = parsedRegistry;
      } catch {
        // A damaged registry is handled by the safe legacy/default migration below.
      }
    }

    if (registry) {
      const activeAccount = registry.accounts.find(
        (account) => account.id === registry?.activeAccountId,
      ) ?? registry.accounts[0];
      let accountState: StudyState | null = null;
      const storedAccountState = window.localStorage.getItem(accountStateKey(activeAccount.id));
      if (storedAccountState) {
        try {
          accountState = normalizeStudyState(JSON.parse(storedAccountState) as unknown);
        } catch {
          // Ignore a damaged account snapshot and open a fresh isolated state.
        }
      }
      setAccounts(registry.accounts);
      setActiveAccountId(activeAccount.id);
      setState(accountState ?? freshStudyState(activeAccount.name));
      if (activeAccount.id !== registry.activeAccountId) {
        window.localStorage.setItem(
          ACCOUNT_REGISTRY_KEY,
          JSON.stringify({ ...registry, activeAccountId: activeAccount.id }),
        );
      }
    } else {
      let legacyState: StudyState | null = null;
      const legacy = window.localStorage.getItem(LEGACY_LOCAL_KEY);
      if (legacy) {
        try {
          legacyState = normalizeStudyState(JSON.parse(legacy) as unknown);
        } catch {
          // Keep the damaged legacy value untouched so a manual recovery remains possible.
        }
      }
      const accountName = legacyState?.profile.name.trim() || "默认账号";
      const accountId = crypto.randomUUID();
      const now = new Date().toISOString();
      const account: DashboardAccount = {
        id: accountId,
        name: accountName,
        createdAt: now,
        lastActiveAt: now,
      };
      const initialState = legacyState ?? freshStudyState(accountName);
      const initialRegistry: AccountRegistry = {
        version: 1,
        activeAccountId: accountId,
        accounts: [account],
      };
      window.localStorage.setItem(accountStateKey(accountId), JSON.stringify(initialState));
      window.localStorage.setItem(ACCOUNT_REGISTRY_KEY, JSON.stringify(initialRegistry));
      setAccounts([account]);
      setActiveAccountId(accountId);
      setState(initialState);
    }
    setSaveStatus("saved");
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !activeAccountId) return;
    queueMicrotask(() => setSaveStatus("saving"));
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(accountStateKey(activeAccountId), JSON.stringify(state));
      setSaveStatus("saved");
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state, loaded, activeAccountId]);

  useEffect(() => {
    if (!loaded || !activeAccountId || !accounts.length) return;
    const registry: AccountRegistry = {
      version: 1,
      activeAccountId,
      accounts,
    };
    window.localStorage.setItem(ACCOUNT_REGISTRY_KEY, JSON.stringify(registry));
  }, [accounts, activeAccountId, loaded]);

  useEffect(() => {
    applyThemePalette(state.appearance, theme);
  }, [state.appearance, theme]);

  const today = localDate();
  const todaySessions = useMemo(() => sessionsForDate(state.sessions, today), [state.sessions, today]);
  const activePlan = useMemo<DailyPlan>(
    () => state.plans.find((plan) => plan.date === planDate) ?? { date: planDate, items: [] },
    [state.plans, planDate],
  );
  const planSessions = useMemo(() => sessionsForDate(state.sessions, planDate), [state.sessions, planDate]);
  const planMetrics = useMemo(
    () => dailyMetrics(planSessions, state.profile.dailyTargetHours, state.scoring.weights, state.lifeActivities),
    [planSessions, state.profile.dailyTargetHours, state.scoring.weights, state.lifeActivities],
  );
  const todayMetrics = useMemo(
    () => dailyMetrics(todaySessions, state.profile.dailyTargetHours, state.scoring.weights, state.lifeActivities),
    [todaySessions, state.profile.dailyTargetHours, state.scoring.weights, state.lifeActivities],
  );
  const progress = useMemo(() => projectProgress(state.subjects), [state.subjects]);
  const sevenDates = useMemo(() => recentDates(7), [today]);
  const thirtyDates = useMemo(() => recentDates(30), [today]);
  const weekMetrics = useMemo(
    () =>
      sevenDates.map((date) => ({
        date,
        ...dailyMetrics(
          sessionsForDate(state.sessions, date),
          state.profile.dailyTargetHours,
          state.scoring.weights,
          state.lifeActivities,
        ),
      })),
    [sevenDates, state.sessions, state.profile.dailyTargetHours, state.scoring.weights, state.lifeActivities],
  );
  const weekSummary = useMemo(
    () => periodSummary(state.sessions, sevenDates, state.profile.dailyTargetHours, state.scoring.weights, state.scoring.weeklyRules, state.lifeActivities),
    [sevenDates, state.sessions, state.profile.dailyTargetHours, state.scoring.weights, state.scoring.weeklyRules, state.lifeActivities],
  );
  const monthSummary = useMemo(
    () => periodSummary(state.sessions, thirtyDates, state.profile.dailyTargetHours, state.scoring.weights, state.scoring.weeklyRules, state.lifeActivities),
    [thirtyDates, state.sessions, state.profile.dailyTargetHours, state.scoring.weights, state.scoring.weeklyRules, state.lifeActivities],
  );
  const activeDays = weekMetrics.filter((item) => item.hasRecords);
  const weeklyAverage = activeDays.length
    ? Math.round(activeDays.reduce((sum, item) => sum + item.score, 0) / activeDays.length)
    : 0;
  const startedSubjects = state.subjects.filter((subject) => subjectProgress(subject) > 0).length;
  const balanceScore = Math.round((startedSubjects / state.subjects.length) * 100);
  const projectScore = Math.round(
    progress * 0.5 + weekSummary.periodScore * 0.25 + monthSummary.periodScore * 0.1 + balanceScore * 0.15,
  );

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(THEME_KEY, next);
  }

  function loadAccountState(account: DashboardAccount) {
    const stored = window.localStorage.getItem(accountStateKey(account.id));
    if (stored) {
      try {
        const normalized = normalizeStudyState(JSON.parse(stored) as unknown);
        if (normalized) return normalized;
      } catch {
        // A damaged account snapshot falls back to a clean state for this account.
      }
    }
    return freshStudyState(account.name);
  }

  function switchAccount(accountId: string) {
    if (!accountId || accountId === activeAccountId) return;
    const nextAccount = accounts.find((account) => account.id === accountId);
    if (!nextAccount) return;

    if (activeAccountId) {
      window.localStorage.setItem(accountStateKey(activeAccountId), JSON.stringify(state));
    }
    const now = new Date().toISOString();
    setSaveStatus("loading");
    setAccounts((current) => current.map((account) =>
      account.id === accountId ? { ...account, lastActiveAt: now } : account,
    ));
    setActiveAccountId(accountId);
    setState(loadAccountState(nextAccount));
    setRecordOpen(false);
    setRecordEditing(null);
    setPlanOpen(false);
    setPlanEditing(null);
    setBackupMode(null);
    setImportCandidate(null);
    setSidebarHidden(false);
    setView("overview");
    setSaveStatus("saved");
  }

  function addAccount(name: string) {
    const accountName = name.trim();
    if (!accountName) {
      window.alert("请输入账号名称。");
      return false;
    }
    if (accounts.some((account) => account.name.toLocaleLowerCase() === accountName.toLocaleLowerCase())) {
      window.alert("已有同名账号，请换一个名称。");
      return false;
    }
    if (activeAccountId) {
      window.localStorage.setItem(accountStateKey(activeAccountId), JSON.stringify(state));
    }
    const now = new Date().toISOString();
    const account: DashboardAccount = {
      id: crypto.randomUUID(),
      name: accountName,
      createdAt: now,
      lastActiveAt: now,
    };
    const nextState = freshStudyState(accountName);
    window.localStorage.setItem(accountStateKey(account.id), JSON.stringify(nextState));
    setAccounts((current) => [...current, account]);
    setActiveAccountId(account.id);
    setState(nextState);
    setView("overview");
    setSaveStatus("saved");
    return true;
  }

  function renameAccount(accountId: string, name: string) {
    const accountName = name.trim();
    if (!accountName) {
      window.alert("账号名称不能为空。");
      return false;
    }
    if (accounts.some((account) =>
      account.id !== accountId
      && account.name.toLocaleLowerCase() === accountName.toLocaleLowerCase()
    )) {
      window.alert("已有同名账号，请换一个名称。");
      return false;
    }
    setAccounts((current) => current.map((account) =>
      account.id === accountId ? { ...account, name: accountName } : account,
    ));
    if (accountId === activeAccountId) {
      updateState((current) => ({
        ...current,
        profile: { ...current.profile, name: accountName },
      }));
    }
    return true;
  }

  function deleteAccount(accountId: string) {
    if (accountId === activeAccountId) {
      window.alert("当前正在使用的账号不能删除，请先切换到其他账号。");
      return;
    }
    const account = accounts.find((item) => item.id === accountId);
    if (!account || !window.confirm(`确定删除账号“${account.name}”及其全部本机数据？此操作无法撤销。`)) return;
    window.localStorage.removeItem(accountStateKey(accountId));
    setAccounts((current) => current.filter((item) => item.id !== accountId));
  }

  function updateState(updater: (current: StudyState) => StudyState) {
    setState((current) => withUnifiedSchedule(updater(current)));
  }

  function addSession(session: StudySession) {
    updateState((current) => ({
      ...current,
      sessions: current.sessions.some((item) => item.id === session.id)
        ? current.sessions.map((item) => item.id === session.id ? session : item)
        : [...current.sessions, session],
    }));
    setRecordEditing(null);
    setRecordOpen(false);
  }

  function addTimerSessions(sessions: StudySession[]) {
    if (!sessions.length) return;
    updateState((current) => {
      const incomingIds = new Set(sessions.map((session) => session.id));
      const needsRestCategory = sessions.some((session) => session.subjectId === "rest");
      const hasRestCategory = current.lifeActivities.some((activity) => activity.id === "rest");
      const lifeActivities = needsRestCategory
        ? hasRestCategory
          ? current.lifeActivities.map((activity) => activity.id === "rest" ? { ...activity, active: true } : activity)
          : [...current.lifeActivities, { id: "rest", name: "休息", accent: "#7d8790", active: true }]
        : current.lifeActivities;
      return {
        ...current,
        lifeActivities,
        sessions: [...current.sessions.filter((session) => !incomingIds.has(session.id)), ...sessions],
      };
    });
  }

  function openNewRecord() {
    setRecordEditing(null);
    setRecordOpen(true);
  }

  function openEditRecord(session: StudySession) {
    setRecordEditing(session);
    setRecordOpen(true);
  }

  function deleteSession(id: string) {
    updateState((current) => ({
      ...current,
      sessions: current.sessions.filter((item) => item.id !== id),
    }));
  }

  function addPlanItem(item: PlanItem) {
    updateState((current) => {
      const existing = current.plans.find((plan) => plan.date === planDate);
      const plans = existing
        ? current.plans.map((plan) => plan.date === planDate
          ? {
              ...plan,
              items: plan.items.some((entry) => entry.id === item.id)
                ? plan.items.map((entry) => entry.id === item.id ? item : entry)
                : [...plan.items, item],
            }
          : plan)
        : [...current.plans, { date: planDate, items: [item] }];
      return { ...current, plans };
    });
    setPlanEditing(null);
    setPlanOpen(false);
  }

  function openNewPlan() {
    setPlanEditing(null);
    setPlanOpen(true);
  }

  function openEditPlan(item: PlanItem) {
    setPlanEditing(item);
    setPlanOpen(true);
  }

  function deletePlanItem(id: string) {
    updateState((current) => ({
      ...current,
      plans: current.plans.map((plan) => plan.date === planDate
        ? { ...plan, items: plan.items.filter((item) => item.id !== id) }
        : plan),
    }));
  }

  function exportData(range: DateRange) {
    const archive = createScheduleArchive(state, range);
    downloadFile(
      JSON.stringify(archive, null, 2),
      `kaoyan-schedule-${range.from}-${range.to}.json`,
    );
    setBackupMode(null);
  }

  function readImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = parseScheduleImport(JSON.parse(String(reader.result)));
        if (!next) throw new Error("invalid");
        setImportCandidate(next);
        setBackupMode("import");
      } catch {
        window.alert("无法导入：请选择日程归档、旧版整站备份或旧版计划 JSON 文件。");
      }
    };
    reader.readAsText(file);
  }

  function importData(range: DateRange) {
    if (!importCandidate) return;
    const selectedSessions = importCandidate.sessions.filter((item) => isInRange(item.date, range));
    const selectedPlans = importCandidate.plans.filter((item) => isInRange(item.date, range));
    const sessionMerge = mergeImportedSessions(state.sessions, selectedSessions);
    const planMerge = mergeImportedPlans(state.plans, selectedPlans);
    const templateMerge = mergeImportedTemplates(state.planTemplates, importCandidate.planTemplates);
    setState((current) => withUnifiedSchedule({
      ...current,
      sessions: sessionMerge.sessions,
      plans: planMerge.plans,
      planTemplates: templateMerge.templates,
    }));
    setBackupMode(null);
    setImportCandidate(null);
    window.alert(
      `导入完成。时间记录：新增 ${sessionMerge.report.added} 条，重复 ${sessionMerge.report.duplicates} 条，顺延 ${sessionMerge.report.shifted} 条，跳过 ${sessionMerge.report.skipped} 条；今日计划：新增 ${planMerge.report.added} 条，重复 ${planMerge.report.duplicates} 条，顺延 ${planMerge.report.shifted} 条，跳过 ${planMerge.report.skipped} 条；计划模板：新增 ${templateMerge.added} 个，重复 ${templateMerge.duplicates} 个。`,
    );
  }

  const viewTitle = NAV.find((item) => item.id === view)?.label ?? "总览";
  const activeAccount = accounts.find((account) => account.id === activeAccountId);

  return (
    <div className={`app-shell ${sidebarHidden ? "sidebar-hidden" : ""} ${view === "timer" ? "timer-view" : ""}`}>
      {sidebarHidden && <button className="sidebar-reveal-toggle" type="button" onClick={() => setSidebarHidden(false)} aria-label="展开侧栏" title="展开侧栏"><PanelLeftOpen size={18} /></button>}
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="sidebar-topbar">
          <div className="brand-block">
            <div className="brand-mark">
              {state.profile.sidebarIcon ? <img src={state.profile.sidebarIcon} alt="侧栏图标" /> : "Z"}
            </div>
            <div><strong>{state.profile.sidebarTitle}</strong><span>{state.profile.sidebarSubtitle}</span></div>
          </div>
          <button className="sidebar-collapse-toggle" type="button" onClick={() => { setSidebarHidden(true); setMobileNavOpen(false); }} aria-label="隐藏侧栏" title="隐藏侧栏"><PanelLeftClose size={18} /></button>
        </div>
        <nav className="nav-list" aria-label="主要导航">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                onClick={() => { setView(item.id); setMobileNavOpen(false); }}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button
            className="sidebar-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "切换至暗色模式" : "切换至亮色模式"}
            title={theme === "light" ? "切换至暗色模式" : "切换至亮色模式"}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === "light" ? "切换至暗色模式" : "切换至亮色模式"}</span>
          </button>
          <div className="mini-target"><Target size={18} /><div><span>目标</span><strong>{state.profile.targetSchool}</strong></div></div>
          <p>{state.profile.targetDescription}</p>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-leading">
            <button className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="打开导航">☰</button>
            <div>
              <p className="eyebrow">{viewTitle}</p>
              <h1>{view === "overview" ? `晚上好，${state.profile.name}` : viewTitle}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <label className="account-switcher">
              <Users size={17} />
              <span>当前账号</span>
              <select
                aria-label="快速切换账号"
                value={activeAccountId}
                onChange={(event) => switchAccount(event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </label>
            <div className={`sync-state ${saveStatus}`} title="学习数据仅保存在当前浏览器">
              <HardDrive size={16} />
              <span>{saveStatus === "loading" ? "正在读取" : saveStatus === "saving" ? "正在保存" : "已保存到本机"}</span>
            </div>
          </div>
        </header>

        {view === "overview" && (
          <Overview
            state={state}
            todaySessions={todaySessions}
            metrics={todayMetrics}
            progress={progress}
            projectScore={projectScore}
            days={daysUntil(state.profile.examDate)}
            onRecord={openNewRecord}
            onNavigate={setView}
          />
        )}
        {view === "today" && (
          <TodayView
            state={state}
            plan={activePlan}
            sessions={planSessions}
            metrics={planMetrics}
            planDate={planDate}
            onPlanDateChange={setPlanDate}
            updateState={updateState}
            onAddPlan={openNewPlan}
            onRecord={openNewRecord}
            onEditPlan={openEditPlan}
            onEditSession={openEditRecord}
            onDeleteSession={deleteSession}
            onDeletePlan={deletePlanItem}
          />
        )}
        {view === "timer" && (
          <TimerView
            state={state}
            accountId={activeAccountId}
            sidebarHidden={sidebarHidden}
            onSidebarHiddenChange={setSidebarHidden}
            onSaveSessions={addTimerSessions}
            onExit={() => setView("overview")}
          />
        )}
        {view === "records" && (
          <RecordsView
            state={state}
            onRecord={openNewRecord}
            onEdit={openEditRecord}
            onDelete={deleteSession}
          />
        )}
        {view === "subjects" && <SubjectsView state={state} updateState={updateState} />}
        {view === "experiences" && <ExperiencesView state={state} updateState={updateState} />}
        {view === "weekly" && <WeeklyView state={state} metrics={weekMetrics} average={weeklyAverage} summary={weekSummary} />}
        {view === "scoring" && (
          <ScoringView
            state={state}
            week={weekSummary}
            month={monthSummary}
            updateState={updateState}
          />
        )}
        {view === "settings" && (
          <SettingsView
            state={state}
            accounts={accounts}
            activeAccountId={activeAccountId}
            updateState={updateState}
            onSwitchAccount={switchAccount}
            onAddAccount={addAccount}
            onRenameAccount={renameAccount}
            onDeleteAccount={deleteAccount}
            onExport={() => setBackupMode("export")}
            onImport={() => importRef.current?.click()}
            onReset={() => window.confirm("确定恢复当前账号的初始信息？当前账号的现有记录将被清空。")
              && setState(freshStudyState(activeAccount?.name ?? "默认账号"))}
          />
        )}
        <input ref={importRef} type="file" hidden accept="application/json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) readImportFile(file);
          event.target.value = "";
        }} />
      </main>

      {recordOpen && <RecordDialog state={state} initial={recordEditing} onClose={() => { setRecordOpen(false); setRecordEditing(null); }} onSave={addSession} />}
      {planOpen && <PlanItemDialog state={state} initial={planEditing} onClose={() => { setPlanOpen(false); setPlanEditing(null); }} onSave={addPlanItem} />}
      {backupMode && (
        <BackupDialog
          mode={backupMode}
          sessions={backupMode === "import" ? importCandidate?.sessions ?? [] : state.sessions}
          plans={backupMode === "import" ? importCandidate?.plans ?? [] : state.plans}
          onClose={() => { setBackupMode(null); setImportCandidate(null); }}
          onConfirm={backupMode === "import" ? importData : exportData}
        />
      )}
    </div>
  );
}

function Overview({ state, todaySessions, metrics, progress, projectScore, days, onRecord, onNavigate }: {
  state: StudyState;
  todaySessions: StudySession[];
  metrics: ReturnType<typeof dailyMetrics>;
  progress: number;
  projectScore: number;
  days: number;
  onRecord: () => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <div className="page-stack">
      <section className="countdown-line"><CalendarDays size={19} /><span>距离暂定初试日期</span><strong>{days}</strong><span>天</span></section>
      <section className="hero-grid">
        <article className="metric-card score-card">
          <div><p className="card-kicker">今日得分</p><strong className="mega-number">{metrics.score}</strong><p className="muted">综合学习质量、学习时段、睡眠和运动计算</p></div>
          <ProgressRing value={metrics.score} label="/ 100" />
        </article>
        <article className="metric-card hours-card">
          <p className="card-kicker">有效学习</p>
          <div className="hours-value"><strong>{(metrics.actualMinutes / 60).toFixed(1)}</strong><span>h / 目标 {state.profile.dailyTargetHours}h</span></div>
          <div className="progress-track"><i style={{ width: `${metrics.hourRatio * 100}%` }} /></div>
          <p className="progress-caption">{Math.round(metrics.hourRatio * 100)}%</p>
        </article>
        <button className="record-cta" onClick={onRecord}>
          <div className="cta-icon"><Plus size={28} /></div>
          <div><span>快速记录</span><strong>记录当前时段</strong></div>
          <ChevronRight size={24} />
        </button>
      </section>

      <section className="content-grid">
        <article className="panel timeline-panel">
          <div className="panel-heading"><div><p className="card-kicker">今日执行</p><h2>时间线</h2></div><button className="text-button" onClick={() => onNavigate("records")}>查看全部 <ChevronRight size={15} /></button></div>
          {todaySessions.length ? (
            <div className="timeline-list">
              {todaySessions.slice(0, 4).map((session) => (
                <div className="timeline-item" key={session.id}>
                  <span className="timeline-dot"><Check size={13} /></span>
                  <time>{session.start}–{session.end}</time>
                  <strong>{session.task}</strong>
                  <span>{lifeActivity(session.subjectId, state.lifeActivities)?.name ?? `${session.completion}%`}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={TimerReset} title="今天还没有学习记录" detail="先记录一个真实时段，评分会从第一条数据开始。" action="开始记录" onAction={onRecord} />
          )}
        </article>
        <article className="panel breakdown-panel">
          <div className="panel-heading"><div><p className="card-kicker">总进度评分</p><h2>项目健康度</h2></div><span className="score-badge">{projectScore}</span></div>
          <ScoreRow label="考研总进度" value={progress} max={100} />
          <ScoreRow label="今日执行" value={metrics.score} max={100} />
          <ScoreRow label="科目启动" value={state.subjects.filter((s) => subjectProgress(s) > 0).length} max={state.subjects.length} />
          <div className="formula-note"><CircleGauge size={16} />总评分 = 总进度 50% + 近7日 25% + 近30日 10% + 科目均衡 15%</div>
        </article>
      </section>

      <section className="subject-grid">
        {state.subjects.map((subject) => {
          const value = subjectProgress(subject);
          return (
            <button className="subject-card" key={subject.id} onClick={() => onNavigate("subjects")}>
              <div className="subject-title"><div><span>{subject.shortName}</span><strong>{subject.name}</strong></div><BookOpen size={20} /></div>
              <ProgressRing value={value} compact color={subject.accent} />
              <p>{subject.note}</p>
            </button>
          );
        })}
      </section>
    </div>
  );
}

function TodayView({ state, plan, sessions, metrics, planDate, onPlanDateChange, updateState, onAddPlan, onRecord, onEditPlan, onEditSession, onDeleteSession, onDeletePlan }: {
  state: StudyState;
  plan: DailyPlan;
  sessions: StudySession[];
  metrics: ReturnType<typeof dailyMetrics>;
  planDate: string;
  onPlanDateChange: (date: string) => void;
  updateState: (updater: (current: StudyState) => StudyState) => void;
  onAddPlan: () => void;
  onRecord: () => void;
  onEditPlan: (item: PlanItem) => void;
  onEditSession: (session: StudySession) => void;
  onDeleteSession: (id: string) => void;
  onDeletePlan: (id: string) => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const selectedTemplate = state.planTemplates.find((template) => template.id === selectedTemplateId)
    ?? state.planTemplates[0];
  const plannedMinutes = plan.items.reduce(
    (sum, item) => sum + minutesBetween(item.start, item.end, item.subjectId === "sleep"),
    0,
  );

  function replaceTodayPlan(items: PlanItem[]) {
    updateState((current) => ({
      ...current,
      plans: current.plans.some((item) => item.date === plan.date)
        ? current.plans.map((item) => item.date === plan.date ? { ...item, items } : item)
        : [...current.plans, { date: plan.date, items }],
    }));
  }

  function saveAsTemplate() {
    if (!plan.items.length) return;
    const name = window.prompt("请输入模板名称，例如：高强度数学日");
    if (!name?.trim()) return;
    const template: PlanTemplate = { id: crypto.randomUUID(), name: name.trim(), items: clonePlanItems(plan.items) };
    updateState((current) => ({ ...current, planTemplates: [...current.planTemplates, template] }));
    setSelectedTemplateId(template.id);
  }

  function applyTemplate() {
    if (!selectedTemplate) return;
    if (plan.items.length && !window.confirm(`应用“${selectedTemplate.name}”会替换今天已有计划，是否继续？`)) return;
    replaceTodayPlan(clonePlanItems(selectedTemplate.items));
  }

  function deleteTemplate() {
    if (!selectedTemplate || !window.confirm(`确定删除计划模板“${selectedTemplate.name}”？`)) return;
    updateState((current) => ({
      ...current,
      planTemplates: current.planTemplates.filter((template) => template.id !== selectedTemplate.id),
    }));
    setSelectedTemplateId("");
  }

  return (
    <div className="page-stack narrow-page">
      <section className="summary-strip today-summary">
        <div><span>计划总时长</span><strong>{formatMinutes(plannedMinutes)}</strong></div>
        <div><span>计划时段</span><strong>{plan.items.length}</strong></div>
        <div><span>实际学习</span><strong>{formatMinutes(metrics.actualMinutes)}</strong></div>
        <div><span>睡眠</span><strong>{formatMinutes(metrics.sleepMinutes)}</strong></div>
        <div><span>运动</span><strong>{formatMinutes(metrics.exerciseMinutes)}</strong></div>
        <div><span>今日得分</span><strong>{metrics.score}</strong></div>
        <button className="primary-button" onClick={onAddPlan}><Plus size={17} />新增计划</button>
      </section>
      <div className="page-actions plan-actions">
        <div className="plan-date-control"><button className="secondary-button" onClick={() => onPlanDateChange(dateOffset(planDate, -1))}>前一天</button><label><span>计划日期</span><input type="date" value={planDate} onChange={(event) => event.target.value && onPlanDateChange(event.target.value)} /></label><button className="secondary-button" onClick={() => onPlanDateChange(dateOffset(planDate, 1))}>后一天</button><button className="text-button" onClick={() => onPlanDateChange(localDate())}>回到今天</button></div>
        <p className="muted">计划与实际记录按日期统一存储。</p>
        <div className="button-row compact-buttons">
          <button className="secondary-button" onClick={onRecord}><Clock3 size={16} />记录实际</button>
          <button className="secondary-button" disabled={!plan.items.length} onClick={saveAsTemplate}><Save size={16} />保存为模板</button>
        </div>
      </div>
      <section className="panel schedule-panel">
        <div className="panel-heading"><div><p className="card-kicker">{plan.date}</p><h2>{plan.date === localDate() ? "今日" : "当日"}计划安排图</h2></div><span className="muted">按计划时段生成</span></div>
        <DayScheduleChart entries={plan.items} state={state} mode="planned" />
        {plan.items.length > 0 && <><div className="schedule-table-divider" /><EditablePlanTable items={plan.items} state={state} onEdit={onEditPlan} onDelete={onDeletePlan} /></>}
      </section>
      <section className="panel template-panel">
        <div className="panel-heading"><div><p className="card-kicker">可复用安排</p><h2>计划模板预览</h2></div><span className="muted">{state.planTemplates.length} 个模板</span></div>
        {selectedTemplate ? (
          <>
            <div className="template-toolbar">
              <label><span>选择模板</span><select value={selectedTemplate.id} onChange={(event) => setSelectedTemplateId(event.target.value)}>{state.planTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
              <div><button className="primary-button" onClick={applyTemplate}>应用到今天</button><button className="danger-button" onClick={deleteTemplate}><Trash2 size={15} />删除模板</button></div>
            </div>
            <DayScheduleChart entries={selectedTemplate.items} state={state} mode="planned" />
          </>
        ) : (
          <div className="schedule-empty">今天安排好计划后，点击“保存为模板”，即可在这里选择并预览。</div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><p className="card-kicker">{plan.date}</p><h2>当天的实际记录</h2></div><span className="muted">目标 {state.profile.dailyTargetHours} 小时</span></div>
        {sessions.length ? <><DayScheduleChart entries={sessions} state={state} mode="actual" /><div className="schedule-table-divider" /><EditableSessionTable sessions={sessions} state={state} onEdit={onEditSession} onDelete={onDeleteSession} /></> : <EmptyState icon={Clock3} title="今天还没有实际记录" detail="执行计划后记录真实时段，计划图与实际图会分别保留。" action="记录第一个时段" onAction={onRecord} />}
      </section>
    </div>
  );
}

function RecordsView({ state, onRecord, onEdit, onDelete }: {
  state: StudyState;
  onRecord: () => void;
  onEdit: (session: StudySession) => void;
  onDelete: (id: string) => void;
}) {
  const dates = Array.from(new Set(state.sessions.map((item) => item.date))).sort().reverse();
  return (
    <div className="page-stack narrow-page">
      <div className="page-actions">
        <p className="muted">共 {state.sessions.length} 条记录 · 与今日计划按日期统一存储</p>
        <div className="button-row compact-buttons">
          <button className="primary-button" onClick={onRecord}><Plus size={17} />新增记录</button>
        </div>
      </div>
      {dates.length ? dates.map((date) => (
        <section className="panel" key={date}>
          <div className="panel-heading"><div><p className="card-kicker">{date}</p><h2>实际时间记录图</h2></div><strong>{formatMinutes(sessionsForDate(state.sessions, date).reduce((sum, item) => sum + item.actualMinutes, 0))}</strong></div>
          <DayScheduleChart entries={sessionsForDate(state.sessions, date)} state={state} mode="actual" />
          <div className="schedule-table-divider" />
            <EditableSessionTable sessions={sessionsForDate(state.sessions, date)} state={state} onEdit={onEdit} onDelete={onDelete} />
        </section>
      )) : <section className="panel"><EmptyState icon={Clock3} title="记录会按日期沉淀在这里" detail="完成第一条记录后，可在这里查看全部历史。" action="新增记录" onAction={onRecord} /></section>}
    </div>
  );
}

function SubjectsView({ state, updateState }: { state: StudyState; updateState: (updater: (current: StudyState) => StudyState) => void }) {
  const importRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<{ subjectId: string; phaseId: string } | null>(null);
  const today = localDate();
  const fastestExperience = state.experiences.find((item) => item.id === state.fastestExperienceId);
  const fastestProjectProgress = benchmarkProjectProgress(fastestExperience, state.subjects, today, state.profile.examDate);

  function addPhase(subject: Subject) {
    if (!window.confirm(`即将在“${subject.name}”中新增复习阶段。新增后会改变总进度的权重结构，是否继续？`)) return;
    const phase = { id: crypto.randomUUID(), name: "新阶段", weight: 10, progress: 0, resources: [] };
    updateState((current) => ({
      ...current,
      subjects: current.subjects.map((item) => item.id === subject.id ? { ...item, phases: [...item.phases, phase] } : item),
    }));
    setEditing({ subjectId: subject.id, phaseId: phase.id });
  }

  function exportSubjects() {
    downloadFile(JSON.stringify({ kind: "kaoyan-subject-progress", version: 1, subjects: state.subjects }, null, 2), "科目进度配置.json");
  }

  function importSubjects(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as { subjects?: Subject[] };
        if (!Array.isArray(parsed.subjects) || !parsed.subjects.every((subject) => subject.id && subject.name && Array.isArray(subject.phases))) throw new Error("invalid");
        if (!window.confirm("导入会替换当前全部科目、阶段和资料进度，时间记录仍会保留。是否继续？")) return;
        updateState((current) => ({
          ...current,
          subjects: parsed.subjects!.map((subject) => ({
            ...subject,
            phases: subject.phases.map((phase) => ({ ...phase, resources: Array.isArray(phase.resources) ? phase.resources : [] })),
          })),
        }));
      } catch {
        window.alert("无法导入：请选择由科目进度页面导出的 JSON 文件。");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="page-stack">
      <section className="progress-hero panel">
        <div>
          <p className="card-kicker">加权总进度 · 动态对比</p>
          <div className="project-comparison-values"><strong>{projectProgress(state.subjects)}%</strong><span>我的进度</span>{fastestProjectProgress !== null && <><strong className="fast-value">{fastestProjectProgress}%</strong><span>快线今日应达</span></>}</div>
          <p className="muted">基准：{fastestExperience?.title ?? "未选择"}；按 {today} 与考试年份动态换算。阶段日期若为推断值，可在经验贴页核对来源标记。</p>
        </div>
        <div className="progress-hero-actions"><div className="ring-comparison"><ProgressRing value={projectProgress(state.subjects)} /><span>我 / 快线 {fastestProjectProgress ?? "—"}%</span></div><div className="button-row"><button className="secondary-button" onClick={exportSubjects}><Download size={16} />导出科目 JSON</button><button className="secondary-button" onClick={() => importRef.current?.click()}><FileUp size={16} />导入科目 JSON</button></div><input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) importSubjects(file); event.target.value = ""; }} /></div>
      </section>
      <section className="subject-detail-grid">
        {state.subjects.map((subject) => {
          const subjectBenchmark = benchmarkSubjectProgress(fastestExperience, subject, today, state.profile.examDate);
          return (
          <article className="panel subject-detail" key={subject.id}>
            <div className="panel-heading"><div><p className="card-kicker">占总计划 {subject.weight}%</p><h2>{subject.name}</h2></div><div className="heading-actions"><div className="subject-comparison-badges"><span className="score-badge" style={{ color: subject.accent }}>我 {subjectProgress(subject)}%</span>{subjectBenchmark !== null && <span className="benchmark-badge">快线 {subjectBenchmark}%</span>}</div><button className="secondary-button" onClick={() => addPhase(subject)}><Plus size={15} />新增阶段</button></div></div>
            <p className="subject-note">{subject.note}</p>
            <div className="phase-list">
              {subject.phases.map((phase) => {
                const benchmark = benchmarkPhaseProgress(fastestExperience, subject.id, phase.id, today, state.profile.examDate);
                return (
                <div className="phase-row comparison-row" key={phase.id}>
                  <button className="phase-open" onClick={() => setEditing({ subjectId: subject.id, phaseId: phase.id })}><span>{phase.name}</span><small>阶段权重 {phase.weight}% · {phase.resources.length} 项资料</small></button>
                  <div className="comparison-slider">
                    <input aria-label={`${subject.name}${phase.name}我的进度`} type="range" min="0" max="100" value={phase.progress} onChange={(event) => {
                      const value = Number(event.target.value);
                      updateState((current) => ({ ...current, subjects: current.subjects.map((item) => item.id === subject.id ? { ...item, phases: item.phases.map((p) => p.id === phase.id ? { ...p, progress: value } : p) } : item) }));
                    }} style={{
                      "--range-color": subject.accent,
                      "--range-progress": `${Math.min(100, Math.max(0, phase.progress))}%`,
                    } as React.CSSProperties} />
                    {benchmark !== null && <span className="benchmark-marker" style={{ left: `${benchmark}%` }} title={`快线今日应达 ${benchmark}%`} />}
                    <div className="comparison-legend"><span style={{ color: subject.accent }}>我的 {phase.progress}%</span><span>快线 {benchmark ?? "—"}%</span></div>
                  </div>
                  <strong className={benchmark !== null && phase.progress < benchmark ? "behind" : "ahead"}>{benchmark === null ? "—" : `${phase.progress - benchmark >= 0 ? "+" : ""}${phase.progress - benchmark}`}</strong>
                </div>
              )})}
            </div>
          </article>
        )})}
      </section>
      {editing && <PhaseEditorDialog state={state} subjectId={editing.subjectId} phaseId={editing.phaseId} updateState={updateState} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PhaseEditorDialog({ state, subjectId, phaseId, updateState, onClose }: {
  state: StudyState;
  subjectId: string;
  phaseId: string;
  updateState: (updater: (current: StudyState) => StudyState) => void;
  onClose: () => void;
}) {
  const subject = state.subjects.find((item) => item.id === subjectId);
  const phase = subject?.phases.find((item) => item.id === phaseId);
  const [resourceForm, setResourceForm] = useState<{ type: StudyResource["type"]; name: string; detail: string }>({ type: "book", name: "", detail: "" });
  if (!subject || !phase) return null;
  const activeSubject = subject;
  const activePhase = phase;

  function updatePhase(changes: Partial<Subject["phases"][number]>) {
    updateState((current) => ({
      ...current,
      subjects: current.subjects.map((item) => item.id === subjectId
        ? { ...item, phases: item.phases.map((entry) => entry.id === phaseId ? { ...entry, ...changes } : entry) }
        : item),
    }));
  }

  function updateResources(updater: (resources: StudyResource[]) => StudyResource[], syncProgress = false) {
    const resources = updater(activePhase.resources);
    const progress = syncProgress && resources.length
      ? Math.round(resources.filter((resource) => resource.completed).length / resources.length * 100)
      : activePhase.progress;
    updatePhase({ resources, progress });
  }

  function addResource(event: React.FormEvent) {
    event.preventDefault();
    if (!resourceForm.name.trim()) return;
    updateResources((resources) => [...resources, { id: crypto.randomUUID(), ...resourceForm, name: resourceForm.name.trim(), detail: resourceForm.detail.trim(), completed: false }], true);
    setResourceForm({ ...resourceForm, name: "", detail: "" });
  }

  function deletePhase() {
    if (!window.confirm(`确定删除“${activeSubject.name} / ${activePhase.name}”及其中的 ${activePhase.resources.length} 项资料？此操作无法撤销。`)) return;
    updateState((current) => ({
      ...current,
      subjects: current.subjects.map((item) => item.id === subjectId ? { ...item, phases: item.phases.filter((entry) => entry.id !== phaseId) } : item),
    }));
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="phase-dialog" role="dialog" aria-modal="true" aria-label="编辑复习阶段">
        <div className="dialog-heading"><div><p className="card-kicker">{subject.name}</p><h2>{phase.name}</h2></div><button onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
        <div className="phase-editor-basics">
          <label><span>阶段名称</span><input value={phase.name} onChange={(event) => updatePhase({ name: event.target.value })} /></label>
          <label><span>阶段权重</span><input type="number" min="0" max="100" value={phase.weight} onChange={(event) => updatePhase({ weight: Math.max(0, Number(event.target.value)) })} /></label>
          <label><span>当前进度：{phase.progress}%</span><input type="range" min="0" max="100" value={phase.progress} onChange={(event) => updatePhase({ progress: Number(event.target.value) })} /></label>
        </div>
        <div className="resource-heading"><div><p className="card-kicker">完成清单</p><h3>书本、章节、试卷与习题集</h3></div><span className="muted">完成勾选会自动同步阶段进度</span></div>
        <form className="resource-add-form" onSubmit={addResource}>
          <select value={resourceForm.type} onChange={(event) => setResourceForm({ ...resourceForm, type: event.target.value as StudyResource["type"] })}>{RESOURCE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
          <input value={resourceForm.name} placeholder="名称，如《高等数学辅导讲义》" onChange={(event) => setResourceForm({ ...resourceForm, name: event.target.value })} />
          <input value={resourceForm.detail} placeholder="章节、题量或完成要求" onChange={(event) => setResourceForm({ ...resourceForm, detail: event.target.value })} />
          <button className="primary-button"><Plus size={16} />新增</button>
        </form>
        <div className="resource-list">
          {phase.resources.map((resource) => (
            <div className={`resource-row ${resource.completed ? "completed" : ""}`} key={resource.id}>
              <input type="checkbox" checked={resource.completed} onChange={() => updateResources((resources) => resources.map((item) => item.id === resource.id ? { ...item, completed: !item.completed } : item), true)} />
              <span className="resource-type">{RESOURCE_TYPES.find((type) => type.value === resource.type)?.label}</span>
              <input value={resource.name} aria-label="资料名称" onChange={(event) => updateResources((resources) => resources.map((item) => item.id === resource.id ? { ...item, name: event.target.value } : item))} />
              <input value={resource.detail} aria-label="资料要求" placeholder="完成要求" onChange={(event) => updateResources((resources) => resources.map((item) => item.id === resource.id ? { ...item, detail: event.target.value } : item))} />
              <button onClick={() => updateResources((resources) => resources.filter((item) => item.id !== resource.id), true)} aria-label="删除资料"><Trash2 size={16} /></button>
            </div>
          ))}
          {!phase.resources.length && <div className="schedule-empty">暂无资料，使用上方表单加入书本、章节、试卷或习题集。</div>}
        </div>
        <div className="dialog-footer"><button className="danger-button" onClick={deletePhase}><Trash2 size={16} />删除整个阶段</button><div><button className="primary-button" onClick={onClose}><Check size={16} />完成编辑</button></div></div>
      </section>
    </div>
  );
}

function WeeklyView({ state, metrics, average, summary }: { state: StudyState; metrics: (ReturnType<typeof dailyMetrics> & { date: string })[]; average: number; summary: ReturnType<typeof periodSummary> }) {
  const maxMinutes = Math.max(...metrics.map((item) => item.actualMinutes), state.profile.dailyTargetHours * 60);
  const total = metrics.reduce((sum, item) => sum + item.actualMinutes, 0);
  function exportMarkdown() {
    const from = metrics[0]?.date ?? localDate();
    const to = metrics.at(-1)?.date ?? localDate();
    const dailyRows = metrics.map((item) => `| ${item.date} | ${(item.actualMinutes / 60).toFixed(1)}h | ${item.score} | ${formatMinutes(item.sleepMinutes)} | ${formatMinutes(item.exerciseMinutes)} |`).join("\n");
    const ruleRows = summary.ruleResults.map((rule) => `| ${rule.name} | ${rule.weight} | ${Math.round(rule.ratio * 100)}% | ${(rule.points).toFixed(1)} |`).join("\n");
    const subjectRows = state.subjects.map((subject) => `| ${subject.name} | ${subject.weight}% | ${subjectProgress(subject)}% |`).join("\n");
    const markdown = `# ${state.profile.targetSchool}考研学习周报\n\n` +
      `**周期：** ${from} 至 ${to}  \n**目标：** ${state.profile.targetDescription}  \n**周报得分：** ${summary.periodScore} / 100\n\n` +
      `## 核心摘要\n\n- 有效学习：${formatMinutes(total)}\n- 活跃天数：${metrics.filter((item) => item.hasRecords).length} / 7\n- 日均得分：${average}\n- 平均睡眠：${formatMinutes(summary.averageSleepMinutes)}\n- 运动累计：${formatMinutes(summary.exerciseMinutes)}\n\n` +
      `## 每日数据\n\n| 日期 | 有效学习 | 日得分 | 睡眠 | 运动 |\n|---|---:|---:|---:|---:|\n${dailyRows}\n\n` +
      `## 自定义评分规则\n\n| 规则 | 权重 | 达成率 | 加权分 |\n|---|---:|---:|---:|\n${ruleRows || "| 暂无启用规则 | 0 | 0% | 0 |"}\n\n` +
      `## 科目进度\n\n| 科目 | 总权重 | 当前进度 |\n|---|---:|---:|\n${subjectRows}\n\n---\n由考研项目管理台生成。\n`;
    downloadFile(markdown, `考研周报-${from}-${to}.md`, "text/markdown;charset=utf-8");
  }
  return (
    <div className="page-stack narrow-page">
      <div className="page-actions"><p className="muted">周报按当前启用的自定义规则实时计算。</p><button className="primary-button" onClick={exportMarkdown}><Download size={17} />导出 Markdown 周报</button></div>
      <section className="summary-strip weekly-summary">
        <div><span>近7日有效学习</span><strong>{formatMinutes(total)}</strong></div>
        <div><span>活跃天数</span><strong>{metrics.filter((item) => item.actualMinutes > 0).length} / 7</strong></div>
        <div><span>平均日得分</span><strong>{average}</strong></div>
        <div><span>周报得分</span><strong>{summary.periodScore}</strong></div>
      </section>
      <section className="panel chart-panel">
        <div className="panel-heading"><div><p className="card-kicker">近 7 天</p><h2>有效学习时长</h2></div><span className="muted">目标线：{state.profile.dailyTargetHours}h</span></div>
        <div className="bar-chart">
          {metrics.map((item) => (
            <div className="bar-column" key={item.date}>
              <div className="bar-value">{item.actualMinutes ? (item.actualMinutes / 60).toFixed(1) : "0"}h</div>
              <div className="bar-track"><i style={{ height: `${Math.max(2, (item.actualMinutes / maxMinutes) * 100)}%` }} /></div>
              <span>{new Date(`${item.date}T00:00:00`).toLocaleDateString("zh-CN", { weekday: "short" })}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel scoring-guide">
        <div className="panel-heading"><div><p className="card-kicker">实时计算</p><h2>本周规则计分</h2></div><span className="score-badge">{summary.periodScore}</span></div>
        <div className="guide-grid">{summary.ruleResults.map((rule) => <ScoreGuide key={rule.id} number={String(Math.round(rule.points))} title={`${rule.name} · 权重 ${rule.weight}`} detail={`${rule.description}；本周达成 ${Math.round(rule.ratio * 100)}%`} />)}</div>
        {!summary.ruleResults.length && <div className="schedule-empty">尚未启用周报规则，请前往“评分标准”新增或启用规则。</div>}
      </section>
    </div>
  );
}

function RoutinePeriodCard({ title, subtitle, summary }: {
  title: string;
  subtitle: string;
  summary: ReturnType<typeof periodSummary>;
}) {
  return (
    <article className="panel routine-period-card">
      <div className="panel-heading">
        <div><p className="card-kicker">{subtitle}</p><h2>{title}</h2></div>
        <ProgressRing value={summary.periodScore} compact />
      </div>
      <div className="routine-metric-grid">
        <div><span>记录覆盖</span><strong>{Math.round(summary.recordRate * 100)}%</strong></div>
        <div><span>平均日得分</span><strong>{summary.averageDailyScore}</strong></div>
        <div><span>平均睡眠</span><strong>{formatMinutes(summary.averageSleepMinutes)}</strong></div>
        <div><span>达标睡眠</span><strong>{Math.round(summary.healthySleepRate * 100)}%</strong></div>
        <div><span>运动累计</span><strong>{formatMinutes(summary.exerciseMinutes)}</strong></div>
        <div><span>日均娱乐</span><strong>{formatMinutes(summary.averageEntertainmentMinutes)}</strong></div>
        <div><span>深夜学习</span><strong>{formatMinutes(summary.lateStudyMinutes)}</strong></div>
        <div><span>作息平衡</span><strong>{Math.round(summary.routineBalance * 100)}%</strong></div>
      </div>
    </article>
  );
}

function ScoringView({ state, week, month, updateState }: {
  state: StudyState;
  week: ReturnType<typeof periodSummary>;
  month: ReturnType<typeof periodSummary>;
  updateState: (updater: (current: StudyState) => StudyState) => void;
}) {
  const totalWeight = Object.values(state.scoring.weights).reduce((sum, value) => sum + value, 0);
  const totalWeeklyWeight = state.scoring.weeklyRules.filter((rule) => rule.enabled).reduce((sum, rule) => sum + rule.weight, 0);

  function updateWeight(key: keyof ScoreWeights, value: number) {
    updateState((current) => ({
      ...current,
      scoring: {
        ...current.scoring,
        weights: { ...current.scoring.weights, [key]: Math.max(0, value) },
      },
    }));
  }

  function updateWeeklyRule(id: string, changes: Partial<StudyState["scoring"]["weeklyRules"][number]>) {
    updateState((current) => ({
      ...current,
      scoring: { ...current.scoring, weeklyRules: current.scoring.weeklyRules.map((rule) => rule.id === id ? { ...rule, ...changes } : rule) },
    }));
  }

  function addWeeklyRule() {
    updateState((current) => ({
      ...current,
      scoring: {
        ...current.scoring,
        weeklyRules: [...current.scoring.weeklyRules, { id: crypto.randomUUID(), name: "新评分规则", description: "自定义周报评价维度", metric: "studyTarget", weight: 10, enabled: true }],
      },
    }));
  }

  return (
    <div className="page-stack scoring-page">
      <section className="period-score-grid">
        <RoutinePeriodCard title="近 7 天" subtitle="短期执行与恢复" summary={week} />
        <RoutinePeriodCard title="近 30 天" subtitle="长期稳定性" summary={month} />
      </section>

      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">周报模型</p><h2>自定义评分规则</h2></div><div className="heading-actions"><span className="muted">启用权重合计 {totalWeeklyWeight}</span><button className="primary-button" onClick={addWeeklyRule}><Plus size={16} />新增规则</button></div></div>
        <p className="settings-copy">选择数据指标、设置名称与权重。系统会按所有启用规则的权重自动归一化为 100 分，新增规则会立即影响近 7 天和近 30 天得分。</p>
        <div className="weekly-rule-list">
          {state.scoring.weeklyRules.map((rule) => (
            <article className={`weekly-rule-card ${rule.enabled ? "" : "disabled"}`} key={rule.id}>
              <label className="rule-enabled"><input type="checkbox" checked={rule.enabled} onChange={(event) => updateWeeklyRule(rule.id, { enabled: event.target.checked })} /><span>启用</span></label>
              <label><span>规则名称</span><input value={rule.name} onChange={(event) => updateWeeklyRule(rule.id, { name: event.target.value })} /></label>
              <label><span>数据指标</span><select value={rule.metric} onChange={(event) => updateWeeklyRule(rule.id, { metric: event.target.value as WeeklyRuleMetric })}>{WEEKLY_METRICS.map((metric) => <option key={metric.value} value={metric.value}>{metric.label}</option>)}</select></label>
              <label><span>权重</span><input type="number" min="0" max="100" value={rule.weight} onChange={(event) => updateWeeklyRule(rule.id, { weight: Math.max(0, Number(event.target.value)) })} /></label>
              <label className="rule-description"><span>说明</span><input value={rule.description} onChange={(event) => updateWeeklyRule(rule.id, { description: event.target.value })} /></label>
              <button className="rule-delete" onClick={() => window.confirm(`确定删除评分规则“${rule.name}”？`) && updateState((current) => ({ ...current, scoring: { ...current.scoring, weeklyRules: current.scoring.weeklyRules.filter((item) => item.id !== rule.id) } }))} aria-label="删除规则"><Trash2 size={16} /></button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel standards-panel">
        <div className="panel-heading"><div><p className="card-kicker">身心健康基线</p><h2>评判标准</h2></div><span className="score-badge">透明可调整</span></div>
        <div className="standards-grid">
          <article className="standard-card">
            <span>01</span><div><strong>睡眠：每日 7–9 小时</strong><p>7–9 小时获得完整睡眠分；5–7 小时和 9–11 小时线性递减，超出范围为 0。近 7/30 天同时统计达标比例。</p><a href="https://www.cdc.gov/sleep/data-research/facts-stats/adults-sleep-facts-and-stats.html" target="_blank" rel="noreferrer">CDC 成人睡眠依据</a></div>
          </article>
          <article className="standard-card">
            <span>02</span><div><strong>运动：每周至少 150 分钟</strong><p>单日 30–90 分钟较优；06:00–09:00 或 16:00–20:30 时段加权最高。近 30 天目标按每周 150 分钟等比例换算为约 {month.exerciseTarget} 分钟。</p><a href="https://www.who.int/news-room/fact-sheets/detail/physical-activity" target="_blank" rel="noreferrer">WHO 身体活动依据</a></div>
          </article>
          <article className="standard-card">
            <span>03</span><div><strong>娱乐：日均不高于 2 小时</strong><p>这是本仪表盘的复习期平衡标准，并非医学阈值。0–120 分钟不扣周期平衡分，超过 120 分钟逐步降分，达到 240 分钟时该项为 0。</p></div>
          </article>
          <article className="standard-card">
            <span>04</span><div><strong>学习：23:30 后降权</strong><p>08:00–12:00、14:00–18:00权重最高；正常晚间保持高权重；22:30 后逐步降低，23:30–05:30显著降权并计入深夜学习。</p></div>
          </article>
        </div>
        <p className="standards-note">当前周期得分由上方启用的自定义周报规则计算；作息平衡指标综合睡眠达标、运动总量、娱乐时长与深夜学习占比。</p>
      </section>

      <section className="panel settings-card">
        <div className="panel-heading">
          <div><p className="card-kicker">个性化模型</p><h2>核心权重</h2></div>
          <span className="muted">当前合计 {totalWeight}</span>
        </div>
        <p className="settings-copy">权重无需强制合计 100，系统会按当前总和自动归一化。调高某一项，会提高它在每日 100 分中的相对影响。</p>
        <div className="score-weight-grid">
          {SCORE_WEIGHT_FIELDS.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <small>{field.detail}</small>
              <div><input type="number" min="0" max="100" value={state.scoring.weights[field.key]} onChange={(event) => updateWeight(field.key, Number(event.target.value))} /><em>权重</em></div>
            </label>
          ))}
        </div>
        <div className="button-row"><button type="button" className="secondary-button" onClick={() => updateState((current) => ({ ...current, scoring: defaultStudyState.scoring }))}><RotateCcw size={17} />恢复推荐权重</button></div>
      </section>
    </div>
  );
}

function SettingsView({
  state,
  accounts,
  activeAccountId,
  updateState,
  onSwitchAccount,
  onAddAccount,
  onRenameAccount,
  onDeleteAccount,
  onExport,
  onImport,
  onReset,
}: {
  state: StudyState;
  accounts: DashboardAccount[];
  activeAccountId: string;
  updateState: (updater: (current: StudyState) => StudyState) => void;
  onSwitchAccount: (accountId: string) => void;
  onAddAccount: (name: string) => boolean;
  onRenameAccount: (accountId: string, name: string) => boolean;
  onDeleteAccount: (accountId: string) => void;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
}) {
  const [customMode, setCustomMode] = useState<"light" | "dark">("light");
  const [newAccountName, setNewAccountName] = useState("");
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  useEffect(() => {
    setAccountNames(Object.fromEntries(accounts.map((account) => [account.id, account.name])));
  }, [accounts]);
  function addNewAccount(event: React.FormEvent) {
    event.preventDefault();
    if (onAddAccount(newAccountName)) setNewAccountName("");
  }
  function commitAccountName(account: DashboardAccount) {
    const draft = accountNames[account.id] ?? account.name;
    if (!onRenameAccount(account.id, draft)) {
      setAccountNames((current) => ({ ...current, [account.id]: account.name }));
    }
  }
  function updateProfile(key: keyof StudyState["profile"], value: string | number) {
    updateState((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  }
  function updateSubject(id: string, changes: Partial<Subject>) {
    updateState((current) => ({ ...current, subjects: current.subjects.map((subject) => subject.id === id ? { ...subject, ...changes } : subject) }));
  }
  function updateLifeActivity(id: string, changes: Partial<LifeActivity>) {
    updateState((current) => ({
      ...current,
      lifeActivities: current.lifeActivities.map((activity) => activity.id === id ? { ...activity, ...changes } : activity),
    }));
  }
  function addSubject() {
    const subject: Subject = { id: crypto.randomUUID(), name: "新考试科目", shortName: "新科目", weight: 0, accent: "#4f7ea8", note: "点击科目进度新增复习阶段", phases: [] };
    updateState((current) => ({ ...current, subjects: [...current.subjects, subject] }));
  }
  function addLifeActivity() {
    const activity: LifeActivity = { id: `life-${crypto.randomUUID()}`, name: "新生活活动", accent: "#6287a8" };
    updateState((current) => ({ ...current, lifeActivities: [...current.lifeActivities, activity] }));
  }
  function deleteLifeActivity(activity: LifeActivity) {
    const referenced = state.sessions.some((session) => session.subjectId === activity.id)
      || state.plans.some((plan) => plan.items.some((item) => item.subjectId === activity.id))
      || state.planTemplates.some((template) => template.items.some((item) => item.subjectId === activity.id));
    if (!window.confirm(referenced
      ? `“${activity.name}”已有记录或计划，删除后会从新增下拉框隐藏，历史数据仍会保留。确定继续吗？`
      : `确定删除生活活动“${activity.name}”？`)) return;
    updateState((current) => ({
      ...current,
      lifeActivities: referenced
        ? current.lifeActivities.map((item) => item.id === activity.id ? { ...item, active: false } : item)
        : current.lifeActivities.filter((item) => item.id !== activity.id),
    }));
  }
  function updateCustomColor(key: keyof ThemeColors, value: string) {
    updateState((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        paletteId: "custom",
        [customMode === "light" ? "customLight" : "customDark"]: {
          ...(customMode === "light" ? current.appearance.customLight : current.appearance.customDark),
          [key]: value,
        },
      },
    }));
  }
  function uploadSidebarIcon(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("请选择 PNG、JPG、WEBP 或 SVG 图片。");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      window.alert("图标图片不能超过 2 MB。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateProfile("sidebarIcon", String(reader.result));
    reader.readAsDataURL(file);
  }
  return (
    <div className="page-stack settings-page">
      <section className="panel settings-card account-settings-card">
        <div className="panel-heading">
          <div><p className="card-kicker">研友空间</p><h2>账号管理</h2></div>
          <div className="account-count"><Users size={18} /><span>{accounts.length} 个账号</span></div>
        </div>
        <p className="settings-copy">每个账号拥有完全独立的目标、科目、计划和时间记录。顶部可随时快速切换，页面只会显示当前账号的数据，适合在同一台设备上轮流记录和监督进度。</p>
        <form className="account-add-form" onSubmit={addNewAccount}>
          <label>
            <span>新增研友账号</span>
            <input
              value={newAccountName}
              maxLength={30}
              placeholder="输入姓名或昵称"
              onChange={(event) => setNewAccountName(event.target.value)}
            />
          </label>
          <button className="primary-button" type="submit"><UserPlus size={17} />新增并切换</button>
        </form>
        <div className="account-list">
          {accounts.map((account) => {
            const active = account.id === activeAccountId;
            return (
              <article className={active ? "active" : ""} key={account.id}>
                <div className="account-avatar" aria-hidden="true">
                  {(accountNames[account.id] ?? account.name).trim().slice(0, 1).toLocaleUpperCase() || "研"}
                </div>
                <label>
                  <span>账号名称</span>
                  <input
                    value={accountNames[account.id] ?? account.name}
                    maxLength={30}
                    onChange={(event) => setAccountNames((current) => ({
                      ...current,
                      [account.id]: event.target.value,
                    }))}
                    onBlur={() => commitAccountName(account)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                </label>
                <div className="account-meta">
                  {active
                    ? <strong>当前账号</strong>
                    : <span>上次切换 {new Date(account.lastActiveAt).toLocaleDateString("zh-CN")}</span>}
                </div>
                <div className="account-actions">
                  {!active && <button type="button" className="secondary-button" onClick={() => onSwitchAccount(account.id)}>切换</button>}
                  {!active && <button type="button" className="danger-button" onClick={() => onDeleteAccount(account.id)}><Trash2 size={15} />删除</button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">项目基线</p><h2>考研目标</h2></div><Save size={19} /></div>
        <div className="form-grid">
          <label><span>称呼</span><input value={state.profile.name} onChange={(e) => updateProfile("name", e.target.value)} /></label>
          <label className="wide"><span>目标项目</span><input value={state.profile.target} onChange={(e) => updateProfile("target", e.target.value)} /></label>
          <label><span>侧栏主标题</span><input value={state.profile.sidebarTitle} onChange={(e) => updateProfile("sidebarTitle", e.target.value)} /></label>
          <label className="wide"><span>侧栏副标题</span><input value={state.profile.sidebarSubtitle} onChange={(e) => updateProfile("sidebarSubtitle", e.target.value)} /></label>
          <div className="wide sidebar-icon-setting">
            <div><span className="field-label">侧栏图标</span><p className="settings-copy">上传后会保存在本机浏览器，并替换左侧标题旁的 Z 图标。</p></div>
            <div className="sidebar-icon-actions">
              <div className="sidebar-icon-preview">{state.profile.sidebarIcon ? <img src={state.profile.sidebarIcon} alt="当前侧栏图标" /> : "Z"}</div>
              <label className="secondary-button file-button"><FileUp size={16} />上传图标<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={uploadSidebarIcon} /></label>
              {state.profile.sidebarIcon && <button type="button" className="danger-button" onClick={() => updateProfile("sidebarIcon", "")}>恢复 Z</button>}
            </div>
          </div>
          <label><span>目标院校</span><input value={state.profile.targetSchool} onChange={(e) => updateProfile("targetSchool", e.target.value)} /></label>
          <label className="wide"><span>目标说明</span><input value={state.profile.targetDescription} onChange={(e) => updateProfile("targetDescription", e.target.value)} /></label>
          <label><span>暂定初试日期</span><input type="date" value={state.profile.examDate} onChange={(e) => updateProfile("examDate", e.target.value)} /></label>
          <label><span>每日目标小时</span><input type="number" min="1" max="16" step="0.5" value={state.profile.dailyTargetHours} onChange={(e) => updateProfile("dailyTargetHours", Number(e.target.value))} /></label>
          <label><span>目标起床</span><input type="time" value={state.profile.wakeTime} onChange={(e) => updateProfile("wakeTime", e.target.value)} /></label>
          <label><span>目标睡觉</span><input type="time" value={state.profile.sleepTime} onChange={(e) => updateProfile("sleepTime", e.target.value)} /></label>
        </div>
      </section>
      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">考试配置</p><h2>考试科目与总进度权重</h2></div><div className="heading-actions"><span className="muted">合计 {state.subjects.reduce((sum, subject) => sum + subject.weight, 0)}%</span><button className="primary-button" onClick={addSubject}><Plus size={16} />新增科目</button></div></div>
        <div className="subject-settings-list">{state.subjects.map((subject) => <article key={subject.id}>
          <label><span>科目名称</span><input value={subject.name} onChange={(event) => updateSubject(subject.id, { name: event.target.value })} /></label>
          <label><span>简称</span><input value={subject.shortName} onChange={(event) => updateSubject(subject.id, { shortName: event.target.value })} /></label>
          <label><span>权重</span><input type="number" min="0" max="100" value={subject.weight} onChange={(event) => updateSubject(subject.id, { weight: Math.max(0, Number(event.target.value)) })} /></label>
          <label><span>科目颜色</span><input type="color" value={subject.accent} onChange={(event) => updateSubject(subject.id, { accent: event.target.value })} /></label>
          <label className="subject-note-field"><span>科目说明</span><input value={subject.note} onChange={(event) => updateSubject(subject.id, { note: event.target.value })} /></label>
          <button onClick={() => window.confirm(`确定删除考试科目“${subject.name}”？对应阶段会一起删除，已有时间记录不会自动删除。`) && updateState((current) => ({ ...current, subjects: current.subjects.filter((item) => item.id !== subject.id) }))} aria-label="删除科目"><Trash2 size={16} /></button>
        </article>)}</div>
      </section>
      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">生活安排</p><h2>生活活动管理</h2></div><div className="heading-actions"><span className="muted">{state.lifeActivities.filter((activity) => activity.active !== false).length} 个活动</span><button className="primary-button" type="button" onClick={addLifeActivity}><Plus size={16} />新增活动</button></div></div>
        <p className="settings-copy">生活活动会出现在计划和时间记录的“科目 / 活动”下拉框中，不会计入有效学习时长。删除已有数据使用过的活动时，历史记录会保留但该活动会从新增列表隐藏。</p>
        <div className="life-activity-settings-list">
          {state.lifeActivities.filter((activity) => activity.active !== false).map((activity) => <article key={activity.id}>
            <span className="activity-color-dot" style={{ background: activity.accent }} />
            <label><span>活动名称</span><input value={activity.name} onChange={(event) => updateLifeActivity(activity.id, { name: event.target.value })} /></label>
            <label><span>活动颜色</span><input type="color" value={activity.accent} onChange={(event) => updateLifeActivity(activity.id, { accent: event.target.value })} /></label>
            <button type="button" className="rule-delete" onClick={() => deleteLifeActivity(activity)} aria-label={`删除生活活动${activity.name}`}><Trash2 size={16} /></button>
          </article>)}
          {!state.lifeActivities.some((activity) => activity.active !== false) && <div className="schedule-empty">还没有生活活动，点击“新增活动”开始配置。</div>}
        </div>
      </section>
      <section className="panel settings-card appearance-settings">
        <div className="panel-heading"><div><p className="card-kicker">视觉外观</p><h2>页面配色方案</h2></div><Palette size={20} /></div>
        <p className="settings-copy">六套方案均分别设计了亮色与暗色版本，侧栏的模式开关会自动使用对应配色。也可以进入自定义调色盘逐项调整。</p>
        <div className="palette-grid">
          {THEME_PALETTES.map((palette) => <button className={state.appearance.paletteId === palette.id ? "active" : ""} key={palette.id} onClick={() => updateState((current) => ({ ...current, appearance: { ...current.appearance, paletteId: palette.id } }))}><span className="palette-swatches"><i style={{ background: palette.light.primary }} /><i style={{ background: palette.light.accent }} /><i style={{ background: palette.dark.bg }} /><i style={{ background: palette.dark.accent }} /></span><strong>{palette.name}</strong><small>{palette.description}</small></button>)}
          <button className={state.appearance.paletteId === "custom" ? "active custom" : "custom"} onClick={() => updateState((current) => ({ ...current, appearance: { ...current.appearance, paletteId: "custom" } }))}><span className="palette-swatches custom-wheel"><Palette size={22} /></span><strong>自定义调色盘</strong><small>独立调节亮色与暗色的全部关键颜色</small></button>
        </div>
        {state.appearance.paletteId === "custom" && <div className="custom-palette-editor">
          <div className="mode-tabs"><button className={customMode === "light" ? "active" : ""} onClick={() => setCustomMode("light")}><Sun size={15} />亮色配色</button><button className={customMode === "dark" ? "active" : ""} onClick={() => setCustomMode("dark")}><Moon size={15} />暗色配色</button></div>
          <div className="color-picker-grid">{COLOR_FIELDS.map((field) => { const colors = customMode === "light" ? state.appearance.customLight : state.appearance.customDark; return <label key={field.key}><span>{field.label}</span><div><input type="color" value={colors[field.key]} onChange={(event) => updateCustomColor(field.key, event.target.value)} /><code>{colors[field.key]}</code></div></label>; })}</div>
          <div className="button-row"><button className="secondary-button" onClick={() => updateState((current) => ({ ...current, appearance: { ...defaultStudyState.appearance, paletteId: "custom" } }))}><RotateCcw size={16} />重置自定义配色</button></div>
        </div>}
      </section>
      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">数据管理</p><h2>本机存储与备份</h2></div><HardDrive size={19} /></div>
        <p className="settings-copy">学习记录只保存在当前浏览器，不会上传到服务器。更换设备、浏览器或清除网站数据前，请先导出 JSON；建议每周备份一次。</p>
        <div className="button-row"><button className="secondary-button" onClick={onExport}><Download size={17} />导出 JSON</button><button className="secondary-button" onClick={onImport}><FileUp size={17} />导入备份</button><button className="danger-button" onClick={onReset}><RotateCcw size={17} />恢复初始数据</button></div>
      </section>
    </div>
  );
}

function BackupDialog({ mode, sessions, plans, onClose, onConfirm }: {
  mode: BackupMode;
  sessions: StudySession[];
  plans: DailyPlan[];
  onClose: () => void;
  onConfirm: (range: DateRange) => void;
}) {
  const dates = [...sessions.map((item) => item.date), ...plans.map((item) => item.date)].sort();
  const firstDate = dates[0] ?? localDate();
  const lastDate = dates.at(-1) ?? localDate();
  const [anchor, setAnchor] = useState(lastDate);
  const [range, setRange] = useState<DateRange>(() =>
    mode === "import" ? { from: firstDate, to: lastDate } : presetRange("week", lastDate),
  );
  const sessionCount = sessions.filter((item) => isInRange(item.date, range)).length;
  const planCount = plans
    .filter((item) => isInRange(item.date, range))
    .reduce((sum, item) => sum + item.items.length, 0);
  const invalid = !range.from || !range.to || range.from > range.to;

  function applyPreset(preset: "day" | "week" | "month") {
    setRange(presetRange(preset, anchor));
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="backup-dialog" role="dialog" aria-modal="true" aria-label={mode === "export" ? "导出数据" : "导入数据"}>
        <div className="dialog-heading">
          <div><p className="card-kicker">按日期管理备份</p><h2>{mode === "export" ? "选择导出范围" : "选择导入范围"}</h2></div>
          <button type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </div>
        <div className="backup-content">
          <label className="anchor-field"><span>定位日期</span><input type="date" value={anchor} onChange={(event) => setAnchor(event.target.value)} /></label>
          <div className="range-presets" aria-label="快捷日期范围">
            <button type="button" onClick={() => applyPreset("day")}>一天</button>
            <button type="button" onClick={() => applyPreset("week")}>一星期</button>
            <button type="button" onClick={() => applyPreset("month")}>一个月</button>
            {mode === "import" && <button type="button" onClick={() => setRange({ from: firstDate, to: lastDate })}>文件全部</button>}
          </div>
          <div className="date-range-fields">
            <label><span>开始日期</span><input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /></label>
            <span>至</span>
            <label><span>结束日期</span><input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /></label>
          </div>
          <div className="range-summary">
            <CalendarDays size={19} />
            <div><strong>{invalid ? "日期范围无效" : `${range.from} 至 ${range.to}`}</strong><span>范围内共有 {sessionCount} 条时间记录和 {planCount} 个计划时段，最小选择精度为一天。</span></div>
          </div>
          {mode === "import" && (
            <div className="conflict-policy">
              <strong>导入冲突规则</strong>
              <p>时间记录和今日计划都会按日期、起止时间及任务名称查重；不同任务的时段重叠时，导入项按原时长顺延到当天最早空闲时段，并写入调整备注，不覆盖已有数据。</p>
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <span>{mode === "export" ? "一个 JSON 文件包含项目设置、科目进度、所选日期的计划与时间记录。" : "合并所选日期的计划与时间记录，不改动项目设置和科目进度。"}</span>
          <div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="button" className="primary-button" disabled={invalid} onClick={() => onConfirm(range)}>{mode === "export" ? <Download size={17} /> : <FileUp size={17} />}{mode === "export" ? "导出 JSON" : "合并导入"}</button></div>
        </div>
      </section>
    </div>
  );
}

function RecordDialog({ state, initial, onClose, onSave }: { state: StudyState; initial: StudySession | null; onClose: () => void; onSave: (session: StudySession) => void }) {
  const now = new Date();
  const end = `${String(now.getHours()).padStart(2, "0")}:${String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, "0")}`;
  const startDate = new Date(now.getTime() - 90 * 60_000);
  const start = `${String(startDate.getHours()).padStart(2, "0")}:${String(Math.floor(startDate.getMinutes() / 5) * 5).padStart(2, "0")}`;
  const [form, setForm] = useState(() => initial ? {
    date: initial.date,
    start: initial.start,
    end: initial.end,
    subjectId: initial.subjectId,
    task: initial.task,
    completion: initial.completion,
    focus: initial.focus,
    note: initial.note,
  } : { date: localDate(), start, end, subjectId: "math", task: "", completion: 100, focus: 4, note: "" });
  const selectedActivity = lifeActivity(form.subjectId, state.lifeActivities);
  const isLifeActivity = Boolean(selectedActivity);
  const plannedMinutes = minutesBetween(form.start, form.end, form.subjectId === "sleep");
  const rangeStart = new Date(`${form.date}T${form.start}:00`).getTime();
  const hasValidRange = Boolean(form.date && form.start && form.end) && Number.isFinite(rangeStart) && plannedMinutes > 0;
  const conflicts = hasValidRange
    ? findOverlappingSessions(
      { start: rangeStart, end: rangeStart + plannedMinutes * 60_000 },
      state.sessions,
      initial ? new Set([initial.id]) : new Set(),
    )
    : [];
  function changeCategory(subjectId: string) {
    const previousActivity = lifeActivity(form.subjectId, state.lifeActivities);
    const nextActivity = lifeActivity(subjectId, state.lifeActivities);
    const canAutofill = !form.task.trim() || form.task === previousActivity?.name;
    setForm({ ...form, subjectId, task: nextActivity && canAutofill ? nextActivity.name : form.task });
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.task.trim() || !hasValidRange || conflicts.length) return;
    onSave({ id: initial?.id ?? crypto.randomUUID(), ...form, task: form.task.trim(), plannedMinutes, actualMinutes: plannedMinutes });
  }
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="record-dialog" onSubmit={submit}>
        <div className="dialog-heading"><div><p className="card-kicker">分时记录</p><h2>{initial ? "编辑时间记录" : "记录一个时段"}</h2></div><button type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
        <div className="dialog-grid">
          <label><span>日期</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label><span>科目 / 活动</span><select value={form.subjectId} onChange={(e) => changeCategory(e.target.value)}><optgroup label="学习科目">{state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</optgroup><optgroup label="生活活动">{state.lifeActivities.filter((activity) => activity.active !== false).map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</optgroup></select></label>
          <label><span>开始时间</span><input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
          <label><span>结束时间</span><input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
          <label className="wide"><span>{isLifeActivity ? "活动内容" : "本时段任务"}</span><input autoFocus placeholder={isLifeActivity ? `例如：${selectedActivity?.name}` : "例如：1000题概率统计第1章"} value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} /></label>
          {!isLifeActivity && <label><span>完成度：{form.completion}%</span><input type="range" min="0" max="100" step="5" value={form.completion} onChange={(e) => setForm({ ...form, completion: Number(e.target.value) })} /></label>}
          {!isLifeActivity && <label><span>专注度：{form.focus} / 5</span><input type="range" min="1" max="5" value={form.focus} onChange={(e) => setForm({ ...form, focus: Number(e.target.value) })} /></label>}
          <label className="wide"><span>{isLifeActivity ? "备注（可选）" : "复盘（可选）"}</span><textarea placeholder={isLifeActivity ? "例如：睡眠质量、运动内容或娱乐方式" : "卡在哪里？下一次从哪里继续？"} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </div>
        {conflicts.length > 0 && <div className="record-conflict-warning" role="alert"><AlertTriangle size={18} /><div><strong>与已有时间记录重叠</strong>{conflicts.map((session) => <span key={session.id}>{session.date} {session.start}–{session.end} · {session.task}</span>)}<small>请调整本条记录的日期或起止时间；已有记录不会被覆盖。</small></div></div>}
        <div className="dialog-footer"><span>{isLifeActivity ? "计入全天记录" : "计入有效学习"}：<strong>{formatMinutes(plannedMinutes)}</strong></span><div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={!form.task.trim() || !hasValidRange || conflicts.length > 0}><Check size={17} />{initial ? "保存修改" : "保存记录"}</button></div></div>
      </form>
    </div>
  );
}

function PlanItemDialog({ state, initial, onClose, onSave }: { state: StudyState; initial: PlanItem | null; onClose: () => void; onSave: (item: PlanItem) => void }) {
  const [form, setForm] = useState(() => initial ? {
    start: initial.start,
    end: initial.end,
    subjectId: initial.subjectId,
    task: initial.task,
    note: initial.note,
  } : { start: "08:00", end: "10:00", subjectId: state.subjects[0]?.id ?? "math", task: "", note: "" });
  const duration = minutesBetween(form.start, form.end, form.subjectId === "sleep");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.task.trim() || duration <= 0) return;
    onSave({ id: initial?.id ?? crypto.randomUUID(), ...form, task: form.task.trim() });
  }
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="record-dialog" onSubmit={submit}>
        <div className="dialog-heading"><div><p className="card-kicker">今日计划</p><h2>{initial ? "编辑计划时段" : "安排一个计划时段"}</h2></div><button type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
        <div className="dialog-grid">
          <label><span>科目 / 活动</span><select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}><optgroup label="考试科目">{state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</optgroup><optgroup label="生活活动">{state.lifeActivities.filter((activity) => activity.active !== false).map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</optgroup></select></label>
          <label><span>计划任务</span><input autoFocus value={form.task} placeholder="例如：高数基础讲义第 3 章" onChange={(event) => setForm({ ...form, task: event.target.value })} /></label>
          <label><span>开始时间</span><input type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label>
          <label><span>结束时间</span><input type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></label>
          <label className="wide"><span>计划备注（可选）</span><textarea value={form.note} placeholder="目标章节、题量或完成标准" onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
        </div>
        <div className="dialog-footer"><span>计划时长：<strong>{formatMinutes(duration)}</strong></span><div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={!form.task.trim() || duration <= 0}><Save size={16} />{initial ? "保存修改" : "保存计划"}</button></div></div>
      </form>
    </div>
  );
}

function SessionTable({ sessions, state, onEdit, onDelete }: { sessions: StudySession[]; state: StudyState; onEdit: (session: StudySession) => void; onDelete: (id: string) => void }) {
  return <div className="session-table">{sessions.map((session) => { const subject = state.subjects.find((item) => item.id === session.subjectId); const activity = lifeActivity(session.subjectId, state.lifeActivities); return <div className="session-row" key={session.id}><span className="subject-indicator" style={{ background: subject?.accent ?? activity?.accent }} /><time>{session.start}–{session.end}</time><div><strong>{session.task}</strong><span>{subject?.name ?? activity?.name ?? "其他"}{session.note ? ` · ${session.note}` : ""}</span></div><span className="session-duration">{formatMinutes(session.actualMinutes)}</span><span className="category-pill">{activity ? "活动" : "科目"}</span><button onClick={() => onDelete(session.id)} aria-label="删除记录"><Trash2 size={16} /></button></div>; })}</div>;
}

function EditableSessionTable({ sessions, state, onEdit, onDelete }: { sessions: StudySession[]; state: StudyState; onEdit: (session: StudySession) => void; onDelete: (id: string) => void }) {
  return <div className="session-table">{sessions.map((session) => {
    const subject = state.subjects.find((item) => item.id === session.subjectId);
    const activity = lifeActivity(session.subjectId, state.lifeActivities);
    return <div className="session-row" key={session.id}>
      <span className="subject-indicator" style={{ background: subject?.accent ?? activity?.accent }} />
      <time>{session.start}–{session.end}</time>
      <div><strong>{session.task}</strong><span>{subject?.name ?? activity?.name ?? "其他"}{session.note ? ` · ${session.note}` : ""}</span></div>
      <span className="session-duration">{formatMinutes(session.actualMinutes)}</span>
      <span className="category-pill">{activity ? "活动" : "科目"}</span>
      <span className="row-actions">
        <button type="button" onClick={() => onEdit(session)} aria-label="编辑记录"><Pencil size={15} /></button>
        <button type="button" onClick={() => onDelete(session.id)} aria-label="删除记录"><Trash2 size={16} /></button>
      </span>
    </div>;
  })}</div>;
}

function EditablePlanTable({ items, state, onEdit, onDelete }: { items: PlanItem[]; state: StudyState; onEdit: (item: PlanItem) => void; onDelete: (id: string) => void }) {
  return <div className="plan-list">{[...items].sort((a, b) => a.start.localeCompare(b.start)).map((item) => {
    const subject = state.subjects.find((entry) => entry.id === item.subjectId);
    const activity = lifeActivity(item.subjectId, state.lifeActivities);
    return <div className="plan-list-row" key={item.id}>
      <span className="subject-indicator" style={{ background: subject?.accent ?? activity?.accent }} />
      <time>{item.start}–{item.end}</time>
      <div><strong>{item.task}</strong><span>{subject?.name ?? activity?.name ?? "其他"}{item.note ? ` · ${item.note}` : ""}</span></div>
      <span className="row-actions">
        <button type="button" onClick={() => onEdit(item)} aria-label="编辑计划"><Pencil size={15} /></button>
        <button type="button" onClick={() => onDelete(item.id)} aria-label="删除计划"><Trash2 size={16} /></button>
      </span>
    </div>;
  })}</div>;
}

function DayScheduleChart({ entries, state, mode }: {
  entries: (StudySession | PlanItem)[];
  state: StudyState;
  mode: "planned" | "actual";
}) {
  const durationFor = (entry: StudySession | PlanItem) => {
    const stored = mode === "planned"
      ? "plannedMinutes" in entry ? entry.plannedMinutes : minutesBetween(entry.start, entry.end, entry.subjectId === "sleep")
      : "actualMinutes" in entry ? entry.actualMinutes : minutesBetween(entry.start, entry.end, entry.subjectId === "sleep");
    return Math.min(24 * 60, Math.max(0, Number(stored) || minutesBetween(entry.start, entry.end, entry.subjectId === "sleep")));
  };
  const chartEntries = entries.filter((entry) => durationFor(entry) > 0);
  const hours = [0, 6, 12, 18, 24];

  if (!chartEntries.length) {
    return <div className="schedule-empty">暂无可生成图表的时段，新增记录后会自动绘制。</div>;
  }

  return (
    <div className="day-schedule" aria-label={mode === "planned" ? "今日计划安排图" : "实际时间记录图"}>
      <div className="schedule-axis-label" />
      <div className="schedule-axis">{hours.map((hour) => <span key={hour} style={{ left: `${hour / 24 * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}</div>
      {chartEntries.map((entry) => {
        const subject = state.subjects.find((item) => item.id === entry.subjectId);
        const activity = lifeActivity(entry.subjectId, state.lifeActivities);
        const duration = durationFor(entry);
        const start = timeToMinutes(entry.start);
        const firstDuration = Math.min(duration, 24 * 60 - start);
        const wrappedDuration = Math.max(0, duration - firstDuration);
        const end = (start + duration) % (24 * 60);
        const endLabel = minutesToTime(end);
        const color = subject?.accent ?? activity?.accent ?? "var(--accent)";
        const title = `${entry.task} · ${entry.start}–${endLabel} · ${formatMinutes(duration)}`;
        return (
          <div className="schedule-row" key={entry.id}>
            <div className="schedule-row-label"><strong>{entry.task}</strong><span>{entry.start}–{endLabel}</span></div>
            <div className="schedule-track">
              {hours.map((hour) => <i className="schedule-gridline" key={hour} style={{ left: `${hour / 24 * 100}%` }} />)}
              <span className="schedule-block" title={title} style={{ left: `${start / (24 * 60) * 100}%`, width: `${firstDuration / (24 * 60) * 100}%`, background: color }} />
              {wrappedDuration > 0 && <span className="schedule-block" title={title} style={{ left: 0, width: `${wrappedDuration / (24 * 60) * 100}%`, background: color }} />}
            </div>
          </div>
        );
      })}
      <div className="schedule-legend"><span><i />{mode === "planned" ? "计划时段" : "实际记录"}</span><small>横轴为 00:00–24:00，悬停色块可查看详情</small></div>
    </div>
  );
}

function PlanTable({ items, state, onEdit, onDelete }: { items: PlanItem[]; state: StudyState; onEdit: (item: PlanItem) => void; onDelete: (id: string) => void }) {
  return <div className="plan-list">{[...items].sort((a, b) => a.start.localeCompare(b.start)).map((item) => { const subject = state.subjects.find((entry) => entry.id === item.subjectId); const activity = lifeActivity(item.subjectId, state.lifeActivities); return <div className="plan-list-row" key={item.id}><span className="subject-indicator" style={{ background: subject?.accent ?? activity?.accent }} /><time>{item.start}–{item.end}</time><div><strong>{item.task}</strong><span>{subject?.name ?? activity?.name ?? "其他"}{item.note ? ` · ${item.note}` : ""}</span></div><button onClick={() => onDelete(item.id)} aria-label="删除计划"><Trash2 size={16} /></button></div>; })}</div>;
}

function ProgressRing({ value, label, compact = false, color }: { value: number; label?: string; compact?: boolean; color?: string }) {
  return <div className={`progress-ring ${compact ? "compact" : ""}`} style={{ "--progress": `${Math.min(100, Math.max(0, value)) * 3.6}deg`, "--ring-color": color ?? "var(--accent)" } as React.CSSProperties}><div><strong>{value}%</strong>{label && <span>{label}</span>}</div></div>;
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="score-row"><span>{label}</span><div className="mini-track"><i style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} /></div><strong>{value}<small>/{max}</small></strong></div>;
}

function EmptyState({ icon: Icon, title, detail, action, onAction }: { icon: typeof Clock3; title: string; detail: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><div><Icon size={25} /></div><strong>{title}</strong><p>{detail}</p><button className="text-button" onClick={onAction}>{action}<ChevronRight size={15} /></button></div>;
}

function ScoreGuide({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="guide-item"><span>{number}</span><div><strong>{title}</strong><p>{detail}</p></div></div>;
}

