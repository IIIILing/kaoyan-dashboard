import { BookOpen, CalendarDays, Check, ChevronRight, CircleGauge, Plus, TimerReset } from "lucide-react";
import LearningCalendar from "../components/LearningCalendar";
import { EmptyState, MiniTrend, ProgressRing, ScoreRow } from "../components/ui";
import { lifeActivity } from "../lib/activities";
import { localDate, recentDates } from "../lib/dates";
import { sessionsForDate, type DailyMetrics } from "../lib/scoring";
import type { View } from "../lib/types";
import { phaseForecast } from "../progress-forecast";
import { subjectProgress, type StudySession, type StudyState } from "../study-state";

export default function Overview({ state, todaySessions, metrics, progress, projectScore, days, onRecord, onNavigate }: {
  state: StudyState;
  todaySessions: StudySession[];
  metrics: DailyMetrics;
  progress: number;
  projectScore: number;
  days: number;
  onRecord: () => void;
  onNavigate: (view: View) => void;
}) {
  const today = localDate();
  const phasePaces = state.subjects.flatMap((subject) => subject.phases.map((phase) => ({ subject, phase, forecast: phaseForecast(phase, today) })))
    .filter((item) => item.forecast.configured)
    .sort((a, b) => a.forecast.progressDelta - b.forecast.progressDelta)
    .slice(0, 4);
  return (
    <div className="page-stack">
      <section className="countdown-line"><CalendarDays size={19} /><span>距离暂定初试日期</span><strong>{days}</strong><span>天</span></section>
      <section className="hero-grid">
        <article className="metric-card score-card">
          <div><p className="card-kicker">今日得分</p><strong className="mega-number">{metrics.score}</strong><p className="muted">综合学习质量、学习时段、睡眠和运动计算</p></div>
          <ProgressRing value={metrics.score} label="/ 100" />
        </article>
        <article className="metric-card hours-card">
          <p className="card-kicker">有效学习</p>
          <div className="hours-value"><strong>{(metrics.actualMinutes / 60).toFixed(1)}</strong><span>h / 目标 {state.profile.dailyTargetHours}h</span></div>
          <div className="progress-track"><i style={{ width: `${metrics.hourRatio * 100}%` }} /></div>
          <p className="progress-caption">{Math.round(metrics.hourRatio * 100)}%</p>
        </article>
        <button className="record-cta" onClick={onRecord}>
          <div className="cta-icon"><Plus size={28} /></div>
          <div><span>快速记录</span><strong>记录当前时段</strong></div>
          <ChevronRight size={24} />
        </button>
      </section>

      <section className="content-grid">
        <article className="panel timeline-panel">
          <div className="panel-heading"><div><p className="card-kicker">今日执行</p><h2>时间线</h2></div><button className="text-button" onClick={() => onNavigate("records")}>查看全部 <ChevronRight size={15} /></button></div>
          {todaySessions.length ? (
            <div className="timeline-list">
              {todaySessions.slice(0, 4).map((session) => (
                <div className="timeline-item" key={session.id}>
                  <span className="timeline-dot"><Check size={13} /></span>
                  <time>{session.start}–{session.end}</time>
                  <strong>{session.task}</strong>
                  <span>{lifeActivity(session.subjectId, state.lifeActivities)?.name ?? `${session.completion}%`}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={TimerReset} title="今天还没有学习记录" detail="先记录一个真实时段，评分会从第一条数据开始。" action="开始记录" onAction={onRecord} />
          )}
        </article>
        <article className="panel breakdown-panel">
          <div className="panel-heading"><div><p className="card-kicker">总进度评分</p><h2>项目健康度</h2></div><span className="score-badge">{projectScore}</span></div>
          <ScoreRow label="考研总进度" value={progress} max={100} />
          <ScoreRow label="今日执行" value={metrics.score} max={100} />
          <ScoreRow label="科目启动" value={state.subjects.filter((s) => subjectProgress(s) > 0).length} max={state.subjects.length} />
          <div className="formula-note"><CircleGauge size={16} />总评分 = 总进度 50% + 近7日 25% + 近30日 10% + 科目均衡 15%</div>
        </article>
      </section>

      <section className="panel overview-pace-panel">
        <div className="panel-heading"><div><p className="card-kicker">阶段速度</p><h2>现在快了还是慢了？</h2></div><button className="text-button" onClick={() => onNavigate("subjects")}>设置阶段目标 <ChevronRight size={15} /></button></div>
        {phasePaces.length ? <div className="overview-pace-grid">{phasePaces.map(({ subject, phase, forecast }) => <button type="button" key={phase.id} onClick={() => onNavigate("subjects")}><span className="subject-indicator" style={{ background: subject.accent }} /><div><small>{subject.shortName}</small><strong>{phase.name}</strong><span>当前 {phase.progress}% · 应达 {forecast.expectedProgress}%</span></div><div className={forecast.progressDelta < 0 ? "behind" : "ahead"}><strong>{forecast.progressDelta < 0 ? `落后 ${Math.abs(forecast.progressDelta)}% ≈ ${Math.abs(forecast.scheduleDays)} 天` : `领先 ${forecast.progressDelta}% ≈ ${Math.abs(forecast.scheduleDays)} 天`}</strong><span>预计完成 {forecast.estimatedCompletionDate ?? "等待进度历史"}</span></div></button>)}</div> : <div className="schedule-empty">为阶段填写开始日期、截止日期与目标进度后，这里会优先显示最需要关注的阶段。</div>}
      </section>

      <InputOutputPanel state={state} onNavigate={onNavigate} />

      <LearningCalendar state={state} />

      <section className="subject-grid">
        {state.subjects.map((subject) => {
          const value = subjectProgress(subject);
          return (
            <button className="subject-card" key={subject.id} onClick={() => onNavigate("subjects")}>
              <div className="subject-title"><div><span>{subject.shortName}</span><strong>{subject.name}</strong></div><BookOpen size={20} /></div>
              <ProgressRing value={value} compact color={subject.accent} />
              <p>{subject.note}</p>
            </button>
          );
        })}
      </section>
    </div>
  );
}

function InputOutputPanel({ state, onNavigate }: { state: StudyState; onNavigate: (view: View) => void }) {
  const latestExam = [...state.examRecords].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!latestExam) return <section className="panel input-output-panel"><div className="panel-heading"><div><p className="card-kicker">投入 × 产出</p><h2>学习时长与成绩趋势</h2></div><button className="text-button" onClick={() => onNavigate("exams")}>记录第一套试卷 <ChevronRight size={15} /></button></div><div className="schedule-empty">记录真题或模考成绩后，这里会把对应科目的学习投入和正确率放在一起观察。</div></section>;
  const subject = state.subjects.find((item) => item.id === latestExam.subjectId);
  const dates = recentDates(14);
  const inputValues = dates.map((date) => sessionsForDate(state.sessions, date).filter((session) => session.subjectId === latestExam.subjectId).reduce((sum, session) => sum + session.actualMinutes, 0));
  const exams = state.examRecords.filter((record) => record.subjectId === latestExam.subjectId).sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
  const inputTotal = inputValues.slice(-7).reduce((sum, value) => sum + value, 0);
  return <section className="panel input-output-panel"><div className="panel-heading"><div><p className="card-kicker">投入 × 产出 · {subject?.shortName ?? "科目"}</p><h2>学习时长与成绩趋势</h2></div><button className="text-button" onClick={() => onNavigate("exams")}>查看成绩模块 <ChevronRight size={15} /></button></div><div className="input-output-grid"><MiniTrend label="投入：近 7 天学习" value={`${(inputTotal / 60).toFixed(1)}h`} detail="曲线为近 14 天每日分钟数" values={inputValues} color="var(--accent)" /><MiniTrend label="产出：最近正确率" value={`${latestExam.correctRate}%`} detail={exams.map((exam) => `${exam.correctRate}%`).join(" → ")} values={exams.map((exam) => exam.correctRate)} color="var(--success)" /></div></section>;
}
