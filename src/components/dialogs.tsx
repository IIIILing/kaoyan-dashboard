import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Download,
  FileUp,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { lifeActivity } from "../lib/activities";
import { isInRange, localDate, presetRange } from "../lib/dates";
import { formatMinutes, minutesBetween } from "../lib/format";
import { computeImportMerge } from "../import-merge";
import type { BackupMode, RecordDraft } from "../lib/types";
import { phaseForecast, recordPhaseProgress } from "../progress-forecast";
import type { DateRange, ScheduleImportCandidate } from "../schedule-data";
import { findOverlappingSessions } from "../session-time";
import type { DailyPlan, PlanItem, StudyResource, StudySession, StudyState, Subject } from "../study-state";
import { findOverlappingPlanItems, scheduledTimeRange } from "../time-range";

const RESOURCE_TYPES = [
  { value: "book", label: "书本" },
  { value: "chapter", label: "章节" },
  { value: "paper", label: "试卷" },
  { value: "exercise", label: "习题集" },
  { value: "other", label: "其他" },
] as const;

export function BackupDialog({ mode, state, candidate, sessions, plans, onClose, onConfirm }: {
  mode: BackupMode;
  state: StudyState;
  candidate: ScheduleImportCandidate | null;
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
  // 导入预览:与 importData 共用同一份合并计算,试算结果就是确认后的真实结果。
  const preview = mode === "import" && candidate && !invalid
    ? computeImportMerge(state, candidate, range)
    : null;

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
            <div><strong>{invalid ? "日期范围无效" : `${range.from} 至 ${range.to}`}</strong><span>范围内共有 {sessionCount} 条时间记录和 {planCount} 个计划时段,最小选择精度为一天。</span></div>
          </div>
          {mode === "import" && (
            <div className="conflict-policy">
              <strong>导入冲突规则</strong>
              <p>时间记录和今日计划都会按日期、起止时间及任务名称查重;不同任务的时段重叠时,导入项按原时长顺延到当天最早空闲时段,并写入调整备注,不覆盖已有数据。</p>
            </div>
          )}
          {preview && (
            <div className="import-preview">
              <div className="import-preview-title"><strong>导入预览</strong><span>按当前日期范围试算,确认后才会真正合并</span></div>
              <ul className="import-preview-list">
                <li><span>时间记录</span><em>新增 {preview.sessions.report.added} 条 · 重复 {preview.sessions.report.duplicates} 条 · 顺延 {preview.sessions.report.shifted} 条 · 跳过 {preview.sessions.report.skipped} 条</em></li>
                <li><span>今日计划</span><em>新增 {preview.plans.report.added} 条 · 重复 {preview.plans.report.duplicates} 条 · 顺延 {preview.plans.report.shifted} 条 · 跳过 {preview.plans.report.skipped} 条</em></li>
                <li><span>计划模板</span><em>新增 {preview.templates.added} 个 · 重复 {preview.templates.duplicates} 个</em></li>
                <li><span>成绩记录</span><em>新增 {preview.exams.added} 条 · 重复 {preview.exams.duplicates} 条</em></li>
                <li><span>复习项</span><em>新增 {preview.reviews.added} 条 · 重复 {preview.reviews.duplicates} 条</em></li>
              </ul>
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <span>{mode === "export" ? "一个 JSON 文件包含项目设置、科目进度、所选日期的计划与时间记录。" : "合并所选日期的计划与时间记录,不改动项目设置和科目进度。"}</span>
          <div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="button" className="primary-button" disabled={invalid} onClick={() => onConfirm(range)}>{mode === "export" ? <Download size={17} /> : <FileUp size={17} />}{mode === "export" ? "导出 JSON" : "合并导入"}</button></div>
        </div>
      </section>
    </div>
  );
}

export function RecordDialog({ state, initial, draft, onClose, onSave }: { state: StudyState; initial: StudySession | null; draft: RecordDraft | null; onClose: () => void; onSave: (session: StudySession) => void }) {
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
  } : { date: draft?.date ?? localDate(), start: draft?.start ?? start, end: draft?.end ?? end, subjectId: draft?.subjectId ?? "math", task: draft?.task ?? "", completion: 100, focus: 4, note: draft?.note ?? "" });
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
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      planItemId: initial?.planItemId,
      ...form,
      task: form.task.trim(),
      plannedMinutes,
      actualMinutes: plannedMinutes,
    });
  }
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="record-dialog" onSubmit={submit}>
        <div className="dialog-heading"><div><p className="card-kicker">分时记录</p><h2>{initial ? "编辑时间记录" : draft?.task ? "记录计划完成情况" : "记录一个时段"}</h2></div><button type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
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
        {conflicts.length > 0 && <div className="record-conflict-warning" role="alert"><AlertTriangle size={18} /><div><strong>与已有时间记录重叠</strong>{conflicts.map((session) => <span key={session.id}>{session.date} {session.start}–{session.end} · {session.task}</span>)}<small>请调整本条记录的日期或起止时间;已有记录不会被覆盖。</small></div></div>}
        <div className="dialog-footer"><span>{isLifeActivity ? "计入全天记录" : "计入有效学习"}：<strong>{formatMinutes(plannedMinutes)}</strong></span><div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={!form.task.trim() || !hasValidRange || conflicts.length > 0}><Check size={17} />{initial ? "保存修改" : "保存记录"}</button></div></div>
      </form>
    </div>
  );
}

