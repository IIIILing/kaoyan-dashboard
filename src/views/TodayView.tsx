import { useState } from "react";
import { Clock3, Copy, Plus, Save, Trash2 } from "lucide-react";
import { confirmDialog, promptDialog } from "../components/dialog-service";
import { DayScheduleChart, EditablePlanTable, EditableSessionTable } from "../components/tables";
import { EmptyState } from "../components/ui";
import { dateOffset, localDate } from "../lib/dates";
import { formatMinutes, minutesBetween } from "../lib/format";
import type { DailyMetrics } from "../lib/scoring";
import type { DailyPlan, PlanItem, PlanTemplate, StudySession, StudyState } from "../study-state";

function clonePlanItems(items: PlanItem[]) {
  return items.map((item) => ({ ...item, id: crypto.randomUUID() }));
}

export default function TodayView({ state, plan, sessions, metrics, planDate, onPlanDateChange, updateState, onAddPlan, onRecord, onStartPlan, onEditPlan, onEditSession, onDeleteSession, onDeletePlan }: {
  state: StudyState;
  plan: DailyPlan;
  sessions: StudySession[];
  metrics: DailyMetrics;
  planDate: string;
  onPlanDateChange: (date: string) => void;
  updateState: (updater: (current: StudyState) => StudyState) => void;
  onAddPlan: () => void;
  onRecord: () => void;
  onStartPlan: (item: PlanItem) => void;
  onEditPlan: (item: PlanItem) => void;
  onEditSession: (session: StudySession) => void;
  onDeleteSession: (id: string) => void;
  onDeletePlan: (id: string) => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const selectedTemplate = state.planTemplates.find((template) => template.id === selectedTemplateId)
    ?? state.planTemplates[0];
  const previousPlanDate = dateOffset(planDate, -1);
  const previousPlan = state.plans.find((item) => item.date === previousPlanDate);
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

  async function saveAsTemplate() {
    if (!plan.items.length) return;
    const name = await promptDialog({
      title: "保存为计划模板",
      message: "请输入模板名称，例如：高强度数学日",
      placeholder: "例如：高强度数学日",
    });
    if (!name?.trim()) return;
    const template: PlanTemplate = { id: crypto.randomUUID(), name: name.trim(), items: clonePlanItems(plan.items) };
    updateState((current) => ({ ...current, planTemplates: [...current.planTemplates, template] }));
    setSelectedTemplateId(template.id);
  }

  async function copyPreviousPlan() {
    if (!previousPlan?.items.length) return;
    if (plan.items.length && !await confirmDialog({
      title: "复制前一天计划",
      message: `复制 ${previousPlanDate} 的计划会替换当前日期已有计划，是否继续？`,
      confirmLabel: "继续",
    })) return;
    replaceTodayPlan(clonePlanItems(previousPlan.items));
  }

  async function applyTemplate() {
    if (!selectedTemplate) return;
    if (plan.items.length && !await confirmDialog({
      title: "应用计划模板",
      message: `应用“${selectedTemplate.name}”会替换今天已有计划，是否继续？`,
      confirmLabel: "继续",
    })) return;
    replaceTodayPlan(clonePlanItems(selectedTemplate.items));
  }

  async function deleteTemplate() {
    if (!selectedTemplate) return;
    if (!await confirmDialog({
      title: "删除计划模板",
      message: `确定删除计划模板“${selectedTemplate.name}”？`,
      danger: true,
      confirmLabel: "删除",
    })) return;
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
          <button className="secondary-button" disabled={!previousPlan?.items.length} title={previousPlan?.items.length ? `复制 ${previousPlanDate} 的 ${previousPlan.items.length} 个时段` : `${previousPlanDate} 没有计划`} onClick={copyPreviousPlan}><Copy size={16} />复制前一天</button>
          <button className="secondary-button" disabled={!plan.items.length} onClick={saveAsTemplate}><Save size={16} />保存为模板</button>
        </div>
      </div>
      <section className="panel schedule-panel">
        <div className="panel-heading"><div><p className="card-kicker">{plan.date}</p><h2>{plan.date === localDate() ? "今日" : "当日"}计划安排图</h2></div><span className="muted">按计划时段生成</span></div>
        <DayScheduleChart entries={plan.items} state={state} mode="planned" />
        {plan.items.length > 0 && <><div className="schedule-table-divider" /><EditablePlanTable items={plan.items} sessions={state.sessions} state={state} canStart={planDate === localDate()} onStart={onStartPlan} onEdit={onEditPlan} onDelete={onDeletePlan} /></>}
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
