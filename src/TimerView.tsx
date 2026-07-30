import {
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
  Settings2,
  SlidersHorizontal,
  Square,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { StudySession, StudyState } from "./study-state";

type TimerMode = "stopwatch" | "countdown" | "pomodoro";
type TimerStatus = "idle" | "running" | "paused" | "finished";
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

const BUILT_IN_EFFECTS: { id: BuiltInEffectId; label: string; detail: string }[] = [
  { id: "minimal", label: "极简数字", detail: "参考图一 · 黑白超大细体数字" },
  { id: "flip", label: "翻页时钟", detail: "参考图二 · 双层卡片与可调分割线" },
  { id: "glass", label: "云雾锁屏", detail: "现有风格 · 柔和渐变与锁屏排版" },
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
    if (!(["idle", "running", "paused", "finished"] as TimerStatus[]).includes(parsed.status as TimerStatus)) return null;
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

function createTimerSessions({ form, mode, effectLabel, activeMs, restMs, startedAt }: {
  form: CompletionForm;
  mode: TimerMode;
  effectLabel: string;
  activeMs: number;
  restMs: number;
  startedAt: number;
}): StudySession[] {
  const activeMinutes = Math.max(1, Math.ceil(activeMs / 60_000));
  const restMinutes = restMs > 0 ? Math.max(1, Math.ceil(restMs / 60_000)) : 0;
  const studyStart = new Date(startedAt);
  const studyEnd = new Date(studyStart.getTime() + activeMinutes * 60_000);
  const timerSummary = `${modeName(mode)} · ${effectLabel} · 有效 ${shortDuration(activeMs)} · 暂停休息 ${shortDuration(restMs)}`;
  const study: StudySession = {
    id: crypto.randomUUID(), date: localDateValue(studyStart), start: timeValue(studyStart), end: timeValue(studyEnd),
    subjectId: form.subjectId, task: form.task.trim(), plannedMinutes: activeMinutes, actualMinutes: activeMinutes,
    completion: form.completion, focus: form.focus, note: [form.note.trim(), timerSummary].filter(Boolean).join(" · "),
  };
  if (!restMinutes) return [study];
  const restStart = studyEnd;
  const restEnd = new Date(restStart.getTime() + restMinutes * 60_000);
  return [study, {
    id: crypto.randomUUID(), date: localDateValue(restStart), start: timeValue(restStart), end: timeValue(restEnd),
    subjectId: "rest", task: "计时暂停", plannedMinutes: restMinutes, actualMinutes: restMinutes,
    completion: 100, focus: 5, note: `计时器自动归入休息 · 累计 ${shortDuration(restMs)}`,
  }];
}

export default function TimerView({ state, accountId, onSaveSessions, onExit }: {
  state: StudyState;
  accountId: string;
  sidebarHidden: boolean;
  onSidebarHiddenChange: (hidden: boolean) => void;
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
  const [activeMs, setActiveMs] = useState(initial?.activeMs ?? 0);
  const [restMs, setRestMs] = useState(initial?.restMs ?? 0);
  const [startedAt, setStartedAt] = useState<number | null>(initial?.startedAt ?? null);
  const [endedAt, setEndedAt] = useState<number | null>(initial?.endedAt ?? null);
  const [transitionAt, setTransitionAt] = useState<number | null>(initial?.transitionAt ?? null);
  const [now, setNow] = useState(Date.now());
  const [completionOpen, setCompletionOpen] = useState(initial?.status === "finished");
  const [settingsDialog, setSettingsDialog] = useState<SettingsDialog>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (status === "idle" || status === "finished") return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    const snapshot: StoredTimer = {
      mode, status, effectId, countdownMinutes, pomodoroFocusMinutes, pomodoroBreakMinutes,
      flipLineWidth, customEffects, builtInBackgrounds, activeMs, restMs, startedAt, endedAt, transitionAt,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [storageKey, mode, status, effectId, countdownMinutes, pomodoroFocusMinutes, pomodoroBreakMinutes, flipLineWidth, customEffects, builtInBackgrounds, activeMs, restMs, startedAt, endedAt, transitionAt]);

  const effectiveActiveMs = activeMs + (status === "running" && transitionAt ? Math.max(0, now - transitionAt) : 0);
  const effectiveRestMs = restMs + (status === "paused" && transitionAt ? Math.max(0, now - transitionAt) : 0);
  const targetMs = mode === "countdown" ? countdownMinutes * 60_000 : mode === "pomodoro" ? pomodoroFocusMinutes * 60_000 : null;
  const displayedMs = targetMs === null ? effectiveActiveMs : Math.max(0, targetMs - effectiveActiveMs);
  const displayText = clockText(displayedMs, targetMs !== null);
  const displayParts = displayText.split(":");
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
  const statusLabel = status === "running" ? "正在专注" : status === "paused" ? "已暂停 · 计入休息" : status === "finished" ? "本轮已结束" : "准备开始";

  function startTimer() {
    if (status === "running" || status === "finished") return;
    const timestamp = Date.now(); setFeedback(""); setNow(timestamp);
    if (status === "idle") { setActiveMs(0); setRestMs(0); setStartedAt(timestamp); setEndedAt(null); }
    else if (status === "paused" && transitionAt) setRestMs((value) => value + Math.max(0, timestamp - transitionAt));
    setTransitionAt(timestamp); setStatus("running");
  }

  function pauseTimer() {
    if (status !== "running" || !transitionAt) return;
    const timestamp = Date.now(); setActiveMs((value) => value + Math.max(0, timestamp - transitionAt));
    setTransitionAt(timestamp); setNow(timestamp); setStatus("paused");
  }

  function finishTimer() {
    if ((status !== "running" && status !== "paused") || !transitionAt || effectiveActiveMs < 1000) return;
    const timestamp = Date.now();
    if (status === "running") setActiveMs((value) => value + Math.max(0, timestamp - transitionAt));
    else setRestMs((value) => value + Math.max(0, timestamp - transitionAt));
    setTransitionAt(null); setEndedAt(timestamp); setNow(timestamp); setStatus("finished"); setCompletionOpen(true);
  }

  function resetTimer(message = "") {
    setStatus("idle"); setActiveMs(0); setRestMs(0); setStartedAt(null); setEndedAt(null); setTransitionAt(null);
    setCompletionOpen(false); setNow(Date.now()); setFeedback(message);
  }

  function saveCompletion(form: CompletionForm) {
    if (!startedAt || !form.task.trim()) return;
    onSaveSessions(createTimerSessions({ form, mode, effectLabel: effectName(effectId, customEffects), activeMs, restMs, startedAt }));
    const restMessage = restMs > 0 ? `，暂停 ${shortDuration(restMs)} 已归入休息` : "";
    resetTimer(`已保存 ${shortDuration(activeMs)} 的学习记录${restMessage}`);
  }

  function updateActiveBackground(background: BackgroundSettings) {
    if (customEffect) setCustomEffects((items) => items.map((item) => item.id === customEffect.id ? { ...item, background } : item));
    else setBuiltInBackgrounds((items) => ({ ...items, [effectBase]: background }));
  }

  function deleteCustomEffect(id: string) {
    if (!window.confirm("确定删除这个自定义效果？")) return;
    setCustomEffects((items) => items.filter((item) => item.id !== id));
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
            <button type="button" onClick={() => setSettingsDialog("background")}><ImageIcon size={17} /><span>背景</span></button>
          </div>
        </header>

        <div className="focus-clock-face">
          {effectBase === "minimal" && <time className="minimal-clock-time">{displayText}</time>}
          {effectBase === "flip" && <div className="flip-clock-face">{displayParts.map((part, index) => <div className="flip-clock-group" key={`${index}-${part}`}><div className="flip-clock-card"><span>{part}</span></div>{index < displayParts.length - 1 && <b>:</b>}</div>)}</div>}
          {effectBase === "glass" && <div className="glass-clock-face"><p>{dateLabel}</p><time>{displayText}</time><strong>{modeName(mode)}</strong></div>}
        </div>

        <footer className="focus-stage-footer">
          <div className="focus-session-meta"><span>有效 {clockText(effectiveActiveMs)}</span><span>休息 {clockText(effectiveRestMs)}</span>{mode === "pomodoro" && <span>建议休息 {pomodoroBreakMinutes} 分</span>}</div>
          <div className="focus-main-controls">
            <button type="button" className="focus-start" onClick={startTimer} disabled={status === "running" || status === "finished"}><Play size={20} fill="currentColor" /><span>{status === "paused" ? "继续" : "开始"}</span></button>
            <button type="button" onClick={pauseTimer} disabled={status !== "running"}><Pause size={19} fill="currentColor" /><span>暂停</span></button>
            <button type="button" className="focus-finish" onClick={finishTimer} disabled={(status !== "running" && status !== "paused") || effectiveActiveMs < 1000}><Square size={17} fill="currentColor" /><span>结束</span></button>
            <button type="button" onClick={() => (status === "idle" || window.confirm("确定放弃当前计时？本次时间不会保存。")) && resetTimer("本次计时已清空")} disabled={status === "idle"}><RotateCcw size={18} /><span>清空</span></button>
          </div>
          <p>{feedback || "所有配置已收进右上角按钮，专注时只看这一块钟表。"}</p>
        </footer>
      </section>

      {settingsDialog === "mode" && <ModeDialog value={mode} disabled={status !== "idle"} onChange={setMode} onClose={() => setSettingsDialog(null)} />}
      {settingsDialog === "duration" && <DurationDialog mode={mode} disabled={status !== "idle"} countdownMinutes={countdownMinutes} pomodoroFocusMinutes={pomodoroFocusMinutes} pomodoroBreakMinutes={pomodoroBreakMinutes} onCountdown={setCountdownMinutes} onFocus={setPomodoroFocusMinutes} onBreak={setPomodoroBreakMinutes} onClose={() => setSettingsDialog(null)} />}
      {settingsDialog === "effects" && <EffectsDialog effectId={effectId} customEffects={customEffects} flipLineWidth={flipLineWidth} onSelect={setEffectId} onFlipLineWidth={setFlipLineWidth} onAdd={(effect) => { setCustomEffects((items) => [...items, effect]); setEffectId(effect.id); }} onUpdate={(effect) => setCustomEffects((items) => items.map((item) => item.id === effect.id ? effect : item))} onDelete={deleteCustomEffect} onClose={() => setSettingsDialog(null)} />}
      {settingsDialog === "background" && <BackgroundDialog effectLabel={effectName(effectId, customEffects)} value={activeBackground} onSave={updateActiveBackground} onClose={() => setSettingsDialog(null)} />}
      {completionOpen && startedAt && <TimerCompletionDialog state={state} activeMs={activeMs} restMs={restMs} startedAt={startedAt} endedAt={endedAt ?? Date.now()} onCancel={() => resetTimer("本次计时已取消，未写入时间记录")} onSave={saveCompletion} />}
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
  return <DialogShell title="选择与管理钟表效果" kicker="效果" onClose={onClose} footer={<><button type="button" className="secondary-button" onClick={() => setAdding((value) => !value)}><Plus size={16} />新增效果</button><button type="button" className="primary-button" onClick={onClose}>完成</button></>}><div className="effect-choice-grid">{BUILT_IN_EFFECTS.map((effect) => <button type="button" key={effect.id} className={effectId === effect.id ? "active" : ""} onClick={() => onSelect(effect.id)}><span className={`effect-mini-preview mini-${effect.id}`}>{effect.id === "flip" ? <><i>12</i><i>19</i></> : "10:04"}</span><strong>{effect.label}</strong><small>{effect.detail}</small>{effectId === effect.id && <Check size={15} />}</button>)}{customEffects.map((effect) => <button type="button" key={effect.id} className={effectId === effect.id ? "active" : ""} onClick={() => onSelect(effect.id)}><span className="effect-mini-preview mini-custom" style={{ color: effect.foreground, background: effect.background.color, fontWeight: effect.fontWeight }}>10:04</span><strong>{effect.name}</strong><small>自定义 · 基于 {BUILT_IN_EFFECTS.find((item) => item.id === effect.base)?.label}</small>{effectId === effect.id && <Check size={15} />}</button>)}</div>{selectedBase === "flip" && <label className="effect-line-setting"><span>翻页分割线粗细：{selectedCustom?.lineWidth ?? flipLineWidth}px</span><input type="range" min="1" max="16" value={selectedCustom?.lineWidth ?? flipLineWidth} onChange={(event) => selectedCustom ? onUpdate({ ...selectedCustom, lineWidth: Number(event.target.value) }) : onFlipLineWidth(Number(event.target.value))} /></label>}{selectedCustom && <div className="custom-effect-actions"><span>当前是自定义效果，可继续在“背景”按钮中修改背景。</span><button type="button" className="danger-button" onClick={() => onDelete(selectedCustom.id)}><Trash2 size={15} />删除效果</button></div>}{adding && <div className="custom-effect-form"><label><span>效果名称</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label><span>基础布局</span><select value={draft.base} onChange={(event) => setDraft({ ...draft, base: event.target.value as EffectBase })}>{BUILT_IN_EFFECTS.map((effect) => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select></label><label><span>数字颜色</span><input type="color" value={draft.foreground} onChange={(event) => setDraft({ ...draft, foreground: event.target.value })} /></label><label><span>背景颜色</span><input type="color" value={draft.background} onChange={(event) => setDraft({ ...draft, background: event.target.value })} /></label><label><span>字体粗细：{draft.fontWeight}</span><input type="range" min="100" max="800" step="50" value={draft.fontWeight} onChange={(event) => setDraft({ ...draft, fontWeight: Number(event.target.value) })} /></label>{draft.base === "flip" && <label><span>分割线：{draft.lineWidth}px</span><input type="range" min="1" max="16" value={draft.lineWidth} onChange={(event) => setDraft({ ...draft, lineWidth: Number(event.target.value) })} /></label>}<button type="button" className="primary-button" onClick={addEffect}><Plus size={16} />保存并使用</button></div>}</DialogShell>;
}

function BackgroundDialog({ effectLabel, value, onSave, onClose }: { effectLabel: string; value: BackgroundSettings; onSave: (value: BackgroundSettings) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<BackgroundSettings>({ ...value });
  function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => setDraft((current) => ({ ...current, mode: "image", image: String(reader.result) })); reader.readAsDataURL(file);
  }
  return <DialogShell title={`设置“${effectLabel}”背景`} kicker="背景" onClose={onClose} footer={<><button type="button" className="secondary-button" onClick={() => setDraft({ ...AUTO_BACKGROUND })}>恢复默认</button><button type="button" className="primary-button" onClick={() => { onSave(draft); onClose(); }}>应用背景</button></>}><div className="background-mode-list">{(["auto","color","gradient","image"] as BackgroundMode[]).map((mode) => <button type="button" key={mode} className={draft.mode === mode ? "active" : ""} onClick={() => setDraft({ ...draft, mode })}>{mode === "auto" ? "跟随效果 / 黑白主题" : mode === "color" ? "纯色" : mode === "gradient" ? "渐变" : "图片"}</button>)}</div>{draft.mode === "color" && <label className="background-color-field"><span>背景颜色</span><input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label>}{draft.mode === "gradient" && <div className="background-color-grid"><label><span>起始颜色</span><input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label><label><span>结束颜色</span><input type="color" value={draft.secondColor} onChange={(event) => setDraft({ ...draft, secondColor: event.target.value })} /></label></div>}{draft.mode === "image" && <div className="background-upload"><label className="secondary-button"><ImageIcon size={16} />选择本地图片<input hidden type="file" accept="image/*" onChange={upload} /></label>{draft.image && <div style={{ backgroundImage: `url(${JSON.stringify(draft.image)})` }} />}</div>}<p className="focus-dialog-note">内置效果在“跟随效果”时会自动适配亮色和暗色主题；自定义背景按你的设置原样显示。</p></DialogShell>;
}

function TimerCompletionDialog({ state, activeMs, restMs, startedAt, endedAt, onCancel, onSave }: { state: StudyState; activeMs: number; restMs: number; startedAt: number; endedAt: number; onCancel: () => void; onSave: (form: CompletionForm) => void }) {
  const [form, setForm] = useState<CompletionForm>({ subjectId: state.subjects[0]?.id ?? "math", task: "", completion: 100, focus: 5, note: "" });
  function submit(event: React.FormEvent) { event.preventDefault(); if (form.task.trim()) onSave(form); }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}><form className="record-dialog timer-completion-dialog" onSubmit={submit}><div className="dialog-heading"><div><p className="card-kicker">本轮已停止</p><h2>保存这段学习记录</h2></div><button type="button" onClick={onCancel} aria-label="取消记录"><X size={20} /></button></div><div className="timer-session-summary"><div><span>有效学习</span><strong>{shortDuration(activeMs)}</strong></div><div><span>暂停 / 休息</span><strong>{shortDuration(restMs)}</strong></div><div><span>实际时段</span><strong>{timeValue(new Date(startedAt))}–{timeValue(new Date(endedAt))}</strong></div></div><div className="dialog-grid"><label><span>学习科目</span><select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}>{state.subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label><label><span>学习内容</span><input autoFocus placeholder="例如：高数强化第 5 讲与对应习题" value={form.task} onChange={(event) => setForm({ ...form, task: event.target.value })} /></label><label><span>完成度：{form.completion}%</span><input type="range" min="0" max="100" step="5" value={form.completion} onChange={(event) => setForm({ ...form, completion: Number(event.target.value) })} /></label><label><span>专注度：{form.focus} / 5</span><input type="range" min="1" max="5" value={form.focus} onChange={(event) => setForm({ ...form, focus: Number(event.target.value) })} /></label><label className="wide"><span>复盘备注（可选）</span><textarea placeholder="本轮完成情况、卡点或下一步" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label></div><div className="timer-rest-notice"><Coffee size={17} /><span>{restMs > 0 ? `暂停累计 ${shortDuration(restMs)}，确认后将同时生成一条“休息”记录。` : "本轮没有暂停，只生成学习记录。"}</span></div><div className="dialog-footer"><span>确认前计时保持停止，不会自动开始下一轮。</span><div><button type="button" className="secondary-button" onClick={onCancel}>取消记录</button><button type="submit" className="primary-button" disabled={!form.task.trim()}><Check size={17} />确定并保存</button></div></div></form></div>;
}