export function PlanItemDialog({ state, date, initial, onClose, onSave }: { state: StudyState; date: string; initial: PlanItem | null; onClose: () => void; onSave: (item: PlanItem) => void }) {
  const [form, setForm] = useState(() => initial ? {
    start: initial.start,
    end: initial.end,
    subjectId: initial.subjectId,
    task: initial.task,
    note: initial.note,
  } : { start: "08:00", end: "10:00", subjectId: state.subjects[0]?.id ?? "math", task: "", note: "" });
  const duration = minutesBetween(form.start, form.end, form.subjectId === "sleep");
  const range = scheduledTimeRange(date, form.start, form.end, form.subjectId === "sleep");
  const conflicts = range
    ? findOverlappingPlanItems(range, state.plans, initial ? new Set([initial.id]) : new Set())
    : [];
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.task.trim() || !range || conflicts.length) return;
    onSave({ id: initial?.id ?? crypto.randomUUID(), ...form, task: form.task.trim() });
  }
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="record-dialog" onSubmit={submit}>
        <div className="dialog-heading"><div><p className="card-kicker">{date} · 计划</p><h2>{initial ? "编辑计划时段" : "安排一个计划时段"}</h2></div><button type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
        <div className="dialog-grid">
          <label><span>科目 / 活动</span><select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}><optgroup label="考试科目">{state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</optgroup><optgroup label="生活活动">{state.lifeActivities.filter((activity) => activity.active !== false).map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</optgroup></select></label>
          <label><span>计划任务</span><input autoFocus value={form.task} placeholder="例如：高数基础讲义第 3 章" onChange={(event) => setForm({ ...form, task: event.target.value })} /></label>
          <label><span>开始时间</span><input type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label>
          <label><span>结束时间</span><input type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></label>
          <label className="wide"><span>计划备注（可选）</span><textarea value={form.note} placeholder="目标章节、题量或完成标准" onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
        </div>
        {conflicts.length > 0 && <div className="form-conflict-warning" role="alert"><AlertTriangle size={18} /><div><strong>与已有计划时段重叠</strong>{conflicts.map(({ date: conflictDate, item }) => <span key={item.id}>{conflictDate} {item.start}–{item.end} · {item.task}</span>)}<small>请调整起止时间;首尾相接的时段可以正常保存。</small></div></div>}
        <div className="dialog-footer"><span>计划时长：<strong>{formatMinutes(duration)}</strong></span><div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={!form.task.trim() || !range || conflicts.length > 0}><Save size={16} />{initial ? "保存修改" : "保存计划"}</button></div></div>
      </form>
    </div>
  );
}

export function PhaseEditorDialog({ state, subjectId, phaseId, updateState, onClose }: {
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
  const forecast = phaseForecast(activePhase, localDate());

  function updatePhase(changes: Partial<Subject["phases"][number]>) {
    updateState((current) => ({
      ...current,
      subjects: current.subjects.map((item) => item.id === subjectId
        ? { ...item, phases: item.phases.map((entry) => {
            if (entry.id !== phaseId) return entry;
            const next = { ...entry, ...changes };
            return typeof changes.progress === "number" ? recordPhaseProgress(next, changes.progress, localDate()) : next;
          }) }
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
        <div className="phase-schedule-fields">
          <label><span>阶段开始日期</span><input type="date" value={phase.startDate ?? ""} max={phase.targetDate || undefined} onChange={(event) => updatePhase({ startDate: event.target.value || undefined })} /></label>
          <label><span>目标截止日期</span><input type="date" value={phase.targetDate ?? ""} min={phase.startDate || undefined} onChange={(event) => updatePhase({ targetDate: event.target.value || undefined })} /></label>
          <label><span>截止时目标进度</span><div className="target-progress-input"><input type="number" min="1" max="100" value={phase.targetProgress ?? 100} onChange={(event) => updatePhase({ targetProgress: Math.min(100, Math.max(1, Number(event.target.value) || 100)) })} /><span>%</span></div></label>
          <div className={`phase-schedule-preview ${forecast.configured && forecast.progressDelta < 0 ? "behind" : ""}`}><span>今日节奏判断</span><strong>{forecast.configured ? `应达 ${forecast.expectedProgress}% · ${forecast.progressDelta >= 0 ? "领先" : "落后"} ${Math.abs(forecast.progressDelta)}%` : "填写开始与截止日期后计算"}</strong></div>
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
