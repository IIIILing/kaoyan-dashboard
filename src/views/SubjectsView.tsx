import { useRef, useState } from "react";
import { Download, FileUp, Plus } from "lucide-react";
import { PhaseEditorDialog, alertDialog, confirmDialog } from "../components/dialogs";
import { ProgressRing } from "../components/ui";
import { benchmarkPhaseProgress, benchmarkProjectProgress, benchmarkSubjectProgress } from "../experience-data";
import { localDate } from "../lib/dates";
import { downloadFile } from "../lib/format";
import { phaseForecast, recordPhaseProgress } from "../progress-forecast";
import { projectProgress, subjectProgress, type Phase, type StudyState, type Subject } from "../study-state";

export default function SubjectsView({ state, updateState }: { state: StudyState; updateState: (updater: (current: StudyState) => StudyState) => void }) {
  const importRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<{ subjectId: string; phaseId: string } | null>(null);
  const today = localDate();
  const fastestExperience = state.experiences.find((item) => item.id === state.fastestExperienceId);
  const fastestProjectProgress = benchmarkProjectProgress(fastestExperience, state.subjects, today, state.profile.examDate);

  async function addPhase(subject: Subject) {
    if (!await confirmDialog({
      title: "新增复习阶段",
      message: `即将在“${subject.name}”中新增复习阶段。新增后会改变总进度的权重结构，是否继续？`,
      confirmLabel: "继续",
    })) return;
    const phase: Phase = { id: crypto.randomUUID(), name: "新阶段", weight: 10, progress: 0, startDate: today, targetDate: state.profile.examDate, targetProgress: 100, progressHistory: [{ date: today, progress: 0 }], resources: [] };
    updateState((current) => ({
      ...current,
      subjects: current.subjects.map((item) => item.id === subject.id ? { ...item, phases: [...item.phases, phase] } : item),
    }));
    setEditing({ subjectId: subject.id, phaseId: phase.id });
  }

  function exportSubjects() {
    downloadFile(JSON.stringify({ kind: "kaoyan-subject-progress", version: 1, subjects: state.subjects }, null, 2), "科目进度配置.json");
  }

  function importSubjects(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as { subjects?: Subject[] };
        if (!Array.isArray(parsed.subjects) || !parsed.subjects.every((subject) => subject.id && subject.name && Array.isArray(subject.phases))) throw new Error("invalid");
        if (!await confirmDialog({
          title: "替换科目配置",
          message: "导入会替换当前全部科目、阶段和资料进度，时间记录仍会保留。是否继续？",
          confirmLabel: "替换",
          danger: true,
        })) return;
        updateState((current) => ({
          ...current,
          subjects: parsed.subjects!.map((subject) => ({
            ...subject,
            phases: subject.phases.map((phase) => ({ ...phase, resources: Array.isArray(phase.resources) ? phase.resources : [] })),
          })),
        }));
      } catch {
        void alertDialog({ title: "无法导入", message: "请选择由科目进度页面导出的 JSON 文件。" });
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="page-stack">
      <section className="progress-hero panel">
        <div>
          <p className="card-kicker">加权总进度 · 动态对比</p>
          <div className="project-comparison-values"><strong>{projectProgress(state.subjects)}%</strong><span>我的进度</span>{fastestProjectProgress !== null && <><strong className="fast-value">{fastestProjectProgress}%</strong><span>快线今日应达</span></>}</div>
          <p className="muted">基准：{fastestExperience?.title ?? "未选择"}；按 {today} 与考试年份动态换算。阶段日期若为推断值，可在经验贴页核对来源标记。</p>
        </div>
        <div className="progress-hero-actions"><div className="ring-comparison"><ProgressRing value={projectProgress(state.subjects)} /><span>我 / 快线 {fastestProjectProgress ?? "—"}%</span></div><div className="button-row"><button className="secondary-button" onClick={exportSubjects}><Download size={16} />导出科目 JSON</button><button className="secondary-button" onClick={() => importRef.current?.click()}><FileUp size={16} />导入科目 JSON</button></div><input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) importSubjects(file); event.target.value = ""; }} /></div>
      </section>
      <section className="subject-detail-grid">
        {state.subjects.map((subject) => {
          const subjectBenchmark = benchmarkSubjectProgress(fastestExperience, subject, today, state.profile.examDate);
          return (
          <article className="panel subject-detail" key={subject.id}>
            <div className="panel-heading"><div><p className="card-kicker">占总计划 {subject.weight}%</p><h2>{subject.name}</h2></div><div className="heading-actions"><div className="subject-comparison-badges"><span className="score-badge" style={{ color: subject.accent }}>我 {subjectProgress(subject)}%</span>{subjectBenchmark !== null && <span className="benchmark-badge">快线 {subjectBenchmark}%</span>}</div><button className="secondary-button" onClick={() => addPhase(subject)}><Plus size={15} />新增阶段</button></div></div>
            <p className="subject-note">{subject.note}</p>
            <div className="phase-list">
              {subject.phases.map((phase) => {
                const benchmark = benchmarkPhaseProgress(fastestExperience, subject.id, phase.id, today, state.profile.examDate);
                const forecast = phaseForecast(phase, today);
                const paceLabel = forecast.progressDelta < 0
                  ? `落后 ${Math.abs(forecast.progressDelta)}% ≈ ${Math.abs(forecast.scheduleDays)} 天`
                  : forecast.progressDelta > 0
                    ? `领先 ${forecast.progressDelta}% ≈ ${Math.abs(forecast.scheduleDays)} 天`
                    : "进度与计划一致";
                return (
                <div className="phase-entry" key={phase.id}>
                <div className="phase-row comparison-row">
                  <button className="phase-open" onClick={() => setEditing({ subjectId: subject.id, phaseId: phase.id })}><span>{phase.name}</span><small>阶段权重 {phase.weight}% · {phase.resources.length} 项资料</small></button>
                  <div className="comparison-slider">
                    <input aria-label={`${subject.name}${phase.name}我的进度`} type="range" min="0" max="100" value={phase.progress} onChange={(event) => {
                      const value = Number(event.target.value);
                      updateState((current) => ({ ...current, subjects: current.subjects.map((item) => item.id === subject.id ? { ...item, phases: item.phases.map((p) => p.id === phase.id ? recordPhaseProgress(p, value, today) : p) } : item) }));
                    }} style={{
                      "--range-color": subject.accent,
                      "--range-progress": `${Math.min(100, Math.max(0, phase.progress))}%`,
                    } as React.CSSProperties} />
                    {benchmark !== null && <span className="benchmark-marker" style={{ left: `${benchmark}%` }} title={`快线今日应达 ${benchmark}%`} />}
                    <div className="comparison-legend"><span style={{ color: subject.accent }}>我的 {phase.progress}%</span><span>快线 {benchmark ?? "—"}%</span></div>
                  </div>
                  <strong className={benchmark !== null && phase.progress < benchmark ? "behind" : "ahead"}>{benchmark === null ? "—" : `${phase.progress - benchmark >= 0 ? "+" : ""}${phase.progress - benchmark}`}</strong>
                </div>
                {forecast.configured && <div className="phase-pace-strip"><div><span>当前</span><strong>{phase.progress}%</strong></div><div><span>按计划应达</span><strong>{forecast.expectedProgress}%</strong></div><div className={forecast.progressDelta < 0 ? "behind" : "ahead"}><span>进度速度</span><strong>{paceLabel}</strong></div><div><span>按近 14 天速度预计</span><strong>{forecast.estimatedCompletionDate ?? "暂无足够历史"}</strong><small>{forecast.recentDailySpeed === null ? "至少跨两天记录进度" : `${forecast.recentDailySpeed.toFixed(1)}% / 天`}</small></div></div>}
                </div>
              )})}
            </div>
          </article>
        )})}
      </section>
      {editing && <PhaseEditorDialog state={state} subjectId={editing.subjectId} phaseId={editing.phaseId} updateState={updateState} onClose={() => setEditing(null)} />}
    </div>
  );
}
