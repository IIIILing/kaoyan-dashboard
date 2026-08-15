import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock3,
  Download,
  HardDrive,
  Home,
  ListTodo,
  Moon,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SlidersHorizontal,
  Sun,
  Target,
  TimerReset,
  TrendingUp,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { BackupDialog, PlanItemDialog, RecordDialog } from "./components/dialogs";
import {
  ACCOUNT_REGISTRY_KEY,
  ACCOUNT_STATE_PREFIX,
  LEGACY_LOCAL_KEY,
  accountStateKey,
  freshStudyState,
  type AccountRegistry,
  type DashboardAccount,
} from "./lib/accounts";
import { daysUntil, localDate, recentDates } from "./lib/dates";
import { downloadFile, minutesBetween } from "./lib/format";
import { dailyMetrics, periodSummary, sessionsForDate } from "./lib/scoring";
import type { BackupMode, RecordDraft, View } from "./lib/types";
import { normalizeExperiences } from "./experience-data";
import { normalizeExamRecords } from "./exam-data";
import { computeImportMerge } from "./import-merge";
import { normalizeReviewItems } from "./review-data";
import {
  createScheduleArchive,
  parseScheduleImport,
  withUnifiedSchedule,
  type DateRange,
  type ScheduleImportCandidate,
} from "./schedule-data";
import {
  defaultLifeActivities,
  defaultStudyState,
  projectProgress,
  subjectProgress,
  type DailyPlan,
  type PlanItem,
  type StudySession,
  type StudyState,
} from "./study-state";
import { applyThemePalette } from "./theme-palettes";
import ExperiencesView from "./ExperiencesView";
import ExamsView from "./ExamsView";
import ReviewView from "./ReviewView";
import TimerView, { type TimerLaunchRequest } from "./TimerView";
import Overview from "./views/Overview";
import RecordsView from "./views/RecordsView";
import ScoringView from "./views/ScoringView";
import SettingsView from "./views/SettingsView";
import SubjectsView from "./views/SubjectsView";
import TodayView from "./views/TodayView";
import WeeklyView from "./views/WeeklyView";

type SaveStatus = "loading" | "saving" | "saved";
type UndoAction = {
  id: string;
  message: string;
  restore: () => void;
};

const NAV: { id: View; label: string; icon: typeof Home }[] = [
  { id: "overview", label: "总览", icon: Home },
  { id: "today", label: "今日计划", icon: ListTodo },
  { id: "timer", label: "专注计时", icon: TimerReset },
  { id: "records", label: "时间记录", icon: Clock3 },
  { id: "exams", label: "成绩趋势", icon: TrendingUp },
  { id: "reviews", label: "复习队列", icon: CalendarDays },
  { id: "subjects", label: "科目进度", icon: BookOpen },
  { id: "experiences", label: "经验贴", icon: NotebookText },
  { id: "weekly", label: "周报", icon: BarChart3 },
  { id: "scoring", label: "评分标准", icon: SlidersHorizontal },
  { id: "settings", label: "设置", icon: Settings },
];

const THEME_KEY = "kaoyan-dashboard-theme";
const BACKUP_DISMISS_KEY = "kaoyan-dashboard-backup-dismissed-at";
const BACKUP_REMINDER_DAYS = 7;

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
        startDate: typeof phase.startDate === "string" ? phase.startDate : undefined,
        targetDate: typeof phase.targetDate === "string" ? phase.targetDate : undefined,
        targetProgress: Number.isFinite(Number(phase.targetProgress)) ? Math.min(100, Math.max(1, Number(phase.targetProgress))) : 100,
        progressHistory: Array.isArray(phase.progressHistory)
          ? phase.progressHistory.filter((snapshot) => snapshot && typeof snapshot.date === "string" && Number.isFinite(Number(snapshot.progress))).map((snapshot) => ({ date: snapshot.date, progress: Math.min(100, Math.max(0, Number(snapshot.progress))) }))
          : [],
        resources: Array.isArray(phase.resources) ? phase.resources : [],
      })),
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

