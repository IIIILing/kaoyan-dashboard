import {
  Check,
  Clock3,
  Coffee,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  RotateCcw,
  Square,
  TimerReset,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { StudySession, StudyState } from "./study-state";

type TimerMode = "stopwatch" | "countdown" | "pomodoro";
type TimerStatus = "idle" | "running" | "paused" | "finished";
type ClockStyle = "mist" | "midnight" | "sunrise";

type StoredTimer = {
  mode: TimerMode;
  status: TimerStatus;
  clockStyle: ClockStyle;
  countdownMinutes: number;
  pomodoroFocusMinutes: number;
  pomodoroBreakMinutes: number;
  activeMs: number;
  restMs: number;
  startedAt: number | null;
  endedAt: number | null;
  transitionAt: number | null;
};

type CompletionForm = {
  subjectId: string;
  task: string;
  completion: number;
  focus: number;
  note: string;
};

const MODE_OPTIONS: { id: TimerMode; label: string; detail: string }[] = [
  { id: "stopwatch", label: "正向计时", detail: "从 00:00:00 开始累计" },
  { id: "countdown", label: "倒计时", detail: "按自定义时长专注" },
  { id: "pomodoro", label: "番茄钟", detail: "自定义专注与休息节奏" },
];

const CLOCK_STYLES: { id: ClockStyle; label: string; detail: string }[] = [
  { id: "mist", label: "云雾玻璃", detail: "轻盈通透的锁屏质感" },
  { id: "midnight", label: "午夜霓光", detail: "深色高对比数字钟" },
  { id: "sunrise", label: "日光渐变", detail: "温暖柔和的桌面色彩" },
];

function safeStoredTimer(storageKey: string): StoredTimer | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as Partial<StoredTimer> | null;
    if (!parsed || !MODE_OPTIONS.some((item) => item.id === parsed.mode)) return null;
    if (!CLOCK_STYLES.some((item) => item.id === parsed.clockStyle)) return null;
    if (!(["idle", "running", "paused", "finished"] as TimerStatus[]).includes(parsed.status as TimerStatus)) return null;
    return {
      mode: parsed.mode as TimerMode,
      status: parsed.status as TimerStatus,
      clockStyle: parsed.clockStyle as ClockStyle,
      countdownMinutes: Math.max(1, Number(parsed.countdownMinutes) || 45),
      pomodoroFocusMinutes: Math.max(1, Number(parsed.pomodoroFocusMinutes) || 25),
      pomodoroBreakMinutes: Math.max(1, Number(parsed.pomodoroBreakMinutes) || 5),
      activeMs: Math.max(0, Number(parsed.activeMs) || 0),
      restMs: Math.max(0, Number(parsed.restMs) || 0),
      startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : null,
      endedAt: typeof parsed.endedAt === "number" ? parsed.endedAt : null,
      transitionAt: typeof parsed.transitionAt === "number" ? parsed.transitionAt : null,
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

function modeName(mode: TimerMode) {
  return MODE_OPTIONS.find((item) => item.id === mode)?.label ?? "计时器";
}

function styleName(style: ClockStyle) {
  return CLOCK_STYLES.find((item) => item.id === style)?.label ?? "桌面钟表";
}

function createTimerSessions({
  form,
  mode,
  clockStyle,
  activeMs,
  restMs,
  startedAt,
}: {
  form: CompletionForm;
  mode: TimerMode;
  clockStyle: ClockStyle;
  activeMs: number;
  restMs: number;
  startedAt: number;
}): StudySession[] {
  const activeMinutes = Math.max(1, Math.ceil(activeMs / 60_000));
  const restMinutes = restMs > 0 ? Math.max(1, Math.ceil(restMs / 60_000)) : 0;
  const studyStart = new Date(startedAt);
  const studyEnd = new Date(studyStart.getTime() + activeMinutes * 60_000);
  const timerSummary = `${modeName(mode)} · ${styleName(clockStyle)} · 有效 ${shortDuration(activeMs)} · 暂停休息 ${shortDuration(restMs)}`;
  const study: StudySession = {
    id: crypto.randomUUID(),
    date: localDateValue(studyStart),
    start: timeValue(studyStart),
    end: timeValue(studyEnd),
    subjectId: form.subjectId,
    task: form.task.trim(),
    plannedMinutes: activeMinutes,
    actualMinutes: activeMinutes,
    completion: form.completion,
    focus: form.focus,
    note: [form.note.trim(), timerSummary].filter(Boolean).join(" · "),
  };
  if (!restMinutes) return [study];
  const restStart = studyEnd;
  const restEnd = new Date(restStart.getTime() + restMinutes * 60_000);
  const rest: StudySession = {
    id: crypto.randomUUID(),
    date: localDateValue(restStart),
    start: timeValue(restStart),
    end: timeValue(restEnd),
    subjectId: "rest",
    task: "计时暂停",
    plannedMinutes: restMinutes,
    actualMinutes: restMinutes,
    completion: 100,
    focus: 5,
    note: `计时器自动归入休息 · 累计 ${shortDuration(restMs)}`,
  };
  return [study, rest];
}

export default function TimerView({
  state,
  accountId,
  sidebarHidden,
  onSidebarHiddenChange,
  onSaveSessions,
}: {
  state: StudyState;
  accountId: string;
  sidebarHidden: boolean;
  onSidebarHiddenChange: (hidden: boolean) => void;
  onSaveSessions: (sessions: StudySession[]) => void;
}) {
  const storageKey = `kaoyan-dashboard-timer-v1:${accountId || "default"}`;
  const initial = useMemo(() => safeStoredTimer(storageKey), [storageKey]);
  const [mode, setMode] = useState<TimerMode>(initial?.mode ?? "stopwatch");
  const [status, setStatus] = useState<TimerStatus>(initial?.status ?? "idle");
  const [clockStyle, setClockStyle] = useState<ClockStyle>(initial?.clockStyle ?? "mist");
  const [countdownMinutes, setCountdownMinutes] = useState(initial?.countdownMinutes ?? 45);
  const [pomodoroFocusMinutes, setPomodoroFocusMinutes] = useState(initial?.pomodoroFocusMinutes ?? 25);
  const [pomodoroBreakMinutes, setPomodoroBreakMinutes] = useState(initial?.pomodoroBreakMinutes ?? 5);
  const [activeMs, setActiveMs] = useState(initial?.activeMs ?? 0);
  const [restMs, setRestMs] = useState(initial?.restMs ?? 0);
  const [startedAt, setStartedAt] = useState<number | null>(initial?.startedAt ?? null);
  const [endedAt, setEndedAt] = useState<number | null>(initial?.endedAt ?? null);
  const [transitionAt, setTransitionAt] = useState<number | null>(initial?.transitionAt ?? null);
  const [now, setNow] = useState(Date.now());
  const [completionOpen, setCompletionOpen] = useState(initial?.status === "finished");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (status === "idle" || status === "finished") return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    const snapshot: StoredTimer = {
      mode,
      status,
      clockStyle,
      countdownMinutes,
      pomodoroFocusMinutes,
      pomodoroBreakMinutes,
      activeMs,
      restMs,
      startedAt,
      endedAt,
      transitionAt,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [storageKey, mode, status, clockStyle, countdownMinutes, pomodoroFocusMinutes, pomodoroBreakMinutes, activeMs, restMs, startedAt, endedAt, transitionAt]);

  const effectiveActiveMs = activeMs + (status === "running" && transitionAt ? Math.max(0, now - transitionAt) : 0);
  const effectiveRestMs = restMs + (status === "paused" && transitionAt ? Math.max(0, now - transitionAt) : 0);
  const targetMs = mode === "countdown"
    ? countdownMinutes * 60_000
    : mode === "pomodoro"
      ? pomodoroFocusMinutes * 60_000
      : null;
  const displayedMs = targetMs === null ? effectiveActiveMs : Math.max(0, targetMs - effectiveActiveMs);
  const isConfigured = targetMs === null || targetMs > 0;

  useEffect(() => {
    if (status !== "running" || targetMs === null || effectiveActiveMs < targetMs) return;
    const timestamp = Date.now();
    setActiveMs(targetMs);
    setTransitionAt(null);
    setEndedAt(timestamp);
    setNow(timestamp);
    setStatus("finished");
    setCompletionOpen(true);
  }, [status, targetMs, effectiveActiveMs]);

  const dateLabel = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(now));
  const statusLabel = status === "running"
    ? "正在专注"
    : status === "paused"
      ? "已暂停 · 此段时间计入休息"
      : status === "finished"
        ? "本轮已结束"
        : "准备开始";

  function startTimer() {
    if (status === "running" || status === "finished" || !isConfigured) return;
    const timestamp = Date.now();
    setFeedback("");
    setNow(timestamp);
    if (status === "idle") {
      setActiveMs(0);
      setRestMs(0);
      setStartedAt(timestamp);
      setEndedAt(null);
    } else if (status === "paused" && transitionAt) {
      setRestMs((value) => value + Math.max(0, timestamp - transitionAt));
    }
    setTransitionAt(timestamp);
    setStatus("running");
  }

  function pauseTimer() {
    if (status !== "running" || !transitionAt) return;
    const timestamp = Date.now();
    setActiveMs((value) => value + Math.max(0, timestamp - transitionAt));
    setTransitionAt(timestamp);
    setNow(timestamp);
    setStatus("paused");
  }

  function finishTimer() {
    if ((status !== "running" && status !== "paused") || !transitionAt || effectiveActiveMs < 1000) return;
    const timestamp = Date.now();
    if (status === "running") setActiveMs((value) => value + Math.max(0, timestamp - transitionAt));
    else setRestMs((value) => value + Math.max(0, timestamp - transitionAt));
    setTransitionAt(null);
    setEndedAt(timestamp);
    setNow(timestamp);
    setStatus("finished");
    setCompletionOpen(true);
  }

  function resetTimer(message = "") {
    setStatus("idle");
    setActiveMs(0);
    setRestMs(0);
    setStartedAt(null);
    setEndedAt(null);
    setTransitionAt(null);
    setCompletionOpen(false);
    setNow(Date.now());
    setFeedback(message);
  }

  function changeMode(nextMode: TimerMode) {
    if (status !== "idle") return;
    setMode(nextMode);
    setFeedback("");
  }

  function saveCompletion(form: CompletionForm) {
    if (!startedAt || !form.task.trim()) return;
    const sessions = createTimerSessions({
      form,
      mode,
      clockStyle,
      activeMs,
      restMs,
      startedAt,
    });
    onSaveSessions(sessions);
    const restMessage = restMs > 0 ? `，暂停 ${shortDuration(restMs)} 已归入休息` : "";
    resetTimer(`已保存 ${shortDuration(activeMs)} 的学习记录${restMessage}`);
  }

  return (
    <div className="timer-page page-stack">
      <section className="timer-intro panel">
        <div>
          <p className="card-kicker">专注桌面</p>
          <h2>把时间留给眼前这一件事</h2>
          <p>暂停时间会累计到“休息”；结束后先填写科目和内容，再决定保存或取消。任何模式结束都不会自动开启下一轮。</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onSidebarHiddenChange(!sidebarHidden)}>
          {sidebarHidden ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {sidebarHidden ? "展开侧栏" : "隐藏侧栏专注"}
        </button>
      </section>

      <section className="timer-mode-tabs" aria-label="计时模式">
        {MODE_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.id}
            className={mode === option.id ? "active" : ""}
            onClick={() => changeMode(option.id)}
            disabled={status !== "idle"}
          >
            <span>{option.id === "pomodoro" ? <Coffee size={18} /> : option.id === "countdown" ? <TimerReset size={18} /> : <Clock3 size={18} />}</span>
            <div><strong>{option.label}</strong><small>{option.detail}</small></div>
          </button>
        ))}
      </section>

      <div className="timer-workspace">
        <section className={`desktop-clock clock-${clockStyle}`} aria-live="polite">
          <div className="desktop-clock-top">
            <span>FOCUS DESK</span>
            <span>{modeName(mode)}</span>
          </div>
          <div className="desktop-clock-center">
            <p>{dateLabel}</p>
            <time>{clockText(displayedMs, targetMs !== null)}</time>
            <strong className={`timer-status status-${status}`}><i />{statusLabel}</strong>
          </div>
          <div className="desktop-clock-bottom">
            <div><span>有效专注</span><strong>{clockText(effectiveActiveMs)}</strong></div>
            <div><span>暂停 / 休息</span><strong>{clockText(effectiveRestMs)}</strong></div>
            {mode === "pomodoro" && <div><span>建议轮间休息</span><strong>{pomodoroBreakMinutes} 分钟</strong></div>}
          </div>
        </section>

        <aside className="timer-side-panel">
          <section className="timer-config-card panel">
            <div className="timer-card-heading"><div><p className="card-kicker">本轮设置</p><h3>{modeName(mode)}</h3></div><TimerReset size={18} /></div>
            {mode === "stopwatch" && <p className="timer-config-copy">不设上限，从零开始记录有效专注时间。暂停后计时停止，暂停时长进入休息累计。</p>}
            {mode === "countdown" && (
              <>
                <label className="timer-number-field"><span>倒计时分钟</span><input type="number" min="1" max="720" disabled={status !== "idle"} value={countdownMinutes} onChange={(event) => setCountdownMinutes(Math.max(1, Math.min(720, Number(event.target.value) || 1)))} /></label>
                <div className="timer-presets">{[30, 45, 60, 90].map((value) => <button type="button" key={value} disabled={status !== "idle"} className={countdownMinutes === value ? "active" : ""} onClick={() => setCountdownMinutes(value)}>{value} 分</button>)}</div>
              </>
            )}
            {mode === "pomodoro" && (
              <>
                <div className="pomodoro-fields">
                  <label className="timer-number-field"><span>专注分钟</span><input type="number" min="1" max="180" disabled={status !== "idle"} value={pomodoroFocusMinutes} onChange={(event) => setPomodoroFocusMinutes(Math.max(1, Math.min(180, Number(event.target.value) || 1)))} /></label>
                  <label className="timer-number-field"><span>建议休息</span><input type="number" min="1" max="60" disabled={status !== "idle"} value={pomodoroBreakMinutes} onChange={(event) => setPomodoroBreakMinutes(Math.max(1, Math.min(60, Number(event.target.value) || 1)))} /></label>
                </div>
                <div className="timer-presets pomodoro-presets">
                  {[[25, 5], [50, 10], [90, 15]].map(([focus, rest]) => <button type="button" key={focus} disabled={status !== "idle"} className={pomodoroFocusMinutes === focus && pomodoroBreakMinutes === rest ? "active" : ""} onClick={() => { setPomodoroFocusMinutes(focus); setPomodoroBreakMinutes(rest); }}>{focus} / {rest}</button>)}
                </div>
                <p className="timer-config-note">专注归零后只提醒并打开记录弹窗，不会自动开始休息或下一轮。</p>
              </>
            )}
          </section>

          <section className="timer-style-card panel">
            <div className="timer-card-heading"><div><p className="card-kicker">钟表样式</p><h3>选择桌面氛围</h3></div></div>
            <div className="clock-style-list">
              {CLOCK_STYLES.map((option) => <button type="button" key={option.id} className={clockStyle === option.id ? "active" : ""} onClick={() => setClockStyle(option.id)}><span className={`clock-style-preview preview-${option.id}`}>09:41</span><div><strong>{option.label}</strong><small>{option.detail}</small></div>{clockStyle === option.id && <Check size={15} />}</button>)}
            </div>
          </section>
        </aside>
      </div>

      <section className="timer-controls panel">
        <div className="timer-control-buttons">
          <button type="button" className="timer-start" onClick={startTimer} disabled={status === "running" || status === "finished"}><Play size={20} fill="currentColor" />{status === "paused" ? "继续" : "开始"}</button>
          <button type="button" onClick={pauseTimer} disabled={status !== "running"}><Pause size={20} fill="currentColor" />暂停</button>
          <button type="button" className="timer-finish" onClick={finishTimer} disabled={(status !== "running" && status !== "paused") || effectiveActiveMs < 1000}><Square size={18} fill="currentColor" />结束</button>
          <button type="button" className="timer-reset" onClick={() => (status === "idle" || window.confirm("确定放弃当前计时？本次时间不会保存。")) && resetTimer("本次计时已清空") } disabled={status === "idle"}><RotateCcw size={18} />清空</button>
        </div>
        <p>{feedback || (status === "paused" ? `本次已累计休息 ${shortDuration(effectiveRestMs)}` : "结束计时后才会询问学习科目和内容")}</p>
      </section>

      {completionOpen && startedAt && (
        <TimerCompletionDialog
          state={state}
          activeMs={activeMs}
          restMs={restMs}
          startedAt={startedAt}
          endedAt={endedAt ?? Date.now()}
          onCancel={() => resetTimer("本次计时已取消，未写入时间记录")}
          onSave={saveCompletion}
        />
      )}
    </div>
  );
}

