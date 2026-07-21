import {
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
  Plus,
  RotateCcw,
  Save,
  Settings,
  SlidersHorizontal,
  Sun,
  Target,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultStudyState,
  projectProgress,
  subjectProgress,
  type ScoreWeights,
  type StudySession,
  type StudyState,
} from "./study-state";

type View = "overview" | "today" | "records" | "subjects" | "weekly" | "scoring" | "settings";
type SaveStatus = "loading" | "saving" | "saved";
type BackupMode = "export" | "import";
type DateRange = { from: string; to: string };
type ImportReport = { added: number; duplicates: number; shifted: number; skipped: number };

const NAV: { id: View; label: string; icon: typeof Home }[] = [
  { id: "overview", label: "总览", icon: Home },
  { id: "today", label: "今日计划", icon: ListTodo },
  { id: "records", label: "时间记录", icon: Clock3 },
  { id: "subjects", label: "科目进度", icon: BookOpen },
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

const LOCAL_KEY = "kaoyan-dashboard-state-v1";
const THEME_KEY = "kaoyan-dashboard-theme";
const LIFE_ACTIVITIES = [
  { id: "sleep", name: "睡觉", accent: "#6f7fa5" },
  { id: "exercise", name: "运动", accent: "#3f8b72" },
  { id: "entertainment", name: "娱乐", accent: "#b27955" },
] as const;
const LIFE_ACTIVITY_IDS = new Set<string>(LIFE_ACTIVITIES.map((item) => item.id));

function lifeActivity(subjectId: string) {
  return LIFE_ACTIVITIES.find((item) => item.id === subjectId);
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

function normalizedTask(task: string) {
  return task.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

function sessionsOverlap(a: StudySession, b: StudySession) {
  return a.date === b.date && timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end);
}

function findFreeSlot(sessions: StudySession[], start: string, duration: number) {
  let candidate = timeToMinutes(start);
  const daySessions = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  while (candidate + duration <= 23 * 60 + 59) {
    const conflict = daySessions.find(
      (item) => candidate < timeToMinutes(item.end) && timeToMinutes(item.start) < candidate + duration,
    );
    if (!conflict) return { start: minutesToTime(candidate), end: minutesToTime(candidate + duration) };
    candidate = timeToMinutes(conflict.end);
  }
  return null;
}

function mergeImportedSessions(existing: StudySession[], incoming: StudySession[]) {
  const merged = [...existing];
  const report: ImportReport = { added: 0, duplicates: 0, shifted: 0, skipped: 0 };

  [...incoming].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)).forEach((item) => {
    const duplicate = merged.some(
      (current) =>
        current.date === item.date &&
        current.start === item.start &&
        current.end === item.end &&
        normalizedTask(current.task) === normalizedTask(item.task),
    );
    if (duplicate) {
      report.duplicates += 1;
      return;
    }

    const daySessions = merged.filter((current) => current.date === item.date);
    if (!daySessions.some((current) => sessionsOverlap(current, item))) {
      merged.push({ ...item, id: crypto.randomUUID() });
      report.added += 1;
      return;
    }

    const duration = Math.max(1, item.actualMinutes || minutesBetween(item.start, item.end));
    const free = findFreeSlot(daySessions, item.start, duration);
    if (!free) {
      report.skipped += 1;
      return;
    }
    const original = `${item.start}–${item.end}`;
    const adjustment = `导入冲突调整：原时段 ${original} 与已有任务重叠，已顺延至 ${free.start}–${free.end}。`;
    merged.push({
      ...item,
      id: crypto.randomUUID(),
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

function dailyMetrics(sessions: StudySession[], targetHours: number, weights: ScoreWeights) {
  const studySessions = sessions.filter((item) => !LIFE_ACTIVITY_IDS.has(item.subjectId));
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
) {
  const days = dates.map((date) => dailyMetrics(sessionsForDate(sessions, date), targetHours, weights));
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
  return {
    days: dates.length,
    periodScore: Math.round(averageDailyScore * 0.75 + recordRate * 10 + routineBalance * 15),
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
  };
}

export default function Dashboard() {
  const [state, setState] = useState<StudyState>(defaultStudyState);
  const [view, setView] = useState<View>("overview");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [loaded, setLoaded] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [backupMode, setBackupMode] = useState<BackupMode | null>(null);
  const [importCandidate, setImportCandidate] = useState<StudyState | null>(null);
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

    const local = window.localStorage.getItem(LOCAL_KEY);
    if (local) {
      try {
        const parsed = JSON.parse(local) as StudyState;
        if (parsed.version === 1 && Array.isArray(parsed.subjects) && Array.isArray(parsed.sessions)) {
          const normalized: StudyState = {
            ...parsed,
            profile: {
              ...defaultStudyState.profile,
              ...parsed.profile,
            },
            scoring: {
              weights: {
                ...defaultStudyState.scoring.weights,
                ...parsed.scoring?.weights,
              },
            },
          };
          const savedEnglish = normalized.subjects.find((subject) => subject.id === "english");
          const defaultEnglish = defaultStudyState.subjects.find((subject) => subject.id === "english");
          const hasLegacyEnglishPlan = savedEnglish?.phases.some((phase) =>
            ["eng-word", "eng-read", "eng-other", "eng-write"].includes(phase.id),
          );
          const savedCircuit = normalized.subjects.find((subject) => subject.id === "circuit");
          const defaultCircuit = defaultStudyState.subjects.find((subject) => subject.id === "circuit");
          const hasLegacyCircuitPlan = savedCircuit?.phases.some((phase) =>
            ["cir-basic", "cir-exercise", "cir-mock"].includes(phase.id),
          );
          if (
            (savedEnglish && defaultEnglish && hasLegacyEnglishPlan) ||
            (savedCircuit && defaultCircuit && hasLegacyCircuitPlan)
          ) {
            const savedProgress = new Map(
              savedEnglish?.phases.map((phase) => [phase.id, phase.progress]) ?? [],
            );
            const progressSource: Record<string, string> = {
              "eng-word-first": "eng-word",
              "eng-real": "eng-read",
              "eng-writing": "eng-write",
            };
            const savedCircuitProgress = new Map(
              savedCircuit?.phases.map((phase) => [phase.id, phase.progress]) ?? [],
            );
            const circuitProgressSource: Record<string, string> = {
              "cir-first": "cir-basic",
              "cir-chapter": "cir-exercise",
              "cir-material": "cir-mock",
            };
            setState({
              ...normalized,
              subjects: normalized.subjects.map((subject) =>
                subject.id === "english" && savedEnglish && defaultEnglish && hasLegacyEnglishPlan
                  ? {
                      ...subject,
                      phases: defaultEnglish.phases.map((phase) => ({
                        ...phase,
                        progress: savedProgress.get(phase.id) ??
                          savedProgress.get(progressSource[phase.id]) ??
                          phase.progress,
                      })),
                    }
                  : subject.id === "circuit" && defaultCircuit && hasLegacyCircuitPlan
                    ? {
                        ...subject,
                        phases: defaultCircuit.phases.map((phase) => ({
                          ...phase,
                          progress: savedCircuitProgress.get(phase.id) ??
                            savedCircuitProgress.get(circuitProgressSource[phase.id]) ??
                            phase.progress,
                        })),
                      }
                    : subject,
              ),
            });
          } else {
            setState(normalized);
          }
        }
      } catch {
        // Ignore a damaged local backup and start from the safe default state.
      }
    }
    setSaveStatus("saved");
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    queueMicrotask(() => setSaveStatus("saving"));
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
      setSaveStatus("saved");
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state, loaded]);

  const today = localDate();
  const todaySessions = useMemo(() => sessionsForDate(state.sessions, today), [state.sessions, today]);
  const todayMetrics = useMemo(
    () => dailyMetrics(todaySessions, state.profile.dailyTargetHours, state.scoring.weights),
    [todaySessions, state.profile.dailyTargetHours, state.scoring.weights],
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
        ),
      })),
    [sevenDates, state.sessions, state.profile.dailyTargetHours, state.scoring.weights],
  );
  const weekSummary = useMemo(
    () => periodSummary(state.sessions, sevenDates, state.profile.dailyTargetHours, state.scoring.weights),
    [sevenDates, state.sessions, state.profile.dailyTargetHours, state.scoring.weights],
  );
  const monthSummary = useMemo(
    () => periodSummary(state.sessions, thirtyDates, state.profile.dailyTargetHours, state.scoring.weights),
    [thirtyDates, state.sessions, state.profile.dailyTargetHours, state.scoring.weights],
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

  function updateState(updater: (current: StudyState) => StudyState) {
    setState((current) => updater(current));
  }

  function addSession(session: StudySession) {
    updateState((current) => ({ ...current, sessions: [...current.sessions, session] }));
    setRecordOpen(false);
  }

  function deleteSession(id: string) {
    updateState((current) => ({
      ...current,
      sessions: current.sessions.filter((item) => item.id !== id),
    }));
  }

  function exportData(range: DateRange) {
    const selected = { ...state, sessions: state.sessions.filter((item) => isInRange(item.date, range)) };
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kaoyan-dashboard-${range.from}-${range.to}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupMode(null);
  }

  function readImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result)) as StudyState;
        if (next.version !== 1 || !Array.isArray(next.subjects) || !Array.isArray(next.sessions)) {
          throw new Error("invalid");
        }
        setImportCandidate(next);
        setBackupMode("import");
      } catch {
        window.alert("无法导入：请选择由本网站导出的 JSON 备份文件。");
      }
    };
    reader.readAsText(file);
  }

  function importData(range: DateRange) {
    if (!importCandidate) return;
    const selected = importCandidate.sessions.filter((item) => isInRange(item.date, range));
    const { sessions, report } = mergeImportedSessions(state.sessions, selected);
    setState((current) => ({ ...current, sessions }));
    setBackupMode(null);
    setImportCandidate(null);
    window.alert(
      `导入完成：新增 ${report.added} 条，重复跳过 ${report.duplicates} 条，冲突顺延 ${report.shifted} 条，因当天无空档跳过 ${report.skipped} 条。`,
    );
  }

  const viewTitle = NAV.find((item) => item.id === view)?.label ?? "总览";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark">Z</div>
          <div><strong>{state.profile.sidebarTitle}</strong><span>{state.profile.sidebarSubtitle}</span></div>
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
          <button className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="打开导航">☰</button>
          <div>
            <p className="eyebrow">{viewTitle}</p>
            <h1>{view === "overview" ? `晚上好，${state.profile.name}` : viewTitle}</h1>
          </div>
          <div className="topbar-actions">
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
            onRecord={() => setRecordOpen(true)}
            onNavigate={setView}
          />
        )}
        {view === "today" && (
          <TodayView state={state} sessions={todaySessions} metrics={todayMetrics} onRecord={() => setRecordOpen(true)} onDelete={deleteSession} />
        )}
        {view === "records" && (
          <RecordsView state={state} onRecord={() => setRecordOpen(true)} onDelete={deleteSession} />
        )}
        {view === "subjects" && <SubjectsView state={state} updateState={updateState} />}
        {view === "weekly" && <WeeklyView state={state} metrics={weekMetrics} average={weeklyAverage} />}
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
            updateState={updateState}
            onExport={() => setBackupMode("export")}
            onImport={() => importRef.current?.click()}
            onReset={() => window.confirm("确定恢复初始信息？现有记录将被清空。") && setState(defaultStudyState)}
          />
        )}
        <input ref={importRef} type="file" hidden accept="application/json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) readImportFile(file);
          event.target.value = "";
        }} />
      </main>

      {recordOpen && <RecordDialog state={state} onClose={() => setRecordOpen(false)} onSave={addSession} />}
      {backupMode && (
        <BackupDialog
          mode={backupMode}
          sessions={backupMode === "import" ? importCandidate?.sessions ?? [] : state.sessions}
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
                  <span>{lifeActivity(session.subjectId)?.name ?? `${session.completion}%`}</span>
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

function TodayView({ state, sessions, metrics, onRecord, onDelete }: { state: StudyState; sessions: StudySession[]; metrics: ReturnType<typeof dailyMetrics>; onRecord: () => void; onDelete: (id: string) => void }) {
  return (
    <div className="page-stack narrow-page">
      <section className="summary-strip today-summary">
        <div><span>今日有效学习</span><strong>{formatMinutes(metrics.actualMinutes)}</strong></div>
        <div><span>作息效率</span><strong>{Math.round(metrics.timingRatio * 100)}%</strong></div>
        <div><span>睡眠</span><strong>{formatMinutes(metrics.sleepMinutes)}</strong></div>
        <div><span>运动</span><strong>{formatMinutes(metrics.exerciseMinutes)}</strong></div>
        <div><span>平均完成度</span><strong>{Math.round(metrics.completion)}%</strong></div>
        <div><span>今日得分</span><strong>{metrics.score}</strong></div>
        <button className="primary-button" onClick={onRecord}><Plus size={17} />新增时段</button>
      </section>
      <section className="panel schedule-panel">
        <div className="panel-heading"><div><p className="card-kicker">{localDate()}</p><h2>今日计划安排图</h2></div><span className="muted">按计划时段生成</span></div>
        <DayScheduleChart sessions={sessions} state={state} mode="planned" />
      </section>
      <section className="panel">
        <div className="panel-heading"><div><p className="card-kicker">{localDate()}</p><h2>今天的分时记录</h2></div><span className="muted">目标 {state.profile.dailyTargetHours} 小时</span></div>
        {sessions.length ? <SessionTable sessions={sessions} state={state} onDelete={onDelete} /> : <EmptyState icon={Clock3} title="把一天拆成真实时段" detail="建议每段 45–150 分钟，完成后立即填写完成度和专注度。" action="记录第一个时段" onAction={onRecord} />}
      </section>
    </div>
  );
}

function RecordsView({ state, onRecord, onDelete }: { state: StudyState; onRecord: () => void; onDelete: (id: string) => void }) {
  const dates = Array.from(new Set(state.sessions.map((item) => item.date))).sort().reverse();
  return (
    <div className="page-stack narrow-page">
      <div className="page-actions"><p className="muted">共 {state.sessions.length} 条记录 · 当前浏览器本地保存</p><button className="primary-button" onClick={onRecord}><Plus size={17} />新增记录</button></div>
      {dates.length ? dates.map((date) => (
        <section className="panel" key={date}>
          <div className="panel-heading"><div><p className="card-kicker">{date}</p><h2>实际时间记录图</h2></div><strong>{formatMinutes(sessionsForDate(state.sessions, date).reduce((sum, item) => sum + item.actualMinutes, 0))}</strong></div>
          <DayScheduleChart sessions={sessionsForDate(state.sessions, date)} state={state} mode="actual" />
          <div className="schedule-table-divider" />
          <SessionTable sessions={sessionsForDate(state.sessions, date)} state={state} onDelete={onDelete} />
        </section>
      )) : <section className="panel"><EmptyState icon={Clock3} title="记录会按日期沉淀在这里" detail="完成第一条记录后，可在这里查看全部历史。" action="新增记录" onAction={onRecord} /></section>}
    </div>
  );
}

function SubjectsView({ state, updateState }: { state: StudyState; updateState: (updater: (current: StudyState) => StudyState) => void }) {
  return (
    <div className="page-stack">
      <section className="progress-hero panel">
        <div><p className="card-kicker">加权总进度</p><strong>{projectProgress(state.subjects)}%</strong><p className="muted">科目权重可在设置中调整；阶段进度会自动折算。</p></div>
        <ProgressRing value={projectProgress(state.subjects)} />
      </section>
      <section className="subject-detail-grid">
        {state.subjects.map((subject) => (
          <article className="panel subject-detail" key={subject.id}>
            <div className="panel-heading"><div><p className="card-kicker">占总计划 {subject.weight}%</p><h2>{subject.name}</h2></div><span className="score-badge" style={{ color: subject.accent }}>{subjectProgress(subject)}%</span></div>
            <p className="subject-note">{subject.note}</p>
            <div className="phase-list">
              {subject.phases.map((phase) => (
                <label className="phase-row" key={phase.id}>
                  <div><span>{phase.name}</span><small>阶段权重 {phase.weight}%</small></div>
                  <input type="range" min="0" max="100" value={phase.progress} onChange={(event) => {
                    const value = Number(event.target.value);
                    updateState((current) => ({ ...current, subjects: current.subjects.map((item) => item.id === subject.id ? { ...item, phases: item.phases.map((p) => p.id === phase.id ? { ...p, progress: value } : p) } : item) }));
                  }} style={{ "--range-color": subject.accent } as React.CSSProperties} />
                  <strong>{phase.progress}%</strong>
                </label>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function WeeklyView({ state, metrics, average }: { state: StudyState; metrics: (ReturnType<typeof dailyMetrics> & { date: string })[]; average: number }) {
  const maxMinutes = Math.max(...metrics.map((item) => item.actualMinutes), state.profile.dailyTargetHours * 60);
  const total = metrics.reduce((sum, item) => sum + item.actualMinutes, 0);
  return (
    <div className="page-stack narrow-page">
      <section className="summary-strip weekly-summary">
        <div><span>近7日有效学习</span><strong>{formatMinutes(total)}</strong></div>
        <div><span>活跃天数</span><strong>{metrics.filter((item) => item.actualMinutes > 0).length} / 7</strong></div>
        <div><span>平均日得分</span><strong>{average}</strong></div>
        <div><span>当前总进度</span><strong>{projectProgress(state.subjects)}%</strong></div>
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
        <div className="panel-heading"><h2>评分规则</h2><span className="score-badge">透明可解释</span></div>
        <div className="guide-grid"><ScoreGuide number={String(state.scoring.weights.duration)} title="有效时长" detail="按学习时间段折算后对比每日目标" /><ScoreGuide number={String(state.scoring.weights.completion)} title="任务完成" detail="按各学习时段长度加权完成度" /><ScoreGuide number={String(state.scoring.weights.focus)} title="专注质量" detail="按时长加权的1–5星专注度" /><ScoreGuide number={String(state.scoring.weights.review)} title="复盘记录" detail="有有效复盘的学习时长占比" /><ScoreGuide number={String(state.scoring.weights.timing)} title="学习时段" detail="白天及正常晚间高分，23:30后和凌晨低分" /><ScoreGuide number={String(state.scoring.weights.sleep)} title="睡眠作息" detail="每日总睡眠7–9小时得满分，过短或过长递减" /><ScoreGuide number={String(state.scoring.weights.exercise)} title="适量运动" detail="30–90分钟最佳，早晨或16:00–20:30加权更高" /></div>
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

  function updateWeight(key: keyof ScoreWeights, value: number) {
    updateState((current) => ({
      ...current,
      scoring: {
        ...current.scoring,
        weights: { ...current.scoring.weights, [key]: Math.max(0, value) },
      },
    }));
  }

  return (
    <div className="page-stack scoring-page">
      <section className="period-score-grid">
        <RoutinePeriodCard title="近 7 天" subtitle="短期执行与恢复" summary={week} />
        <RoutinePeriodCard title="近 30 天" subtitle="长期稳定性" summary={month} />
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
        <p className="standards-note">周期得分 = 记录日平均分 75% + 记录覆盖 10% + 作息平衡 15%。作息平衡综合睡眠达标、运动总量、娱乐时长与深夜学习占比。</p>
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

function SettingsView({ state, updateState, onExport, onImport, onReset }: { state: StudyState; updateState: (updater: (current: StudyState) => StudyState) => void; onExport: () => void; onImport: () => void; onReset: () => void }) {
  function updateProfile(key: keyof StudyState["profile"], value: string | number) {
    updateState((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  }
  return (
    <div className="page-stack settings-page">
      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">项目基线</p><h2>考研目标</h2></div><Save size={19} /></div>
        <div className="form-grid">
          <label><span>称呼</span><input value={state.profile.name} onChange={(e) => updateProfile("name", e.target.value)} /></label>
          <label className="wide"><span>目标项目</span><input value={state.profile.target} onChange={(e) => updateProfile("target", e.target.value)} /></label>
          <label><span>侧栏主标题</span><input value={state.profile.sidebarTitle} onChange={(e) => updateProfile("sidebarTitle", e.target.value)} /></label>
          <label className="wide"><span>侧栏副标题</span><input value={state.profile.sidebarSubtitle} onChange={(e) => updateProfile("sidebarSubtitle", e.target.value)} /></label>
          <label><span>目标院校</span><input value={state.profile.targetSchool} onChange={(e) => updateProfile("targetSchool", e.target.value)} /></label>
          <label className="wide"><span>目标说明</span><input value={state.profile.targetDescription} onChange={(e) => updateProfile("targetDescription", e.target.value)} /></label>
          <label><span>暂定初试日期</span><input type="date" value={state.profile.examDate} onChange={(e) => updateProfile("examDate", e.target.value)} /></label>
          <label><span>每日目标小时</span><input type="number" min="1" max="16" step="0.5" value={state.profile.dailyTargetHours} onChange={(e) => updateProfile("dailyTargetHours", Number(e.target.value))} /></label>
          <label><span>目标起床</span><input type="time" value={state.profile.wakeTime} onChange={(e) => updateProfile("wakeTime", e.target.value)} /></label>
          <label><span>目标睡觉</span><input type="time" value={state.profile.sleepTime} onChange={(e) => updateProfile("sleepTime", e.target.value)} /></label>
        </div>
      </section>
      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">总进度模型</p><h2>科目权重</h2></div><span className="muted">合计 {state.subjects.reduce((sum, subject) => sum + subject.weight, 0)}%</span></div>
        <div className="weight-grid">{state.subjects.map((subject) => <label key={subject.id}><span>{subject.name}</span><div><input type="number" min="0" max="100" value={subject.weight} onChange={(e) => updateState((current) => ({ ...current, subjects: current.subjects.map((item) => item.id === subject.id ? { ...item, weight: Number(e.target.value) } : item) }))} /><em>%</em></div></label>)}</div>
      </section>
      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">数据管理</p><h2>本机存储与备份</h2></div><HardDrive size={19} /></div>
        <p className="settings-copy">学习记录只保存在当前浏览器，不会上传到服务器。更换设备、浏览器或清除网站数据前，请先导出 JSON；建议每周备份一次。</p>
        <div className="button-row"><button className="secondary-button" onClick={onExport}><Download size={17} />导出 JSON</button><button className="secondary-button" onClick={onImport}><FileUp size={17} />导入备份</button><button className="danger-button" onClick={onReset}><RotateCcw size={17} />恢复初始数据</button></div>
      </section>
    </div>
  );
}

function BackupDialog({ mode, sessions, onClose, onConfirm }: {
  mode: BackupMode;
  sessions: StudySession[];
  onClose: () => void;
  onConfirm: (range: DateRange) => void;
}) {
  const dates = sessions.map((item) => item.date).sort();
  const firstDate = dates[0] ?? localDate();
  const lastDate = dates.at(-1) ?? localDate();
  const [anchor, setAnchor] = useState(lastDate);
  const [range, setRange] = useState<DateRange>(() =>
    mode === "import" ? { from: firstDate, to: lastDate } : presetRange("week", lastDate),
  );
  const count = sessions.filter((item) => isInRange(item.date, range)).length;
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
            <div><strong>{invalid ? "日期范围无效" : `${range.from} 至 ${range.to}`}</strong><span>范围内共有 {count} 条学习记录，最小选择精度为一天。</span></div>
          </div>
          {mode === "import" && (
            <div className="conflict-policy">
              <strong>导入冲突规则</strong>
              <p>相同日期、起止时间和任务名称的记录会跳过；不同任务时间重叠时，导入记录按原时长顺延到当天最早空闲时段，并写入调整备注，不覆盖已有数据。</p>
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <span>{mode === "export" ? "导出文件包含项目设置、科目进度和所选日期记录。" : "仅合并所选日期，不改动项目设置和科目进度。"}</span>
          <div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="button" className="primary-button" disabled={invalid} onClick={() => onConfirm(range)}>{mode === "export" ? <Download size={17} /> : <FileUp size={17} />}{mode === "export" ? "导出 JSON" : "合并导入"}</button></div>
        </div>
      </section>
    </div>
  );
}

function RecordDialog({ state, onClose, onSave }: { state: StudyState; onClose: () => void; onSave: (session: StudySession) => void }) {
  const now = new Date();
  const end = `${String(now.getHours()).padStart(2, "0")}:${String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, "0")}`;
  const startDate = new Date(now.getTime() - 90 * 60_000);
  const start = `${String(startDate.getHours()).padStart(2, "0")}:${String(Math.floor(startDate.getMinutes() / 5) * 5).padStart(2, "0")}`;
  const [form, setForm] = useState({ date: localDate(), start, end, subjectId: "math", task: "", completion: 100, focus: 4, note: "" });
  const selectedActivity = lifeActivity(form.subjectId);
  const isLifeActivity = Boolean(selectedActivity);
  const plannedMinutes = minutesBetween(form.start, form.end, form.subjectId === "sleep");
  function changeCategory(subjectId: string) {
    const previousActivity = lifeActivity(form.subjectId);
    const nextActivity = lifeActivity(subjectId);
    const canAutofill = !form.task.trim() || form.task === previousActivity?.name;
    setForm({ ...form, subjectId, task: nextActivity && canAutofill ? nextActivity.name : form.task });
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.task.trim() || plannedMinutes <= 0) return;
    onSave({ id: crypto.randomUUID(), ...form, task: form.task.trim(), plannedMinutes, actualMinutes: plannedMinutes });
  }
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="record-dialog" onSubmit={submit}>
        <div className="dialog-heading"><div><p className="card-kicker">分时记录</p><h2>记录一个时段</h2></div><button type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
        <div className="dialog-grid">
          <label><span>日期</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label><span>科目 / 活动</span><select value={form.subjectId} onChange={(e) => changeCategory(e.target.value)}><optgroup label="学习科目">{state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</optgroup><optgroup label="生活活动">{LIFE_ACTIVITIES.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</optgroup></select></label>
          <label><span>开始时间</span><input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
          <label><span>结束时间</span><input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
          <label className="wide"><span>{isLifeActivity ? "活动内容" : "本时段任务"}</span><input autoFocus placeholder={isLifeActivity ? `例如：${selectedActivity?.name}` : "例如：1000题概率统计第1章"} value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} /></label>
          {!isLifeActivity && <label><span>完成度：{form.completion}%</span><input type="range" min="0" max="100" step="5" value={form.completion} onChange={(e) => setForm({ ...form, completion: Number(e.target.value) })} /></label>}
          {!isLifeActivity && <label><span>专注度：{form.focus} / 5</span><input type="range" min="1" max="5" value={form.focus} onChange={(e) => setForm({ ...form, focus: Number(e.target.value) })} /></label>}
          <label className="wide"><span>{isLifeActivity ? "备注（可选）" : "复盘（可选）"}</span><textarea placeholder={isLifeActivity ? "例如：睡眠质量、运动内容或娱乐方式" : "卡在哪里？下一次从哪里继续？"} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </div>
        <div className="dialog-footer"><span>{isLifeActivity ? "计入全天记录" : "计入有效学习"}：<strong>{formatMinutes(plannedMinutes)}</strong></span><div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={!form.task.trim() || plannedMinutes <= 0}><Check size={17} />保存记录</button></div></div>
      </form>
    </div>
  );
}

function SessionTable({ sessions, state, onDelete }: { sessions: StudySession[]; state: StudyState; onDelete: (id: string) => void }) {
  return <div className="session-table">{sessions.map((session) => { const subject = state.subjects.find((item) => item.id === session.subjectId); const activity = lifeActivity(session.subjectId); return <div className="session-row" key={session.id}><span className="subject-indicator" style={{ background: subject?.accent ?? activity?.accent }} /><time>{session.start}–{session.end}</time><div><strong>{session.task}</strong><span>{subject?.name ?? activity?.name ?? "其他"}{session.note ? ` · ${session.note}` : ""}</span></div><span className="session-duration">{formatMinutes(session.actualMinutes)}</span><span className="completion-pill">{activity ? "生活" : `${session.completion}%`}</span><button onClick={() => onDelete(session.id)} aria-label="删除记录"><Trash2 size={16} /></button></div>; })}</div>;
}

function DayScheduleChart({ sessions, state, mode }: {
  sessions: StudySession[];
  state: StudyState;
  mode: "planned" | "actual";
}) {
  const durationFor = (session: StudySession) => {
    const stored = mode === "planned" ? session.plannedMinutes : session.actualMinutes;
    return Math.min(24 * 60, Math.max(0, Number(stored) || minutesBetween(session.start, session.end, session.subjectId === "sleep")));
  };
  const chartSessions = sessions.filter((session) => durationFor(session) > 0);
  const hours = [0, 6, 12, 18, 24];

  if (!chartSessions.length) {
    return <div className="schedule-empty">暂无可生成图表的时段，新增记录后会自动绘制。</div>;
  }

  return (
    <div className="day-schedule" aria-label={mode === "planned" ? "今日计划安排图" : "实际时间记录图"}>
      <div className="schedule-axis-label" />
      <div className="schedule-axis">{hours.map((hour) => <span key={hour} style={{ left: `${hour / 24 * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}</div>
      {chartSessions.map((session) => {
        const subject = state.subjects.find((item) => item.id === session.subjectId);
        const activity = lifeActivity(session.subjectId);
        const duration = durationFor(session);
        const start = timeToMinutes(session.start);
        const firstDuration = Math.min(duration, 24 * 60 - start);
        const wrappedDuration = Math.max(0, duration - firstDuration);
        const end = (start + duration) % (24 * 60);
        const endLabel = minutesToTime(end);
        const color = subject?.accent ?? activity?.accent ?? "var(--accent)";
        const title = `${session.task} · ${session.start}–${endLabel} · ${formatMinutes(duration)}`;
        return (
          <div className="schedule-row" key={session.id}>
            <div className="schedule-row-label"><strong>{session.task}</strong><span>{session.start}–{endLabel}</span></div>
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

