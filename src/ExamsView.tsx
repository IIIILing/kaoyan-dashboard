import { Clock3, Pencil, Plus, Save, Target, Trash2, TrendingUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import { confirmDialog } from "./components/dialog-service";
import { scoreRate } from "./exam-data";
import { localDate } from "./lib/dates";
import type { ExamPaperType, ExamRecord, ExamSection, StudyState } from "./study-state";

const PAPER_TYPES: { value: ExamPaperType; label: string }[] = [
  { value: "past", label: "历年真题" },
  { value: "mock", label: "模拟考试" },
  { value: "chapter", label: "章节测试" },
  { value: "other", label: "其他测评" },
];

function paperTypeLabel(value: ExamPaperType) {
  return PAPER_TYPES.find((item) => item.value === value)?.label ?? "其他测评";
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

export default function ExamsView({ state, updateState }: { state: StudyState; updateState: (updater: (current: StudyState) => StudyState) => void }) {
  const [subjectId, setSubjectId] = useState("all");
  const [paperType, setPaperType] = useState<ExamPaperType | "all">("all");
  const [editing, setEditing] = useState<ExamRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const filtered = useMemo(() => state.examRecords
    .filter((record) => subjectId === "all" || record.subjectId === subjectId)
    .filter((record) => paperType === "all" || record.paperType === paperType)
    .sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`)), [state.examRecords, subjectId, paperType]);
  const chronological = [...filtered].reverse().slice(-12);
  const averageCorrectRate = filtered.length ? Math.round(filtered.reduce((sum, record) => sum + record.correctRate, 0) / filtered.length) : 0;
  const averageScoreRate = filtered.length ? Math.round(filtered.reduce((sum, record) => sum + scoreRate(record), 0) / filtered.length) : 0;
  const improvement = chronological.length > 1 ? Math.round(chronological.at(-1)!.correctRate - chronological[0].correctRate) : 0;
  const points = chronological.map((record, index) => {
    const x = chronological.length === 1 ? 50 : index / (chronological.length - 1) * 100;
    return `${x},${40 - record.correctRate * .36}`;
  }).join(" ");

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function save(record: ExamRecord) {
    updateState((current) => ({
      ...current,
      examRecords: current.examRecords.some((item) => item.id === record.id)
        ? current.examRecords.map((item) => item.id === record.id ? record : item)
        : [...current.examRecords, record],
    }));
    setDialogOpen(false);
    setEditing(null);
  }

  async function remove(record: ExamRecord) {
    if (!await confirmDialog({
      title: "删除成绩记录",
      message: `确定删除“${record.paperName}”的成绩记录？`,
      danger: true,
      confirmLabel: "删除",
    })) return;
    updateState((current) => ({ ...current, examRecords: current.examRecords.filter((item) => item.id !== record.id) }));
  }

  return <div className="page-stack narrow-page">
    <div className="page-actions"><p className="muted">把学习投入和真题、模考的输出质量放在一起观察。</p><button className="primary-button" type="button" onClick={openNew}><Plus size={17} />记录成绩</button></div>
    <section className="exam-summary-strip">
      <div><span>测评次数</span><strong>{filtered.length}</strong></div>
      <div><span>平均得分率</span><strong>{averageScoreRate}%</strong></div>
      <div><span>平均正确率</span><strong>{averageCorrectRate}%</strong></div>
      <div className={improvement >= 0 ? "positive" : "negative"}><span>趋势变化</span><strong>{improvement > 0 ? "+" : ""}{improvement}%</strong></div>
    </section>
    <section className="exam-filter-bar">
      <label><span>科目</span><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="all">全部科目</option>{state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      <label><span>试卷类型</span><select value={paperType} onChange={(event) => setPaperType(event.target.value as ExamPaperType | "all")}><option value="all">全部类型</option>{PAPER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
    </section>
    <section className="panel exam-trend-panel">
      <div className="panel-heading"><div><p className="card-kicker">最近 {chronological.length} 次</p><h2>正确率趋势</h2></div><span className="muted">0–100%</span></div>
      {chronological.length ? <><div className="exam-trend-chart"><svg viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label="正确率趋势折线图"><line x1="0" y1="4" x2="100" y2="4" /><line x1="0" y1="22" x2="100" y2="22" /><line x1="0" y1="40" x2="100" y2="40" /><polyline points={points} /></svg>{chronological.map((record, index) => <span key={record.id} style={{ left: `${chronological.length === 1 ? 50 : index / (chronological.length - 1) * 100}%`, bottom: `${record.correctRate * .86}%` }} title={`${record.date} · ${record.paperName} · ${record.correctRate}%`} />)}</div><div className="exam-trend-labels">{chronological.map((record) => <span key={record.id}>{record.date.slice(5)}<strong>{record.correctRate}%</strong></span>)}</div></> : <div className="schedule-empty">记录第一套真题或模考后，这里会显示正确率趋势。</div>}
    </section>
    <section className="exam-record-list">
      {filtered.map((record) => {
        const subject = state.subjects.find((item) => item.id === record.subjectId);
        return <article className="panel exam-record-card" key={record.id}>
          <span className="subject-indicator" style={{ background: subject?.accent }} />
          <div className="exam-record-main"><small>{record.date} · {paperTypeLabel(record.paperType)}</small><strong>{record.paperName}</strong><span>{subject?.name ?? "未知科目"}{record.note ? ` · ${record.note}` : ""}</span></div>
          <div className="exam-score"><strong>{record.score}<small> / {record.fullScore}</small></strong><span>得分率 {scoreRate(record)}%</span></div>
          <div className="exam-quality"><span><Target size={14} />正确率 {record.correctRate}%</span><span><Clock3 size={14} />{formatDuration(record.durationMinutes)}</span><span>错题 {record.wrongCount}</span></div>
          <div className="exam-sections">{record.sections.length ? record.sections.map((section) => <span key={section.id}>{section.name} {section.score}/{section.fullScore} · 错 {section.wrongCount}</span>) : <span>未填写分项成绩</span>}</div>
          <div className="row-actions"><button type="button" onClick={() => { setEditing(record); setDialogOpen(true); }} aria-label={`编辑成绩：${record.paperName}`}><Pencil size={15} /></button><button type="button" onClick={() => remove(record)} aria-label={`删除成绩：${record.paperName}`}><Trash2 size={15} /></button></div>
        </article>;
      })}
      {!filtered.length && <section className="panel"><div className="empty-state"><div><TrendingUp size={25} /></div><strong>还没有匹配的成绩记录</strong><p>从一套真题、章节测试或模拟考试开始，建立输出质量曲线。</p><button className="text-button" type="button" onClick={openNew}>记录第一套试卷</button></div></section>}
    </section>
    {dialogOpen && <ExamRecordDialog state={state} initial={editing} defaultSubjectId={subjectId === "all" ? state.subjects[0]?.id ?? "" : subjectId} onClose={() => { setDialogOpen(false); setEditing(null); }} onSave={save} />}
  </div>;
}

function ExamRecordDialog({ state, initial, defaultSubjectId, onClose, onSave }: { state: StudyState; initial: ExamRecord | null; defaultSubjectId: string; onClose: () => void; onSave: (record: ExamRecord) => void }) {
  const [form, setForm] = useState<ExamRecord>(() => initial ? { ...initial, sections: initial.sections.map((section) => ({ ...section })) } : {
    id: crypto.randomUUID(), subjectId: defaultSubjectId, date: localDate(), paperType: "past", paperName: "", score: 0, fullScore: 150, durationMinutes: 180, correctRate: 0, wrongCount: 0, sections: [], note: "",
  });
  const valid = Boolean(form.subjectId && form.date && form.paperName.trim() && form.fullScore > 0 && form.score >= 0 && form.score <= form.fullScore && form.durationMinutes > 0 && form.correctRate >= 0 && form.correctRate <= 100 && form.wrongCount >= 0);

  function updateSection(id: string, changes: Partial<ExamSection>) {
    setForm((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, ...changes } : section) }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onSave({ ...form, paperName: form.paperName.trim(), note: form.note.trim(), score: Number(form.score), fullScore: Number(form.fullScore), durationMinutes: Math.round(Number(form.durationMinutes)), correctRate: Number(form.correctRate), wrongCount: Math.round(Number(form.wrongCount)), sections: form.sections.filter((section) => section.name.trim()).map((section) => ({ ...section, name: section.name.trim() })) });
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="record-dialog exam-record-dialog" onSubmit={submit}>
    <div className="dialog-heading"><div><p className="card-kicker">输出质量</p><h2>{initial ? "编辑成绩记录" : "记录真题 / 模考成绩"}</h2></div><button type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
    <div className="dialog-grid exam-main-fields">
      <label><span>科目</span><select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}>{state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      <label><span>日期</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
      <label><span>试卷类型</span><select value={form.paperType} onChange={(event) => setForm({ ...form, paperType: event.target.value as ExamPaperType })}>{PAPER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      <label><span>试卷名称</span><input autoFocus value={form.paperName} placeholder="例如：2024 数学一真题" onChange={(event) => setForm({ ...form, paperName: event.target.value })} /></label>
      <label><span>得分</span><input type="number" min="0" max={form.fullScore} value={form.score} onChange={(event) => setForm({ ...form, score: Number(event.target.value) })} /></label>
      <label><span>满分</span><input type="number" min="1" value={form.fullScore} onChange={(event) => setForm({ ...form, fullScore: Math.max(1, Number(event.target.value)) })} /></label>
      <label><span>用时（分钟）</span><input type="number" min="1" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} /></label>
      <label><span>正确率（%）</span><input type="number" min="0" max="100" value={form.correctRate} onChange={(event) => setForm({ ...form, correctRate: Number(event.target.value) })} /></label>
      <label><span>错题数量</span><input type="number" min="0" value={form.wrongCount} onChange={(event) => setForm({ ...form, wrongCount: Number(event.target.value) })} /></label>
      <label className="wide"><span>复盘备注（可选）</span><textarea value={form.note} placeholder="主要失分原因、薄弱章节、下次改进" onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
    </div>
    <div className="exam-section-heading"><div><p className="card-kicker">分项成绩</p><strong>选择填空、大题、阅读、翻译等</strong></div><button type="button" className="secondary-button" onClick={() => setForm((current) => ({ ...current, sections: [...current.sections, { id: crypto.randomUUID(), name: "", score: 0, fullScore: 0, wrongCount: 0 }] }))}><Plus size={15} />添加分项</button></div>
    <div className="exam-section-list">{form.sections.map((section) => <div className="exam-section-row" key={section.id}><input aria-label="分项名称" value={section.name} placeholder="例如：选择填空" onChange={(event) => updateSection(section.id, { name: event.target.value })} /><input aria-label="分项得分" type="number" min="0" max={section.fullScore || undefined} value={section.score} onChange={(event) => updateSection(section.id, { score: Number(event.target.value) })} /><span>/</span><input aria-label="分项满分" type="number" min="0" value={section.fullScore} onChange={(event) => updateSection(section.id, { fullScore: Number(event.target.value) })} /><input aria-label="分项错题" type="number" min="0" value={section.wrongCount} onChange={(event) => updateSection(section.id, { wrongCount: Number(event.target.value) })} /><button type="button" onClick={() => setForm((current) => ({ ...current, sections: current.sections.filter((item) => item.id !== section.id) }))} aria-label="删除分项"><Trash2 size={15} /></button></div>)}</div>
    <div className="dialog-footer"><span>当前得分率：<strong>{scoreRate(form)}%</strong></span><div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button" disabled={!valid}><Save size={16} />保存成绩</button></div></div>
  </form></div>;
}