function TimerCompletionDialog({
  state,
  activeMs,
  restMs,
  startedAt,
  endedAt,
  onCancel,
  onSave,
}: {
  state: StudyState;
  activeMs: number;
  restMs: number;
  startedAt: number;
  endedAt: number;
  onCancel: () => void;
  onSave: (form: CompletionForm) => void;
}) {
  const [form, setForm] = useState<CompletionForm>({
    subjectId: state.subjects[0]?.id ?? "math",
    task: "",
    completion: 100,
    focus: 5,
    note: "",
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.task.trim()) return;
    onSave(form);
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <form className="record-dialog timer-completion-dialog" onSubmit={submit}>
        <div className="dialog-heading">
          <div><p className="card-kicker">本轮已停止</p><h2>保存这段学习记录</h2></div>
          <button type="button" onClick={onCancel} aria-label="取消记录"><X size={20} /></button>
        </div>
        <div className="timer-session-summary">
          <div><span>有效学习</span><strong>{shortDuration(activeMs)}</strong></div>
          <div><span>暂停 / 休息</span><strong>{shortDuration(restMs)}</strong></div>
          <div><span>实际时段</span><strong>{timeValue(new Date(startedAt))}–{timeValue(new Date(endedAt))}</strong></div>
        </div>
        <div className="dialog-grid">
          <label><span>学习科目</span><select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}>{state.subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label>
          <label><span>学习内容</span><input autoFocus placeholder="例如：高数强化第 5 讲与对应习题" value={form.task} onChange={(event) => setForm({ ...form, task: event.target.value })} /></label>
          <label><span>完成度：{form.completion}%</span><input type="range" min="0" max="100" step="5" value={form.completion} onChange={(event) => setForm({ ...form, completion: Number(event.target.value) })} /></label>
          <label><span>专注度：{form.focus} / 5</span><input type="range" min="1" max="5" value={form.focus} onChange={(event) => setForm({ ...form, focus: Number(event.target.value) })} /></label>
          <label className="wide"><span>复盘备注（可选）</span><textarea placeholder="本轮完成情况、卡点或下一步" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
        </div>
        <div className="timer-rest-notice"><Coffee size={17} /><span>{restMs > 0 ? `暂停累计 ${shortDuration(restMs)}，确认后将同时生成一条“休息”记录。` : "本轮没有暂停，只生成学习记录。"}</span></div>
        <div className="dialog-footer"><span>确认前计时保持停止，不会自动开始下一轮。</span><div><button type="button" className="secondary-button" onClick={onCancel}>取消记录</button><button type="submit" className="primary-button" disabled={!form.task.trim()}><Check size={17} />确定并保存</button></div></div>
      </form>
    </div>
  );
}
