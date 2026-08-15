import { AlertCircle, BookOpen, CalendarClock, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { confirmDialog } from "./components/dialogs";
import { completeReviewItem, nextReviewInterval } from "./review-data";
import { localDate } from "./lib/dates";
import type { ReviewItem, ReviewItemKind, StudyState } from "./study-state";

const KIND_OPTIONS: { value: ReviewItemKind; label: string }[] = [
  { value: "mistake", label: "错题" },
  { value: "knowledge", label: "知识点" },
  { value: "exam", label: "试卷复盘" },
];

function dateDistance(date: string) {
  return Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${localDate()}T12:00:00`).getTime()) / 86_400_000);
}

function kindLabel(kind: ReviewItemKind) {
  return KIND_OPTIONS.find((item) => item.value === kind)?.label ?? "知识点";
}

export default function ReviewView({ state, updateState }: { state: StudyState; updateState: (updater: (current: StudyState) => StudyState) => void }) {
  const [filter, setFilter] = useState<"due" | "upcoming" | "all">("due");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReviewItem | null>(null);
  const today = localDate();
  const dueCount = state.reviewItems.filter((item) => item.nextReviewDate <= today).length;
  const comingCount = state.reviewItems.filter((item) => item.nextReviewDate > today && dateDistance(item.nextReviewDate) <= 7).length;
  const masteredCount = state.reviewItems.filter((item) => item.mastery >= 4).length;
  const items = useMemo(() => [...state.reviewItems]
    .filter((item) => filter === "all" || (filter === "due" ? item.nextReviewDate <= today : item.nextReviewDate > today))
    .sort((a, b) => `${a.nextReviewDate}${a.createdAt}`.localeCompare(`${b.nextReviewDate}${b.createdAt}`)), [state.reviewItems, filter, today]);

  function save(item: ReviewItem) {
    updateState((current) => ({
      ...current,
      reviewItems: current.reviewItems.some((entry) => entry.id === item.id)
        ? current.reviewItems.map((entry) => entry.id === item.id ? item : entry)
        : [...current.reviewItems, item],
    }));
    setDialogOpen(false);
    setEditing(null);
  }

  function complete(item: ReviewItem) {
    updateState((current) => ({ ...current, reviewItems: current.reviewItems.map((entry) => entry.id === item.id ? completeReviewItem(entry) : entry) }));
  }

  return <div className="page-stack review-page">
    <div className="page-actions"><p className="muted">把错题与易忘知识点排进 3 → 7 → 14 天复习节奏。</p><button className="primary-button" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus size={17} />新增复习项</button></div>
    <section className="summary-strip review-summary">
      <div className={dueCount ? "negative" : "positive"}><span>今日应复习</span><strong>{dueCount} 项</strong></div>
      <div><span>未来 7 天</span><strong>{comingCount} 项</strong></div>
      <div><span>已复习次数</span><strong>{state.reviewItems.reduce((sum, item) => sum + item.reviewCount, 0)}</strong></div>
      <div><span>掌握度 ≥ 4</span><strong>{masteredCount} 项</strong></div>
    </section>
    <section className="panel review-queue-panel">
      <div className="panel-heading"><div><p className="card-kicker">间隔复习</p><h2>{filter === "due" ? "今日队列" : filter === "upcoming" ? "后续安排" : "全部复习项"}</h2></div><div className="mode-tabs"><button className={filter === "due" ? "active" : ""} onClick={() => setFilter("due")}>到期 {dueCount}</button><button className={filter === "upcoming" ? "active" : ""} onClick={() => setFilter("upcoming")}>待复习</button><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部</button></div></div>
      {items.length ? <div className="review-item-list">{items.map((item) => {
        const subject = state.subjects.find((entry) => entry.id === item.subjectId);
        const distance = dateDistance(item.nextReviewDate);
        return <article className={`review-item-card ${distance <= 0 ? "due" : ""}`} key={item.id}>
          <span className="subject-indicator" style={{ background: subject?.accent }} />
          <div className="review-item-main"><small>{kindLabel(item.kind)} · {subject?.name ?? "未知科目"}</small><strong>{item.title}</strong><span>{item.detail || "尚未填写易错原因或知识说明"}</span>{item.source && <em>来源：{item.source}</em>}</div>
          <div className="review-mastery"><span>掌握度</span><strong>{"●".repeat(item.mastery)}{"○".repeat(5 - item.mastery)}</strong><small>已复习 {item.reviewCount} 次</small></div>
          <div className={`review-due ${distance <= 0 ? "overdue" : ""}`}><CalendarClock size={16} /><strong>{distance < 0 ? `逾期 ${Math.abs(distance)} 天` : distance === 0 ? "今天到期" : `${distance} 天后`}</strong><span>{item.nextReviewDate}</span></div>
          <div className="review-actions">
            {distance <= 0 && <button className="primary-button" onClick={() => complete(item)}><Check size={15} />完成复习 · 下次 +{nextReviewInterval(item)} 天</button>}
            <button className="icon-button" onClick={() => { setEditing(item); setDialogOpen(true); }} aria-label={`编辑${item.title}`}><Pencil size={16} /></button>
            <button className="icon-button danger" onClick={async () => {
              if (await confirmDialog({
                title: "删除复习项",
                message: `确定删除复习项“${item.title}”？`,
                danger: true,
                confirmLabel: "删除",
              })) {
                updateState((current) => ({ ...current, reviewItems: current.reviewItems.filter((entry) => entry.id !== item.id) }));
              }
            }} aria-label={`删除${item.title}`}><Trash2 size={16} /></button>
          </div>
        </article>;
      })}</div> : <div className="schedule-empty">{filter === "due" ? <><Check size={18} />今天没有待复习项，队列已经清空。</> : <><BookOpen size={18} />还没有符合条件的复习项。</>}</div>}
    </section>
    {dialogOpen && <ReviewDialog state={state} initial={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} onSave={save} />}
  </div>;
}

function ReviewDialog({ state, initial, onClose, onSave }: { state: StudyState; initial: ReviewItem | null; onClose: () => void; onSave: (item: ReviewItem) => void }) {
  const [form, setForm] = useState<ReviewItem>(() => initial ? { ...initial } : {
    id: crypto.randomUUID(),
    subjectId: state.subjects[0]?.id ?? "",
    kind: "mistake",
    title: "",
    detail: "",
    source: "",
    mastery: 2,
    nextReviewDate: localDate(),
    reviewCount: 0,
    createdAt: new Date().toISOString(),
  });
  const valid = Boolean(form.subjectId && form.title.trim() && form.nextReviewDate);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="record-dialog review-dialog" onSubmit={(event) => { event.preventDefault(); if (valid) onSave({ ...form, title: form.title.trim(), detail: form.detail.trim(), source: form.source.trim() }); }}>
    <div className="dialog-heading"><div><p className="card-kicker">3 / 7 / 14 天</p><h2>{initial ? "编辑复习项" : "新增复习项"}</h2></div><button type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
    <div className="dialog-grid">
      <label><span>科目</span><select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}>{state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      <label><span>类型</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as ReviewItemKind })}>{KIND_OPTIONS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
      <label className="wide"><span>复习主题</span><input autoFocus value={form.title} placeholder="例如：受控源列方程符号" onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label className="wide"><span>易错原因 / 知识说明</span><textarea value={form.detail} placeholder="错在哪里、正确判断是什么" onChange={(event) => setForm({ ...form, detail: event.target.value })} /></label>
      <label><span>来源</span><input value={form.source} placeholder="例如：840 真题 2024 第 8 题" onChange={(event) => setForm({ ...form, source: event.target.value })} /></label>
      <label><span>下次复习日</span><input type="date" value={form.nextReviewDate} onChange={(event) => setForm({ ...form, nextReviewDate: event.target.value })} /></label>
      <label className="wide review-mastery-field"><span>当前掌握度：{form.mastery} / 5</span><input type="range" min="1" max="5" value={form.mastery} onChange={(event) => setForm({ ...form, mastery: Number(event.target.value) })} /><small>1 = 完全陌生，5 = 可以稳定独立解答</small></label>
    </div>
    <div className="review-dialog-tip"><AlertCircle size={17} /><span>每次点击“完成复习”后，下次日期依次顺延 3、7、14 天；此后保持 14 天循环。</span></div>
    <div className="dialog-footer"><span>{initial ? `已完成 ${form.reviewCount} 次复习` : "默认加入今天的复习队列"}</span><div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={!valid}><Check size={16} />保存复习项</button></div></div>
  </form></div>;
}
