import { useState } from "react";
import { Clock3, FilterX, Plus, Search } from "lucide-react";
import { DayScheduleChart, EditableSessionTable } from "../components/tables";
import { EmptyState } from "../components/ui";
import { lifeActivity } from "../lib/activities";
import { formatMinutes } from "../lib/format";
import { sessionsForDate } from "../lib/scoring";
import type { StudySession, StudyState } from "../study-state";

export default function RecordsView({ state, onRecord, onEdit, onDelete }: {
  state: StudyState;
  onRecord: () => void;
  onEdit: (session: StudySession) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredSessions = state.sessions.filter((session) => {
    if (categoryId !== "all" && session.subjectId !== categoryId) return false;
    if (fromDate && session.date < fromDate) return false;
    if (toDate && session.date > toDate) return false;
    if (!normalizedQuery) return true;
    const subject = state.subjects.find((item) => item.id === session.subjectId);
    const activity = lifeActivity(session.subjectId, state.lifeActivities);
    return [session.task, session.note, session.date, subject?.name, subject?.shortName, activity?.name]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(normalizedQuery));
  });
  const dates = Array.from(new Set(filteredSessions.map((item) => item.date))).sort().reverse();
  const filteredMinutes = filteredSessions.reduce((sum, item) => sum + item.actualMinutes, 0);
  const hasFilters = Boolean(normalizedQuery || categoryId !== "all" || fromDate || toDate);

  function clearFilters() {
    setQuery("");
    setCategoryId("all");
    setFromDate("");
    setToDate("");
  }

  return (
    <div className="page-stack narrow-page">
      <div className="page-actions">
        <p className="muted">显示 {filteredSessions.length} / {state.sessions.length} 条 · 合计 {formatMinutes(filteredMinutes)}</p>
        <div className="button-row compact-buttons">
          <button className="primary-button" onClick={onRecord}><Plus size={17} />新增记录</button>
        </div>
      </div>
      <section className="records-filter-panel" aria-label="筛选时间记录">
        <label className="records-search"><span>搜索任务、备注或类别</span><div><Search size={16} /><input type="search" value={query} placeholder="例如：电路、真题、复盘" onChange={(event) => setQuery(event.target.value)} /></div></label>
        <label><span>科目 / 活动</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">全部类别</option><optgroup label="考试科目">{state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</optgroup><optgroup label="生活活动">{state.lifeActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</optgroup></select></label>
        <label><span>开始日期</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label><span>结束日期</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
        <button type="button" className="secondary-button records-clear" disabled={!hasFilters} onClick={clearFilters}><FilterX size={16} />清除筛选</button>
      </section>
      {dates.length ? dates.map((date) => (
        <section className="panel" key={date}>
          <div className="panel-heading"><div><p className="card-kicker">{date}</p><h2>实际时间记录图</h2></div><strong>{formatMinutes(sessionsForDate(filteredSessions, date).reduce((sum, item) => sum + item.actualMinutes, 0))}</strong></div>
          <DayScheduleChart entries={sessionsForDate(filteredSessions, date)} state={state} mode="actual" />
          <div className="schedule-table-divider" />
            <EditableSessionTable sessions={sessionsForDate(filteredSessions, date)} state={state} onEdit={onEdit} onDelete={onDelete} />
        </section>
      )) : <section className="panel">{state.sessions.length ? <EmptyState icon={Search} title="没有匹配的时间记录" detail="调整关键词、类别或日期范围后再试。" action="清除全部筛选" onAction={clearFilters} /> : <EmptyState icon={Clock3} title="记录会按日期沉淀在这里" detail="完成第一条记录后，可在这里查看全部历史。" action="新增记录" onAction={onRecord} />}</section>}
    </div>
  );
}
