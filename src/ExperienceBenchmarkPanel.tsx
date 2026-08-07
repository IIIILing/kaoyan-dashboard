import { Check, Copy, Route } from "lucide-react";
import { useMemo, useState } from "react";
import { benchmarkPhaseProgress, benchmarkProjectProgress, benchmarkSubjectProgress, type ExperienceMilestone, type ExperiencePost } from "./experience-data";
import { mergeImportedPlans } from "./schedule-data";
import { projectProgress, subjectProgress, type DailyPlan, type StudyState } from "./study-state";

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function milestoneDate(monthDay: string, examDate: string) {
  if (!/^\d{2}-\d{2}$/.test(monthDay) || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return null;
  const result = `${examDate.slice(0, 4)}-${monthDay}`;
  return Number.isNaN(new Date(`${result}T12:00:00`).getTime()) ? null : result;
}

function benchmarkValue(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function deltaLabel(actual: number, benchmark: number | null) {
  if (benchmark === null) return "无映射";
  const delta = actual - benchmark;
  return delta === 0 ? "持平" : delta > 0 ? `领先 ${delta}%` : `落后 ${Math.abs(delta)}%`;
}

export default function ExperienceBenchmarkPanel({ state, updateState }: { state: StudyState; updateState: (updater: (current: StudyState) => StudyState) => void }) {
  const firstId = state.experiences[0]?.id ?? "";
  const secondId = state.experiences.find((item) => item.id !== firstId)?.id ?? firstId;
  const [routeAId, setRouteAId] = useState(firstId);
  const [routeBId, setRouteBId] = useState(state.fastestExperienceId && state.fastestExperienceId !== firstId ? state.fastestExperienceId : secondId);
  const [subjectId, setSubjectId] = useState(state.subjects.find((subject) => subject.id === "circuit")?.id ?? state.subjects[0]?.id ?? "");
  const [feedback, setFeedback] = useState("");
  const routeA = state.experiences.find((item) => item.id === routeAId) ?? state.experiences[0];
  const routeB = state.experiences.find((item) => item.id === routeBId) ?? state.experiences.find((item) => item.id !== routeA?.id) ?? routeA;
  const subject = state.subjects.find((item) => item.id === subjectId) ?? state.subjects[0];
  const today = localDate();
  const rows = useMemo(() => (subject?.phases ?? []).map((phase) => {
    const a = benchmarkPhaseProgress(routeA, subject.id, phase.id, today, state.profile.examDate);
    const b = benchmarkPhaseProgress(routeB, subject.id, phase.id, today, state.profile.examDate);
    const milestoneA = routeA?.subjects.find((item) => item.id === subject.id)?.milestones.find((item) => item.phaseId === phase.id);
    const milestoneB = routeB?.subjects.find((item) => item.id === subject.id)?.milestones.find((item) => item.phaseId === phase.id);
    return { phase, a, b, milestoneA, milestoneB };
  }), [routeA, routeB, state.profile.examDate, subject, today]);
  if (!routeA || !routeB || !subject) return null;
  const projectA = benchmarkProjectProgress(routeA, state.subjects, today, state.profile.examDate);
  const projectB = benchmarkProjectProgress(routeB, state.subjects, today, state.profile.examDate);
  const subjectA = benchmarkSubjectProgress(routeA, subject, today, state.profile.examDate);
  const subjectB = benchmarkSubjectProgress(routeB, subject, today, state.profile.examDate);

  function copyMilestones(experience: ExperiencePost, milestones: ExperienceMilestone[]) {
    const incoming = milestones.flatMap((milestone): DailyPlan[] => {
      const date = milestoneDate(milestone.endMonthDay, state.profile.examDate);
      if (!date) return [];
      return [{ date, items: [{
        id: `experience-plan-${experience.id}-${milestone.id}`,
        start: "20:00",
        end: "20:30",
        subjectId: subject.id,
        task: `阶段验收：${milestone.title}`,
        note: `来自“${experience.title}” · 基准 ${milestone.startMonthDay}–${milestone.endMonthDay}${milestone.workload ? ` · ${milestone.workload}` : ""}`,
      }] }];
    });
    if (!incoming.length) {
      setFeedback("这些节点没有可用的 MM-DD 结束日期，暂未复制。");
      return;
    }
    const preview = mergeImportedPlans(state.plans, incoming);
    updateState((current) => ({ ...current, plans: mergeImportedPlans(current.plans, incoming).plans }));
    const report = preview.report;
    setFeedback(`已复制 ${report.added} 个节点（直接新增 ${report.added - report.shifted} 个，冲突顺延 ${report.shifted} 个）；重复 ${report.duplicates} 个，跳过 ${report.skipped} 个。`);
  }

  const milestonesA = routeA.subjects.find((item) => item.id === subject.id)?.milestones ?? [];
  const milestonesB = routeB.subjects.find((item) => item.id === subject.id)?.milestones ?? [];
  return <section className="panel experience-benchmark-panel">
    <div className="panel-heading"><div><p className="card-kicker">A / B / 我的进度</p><h2>经验路线可执行对照</h2></div><Route size={20} /></div>
    <div className="benchmark-controls">
      <label><span>路线 A</span><select value={routeA.id} onChange={(event) => setRouteAId(event.target.value)}>{state.experiences.map((experience) => <option key={experience.id} value={experience.id}>{experience.title}</option>)}</select></label>
      <label><span>路线 B</span><select value={routeB.id} onChange={(event) => setRouteBId(event.target.value)}>{state.experiences.map((experience) => <option key={experience.id} value={experience.id}>{experience.title}</option>)}</select></label>
      <label><span>对照科目</span><select value={subject.id} onChange={(event) => setSubjectId(event.target.value)}>{state.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </div>
    <div className="benchmark-overview-grid">
      <article><span>我的项目总进度</span><strong>{projectProgress(state.subjects)}%</strong><small>{subject.name} {subjectProgress(subject)}%</small></article>
      <article><span>路线 A · {routeA.totalScore ? `${routeA.totalScore} 分` : "未填分数"}</span><strong>{benchmarkValue(projectA)}</strong><small>{subject.shortName} {benchmarkValue(subjectA)} · {routeA.prepStartLabel}</small></article>
      <article><span>路线 B · {routeB.totalScore ? `${routeB.totalScore} 分` : "未填分数"}</span><strong>{benchmarkValue(projectB)}</strong><small>{subject.shortName} {benchmarkValue(subjectB)} · {routeB.prepStartLabel}</small></article>
    </div>
    <div className="benchmark-table-scroll"><table className="benchmark-table"><thead><tr><th>我的阶段</th><th>我的进度</th><th>路线 A 应达</th><th>路线 B 应达</th><th>节点动作</th></tr></thead><tbody>{rows.map(({ phase, a, b, milestoneA, milestoneB }) => <tr key={phase.id}>
      <td><strong>{phase.name}</strong><small>权重 {phase.weight}%</small></td>
      <td><strong>{phase.progress}%</strong></td>
      <td><strong>{benchmarkValue(a)}</strong><small className={a !== null && phase.progress < a ? "negative" : "positive"}>{deltaLabel(phase.progress, a)}</small></td>
      <td><strong>{benchmarkValue(b)}</strong><small className={b !== null && phase.progress < b ? "negative" : "positive"}>{deltaLabel(phase.progress, b)}</small></td>
      <td><div>{milestoneA && <button onClick={() => copyMilestones(routeA, [milestoneA])}><Copy size={13} />A 节点</button>}{milestoneB && <button onClick={() => copyMilestones(routeB, [milestoneB])}><Copy size={13} />B 节点</button>}{!milestoneA && !milestoneB && <span>暂无映射</span>}</div></td>
    </tr>)}</tbody></table></div>
    <div className="benchmark-copy-footer"><div>{feedback ? <><Check size={16} /><span>{feedback}</span></> : <span>节点会写入其结束日期的 20:00–20:30；若冲突则自动顺延，不覆盖已有计划。</span>}</div><div><button className="secondary-button" onClick={() => copyMilestones(routeA, milestonesA)}><Copy size={15} />复制路线 A 全部节点</button><button className="secondary-button" onClick={() => copyMilestones(routeB, milestonesB)}><Copy size={15} />复制路线 B 全部节点</button></div></div>
  </section>;
}