export default function Dashboard() {
  const [state, setState] = useState<StudyState>(defaultStudyState);
  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState("");
  const [view, setView] = useState<View>("overview");
  const [planDate, setPlanDate] = useState(localDate());
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordEditing, setRecordEditing] = useState<StudySession | null>(null);
  const [recordDraft, setRecordDraft] = useState<RecordDraft | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planEditing, setPlanEditing] = useState<PlanItem | null>(null);
  const [timerLaunch, setTimerLaunch] = useState<TimerLaunchRequest | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [backupMode, setBackupMode] = useState<BackupMode | null>(null);
  const [importCandidate, setImportCandidate] = useState<ScheduleImportCandidate | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [backupReminderDismissedAt, setBackupReminderDismissedAt] = useState(() => {
    try {
      return window.localStorage.getItem(BACKUP_DISMISS_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const importRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  const accountIdRef = useRef(activeAccountId);
  const loadedRef = useRef(loaded);

  useEffect(() => {
    stateRef.current = state;
    accountIdRef.current = activeAccountId;
    loadedRef.current = loaded;
  });

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
    setLastSavedAt(new Date().toISOString());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !activeAccountId) return;
    queueMicrotask(() => setSaveStatus("saving"));
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(accountStateKey(activeAccountId), JSON.stringify(state));
      setSaveStatus("saved");
      setLastSavedAt(new Date().toISOString());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state, loaded, activeAccountId]);

  // 防抖窗口(250ms)内关闭页面或切换标签页时,数据可能来不及写入。
  // 在 beforeunload / visibilitychange(hidden) 时同步强制写一次,避免丢失最后几秒的编辑。
  useEffect(() => {
    function flushPendingSave() {
      const current = stateRef.current;
      const accountId = accountIdRef.current;
      if (!loadedRef.current || !accountId || !current) return;
      try {
        window.localStorage.setItem(accountStateKey(accountId), JSON.stringify(current));
      } catch {
        // 存储空间不足等异常:保留上一次成功写入的快照即可。
      }
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flushPendingSave();
    }
    window.addEventListener("beforeunload", flushPendingSave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flushPendingSave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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

  useEffect(() => () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
  }, []);

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
    setRecordDraft(null);
    setPlanOpen(false);
    setPlanEditing(null);
    setTimerLaunch(null);
    setBackupMode(null);
    setImportCandidate(null);
    setUndoAction(null);
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
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

  function offerUndo(message: string, restore: () => void) {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    const id = crypto.randomUUID();
    setUndoAction({ id, message, restore });
    undoTimerRef.current = window.setTimeout(() => {
      setUndoAction((current) => current?.id === id ? null : current);
      undoTimerRef.current = null;
    }, 8_000);
  }

  function undoLastAction() {
    if (!undoAction) return;
    const restore = undoAction.restore;
    dismissUndo();
    restore();
  }

  function dismissUndo() {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndoAction(null);
  }

  function addSession(session: StudySession) {
    updateState((current) => ({
      ...current,
      sessions: current.sessions.some((item) => item.id === session.id)
        ? current.sessions.map((item) => item.id === session.id ? session : item)
        : [...current.sessions, session],
    }));
    setRecordEditing(null);
    setRecordDraft(null);
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

  function openNewRecord(date = localDate()) {
    setRecordEditing(null);
    setRecordDraft({ date });
    setRecordOpen(true);
  }

  function openEditRecord(session: StudySession) {
    setRecordEditing(session);
    setRecordDraft(null);
    setRecordOpen(true);
  }

  function startPlanTimer(item: PlanItem) {
    if (planDate !== localDate()) {
      window.alert("只能从今天的计划开始计时。请先切换回今天。");
      return;
    }
    setTimerLaunch({
      id: crypto.randomUUID(),
      planItemId: item.id,
      planDate,
      plannedMinutes: minutesBetween(item.start, item.end, item.subjectId === "sleep"),
      subjectId: item.subjectId,
      task: item.task,
    });
    setView("timer");
  }

  function deleteSession(id: string) {
    const deleted = state.sessions.find((item) => item.id === id);
    if (!deleted) return;
    updateState((current) => ({
      ...current,
      sessions: current.sessions.filter((item) => item.id !== id),
    }));
    offerUndo(`已删除实际记录“${deleted.task}”`, () => updateState((current) => ({
      ...current,
      sessions: current.sessions.some((item) => item.id === deleted.id)
        ? current.sessions
        : [...current.sessions, deleted],
    })));
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
    const deletedPlan = state.plans.find((plan) => plan.date === planDate);
    const deleted = deletedPlan?.items.find((item) => item.id === id);
    if (!deletedPlan || !deleted) return;
    updateState((current) => ({
      ...current,
      plans: current.plans.map((plan) => plan.date === planDate
        ? { ...plan, items: plan.items.filter((item) => item.id !== id) }
        : plan),
    }));
    offerUndo(`已删除计划“${deleted.task}”`, () => updateState((current) => ({
      ...current,
      plans: current.plans.some((plan) => plan.date === deletedPlan.date)
        ? current.plans.map((plan) => plan.date === deletedPlan.date && !plan.items.some((item) => item.id === deleted.id)
          ? { ...plan, items: [...plan.items, deleted] }
          : plan)
        : [...current.plans, { date: deletedPlan.date, items: [deleted] }],
    })));
  }

  function exportData(range: DateRange) {
    const archive = createScheduleArchive(state, range);
    downloadFile(
      JSON.stringify(archive, null, 2),
      `kaoyan-schedule-${range.from}-${range.to}.json`,
    );
    updateState((current) => ({ ...current, dataSafety: { ...current.dataSafety, lastExternalBackupAt: new Date().toISOString() } }));
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
    const merged = computeImportMerge(state, importCandidate, range);
    setState((current) => withUnifiedSchedule({
      ...current,
      sessions: merged.sessions.sessions,
      plans: merged.plans.plans,
      planTemplates: merged.templates.templates,
      examRecords: merged.exams.records,
      reviewItems: merged.reviews.items,
    }));
    setBackupMode(null);
    setImportCandidate(null);
    window.alert(
      `导入完成。时间记录：新增 ${merged.sessions.report.added} 条，重复 ${merged.sessions.report.duplicates} 条，顺延 ${merged.sessions.report.shifted} 条，跳过 ${merged.sessions.report.skipped} 条；今日计划：新增 ${merged.plans.report.added} 条，重复 ${merged.plans.report.duplicates} 条，顺延 ${merged.plans.report.shifted} 条，跳过 ${merged.plans.report.skipped} 条；计划模板：新增 ${merged.templates.added} 个，重复 ${merged.templates.duplicates} 个；成绩记录：新增 ${merged.exams.added} 条，重复 ${merged.exams.duplicates} 条；复习项：新增 ${merged.reviews.added} 条，重复 ${merged.reviews.duplicates} 条。`,
    );
  }

  const viewTitle = NAV.find((item) => item.id === view)?.label ?? "总览";
  const activeAccount = accounts.find((account) => account.id === activeAccountId);

  // 备份提醒:有实际数据、且超过 7 天未导出 JSON 时,在页面顶部提示(今日已手动关闭则不再显示)。
  const backupTimestamp = state.dataSafety.lastExternalBackupAt;
  const backupAgeDays = backupTimestamp ? Math.floor((Date.now() - new Date(backupTimestamp).getTime()) / 86_400_000) : null;
  const hasBackupableData =
    state.sessions.length > 0 ||
    state.plans.length > 0 ||
    state.examRecords.length > 0 ||
    state.reviewItems.length > 0;
  const backupOverdue = hasBackupableData && (backupAgeDays === null || backupAgeDays >= BACKUP_REMINDER_DAYS);
  const dismissalFresh =
    Boolean(backupReminderDismissedAt) &&
    Date.now() - new Date(backupReminderDismissedAt).getTime() < 86_400_000;
  const showBackupReminder = loaded && backupOverdue && !dismissalFresh && view !== "timer";

  function dismissBackupReminder() {
    const now = new Date().toISOString();
    setBackupReminderDismissedAt(now);
    try {
      window.localStorage.setItem(BACKUP_DISMISS_KEY, now);
    } catch {
      // 忽略写入失败:下次进入页面时重新提醒即可。
    }
  }

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

        {showBackupReminder && (
          <div className="backup-reminder-banner" role="status">
            <AlertTriangle size={18} />
            <div>
              <strong>{backupAgeDays === null ? "还没有外部备份" : `外部备份已 ${backupAgeDays} 天未更新`}</strong>
              <span>学习数据仅保存在当前浏览器。请定期导出 JSON 备份,更换设备或清理浏览器数据前务必先导出。</span>
            </div>
            <button type="button" className="primary-button" onClick={() => setBackupMode("export")}><Download size={15} />立即备份</button>
            <button type="button" className="backup-reminder-dismiss" onClick={dismissBackupReminder} aria-label="今日不再提醒" title="今日不再提醒"><X size={15} /></button>
          </div>
        )}

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
            onRecord={() => openNewRecord(planDate)}
            onStartPlan={startPlanTimer}
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
            launchRequest={timerLaunch}
            onLaunchHandled={() => setTimerLaunch(null)}
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
        {view === "exams" && <ExamsView state={state} updateState={updateState} />}
        {view === "reviews" && <ReviewView state={state} updateState={updateState} />}
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
            lastSavedAt={lastSavedAt}
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

      {recordOpen && <RecordDialog state={state} initial={recordEditing} draft={recordDraft} onClose={() => { setRecordOpen(false); setRecordEditing(null); setRecordDraft(null); }} onSave={addSession} />}
      {planOpen && <PlanItemDialog state={state} date={planDate} initial={planEditing} onClose={() => { setPlanOpen(false); setPlanEditing(null); }} onSave={addPlanItem} />}
      {backupMode && (
        <BackupDialog
          mode={backupMode}
          state={state}
          candidate={importCandidate}
          sessions={backupMode === "import" ? importCandidate?.sessions ?? [] : state.sessions}
          plans={backupMode === "import" ? importCandidate?.plans ?? [] : state.plans}
          onClose={() => { setBackupMode(null); setImportCandidate(null); }}
          onConfirm={backupMode === "import" ? importData : exportData}
        />
      )}
      {undoAction && <div className="undo-toast" role="status" aria-live="polite"><span>{undoAction.message}</span><button type="button" onClick={undoLastAction}><Undo2 size={16} />撤销</button><button type="button" className="undo-toast-close" onClick={dismissUndo} aria-label="关闭撤销提示"><X size={15} /></button></div>}
    </div>
  );
}
