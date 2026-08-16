import {
  AlertTriangle,
  Check,
  Clock3,
  Coffee,
  Image as ImageIcon,
  LogOut,
  Palette,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Settings2,
  Square,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { alertDialog, confirmDialog } from "./components/dialogs";
import { compressImageFile } from "./lib/image";
import type { StudySession, StudyState } from "./study-state";
import { findOverlappingSessions } from "./session-time";

type TimerMode = "stopwatch" | "countdown" | "pomodoro";
type TimerStatus = "idle" | "running" | "resting" | "paused" | "finished";
type BuiltInEffectId = "minimal" | "flip" | "glass";
type EffectBase = BuiltInEffectId;
type SettingsDialog = "mode" | "duration" | "effects" | "background" | null;
type BackgroundMode = "auto" | "color" | "gradient" | "image";

type BackgroundSettings = {
  mode: BackgroundMode;
  color: string;
  secondColor: string;
  image: string;
};

type CustomEffect = {
  id: string;
  name: string;
  base: EffectBase;
  foreground: string;
  fontWeight: number;
  lineWidth: number;
  background: BackgroundSettings;
};

type StoredTimer = {
  mode: TimerMode;
  status: TimerStatus;
  effectId: string;
  countdownMinutes: number;
  pomodoroFocusMinutes: number;
  pomodoroBreakMinutes: number;
  flipLineWidth: number;
  customEffects: CustomEffect[];
  builtInBackgrounds: Partial<Record<BuiltInEffectId, BackgroundSettings>>;
  showSecondsByEffect: Record<string, boolean>;
  activeMs: number;
  restMs: number;
  startedAt: number | null;
  endedAt: number | null;
  transitionAt: number | null;
  preset: TimerPreset | null;
};

type TimerPreset = {
  subjectId: string;
  task: string;
  planItemId?: string;
  planDate?: string;
  plannedMinutes?: number;
};

export type TimerLaunchRequest = TimerPreset & {
  id: string;
  planItemId: string;
  planDate: string;
  plannedMinutes: number;
};

type TimerSegment = TimerPreset & {
  id: string;
  start: string;
  end: string;
  completion: number;
  focus: number;
  note: string;
};

const MODE_OPTIONS: { id: TimerMode; label: string; detail: string }[] = [
  { id: "stopwatch", label: "正向计时", detail: "从 00:00:00 开始累计" },
  { id: "countdown", label: "倒计时", detail: "按自定义时长专注" },
  { id: "pomodoro", label: "番茄钟", detail: "自定义专注与休息节奏" },
];

const BUILT_IN_EFFECTS: { id: BuiltInEffectId; label: string; detail: string }[] = [
  { id: "minimal", label: "Apple 双卡", detail: "小时 / 分钟双卡 · 低干扰秒数" },
  { id: "flip", label: "Apple 翻页", detail: "标准数字宽度 · 可调卡片分割线" },
  { id: "glass", label: "Claude 暖纸", detail: "暖象牙色 · 陶土橙与编辑感衬线" },
];

const AUTO_BACKGROUND: BackgroundSettings = {
  mode: "auto",
  color: "#000000",
  secondColor: "#315b78",
  image: "",
};

function isBackground(value: unknown): value is BackgroundSettings {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BackgroundSettings>;
  return (["auto", "color", "gradient", "image"] as BackgroundMode[]).includes(candidate.mode as BackgroundMode)
    && typeof candidate.color === "string"
    && typeof candidate.secondColor === "string"
    && typeof candidate.image === "string";
}

function safeStoredTimer(storageKey: string): StoredTimer | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as Partial<StoredTimer> & { clockStyle?: string } | null;
    if (!parsed || !MODE_OPTIONS.some((item) => item.id === parsed.mode)) return null;
    if (!(["idle", "running", "resting", "paused", "finished"] as TimerStatus[]).includes(parsed.status as TimerStatus)) return null;
    const customEffects = Array.isArray(parsed.customEffects)
      ? parsed.customEffects.filter((effect): effect is CustomEffect => Boolean(effect?.id && effect.name && BUILT_IN_EFFECTS.some((item) => item.id === effect.base) && isBackground(effect.background)))
      : [];
    const legacyEffect = parsed.clockStyle ? "glass" : "minimal";
    const requestedEffect = typeof parsed.effectId === "string" ? parsed.effectId : legacyEffect;
    const effectId = BUILT_IN_EFFECTS.some((item) => item.id === requestedEffect) || customEffects.some((item) => item.id === requestedEffect)
      ? requestedEffect
      : "minimal";
    return {
      mode: parsed.mode as TimerMode,
      status: parsed.status as TimerStatus,
      effectId,
      countdownMinutes: Math.max(1, Number(parsed.countdownMinutes) || 45),
      pomodoroFocusMinutes: Math.max(1, Number(parsed.pomodoroFocusMinutes) || 25),
      pomodoroBreakMinutes: Math.max(1, Number(parsed.pomodoroBreakMinutes) || 5),
      flipLineWidth: Math.max(1, Math.min(16, Number(parsed.flipLineWidth) || 2)),
      customEffects,
      builtInBackgrounds: parsed.builtInBackgrounds && typeof parsed.builtInBackgrounds === "object" ? parsed.builtInBackgrounds : {},
      showSecondsByEffect: parsed.showSecondsByEffect && typeof parsed.showSecondsByEffect === "object"
        ? Object.fromEntries(Object.entries(parsed.showSecondsByEffect).filter(([, value]) => typeof value === "boolean"))
        : {},
      activeMs: Math.max(0, Number(parsed.activeMs) || 0),
      restMs: Math.max(0, Number(parsed.restMs) || 0),
      startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : null,
      endedAt: typeof parsed.endedAt === "number" ? parsed.endedAt : null,
      transitionAt: parsed.status !== "paused" && typeof parsed.transitionAt === "number" ? parsed.transitionAt : null,
      preset: parsed.preset && typeof parsed.preset.subjectId === "string" && typeof parsed.preset.task === "string"
        ? {
            subjectId: parsed.preset.subjectId,
            task: parsed.preset.task,
            planItemId: typeof parsed.preset.planItemId === "string" ? parsed.preset.planItemId : undefined,
            planDate: typeof parsed.preset.planDate === "string" ? parsed.preset.planDate : undefined,
            plannedMinutes: typeof parsed.preset.plannedMinutes === "number" ? parsed.preset.plannedMinutes : undefined,
          }
        : null,
    };
  } catch {
    return null;
  }
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function clockText(milliseconds: number, roundUp = false) {
  const seconds = Math.max(0, roundUp ? Math.ceil(milliseconds / 1000) : Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}`;
}

function shortDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes >= 60) return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
  if (minutes) return `${minutes} 分 ${restSeconds} 秒`;
  return `${restSeconds} 秒`;
}

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function timeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateTimeValue(timestamp: number) {
  const date = new Date(timestamp);
  return `${localDateValue(date)}T${timeValue(date)}`;
}

function minuteFloor(timestamp: number) {
  return Math.floor(timestamp / 60_000) * 60_000;
}

function minuteCeil(timestamp: number) {
  return Math.ceil(timestamp / 60_000) * 60_000;
}

function timerBounds(startedAt: number, endedAt: number) {
  const start = minuteFloor(startedAt);
  return { start, end: Math.max(start + 60_000, minuteCeil(endedAt)) };
}

function timestampValue(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

function dateTimeRangeLabel(start: number, end: number) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return localDateValue(startDate) === localDateValue(endDate)
    ? `${timeValue(startDate)}–${timeValue(endDate)}`
    : `${localDateValue(startDate)} ${timeValue(startDate)}–${localDateValue(endDate)} ${timeValue(endDate)}`;
}

function modeName(mode: TimerMode) {
  return MODE_OPTIONS.find((item) => item.id === mode)?.label ?? "计时器";
}

function effectName(effectId: string, customEffects: CustomEffect[]) {
  return BUILT_IN_EFFECTS.find((item) => item.id === effectId)?.label
    ?? customEffects.find((item) => item.id === effectId)?.name
    ?? "极简数字";
}

function backgroundStyle(background: BackgroundSettings): CSSProperties {
  if (background.mode === "color") return { background: background.color };
  if (background.mode === "gradient") return { background: `linear-gradient(145deg, ${background.color}, ${background.secondColor})` };
  if (background.mode === "image" && background.image) return { backgroundImage: `linear-gradient(rgba(0,0,0,.18), rgba(0,0,0,.18)), url(${JSON.stringify(background.image)})`, backgroundSize: "cover", backgroundPosition: "center" };
  return {};
}

function createTimerSessions({ segments, mode, effectLabel, activeMs, restMs }: {
  segments: TimerSegment[];
  mode: TimerMode;
  effectLabel: string;
  activeMs: number;
  restMs: number;
}): StudySession[] {
  const timerSummary = `${modeName(mode)} · ${effectLabel} · 有效 ${shortDuration(activeMs)} · 暂停休息 ${shortDuration(restMs)}`;
  return [...segments]
    .sort((a, b) => a.start.localeCompare(b.start))
    .flatMap((segment) => {
      const segmentStart = timestampValue(segment.start);
      const segmentEnd = timestampValue(segment.end);
      const sessions: StudySession[] = [];
      let cursor = segmentStart;
      while (cursor < segmentEnd) {
        const cursorDate = new Date(cursor);
        const nextMidnight = new Date(cursorDate);
        nextMidnight.setHours(24, 0, 0, 0);
        const pieceEnd = Math.min(segmentEnd, nextMidnight.getTime());
        const minutes = Math.max(1, Math.round((pieceEnd - cursor) / 60_000));
        sessions.push({
          id: crypto.randomUUID(),
          planItemId: segment.planItemId,
          date: localDateValue(cursorDate),
          start: timeValue(cursorDate),
          end: timeValue(new Date(pieceEnd)),
          subjectId: segment.subjectId,
          task: segment.task.trim(),
          plannedMinutes: minutes,
          actualMinutes: minutes,
          completion: segment.completion,
          focus: segment.focus,
          note: [segment.note.trim(), timerSummary].filter(Boolean).join(" · "),
        });
        cursor = pieceEnd;
      }
      return sessions;
    });
}

export default function TimerView({ state, accountId, launchRequest, onLaunchHandled, onSaveSessions, onExit }: {
  state: StudyState;
  accountId: string;
  sidebarHidden: boolean;
  onSidebarHiddenChange: (hidden: boolean) => void;
  launchRequest: TimerLaunchRequest | null;
  onLaunchHandled: () => void;
  onSaveSessions: (sessions: StudySession[]) => void;
  onExit: () => void;
}) {
  const storageKey = `kaoyan-dashboard-timer-v1:${accountId || "default"}`;
  const initial = useMemo(() => safeStoredTimer(storageKey), [storageKey]);
  const [mode, setMode] = useState<TimerMode>(initial?.mode ?? "stopwatch");
  const [status, setStatus] = useState<TimerStatus>(initial?.status ?? "idle");
  const [effectId, setEffectId] = useState(initial?.effectId ?? "minimal");
  const [countdownMinutes, setCountdownMinutes] = useState(initial?.countdownMinutes ?? 45);
  const [pomodoroFocusMinutes, setPomodoroFocusMinutes] = useState(initial?.pomodoroFocusMinutes ?? 25);
  const [pomodoroBreakMinutes, setPomodoroBreakMinutes] = useState(initial?.pomodoroBreakMinutes ?? 5);
  const [flipLineWidth, setFlipLineWidth] = useState(initial?.flipLineWidth ?? 2);
  const [customEffects, setCustomEffects] = useState<CustomEffect[]>(initial?.customEffects ?? []);
  const [builtInBackgrounds, setBuiltInBackgrounds] = useState<Partial<Record<BuiltInEffectId, BackgroundSettings>>>(initial?.builtInBackgrounds ?? {});
  const [showSecondsByEffect, setShowSecondsByEffect] = useState<Record<string, boolean>>(initial?.showSecondsByEffect ?? {});
  const [activeMs, setActiveMs] = useState(initial?.activeMs ?? 0);
  const [restMs, setRestMs] = useState(initial?.restMs ?? 0);
  const [startedAt, setStartedAt] = useState<number | null>(initial?.startedAt ?? null);
  const [endedAt, setEndedAt] = useState<number | null>(initial?.endedAt ?? null);
  const [transitionAt, setTransitionAt] = useState<number | null>(initial?.transitionAt ?? null);
  const [preset, setPreset] = useState<TimerPreset | null>(initial?.preset ?? null);
  const [now, setNow] = useState(Date.now());
  const [completionOpen, setCompletionOpen] = useState(initial?.status === "finished");
  const [startSetupOpen, setStartSetupOpen] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState<SettingsDialog>(null);
  const [feedback, setFeedback] = useState("");
  const handledLaunchIdRef = useRef("");

  useEffect(() => {
    if (!launchRequest || handledLaunchIdRef.current === launchRequest.id) return;
    handledLaunchIdRef.current = launchRequest.id;
    if (status === "idle") beginTimer(launchRequest);
    else setFeedback(`“${launchRequest.task}”尚未开始：请先结束或清空当前计时。`);
    onLaunchHandled();
    // beginTimer 依赖多个状态/setter,刻意不列入依赖:handledLaunchIdRef 保证只执行一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchRequest, onLaunchHandled, status]);

  useEffect(() => {
    if (status === "idle" || status === "paused" || status === "finished") return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    const snapshot: StoredTimer = {
      mode, status, effectId, countdownMinutes, pomodoroFocusMinutes, pomodoroBreakMinutes,
      flipLineWidth, customEffects, builtInBackgrounds, showSecondsByEffect, activeMs, restMs, startedAt, endedAt, transitionAt, preset,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [storageKey, mode, status, effectId, countdownMinutes, pomodoroFocusMinutes, pomodoroBreakMinutes, flipLineWidth, customEffects, builtInBackgrounds, showSecondsByEffect, activeMs, restMs, startedAt, endedAt, transitionAt, preset]);

  const effectiveActiveMs = activeMs + (status === "running" && transitionAt ? Math.max(0, now - transitionAt) : 0);
  const effectiveRestMs = restMs + (status === "resting" && transitionAt ? Math.max(0, now - transitionAt) : 0);
  const targetMs = mode === "countdown" ? countdownMinutes * 60_000 : mode === "pomodoro" ? pomodoroFocusMinutes * 60_000 : null;
  const remainingMs = targetMs === null ? null : Math.max(0, targetMs - effectiveActiveMs);
  const displayText = clockText(status === "resting" ? effectiveRestMs : effectiveActiveMs);
  const displayParts = displayText.split(":");
  const showSeconds = showSecondsByEffect[effectId] ?? false;
  const visibleDisplayParts = showSeconds ? displayParts : displayParts.slice(0, 2);
  const customEffect = customEffects.find((effect) => effect.id === effectId);
  const effectBase: EffectBase = customEffect?.base ?? (BUILT_IN_EFFECTS.some((item) => item.id === effectId) ? effectId as BuiltInEffectId : "minimal");
  const activeBackground = customEffect?.background ?? builtInBackgrounds[effectBase as BuiltInEffectId] ?? AUTO_BACKGROUND;
  const lineWidth = customEffect?.lineWidth ?? flipLineWidth;
  const stageStyle = {
    ...backgroundStyle(activeBackground),
    "--flip-line-width": `${lineWidth}px`,
    "--custom-clock-color": customEffect?.foreground ?? "currentColor",
    "--custom-clock-weight": customEffect?.fontWeight ?? 300,
  } as CSSProperties;

  useEffect(() => {
    if (status !== "running" || targetMs === null || effectiveActiveMs < targetMs) return;
    const timestamp = Date.now();
    setActiveMs(targetMs); setTransitionAt(null); setEndedAt(timestamp); setNow(timestamp); setStatus("finished"); setCompletionOpen(true);
  }, [status, targetMs, effectiveActiveMs]);

  const dateLabel = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date(now));
  const statusLabel = status === "running" ? "正在专注" : status === "resting" ? "正在休息 · 单独计时" : status === "paused" ? "已暂停 · 计时冻结" : status === "finished" ? "本轮已结束" : "准备开始";

  function beginTimer(nextPreset: TimerPreset | null) {
    if (status !== "idle") return;
    const timestamp = Date.now();
    setPreset(nextPreset && nextPreset.subjectId && nextPreset.task.trim() ? { ...nextPreset, task: nextPreset.task.trim() } : null);
    setStartSetupOpen(false); setFeedback(""); setNow(timestamp); setActiveMs(0); setRestMs(0);
    setStartedAt(timestamp); setEndedAt(null); setTransitionAt(timestamp); setStatus("running");
  }

  function startTimer() {
    if (status === "running" || status === "finished") return;
    const timestamp = Date.now(); setFeedback(""); setNow(timestamp);
    if (status === "idle") { setStartSetupOpen(true); return; }
    if (status === "resting" && transitionAt) setRestMs((value) => value + Math.max(0, timestamp - transitionAt));
    setTransitionAt(timestamp); setStatus("running");
  }

  function startRest() {
    if ((status !== "running" && status !== "paused") || !startedAt) return;
    const timestamp = Date.now(); setFeedback(""); setNow(timestamp);
    if (status === "running" && transitionAt) setActiveMs((value) => value + Math.max(0, timestamp - transitionAt));
    setTransitionAt(timestamp); setStatus("resting");
  }

  function pauseTimer() {
    if ((status !== "running" && status !== "resting") || !transitionAt) return;
    const timestamp = Date.now();
    if (status === "running") setActiveMs((value) => value + Math.max(0, timestamp - transitionAt));
    else setRestMs((value) => value + Math.max(0, timestamp - transitionAt));
    setTransitionAt(null); setNow(timestamp); setStatus("paused");
  }

  function finishTimer() {
    if ((status !== "running" && status !== "resting" && status !== "paused") || effectiveActiveMs < 1000) return;
    const timestamp = Date.now();
    if (status === "running" && transitionAt) setActiveMs((value) => value + Math.max(0, timestamp - transitionAt));
    else if (status === "resting" && transitionAt) setRestMs((value) => value + Math.max(0, timestamp - transitionAt));
    setTransitionAt(null); setEndedAt(timestamp); setNow(timestamp); setStatus("finished"); setCompletionOpen(true);
  }

  function resetTimer(message = "") {
    setStatus("idle"); setActiveMs(0); setRestMs(0); setStartedAt(null); setEndedAt(null); setTransitionAt(null);
    setPreset(null); setStartSetupOpen(false); setCompletionOpen(false); setNow(Date.now()); setFeedback(message);
  }

  function saveCompletion(segments: TimerSegment[]) {
    if (!startedAt || !segments.length) return;
    const sessions = createTimerSessions({ segments, mode, effectLabel: effectName(effectId, customEffects), activeMs, restMs });
    onSaveSessions(sessions);
    resetTimer(`已按最终安排保存 ${sessions.length} 条时间记录`);
  }

  function updateActiveBackground(background: BackgroundSettings) {
    if (customEffect) setCustomEffects((items) => items.map((item) => item.id === customEffect.id ? { ...item, background } : item));
    else setBuiltInBackgrounds((items) => ({ ...items, [effectBase]: background }));
  }

  async function deleteCustomEffect(id: string) {
    if (!await confirmDialog({ title: "删除自定义效果", message: "确定删除这个自定义效果？", danger: true, confirmLabel: "删除" })) return;
    setCustomEffects((items) => items.filter((item) => item.id !== id));
    setShowSecondsByEffect((items) => Object.fromEntries(Object.entries(items).filter(([key]) => key !== id)));
    if (effectId === id) setEffectId("minimal");
  }

  return (
    <div className="focus-timer-page">
      <section className={`focus-clock-stage focus-effect-${effectBase} ${customEffect ? "focus-effect-custom" : ""}`} style={stageStyle} aria-live="polite">
        <header className="focus-stage-topbar">
          <div className="focus-stage-status"><button type="button" onClick={onExit} title="退出专注页" aria-label="退出专注页"><LogOut size={18} /></button><span><i className={`status-${status}`} />{statusLabel}</span></div>
          <div className="focus-settings-buttons">
            <button type="button" onClick={() => setSettingsDialog("mode")}><Settings2 size={17} /><span>{modeName(mode)}</span></button>
            <button type="button" onClick={() => setSettingsDialog("duration")}><TimerReset size={17} /><span>时长</span></button>
            <button type="button" onClick={() => setSettingsDialog("effects")}><Palette size={17} /><span>{effectName(effectId, customEffects)}</span></button>
            <button type="button" className={showSeconds ? "active" : ""} onClick={() => setShowSecondsByEffect((items) => ({ ...items, [effectId]: !showSeconds }))} title={showSeconds ? "隐藏秒数" : "显示精确秒数"} aria-pressed={showSeconds}><Clock3 size={17} /><span>{showSeconds ? "隐藏秒数" : "显示秒数"}</span></button>
            <button type="button" onClick={() => setSettingsDialog("background")}><ImageIcon size={17} /><span>背景</span></button>
          </div>
        </header>

        <div className="focus-clock-face">
          {effectBase === "minimal" && <div className="dual-clock-face"><div className="dual-clock-card"><span>{displayParts[0]}</span></div><div className="dual-clock-card"><span>{displayParts[1]}</span></div>{showSeconds && <small>秒 {displayParts[2]}</small>}</div>}
          {effectBase === "flip" && <div className={`flip-clock-face ${showSeconds ? "with-seconds" : ""}`}>{visibleDisplayParts.map((part, index) => <div className="flip-clock-group" key={`${index}-${part}`}><div className="flip-clock-card"><span>{part}</span></div>{index < visibleDisplayParts.length - 1 && <b>:</b>}</div>)}</div>}
          {effectBase === "glass" && <div className="glass-clock-face"><p>{dateLabel}</p><time>{showSeconds ? displayText : displayText.slice(0, 5)}</time><strong>{modeName(mode)}</strong></div>}
        </div>

        <footer className="focus-stage-footer">
          <div className="focus-session-meta"><span>有效 {clockText(effectiveActiveMs)}</span><span>休息 {clockText(effectiveRestMs)}</span>{preset && <span className="focus-current-task">当前：{preset.task}</span>}{preset?.planItemId && <span>关联计划 · {preset.plannedMinutes ?? 0} 分钟</span>}{remainingMs !== null && <span>剩余 {clockText(remainingMs, true)}</span>}{mode === "pomodoro" && <span>建议休息 {pomodoroBreakMinutes} 分</span>}</div>
          <div className="focus-main-controls">
            <button type="button" className="focus-start" onClick={startTimer} disabled={status === "running" || status === "finished"}><Play size={20} fill="currentColor" /><span>{status === "resting" ? "继续学习" : status === "paused" ? "继续" : "开始"}</span></button>
            <button type="button" onClick={pauseTimer} disabled={status !== "running" && status !== "resting"}><Pause size={19} fill="currentColor" /><span>暂停</span></button>
            <button type="button" className={`focus-rest ${status === "resting" ? "active" : ""}`} onClick={startRest} disabled={status === "idle" || status === "resting" || status === "finished"}><Coffee size={18} /><span>休息</span></button>
            <button type="button" className="focus-finish" onClick={finishTimer} disabled={(status !== "running" && status !== "resting" && status !== "paused") || effectiveActiveMs < 1000}><Square size={17} fill="currentColor" /><span>结束</span></button>
            <button type="button" onClick={async () => { if (status === "idle" || await confirmDialog({ title: "放弃当前计时", message: "确定放弃当前计时？本次时间不会保存。" })) resetTimer("本次计时已清空"); }} disabled={status === "idle"}><RotateCcw size={18} /><span>清空</span></button>
          </div>
          <p>{feedback || "开始时可预设当前任务；结束后可按实际情况确认、修改或拆分记录。"}</p>
        </footer>
      </section>

      {settingsDialog === "mode" && <ModeDialog value={mode} disabled={status !== "idle"} onChange={setMode} onClose={() => setSettingsDialog(null)} />}
      {settingsDialog === "duration" && <DurationDialog mode={mode} disabled={status !== "idle"} countdownMinutes={countdownMinutes} pomodoroFocusMinutes={pomodoroFocusMinutes} pomodoroBreakMinutes={pomodoroBreakMinutes} onCountdown={setCountdownMinutes} onFocus={setPomodoroFocusMinutes} onBreak={setPomodoroBreakMinutes} onClose={() => setSettingsDialog(null)} />}
      {settingsDialog === "effects" && <EffectsDialog effectId={effectId} customEffects={customEffects} flipLineWidth={flipLineWidth} onSelect={setEffectId} onFlipLineWidth={setFlipLineWidth} onAdd={(effect) => { setCustomEffects((items) => [...items, effect]); setEffectId(effect.id); }} onUpdate={(effect) => setCustomEffects((items) => items.map((item) => item.id === effect.id ? effect : item))} onDelete={deleteCustomEffect} onClose={() => setSettingsDialog(null)} />}
      {settingsDialog === "background" && <BackgroundDialog effectLabel={effectName(effectId, customEffects)} value={activeBackground} onSave={updateActiveBackground} onClose={() => setSettingsDialog(null)} />}
      {startSetupOpen && <TimerStartDialog state={state} onCancel={() => setStartSetupOpen(false)} onStart={beginTimer} />}
      {completionOpen && startedAt && <TimerCompletionDialog state={state} preset={preset} activeMs={activeMs} restMs={restMs} startedAt={startedAt} endedAt={endedAt ?? Date.now()} onCancel={() => resetTimer("本次计时已取消，未写入时间记录")} onSave={saveCompletion} />}
    </div>
  );
}

function DialogShell({ title, kicker, onClose, children, footer }: { title: string; kicker: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return <div className="dialog-backdrop timer-settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="timer-settings-dialog" role="dialog" aria-modal="true"><div className="dialog-heading"><div><p className="card-kicker">{kicker}</p><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div><div className="timer-settings-body">{children}</div>{footer && <div className="dialog-footer"><span>修改会保存在当前账号的计时器中。</span><div>{footer}</div></div>}</section></div>;
}

function ModeDialog({ value, disabled, onChange, onClose }: { value: TimerMode; disabled: boolean; onChange: (mode: TimerMode) => void; onClose: () => void }) {
  return <DialogShell title="选择计时模式" kicker="模式" onClose={onClose} footer={<button className="primary-button" type="button" onClick={onClose}>完成</button>}><div className="focus-option-list">{MODE_OPTIONS.map((option) => <button type="button" key={option.id} className={value === option.id ? "active" : ""} disabled={disabled} onClick={() => onChange(option.id)}><span>{option.id === "pomodoro" ? <Coffee size={19} /> : option.id === "countdown" ? <TimerReset size={19} /> : <Clock3 size={19} />}</span><div><strong>{option.label}</strong><small>{option.detail}</small></div>{value === option.id && <Check size={16} />}</button>)}</div>{disabled && <p className="focus-dialog-note">正在计时时不能切换模式，请先结束或清空本轮。</p>}</DialogShell>;
}

function DurationDialog({ mode, disabled, countdownMinutes, pomodoroFocusMinutes, pomodoroBreakMinutes, onCountdown, onFocus, onBreak, onClose }: { mode: TimerMode; disabled: boolean; countdownMinutes: number; pomodoroFocusMinutes: number; pomodoroBreakMinutes: number; onCountdown: (value: number) => void; onFocus: (value: number) => void; onBreak: (value: number) => void; onClose: () => void }) {
  return <DialogShell title="设置本轮时长" kicker="时间" onClose={onClose} footer={<button className="primary-button" type="button" onClick={onClose}>应用</button>}>{mode === "stopwatch" ? <div className="focus-empty-setting"><Clock3 size={24} /><strong>正向计时不设上限</strong><span>从 00:00:00 开始累计，有需要时直接结束。</span></div> : mode === "countdown" ? <><label className="focus-number-field"><span>倒计时分钟</span><input type="number" min="1" max="720" disabled={disabled} value={countdownMinutes} onChange={(event) => onCountdown(Math.max(1, Math.min(720, Number(event.target.value) || 1)))} /></label><div className="focus-presets">{[30,45,60,90].map((value) => <button type="button" key={value} disabled={disabled} className={countdownMinutes === value ? "active" : ""} onClick={() => onCountdown(value)}>{value} 分</button>)}</div></> : <><div className="focus-duration-grid"><label className="focus-number-field"><span>专注分钟</span><input type="number" min="1" max="180" disabled={disabled} value={pomodoroFocusMinutes} onChange={(event) => onFocus(Math.max(1, Math.min(180, Number(event.target.value) || 1)))} /></label><label className="focus-number-field"><span>建议休息</span><input type="number" min="1" max="60" disabled={disabled} value={pomodoroBreakMinutes} onChange={(event) => onBreak(Math.max(1, Math.min(60, Number(event.target.value) || 1)))} /></label></div><div className="focus-presets">{[[25,5],[50,10],[90,15]].map(([focus, rest]) => <button type="button" key={focus} disabled={disabled} className={pomodoroFocusMinutes === focus && pomodoroBreakMinutes === rest ? "active" : ""} onClick={() => { onFocus(focus); onBreak(rest); }}>{focus} / {rest}</button>)}</div></>}</DialogShell>;
}

function EffectsDialog({ effectId, customEffects, flipLineWidth, onSelect, onFlipLineWidth, onAdd, onUpdate, onDelete, onClose }: { effectId: string; customEffects: CustomEffect[]; flipLineWidth: number; onSelect: (id: string) => void; onFlipLineWidth: (value: number) => void; onAdd: (effect: CustomEffect) => void; onUpdate: (effect: CustomEffect) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const selectedCustom = customEffects.find((effect) => effect.id === effectId);
  const selectedBase = selectedCustom?.base ?? effectId;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "我的效果", base: "minimal" as EffectBase, foreground: "#ffffff", background: "#111111", fontWeight: 300, lineWidth: 2 });
  function addEffect() {
    const effect: CustomEffect = { id: `custom-${crypto.randomUUID()}`, name: draft.name.trim() || "我的效果", base: draft.base, foreground: draft.foreground, fontWeight: draft.fontWeight, lineWidth: draft.lineWidth, background: { mode: "color", color: draft.background, secondColor: draft.background, image: "" } };
    onAdd(effect); setAdding(false);
  }
  return <DialogShell title="选择与管理钟表效果" kicker="效果" onClose={onClose} footer={<><button type="button" className="secondary-button" onClick={() => setAdding((value) => !value)}><Plus size={16} />新增效果</button><button type="button" className="primary-button" onClick={onClose}>完成</button></>}><div className="effect-choice-grid">{BUILT_IN_EFFECTS.map((effect) => <button type="button" key={effect.id} className={effectId === effect.id ? "active" : ""} onClick={() => onSelect(effect.id)}><span className={`effect-mini-preview mini-${effect.id}`}>{effect.id === "flip" || effect.id === "minimal" ? <><i>12</i><i>{effect.id === "minimal" ? "07" : "19"}</i></> : "10:04"}</span><strong>{effect.label}</strong><small>{effect.detail}</small>{effectId === effect.id && <Check size={15} />}</button>)}{customEffects.map((effect) => <button type="button" key={effect.id} className={effectId === effect.id ? "active" : ""} onClick={() => onSelect(effect.id)}><span className="effect-mini-preview mini-custom" style={{ color: effect.foreground, background: effect.background.color, fontWeight: effect.fontWeight }}>10:04</span><strong>{effect.name}</strong><small>自定义 · 基于 {BUILT_IN_EFFECTS.find((item) => item.id === effect.base)?.label}</small>{effectId === effect.id && <Check size={15} />}</button>)}</div>{(selectedBase === "flip" || selectedBase === "minimal") && <label className="effect-line-setting"><span>卡片分割线粗细：{selectedCustom?.lineWidth ?? flipLineWidth}px</span><input type="range" min="1" max="16" value={selectedCustom?.lineWidth ?? flipLineWidth} onChange={(event) => selectedCustom ? onUpdate({ ...selectedCustom, lineWidth: Number(event.target.value) }) : onFlipLineWidth(Number(event.target.value))} /></label>}{selectedCustom && <div className="custom-effect-actions"><span>当前是自定义效果，可继续在“背景”按钮中修改背景。</span><button type="button" className="danger-button" onClick={() => onDelete(selectedCustom.id)}><Trash2 size={15} />删除效果</button></div>}{adding && <div className="custom-effect-form"><label><span>效果名称</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label><span>基础布局</span><select value={draft.base} onChange={(event) => setDraft({ ...draft, base: event.target.value as EffectBase })}>{BUILT_IN_EFFECTS.map((effect) => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select></label><label><span>数字颜色</span><input type="color" value={draft.foreground} onChange={(event) => setDraft({ ...draft, foreground: event.target.value })} /></label><label><span>背景颜色</span><input type="color" value={draft.background} onChange={(event) => setDraft({ ...draft, background: event.target.value })} /></label><label><span>字体粗细：{draft.fontWeight}</span><input type="range" min="100" max="800" step="50" value={draft.fontWeight} onChange={(event) => setDraft({ ...draft, fontWeight: Number(event.target.value) })} /></label>{(draft.base === "flip" || draft.base === "minimal") && <label><span>分割线：{draft.lineWidth}px</span><input type="range" min="1" max="16" value={draft.lineWidth} onChange={(event) => setDraft({ ...draft, lineWidth: Number(event.target.value) })} /></label>}<button type="button" className="primary-button" onClick={addEffect}><Plus size={16} />保存并使用</button></div>}</DialogShell>;
}

function BackgroundDialog({ effectLabel, value, onSave, onClose }: { effectLabel: string; value: BackgroundSettings; onSave: (value: BackgroundSettings) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<BackgroundSettings>({ ...value });
  function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    // 压缩到最长边 1280px 再存,避免大图 base64 撑爆 localStorage 配额。
    compressImageFile(file, 1280)
      .then((dataUrl) => setDraft((current) => ({ ...current, mode: "image", image: dataUrl })))
      .catch(() => void alertDialog({ title: "图片处理失败", message: "无法读取这张图片，请换一张再试。" }));
  }
  return <DialogShell title={`设置“${effectLabel}”背景`} kicker="背景" onClose={onClose} footer={<><button type="button" className="secondary-button" onClick={() => setDraft({ ...AUTO_BACKGROUND })}>恢复默认</button><button type="button" className="primary-button" onClick={() => { onSave(draft); onClose(); }}>应用背景</button></>}><div className="background-mode-list">{(["auto","color","gradient","image"] as BackgroundMode[]).map((mode) => <button type="button" key={mode} className={draft.mode === mode ? "active" : ""} onClick={() => setDraft({ ...draft, mode })}>{mode === "auto" ? "跟随效果 / 黑白主题" : mode === "color" ? "纯色" : mode === "gradient" ? "渐变" : "图片"}</button>)}</div>{draft.mode === "color" && <label className="background-color-field"><span>背景颜色</span><input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label>}{draft.mode === "gradient" && <div className="background-color-grid"><label><span>起始颜色</span><input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label><label><span>结束颜色</span><input type="color" value={draft.secondColor} onChange={(event) => setDraft({ ...draft, secondColor: event.target.value })} /></label></div>}{draft.mode === "image" && <div className="background-upload"><label className="secondary-button"><ImageIcon size={16} />选择本地图片<input hidden type="file" accept="image/*" onChange={upload} /></label>{draft.image && <div style={{ backgroundImage: `url(${JSON.stringify(draft.image)})` }} />}</div>}<p className="focus-dialog-note">内置效果在“跟随效果”时会自动适配亮色和暗色主题；自定义背景按你的设置原样显示。</p></DialogShell>;
}

function CategoryOptions({ state, optional = false }: { state: StudyState; optional?: boolean }) {
  return <>{optional && <option value="">暂不选择</option>}<optgroup label="学习科目">{state.subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</optgroup><optgroup label="生活活动">{state.lifeActivities.filter((activity) => activity.active !== false).map((activity) => <option value={activity.id} key={activity.id}>{activity.name}</option>)}</optgroup></>;
}

function TimerStartDialog({ state, onCancel, onStart }: { state: StudyState; onCancel: () => void; onStart: (preset: TimerPreset | null) => void }) {
  const [preset, setPreset] = useState<TimerPreset>({ subjectId: "", task: "" });
  const selectedActivity = state.lifeActivities.find((activity) => activity.id === preset.subjectId && activity.active !== false);
  const complete = Boolean(preset.subjectId && preset.task.trim());

  function changeCategory(subjectId: string) {
    const previousActivity = state.lifeActivities.find((activity) => activity.id === preset.subjectId && activity.active !== false);
    const nextActivity = state.lifeActivities.find((activity) => activity.id === subjectId && activity.active !== false);
    const canAutofill = !preset.task.trim() || preset.task === previousActivity?.name;
    setPreset({ subjectId, task: canAutofill ? nextActivity?.name ?? "" : preset.task });
  }

  return <div className="dialog-backdrop timer-settings-backdrop" role="presentation">
    <section className="timer-settings-dialog timer-start-dialog" role="dialog" aria-modal="true" aria-labelledby="timer-start-title">
      <div className="dialog-heading"><div><p className="card-kicker">开始前 · 可选</p><h2 id="timer-start-title">当前正在做什么？</h2></div><button type="button" onClick={onCancel} aria-label="返回计时器"><X size={20} /></button></div>
      <p className="timer-dialog-intro">提前写下本轮任务，结束时可以直接确认保存；也可以跳过，结束后再补充或拆分。</p>
      <div className="dialog-grid">
        <label><span>科目 / 活动</span><select value={preset.subjectId} onChange={(event) => changeCategory(event.target.value)}><CategoryOptions state={state} optional /></select></label>
        <label><span>{selectedActivity ? "活动内容" : "任务名称"}</span><input autoFocus placeholder={selectedActivity ? `例如：${selectedActivity.name}` : "例如：电路原理强化课第 3 讲"} value={preset.task} onChange={(event) => setPreset({ ...preset, task: event.target.value })} /></label>
      </div>
      {(preset.subjectId || preset.task.trim()) && !complete && <div className="timer-validation-message"><AlertTriangle size={16} /><span>要带着预设开始，请同时选择类别并填写任务；也可以直接跳过本次填写。</span></div>}
      <div className="dialog-footer"><span>预设只属于本轮计时，可在结束后修改。</span><div><button type="button" className="secondary-button" onClick={() => onStart(null)}>不填写，直接开始</button><button type="button" className="primary-button" disabled={!complete} onClick={() => onStart(preset)}><Play size={16} fill="currentColor" />带着任务开始</button></div></div>
    </section>
  </div>;
}

function analyzeSegments(segments: TimerSegment[], boundStart: number, boundEnd: number, existingSessions: StudySession[]) {
  const invalidIds = new Set<string>();
  const fieldInvalidIds = new Set<string>();
  const existingConflicts = new Map<string, StudySession[]>();
  const timed = segments.map((segment) => ({ segment, start: timestampValue(segment.start), end: timestampValue(segment.end) }));
  for (const item of timed) {
    if (!Number.isFinite(item.start) || !Number.isFinite(item.end) || item.start >= item.end || item.start < boundStart || item.end > boundEnd || !item.segment.subjectId || !item.segment.task.trim()) {
      invalidIds.add(item.segment.id);
      fieldInvalidIds.add(item.segment.id);
      continue;
    }
    const conflicts = findOverlappingSessions({ start: item.start, end: item.end }, existingSessions);
    if (conflicts.length) {
      invalidIds.add(item.segment.id);
      existingConflicts.set(item.segment.id, conflicts);
    }
  }
  const ordered = timed.filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.start < item.end).sort((a, b) => a.start - b.start);
  let overlap = false;
  let furthest = ordered[0];
  for (let index = 1; index < ordered.length; index += 1) {
    if (furthest && ordered[index].start < furthest.end) {
      overlap = true;
      invalidIds.add(ordered[index].segment.id);
      invalidIds.add(furthest.segment.id);
    }
    if (!furthest || ordered[index].end > furthest.end) furthest = ordered[index];
  }
  const gaps: { start: number; end: number }[] = [];
  let cursor = boundStart;
  for (const item of ordered) {
    const clippedStart = Math.max(boundStart, item.start);
    const clippedEnd = Math.min(boundEnd, item.end);
    if (clippedStart > cursor) gaps.push({ start: cursor, end: clippedStart });
    cursor = Math.max(cursor, clippedEnd);
  }
  if (cursor < boundEnd) gaps.push({ start: cursor, end: boundEnd });
  return { invalidIds, fieldInvalidIds, overlap, gaps, existingConflicts };
}

function TimerCompletionDialog({ state, preset, activeMs, restMs, startedAt, endedAt, onCancel, onSave }: { state: StudyState; preset: TimerPreset | null; activeMs: number; restMs: number; startedAt: number; endedAt: number; onCancel: () => void; onSave: (segments: TimerSegment[]) => void }) {
  const bounds = useMemo(() => timerBounds(startedAt, endedAt), [startedAt, endedAt]);
  const firstActivity = state.lifeActivities.find((activity) => activity.active !== false);
  const defaultSubjectId = preset?.subjectId ?? state.subjects[0]?.id ?? firstActivity?.id ?? "";
  const [phase, setPhase] = useState<"confirm" | "edit">(preset?.subjectId && preset.task.trim() ? "confirm" : "edit");
  const [segments, setSegments] = useState<TimerSegment[]>([{
    id: crypto.randomUUID(),
    planItemId: preset?.planItemId,
    planDate: preset?.planDate,
    plannedMinutes: preset?.plannedMinutes,
    start: dateTimeValue(bounds.start),
    end: dateTimeValue(bounds.end),
    subjectId: defaultSubjectId,
    task: preset?.task ?? "",
    completion: 100,
    focus: 5,
    note: "",
  }]);
  const [allowGaps, setAllowGaps] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const analysis = useMemo(() => analyzeSegments(segments, bounds.start, bounds.end, state.sessions), [segments, bounds.start, bounds.end, state.sessions]);
  const canSave = segments.length > 0 && analysis.invalidIds.size === 0 && !analysis.overlap && (!analysis.gaps.length || allowGaps);
  const conflictingSessions = [...new Map([...analysis.existingConflicts.values()].flat().map((session) => [session.id, session])).values()];
  const presetCategory = state.subjects.find((subject) => subject.id === preset?.subjectId)?.name ?? state.lifeActivities.find((activity) => activity.id === preset?.subjectId)?.name ?? "未分类";

  function updateSegment(id: string, patch: Partial<TimerSegment>) {
    setSegments((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
    setEditMessage("");
  }

  function changeCategory(segment: TimerSegment, subjectId: string) {
    const previousActivity = state.lifeActivities.find((activity) => activity.id === segment.subjectId && activity.active !== false);
    const nextActivity = state.lifeActivities.find((activity) => activity.id === subjectId && activity.active !== false);
    const canAutofill = !segment.task.trim() || segment.task === previousActivity?.name;
    updateSegment(segment.id, { subjectId, task: canAutofill ? nextActivity?.name ?? "" : segment.task });
  }

  function splitSegment(segment: TimerSegment) {
    const start = timestampValue(segment.start);
    const end = timestampValue(segment.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 2 * 60_000) {
      setEditMessage("这个时间段不足 2 分钟，无法继续拆分。");
      return;
    }
    const midpoint = start + Math.floor((end - start) / 120_000) * 60_000;
    const next: TimerSegment = { ...segment, id: crypto.randomUUID(), start: dateTimeValue(midpoint), task: segment.planItemId ? segment.task : "", note: "" };
    setSegments((items) => items.flatMap((item) => item.id === segment.id ? [{ ...item, end: dateTimeValue(midpoint) }, next] : [item]));
    setEditMessage("");
  }

  function addSegment() {
    const gap = analysis.gaps.find((item) => item.end - item.start >= 60_000);
    if (gap) {
      setSegments((items) => [...items, { id: crypto.randomUUID(), planItemId: preset?.planItemId, planDate: preset?.planDate, plannedMinutes: preset?.plannedMinutes, start: dateTimeValue(gap.start), end: dateTimeValue(gap.end), subjectId: defaultSubjectId, task: preset?.planItemId ? preset.task : "", completion: 100, focus: 5, note: "" }]);
      setEditMessage("");
      return;
    }
    const longest = [...segments].sort((a, b) => (timestampValue(b.end) - timestampValue(b.start)) - (timestampValue(a.end) - timestampValue(a.start)))[0];
    if (longest) splitSegment(longest);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (canSave) onSave([...segments].sort((a, b) => a.start.localeCompare(b.start)));
  }

  if (phase === "confirm" && preset) {
    return <div className="dialog-backdrop" role="presentation">
      <section className="record-dialog timer-completion-dialog timer-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="timer-confirm-title">
        <div className="dialog-heading"><div><p className="card-kicker">本轮已停止</p><h2 id="timer-confirm-title">是否需要修改本次记录？</h2></div><button type="button" onClick={onCancel} aria-label="取消记录"><X size={20} /></button></div>
        <div className="timer-session-summary"><div><span>完整时段</span><strong>{dateTimeRangeLabel(bounds.start, bounds.end)}</strong></div><div><span>科目 / 活动</span><strong>{presetCategory}</strong></div><div><span>本轮有效计时</span><strong>{shortDuration(activeMs)}</strong></div></div>
        <div className="timer-preset-review"><span className="subject-indicator" /><div><small>{preset.planItemId ? "将保存并关联回原计划" : "将按以下信息保存"}</small><strong>{preset.task}</strong><span>{dateTimeRangeLabel(bounds.start, bounds.end)} · {presetCategory}{preset.planItemId ? ` · 计划 ${preset.plannedMinutes ?? 0} 分钟` : ""}</span></div></div>
        {conflictingSessions.length > 0 && <div className="record-conflict-warning" role="alert"><AlertTriangle size={18} /><div><strong>这段时间与已有记录重叠</strong>{conflictingSessions.map((session) => <span key={session.id}>{session.date} {session.start}–{session.end} · {session.task}</span>)}<small>请选择“是，修改记录”并调整时间段后再保存。</small></div></div>}
        {restMs > 0 && <div className="timer-rest-notice"><Coffee size={17} /><span>本轮曾使用休息计时（累计 {shortDuration(restMs)}）。如需把休息单独记录，请选择“是”并拆分实际时段。</span></div>}
        <div className="dialog-footer"><span>{conflictingSessions.length ? "已有记录保持不变，请先修改本次时段。" : "选择“否”会直接保存这一整段；选择“是”可修改或拆分。"}</span><div><button type="button" className="secondary-button" onClick={() => setPhase("edit")}><Scissors size={16} />是，修改记录</button><button type="button" className="primary-button" disabled={conflictingSessions.length > 0} onClick={() => onSave(segments)}><Check size={17} />否，直接保存</button></div></div>
      </section>
    </div>;
  }

  return <div className="dialog-backdrop" role="presentation">
    <form className="record-dialog timer-completion-dialog timer-segment-dialog" onSubmit={submit}>
      <div className="dialog-heading"><div><p className="card-kicker">{preset ? "按实际情况修正" : "本轮尚未填写活动"}</p><h2>{preset ? "编辑本次计时记录" : "这段时间你在做什么？"}</h2></div><button type="button" onClick={onCancel} aria-label="取消记录"><X size={20} /></button></div>
      <div className="timer-session-summary"><div><span>可分配范围</span><strong>{dateTimeRangeLabel(bounds.start, bounds.end)}</strong></div><div><span>有效计时</span><strong>{shortDuration(activeMs)}</strong></div><div><span>暂停 / 休息</span><strong>{shortDuration(restMs)}</strong></div></div>
      {preset?.planItemId && <div className="timer-linked-plan-note"><Check size={16} /><span>下面所有拆分时间段都会关联回 {preset.planDate} 的“{preset.task}”。</span></div>}
      <div className="timer-segment-toolbar"><div><strong>最终时间段</strong><span>修改整段，或拆成多个真实活动；这里只保存下面的最终结果。</span></div><button type="button" className="secondary-button" onClick={addSegment}><Plus size={16} />添加时间段</button></div>
      <div className="timer-segment-list">
        {segments.map((segment, index) => {
          const selectedActivity = state.lifeActivities.find((activity) => activity.id === segment.subjectId && activity.active !== false);
          const isInvalid = analysis.invalidIds.has(segment.id);
          const duration = timestampValue(segment.end) - timestampValue(segment.start);
          return <section className={`timer-segment-card ${isInvalid ? "invalid" : ""}`} key={segment.id}>
            <header><div><span>{String(index + 1).padStart(2, "0")}</span><div><strong>时间段 {index + 1}</strong><small>{Number.isFinite(duration) && duration > 0 ? shortDuration(duration) : "请检查起止时间"}</small></div></div><div><button type="button" onClick={() => splitSegment(segment)} title="从中间拆分"><Scissors size={15} />拆分</button><button type="button" onClick={() => setSegments((items) => items.filter((item) => item.id !== segment.id))} title="删除时间段"><Trash2 size={15} /></button></div></header>
            <div className="timer-segment-fields">
              <label><span>开始</span><input type="datetime-local" min={dateTimeValue(bounds.start)} max={dateTimeValue(bounds.end)} value={segment.start} onChange={(event) => updateSegment(segment.id, { start: event.target.value })} /></label>
              <label><span>结束</span><input type="datetime-local" min={dateTimeValue(bounds.start)} max={dateTimeValue(bounds.end)} value={segment.end} onChange={(event) => updateSegment(segment.id, { end: event.target.value })} /></label>
              <label><span>科目 / 活动</span><select value={segment.subjectId} onChange={(event) => changeCategory(segment, event.target.value)}><CategoryOptions state={state} optional /></select></label>
              <label><span>{selectedActivity ? "活动内容" : "任务名称"}</span><input placeholder={selectedActivity ? `例如：${selectedActivity.name}` : "填写本时段的真实任务"} value={segment.task} onChange={(event) => updateSegment(segment.id, { task: event.target.value })} /></label>
              {!selectedActivity && <label><span>完成度：{segment.completion}%</span><input type="range" min="0" max="100" step="5" value={segment.completion} onChange={(event) => updateSegment(segment.id, { completion: Number(event.target.value) })} /></label>}
              {!selectedActivity && <label><span>专注度：{segment.focus} / 5</span><input type="range" min="1" max="5" value={segment.focus} onChange={(event) => updateSegment(segment.id, { focus: Number(event.target.value) })} /></label>}
              <label className="wide"><span>备注（可选）</span><textarea placeholder="完成情况、休息方式或下一步" value={segment.note} onChange={(event) => updateSegment(segment.id, { note: event.target.value })} /></label>
            </div>
          </section>;
        })}
      </div>
      {(analysis.overlap || analysis.fieldInvalidIds.size > 0 || editMessage) && <div className="timer-validation-message error"><AlertTriangle size={17} /><span>{editMessage || (analysis.overlap ? "时间段存在重叠，请调整起止时间后再保存。" : "每段都必须位于本轮范围内，并填写有效的类别、任务和起止时间。")}</span></div>}
      {conflictingSessions.length > 0 && <div className="record-conflict-warning" role="alert"><AlertTriangle size={18} /><div><strong>本次分段与已有记录重叠</strong>{conflictingSessions.map((session) => <span key={session.id}>{session.date} {session.start}–{session.end} · {session.task}</span>)}<small>请调整标红时间段；已有记录不会被覆盖或重复统计。</small></div></div>}
      {analysis.gaps.length > 0 && <div className="timer-gap-panel"><div><AlertTriangle size={17} /><div><strong>还有未分配时间</strong>{analysis.gaps.map((gap) => <span key={`${gap.start}-${gap.end}`}>{dateTimeRangeLabel(gap.start, gap.end)} 尚未分配活动</span>)}</div></div><label><input type="checkbox" checked={allowGaps} onChange={(event) => setAllowGaps(event.target.checked)} /><span>明确将以上时段标记为“未记录”，不写入统计</span></label></div>}
      <div className="dialog-footer"><span>{analysis.gaps.length ? "补齐空档，或明确标记为未记录后保存。" : `共 ${segments.length} 个时间段，将分别写入每日记录。`}</span><div><button type="button" className="secondary-button" onClick={onCancel}>取消记录</button><button type="submit" className="primary-button" disabled={!canSave}><Check size={17} />保存最终记录</button></div></div>
    </form>
  </div>;
}
