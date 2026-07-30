import { Download, FileUp, Plus, Save, Target, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  CANONICAL_EXPERIENCE_SUBJECTS,
  createEmptyExperience,
  createEmptyExperienceSubject,
  createExperienceArchive,
  parseExperienceImport,
  type DatePrecision,
  type ExperienceMilestone,
  type ExperiencePost,
  type ExperienceSubject,
} from "./experience-data";
import type { StudyState } from "./study-state";

type Props = {
  state: StudyState;
  updateState: (updater: (current: StudyState) => StudyState) => void;
};

const CANONICAL_IDS = new Set<string>(CANONICAL_EXPERIENCE_SUBJECTS.map((item) => item.id));

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function listText(items: string[]) {
  return items.join("\n");
}

function textList(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function pageText(items: number[]) {
  return items.join(", ");
}

function pageList(value: string) {
  return value.split(/[,，\s]+/).map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

export default function ExperiencesView({ state, updateState }: Props) {
  const importRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState(state.fastestExperienceId || state.experiences[0]?.id || "");
  const selected = state.experiences.find((item) => item.id === selectedId) ?? state.experiences[0];

  function updateExperience(id: string, changes: Partial<ExperiencePost>) {
    updateState((current) => ({
      ...current,
      experiences: current.experiences.map((item) => item.id === id ? { ...item, ...changes } : item),
    }));
  }

  function updateSubject(experienceId: string, subjectId: string, changes: Partial<ExperienceSubject>) {
    updateState((current) => ({
      ...current,
      experiences: current.experiences.map((item) => item.id === experienceId
        ? { ...item, subjects: item.subjects.map((subject) => subject.id === subjectId ? { ...subject, ...changes } : subject) }
        : item),
    }));
  }

  function updateMilestone(experienceId: string, subjectId: string, milestoneId: string, changes: Partial<ExperienceMilestone>) {
    updateState((current) => ({
      ...current,
      experiences: current.experiences.map((item) => item.id === experienceId
        ? {
            ...item,
            subjects: item.subjects.map((subject) => subject.id === subjectId
              ? { ...subject, milestones: subject.milestones.map((entry) => entry.id === milestoneId ? { ...entry, ...changes } : entry) }
              : subject),
          }
        : item),
    }));
  }

  function addExperience() {
    const experience = createEmptyExperience();
    updateState((current) => ({ ...current, experiences: [...current.experiences, experience] }));
    setSelectedId(experience.id);
  }

  function deleteExperience(experience: ExperiencePost) {
    if (state.experiences.length <= 1) {
      window.alert("至少保留一条经验。你可以清空当前经验的字段，或先新增一条再删除。");
      return;
    }
    if (!window.confirm(`确定删除“${experience.title}”？此操作只影响当前账号，且无法撤销。`)) return;
    const remaining = state.experiences.filter((item) => item.id !== experience.id);
    updateState((current) => ({
      ...current,
      experiences: current.experiences.filter((item) => item.id !== experience.id),
      fastestExperienceId: current.fastestExperienceId === experience.id ? remaining[0].id : current.fastestExperienceId,
    }));
    setSelectedId(remaining[0].id);
  }

  function addSubject(experience: ExperiencePost) {
    const subject = createEmptyExperienceSubject();
    updateExperience(experience.id, { subjects: [...experience.subjects, subject] });
  }

  function deleteSubject(experience: ExperiencePost, subject: ExperienceSubject) {
    if (CANONICAL_IDS.has(subject.id)) return;
    if (!window.confirm(`确定删除自定义科目“${subject.name}”及其结构化内容？`)) return;
    updateExperience(experience.id, { subjects: experience.subjects.filter((item) => item.id !== subject.id) });
  }

  function addMilestone(experience: ExperiencePost, subject: ExperienceSubject) {
    const milestone: ExperienceMilestone = {
      id: crypto.randomUUID(),
      title: "新阶段",
      startMonthDay: "",
      endMonthDay: "",
      detail: "",
      workload: "",
      sourcePages: [],
      datePrecision: "explicit",
    };
    updateSubject(experience.id, subject.id, { milestones: [...subject.milestones, milestone] });
  }

  function importExperiences(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseExperienceImport(JSON.parse(String(reader.result)));
        if (!imported) throw new Error("invalid");
        updateState((current) => {
          const byId = new Map(current.experiences.map((item) => [item.id, item]));
          for (const experience of imported.experiences) byId.set(experience.id, experience);
          const next = [...byId.values()];
          const importedFastest = imported.fastestExperienceId
            && next.some((item) => item.id === imported.fastestExperienceId)
            ? imported.fastestExperienceId
            : current.fastestExperienceId;
          return { ...current, experiences: next, fastestExperienceId: importedFastest };
        });
        setSelectedId(imported.experiences[0].id);
        window.alert(`导入完成：${imported.experiences.length} 条经验。相同 ID 已更新，不同 ID 已追加；未识别扩展字段会随对象保留并可再次导出。`);
      } catch {
        window.alert("无法导入：请选择经验贴页面导出的 JSON、经验数组或单条经验对象。");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="page-stack experience-page">
      <section className="panel experience-hero">
        <div>
          <p className="card-kicker">结构化经验库</p>
          <h2>{state.experiences.length} 位考生 · {state.experiences.reduce((sum, item) => sum + item.subjects.length, 0)} 份科目经验</h2>
          <p>集中管理不同院校、专业与科目的备考经验。每条经验都可自由配置科目与阶段，并可任选一条作为动态进度参考。</p>
        </div>
        <div className="heading-actions">
          <button className="primary-button" onClick={addExperience}><Plus size={16} />新增经验</button>
          <button className="secondary-button" onClick={() => downloadJson(createExperienceArchive(state.experiences, state.fastestExperienceId), "考研经验贴-结构化数据.json")}><Download size={16} />导出 JSON</button>
          <button className="secondary-button" onClick={() => importRef.current?.click()}><FileUp size={16} />导入 JSON</button>
          <input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) importExperiences(file); event.target.value = ""; }} />
        </div>
      </section>

      <section className="experience-layout">
        <aside className="experience-index">
          {state.experiences.map((experience) => (
            <button key={experience.id} className={selected?.id === experience.id ? "active" : ""} onClick={() => setSelectedId(experience.id)}>
              <span>{experience.id === state.fastestExperienceId ? "快线基准" : experience.authorLabel || "经验"}</span>
              <strong>{experience.title}</strong>
              <small>{experience.totalScore ? `${experience.totalScore} 分` : "未填总分"} · {experience.prepStartLabel || "未填起点"}</small>
            </button>
          ))}
        </aside>

        {selected && (
          <div className="experience-editor">
            <section className="panel">
              <div className="panel-heading">
                <div><p className="card-kicker">一人一条 · 基本信息</p><h2>{selected.title}</h2></div>
                <div className="heading-actions">
                  <button className={selected.id === state.fastestExperienceId ? "primary-button" : "secondary-button"} onClick={() => updateState((current) => ({ ...current, fastestExperienceId: selected.id }))}><Target size={15} />{selected.id === state.fastestExperienceId ? "当前快线" : "设为快线"}</button>
                  <button className="danger-button" onClick={() => deleteExperience(selected)}><Trash2 size={15} />删除</button>
                </div>
              </div>
              <div className="experience-basic-grid">
                <label className="wide"><span>标题</span><input value={selected.title} onChange={(event) => updateExperience(selected.id, { title: event.target.value })} /></label>
                <label><span>署名 / 身份</span><input value={selected.authorLabel} onChange={(event) => updateExperience(selected.id, { authorLabel: event.target.value })} /></label>
                <label><span>总分</span><input type="number" min="0" max="500" value={selected.totalScore ?? ""} onChange={(event) => updateExperience(selected.id, { totalScore: event.target.value ? Number(event.target.value) : undefined })} /></label>
                <label><span>目标院校</span><input value={selected.school} onChange={(event) => updateExperience(selected.id, { school: event.target.value })} /></label>
                <label><span>专业</span><input value={selected.major} onChange={(event) => updateExperience(selected.id, { major: event.target.value })} /></label>
                <label><span>启动月日（MM-DD）</span><input placeholder="07-15" value={selected.prepStartMonthDay} onChange={(event) => updateExperience(selected.id, { prepStartMonthDay: event.target.value })} /></label>
                <label><span>启动说明</span><input value={selected.prepStartLabel} onChange={(event) => updateExperience(selected.id, { prepStartLabel: event.target.value })} /></label>
                <label className="wide"><span>每日时长 / 作息</span><input value={selected.dailyHours} onChange={(event) => updateExperience(selected.id, { dailyHours: event.target.value })} /></label>
                <label className="wide"><span>路线概览</span><textarea rows={4} value={selected.overview} onChange={(event) => updateExperience(selected.id, { overview: event.target.value })} /></label>
                <label className="wide"><span>全局建议（每行一条）</span><textarea rows={4} value={listText(selected.overallAdvice)} onChange={(event) => updateExperience(selected.id, { overallAdvice: textList(event.target.value) })} /></label>
              </div>
            </section>

            <section className="experience-subjects">
              <div className="experience-section-heading"><div><p className="card-kicker">科目结构</p><h2>默认数一、英一、电路、政治；可继续扩展</h2></div><button className="secondary-button" onClick={() => addSubject(selected)}><Plus size={15} />自定义科目</button></div>
              {selected.subjects.map((subject) => (
                <ExperienceSubjectEditor
                  key={subject.id}
                  state={state}
                  experience={selected}
                  subject={subject}
                  onUpdate={(changes) => updateSubject(selected.id, subject.id, changes)}
                  onUpdateMilestone={(milestoneId, changes) => updateMilestone(selected.id, subject.id, milestoneId, changes)}
                  onAddMilestone={() => addMilestone(selected, subject)}
                  onDeleteMilestone={(milestoneId) => updateSubject(selected.id, subject.id, { milestones: subject.milestones.filter((item) => item.id !== milestoneId) })}
                  onDelete={() => deleteSubject(selected, subject)}
                />
              ))}
            </section>

            <section className="panel source-preservation">
              <div className="panel-heading"><div><p className="card-kicker">来源与保真</p><h2>核心内容保留区</h2></div><Save size={18} /></div>
              <div className="experience-basic-grid">
                <label className="wide"><span>来源文件</span><input value={selected.source.document} onChange={(event) => updateExperience(selected.id, { source: { ...selected.source, document: event.target.value } })} /></label>
                <label><span>PDF 页码</span><input value={pageText(selected.source.pdfPages)} onChange={(event) => updateExperience(selected.id, { source: { ...selected.source, pdfPages: pageList(event.target.value) } })} /></label>
                <label><span>印刷页码</span><input value={pageText(selected.source.printedPages)} onChange={(event) => updateExperience(selected.id, { source: { ...selected.source, printedPages: pageList(event.target.value) } })} /></label>
                <label className="wide"><span>结构化说明</span><textarea rows={3} value={selected.source.note} onChange={(event) => updateExperience(selected.id, { source: { ...selected.source, note: event.target.value } })} /></label>
                <label className="wide"><span>不可丢失的原文事实（每行一条）</span><textarea rows={4} value={listText(selected.preservedText)} onChange={(event) => updateExperience(selected.id, { preservedText: textList(event.target.value) })} /></label>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function ExperienceSubjectEditor({ state, experience, subject, onUpdate, onUpdateMilestone, onAddMilestone, onDeleteMilestone, onDelete }: {
  state: StudyState;
  experience: ExperiencePost;
  subject: ExperienceSubject;
  onUpdate: (changes: Partial<ExperienceSubject>) => void;
  onUpdateMilestone: (milestoneId: string, changes: Partial<ExperienceMilestone>) => void;
  onAddMilestone: () => void;
  onDeleteMilestone: (milestoneId: string) => void;
  onDelete: () => void;
}) {
  const subjectPhases = state.subjects.find((item) => item.id === subject.id)?.phases ?? [];
  return (
    <details className="panel experience-subject" open={subject.id === "math"}>
      <summary><span>{subject.shortName}</span><strong>{subject.name}</strong><em>{subject.score ? `${subject.score} 分` : `${subject.milestones.length} 个阶段`}</em></summary>
      <div className="experience-subject-body">
        <div className="experience-basic-grid compact-grid">
          <label><span>科目名称</span><input value={subject.name} onChange={(event) => onUpdate({ name: event.target.value })} /></label>
          <label><span>简称</span><input value={subject.shortName} onChange={(event) => onUpdate({ shortName: event.target.value })} /></label>
          <label><span>分数</span><input type="number" min="0" max="200" value={subject.score ?? ""} onChange={(event) => onUpdate({ score: event.target.value ? Number(event.target.value) : undefined })} /></label>
          {!CANONICAL_IDS.has(subject.id) && <button className="danger-button subject-delete" onClick={onDelete}><Trash2 size={14} />删除自定义科目</button>}
          <label className="wide"><span>核心路线概述</span><textarea rows={3} value={subject.summary} onChange={(event) => onUpdate({ summary: event.target.value })} /></label>
          <label><span>资料（每行一条）</span><textarea rows={6} value={listText(subject.materials)} onChange={(event) => onUpdate({ materials: textList(event.target.value) })} /></label>
          <label><span>方法（每行一条）</span><textarea rows={6} value={listText(subject.methods)} onChange={(event) => onUpdate({ methods: textList(event.target.value) })} /></label>
          <label><span>踩坑（每行一条）</span><textarea rows={5} value={listText(subject.pitfalls)} onChange={(event) => onUpdate({ pitfalls: textList(event.target.value) })} /></label>
          <label><span>原文事实（每行一条）</span><textarea rows={5} value={listText(subject.sourceNotes)} onChange={(event) => onUpdate({ sourceNotes: textList(event.target.value) })} /></label>
          <label className="wide"><span>考试策略</span><textarea rows={3} value={subject.examStrategy} onChange={(event) => onUpdate({ examStrategy: event.target.value })} /></label>
        </div>

        <div className="milestone-heading"><div><p className="card-kicker">时间轴</p><strong>阶段与快线映射</strong></div><button className="secondary-button" onClick={onAddMilestone}><Plus size={14} />新增阶段</button></div>
        <div className="milestone-list">
          {subject.milestones.map((entry) => (
            <article className="milestone-editor" key={entry.id}>
              <label className="milestone-title"><span>阶段名称</span><input value={entry.title} onChange={(event) => onUpdateMilestone(entry.id, { title: event.target.value })} /></label>
              <label><span>对应进度阶段</span>{subjectPhases.length ? <select value={entry.phaseId ?? ""} onChange={(event) => onUpdateMilestone(entry.id, { phaseId: event.target.value || undefined })}><option value="">不参与快线</option>{subjectPhases.map((phase) => <option value={phase.id} key={phase.id}>{phase.name}</option>)}</select> : <input placeholder="phaseId（可选）" value={entry.phaseId ?? ""} onChange={(event) => onUpdateMilestone(entry.id, { phaseId: event.target.value || undefined })} />}</label>
              <label><span>开始 MM-DD</span><input placeholder="07-15" value={entry.startMonthDay} onChange={(event) => onUpdateMilestone(entry.id, { startMonthDay: event.target.value })} /></label>
              <label><span>结束 MM-DD</span><input placeholder="09-15" value={entry.endMonthDay} onChange={(event) => onUpdateMilestone(entry.id, { endMonthDay: event.target.value })} /></label>
              <label><span>日期精度</span><select value={entry.datePrecision} onChange={(event) => onUpdateMilestone(entry.id, { datePrecision: event.target.value as DatePrecision })}><option value="explicit">原文明确</option><option value="approximate">原文约数</option><option value="inferred">据上下文推断</option></select></label>
              <label><span>来源 PDF 页</span><input value={pageText(entry.sourcePages)} onChange={(event) => onUpdateMilestone(entry.id, { sourcePages: pageList(event.target.value) })} /></label>
              <label className="wide"><span>工作量</span><input value={entry.workload} onChange={(event) => onUpdateMilestone(entry.id, { workload: event.target.value })} /></label>
              <label className="wide"><span>阶段详情</span><textarea rows={3} value={entry.detail} onChange={(event) => onUpdateMilestone(entry.id, { detail: event.target.value })} /></label>
              <button className="icon-danger" title="删除阶段" aria-label={`删除 ${entry.title}`} onClick={() => onDeleteMilestone(entry.id)}><Trash2 size={15} /></button>
            </article>
          ))}
          {!subject.milestones.length && <div className="empty-milestones">暂无阶段。新增后填写 MM-DD 时间窗并映射到科目阶段，即可参与动态快线。</div>}
        </div>
      </div>
    </details>
  );
}
