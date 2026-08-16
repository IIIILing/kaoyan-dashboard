import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { confirmDialog } from "../components/dialogs";
import { ProgressRing } from "../components/ui";
import { formatMinutes } from "../lib/format";
import type { PeriodSummary } from "../lib/scoring";
import {
  defaultStudyState,
  type ScoreWeights,
  type StudyState,
  type WeeklyRuleMetric,
} from "../study-state";

const SCORE_WEIGHT_FIELDS: { key: keyof ScoreWeights; label: string; detail: string }[] = [
  { key: "duration", label: "有效时长", detail: "按作息折算后的学习时长" },
  { key: "completion", label: "任务完成", detail: "按时长加权的完成度" },
  { key: "focus", label: "专注质量", detail: "按时长加权的专注度" },
  { key: "review", label: "复盘记录", detail: "有效复盘覆盖比例" },
  { key: "timing", label: "学习时段", detail: "健康学习时段占比" },
  { key: "sleep", label: "睡眠作息", detail: "7–9 小时为满分区间" },
  { key: "exercise", label: "运动安排", detail: "时长与时段综合评价" },
];

const WEEKLY_METRICS: { value: WeeklyRuleMetric; label: string }[] = [
  { value: "averageDailyScore", label: "记录日平均分" },
  { value: "recordRate", label: "记录覆盖率" },
  { value: "studyTarget", label: "学习目标达成率" },
  { value: "healthySleepRate", label: "健康睡眠达标率" },
  { value: "exerciseTarget", label: "运动目标达成率" },
  { value: "routineBalance", label: "作息平衡" },
];

export default function ScoringView({ state, week, month, updateState }: {
  state: StudyState;
  week: PeriodSummary;
  month: PeriodSummary;
  updateState: (updater: (current: StudyState) => StudyState) => void;
}) {
  const totalWeight = Object.values(state.scoring.weights).reduce((sum, value) => sum + value, 0);
  const totalWeeklyWeight = state.scoring.weeklyRules.filter((rule) => rule.enabled).reduce((sum, rule) => sum + rule.weight, 0);

  function updateWeight(key: keyof ScoreWeights, value: number) {
    updateState((current) => ({
      ...current,
      scoring: {
        ...current.scoring,
        weights: { ...current.scoring.weights, [key]: Math.max(0, value) },
      },
    }));
  }

  function updateWeeklyRule(id: string, changes: Partial<StudyState["scoring"]["weeklyRules"][number]>) {
    updateState((current) => ({
      ...current,
      scoring: { ...current.scoring, weeklyRules: current.scoring.weeklyRules.map((rule) => rule.id === id ? { ...rule, ...changes } : rule) },
    }));
  }

  function addWeeklyRule() {
    updateState((current) => ({
      ...current,
      scoring: {
        ...current.scoring,
        weeklyRules: [...current.scoring.weeklyRules, { id: crypto.randomUUID(), name: "新评分规则", description: "自定义周报评价维度", metric: "studyTarget", weight: 10, enabled: true }],
      },
    }));
  }

  return (
    <div className="page-stack scoring-page">
      <section className="period-score-grid">
        <RoutinePeriodCard title="近 7 天" subtitle="短期执行与恢复" summary={week} />
        <RoutinePeriodCard title="近 30 天" subtitle="长期稳定性" summary={month} />
      </section>

      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">周报模型</p><h2>自定义评分规则</h2></div><div className="heading-actions"><span className="muted">启用权重合计 {totalWeeklyWeight}</span><button className="primary-button" onClick={addWeeklyRule}><Plus size={16} />新增规则</button></div></div>
        <p className="settings-copy">选择数据指标、设置名称与权重。系统会按所有启用规则的权重自动归一化为 100 分，新增规则会立即影响近 7 天和近 30 天得分。</p>
        <div className="weekly-rule-list">
          {state.scoring.weeklyRules.map((rule) => (
            <article className={`weekly-rule-card ${rule.enabled ? "" : "disabled"}`} key={rule.id}>
              <label className="rule-enabled"><input type="checkbox" checked={rule.enabled} onChange={(event) => updateWeeklyRule(rule.id, { enabled: event.target.checked })} /><span>启用</span></label>
              <label><span>规则名称</span><input value={rule.name} onChange={(event) => updateWeeklyRule(rule.id, { name: event.target.value })} /></label>
              <label><span>数据指标</span><select value={rule.metric} onChange={(event) => updateWeeklyRule(rule.id, { metric: event.target.value as WeeklyRuleMetric })}>{WEEKLY_METRICS.map((metric) => <option key={metric.value} value={metric.value}>{metric.label}</option>)}</select></label>
              <label><span>权重</span><input type="number" min="0" max="100" value={rule.weight} onChange={(event) => updateWeeklyRule(rule.id, { weight: Math.max(0, Number(event.target.value)) })} /></label>
              <label className="rule-description"><span>说明</span><input value={rule.description} onChange={(event) => updateWeeklyRule(rule.id, { description: event.target.value })} /></label>
              <button className="rule-delete" onClick={async () => {
                if (await confirmDialog({
                  title: "删除评分规则",
                  message: `确定删除评分规则“${rule.name}”？`,
                  danger: true,
                  confirmLabel: "删除",
                })) {
                  updateState((current) => ({ ...current, scoring: { ...current.scoring, weeklyRules: current.scoring.weeklyRules.filter((item) => item.id !== rule.id) } }));
                }
              }} aria-label="删除规则"><Trash2 size={16} /></button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel standards-panel">
        <div className="panel-heading"><div><p className="card-kicker">身心健康基线</p><h2>评判标准</h2></div><span className="score-badge">透明可调整</span></div>
        <div className="standards-grid">
          <article className="standard-card">
            <span>01</span><div><strong>睡眠：每日 7–9 小时</strong><p>7–9 小时获得完整睡眠分；5–7 小时和 9–11 小时线性递减，超出范围为 0。近 7/30 天同时统计达标比例。</p><a href="https://www.cdc.gov/sleep/data-research/facts-stats/adults-sleep-facts-and-stats.html" target="_blank" rel="noreferrer">CDC 成人睡眠依据</a></div>
          </article>
          <article className="standard-card">
            <span>02</span><div><strong>运动：每周至少 150 分钟</strong><p>单日 30–90 分钟较优；06:00–09:00 或 16:00–20:30 时段加权最高。近 30 天目标按每周 150 分钟等比例换算为约 {month.exerciseTarget} 分钟。</p><a href="https://www.who.int/news-room/fact-sheets/detail/physical-activity" target="_blank" rel="noreferrer">WHO 身体活动依据</a></div>
          </article>
          <article className="standard-card">
            <span>03</span><div><strong>娱乐：日均不高于 2 小时</strong><p>这是本仪表盘的复习期平衡标准，并非医学阈值。0–120 分钟不扣周期平衡分，超过 120 分钟逐步降分，达到 240 分钟时该项为 0。</p></div>
          </article>
          <article className="standard-card">
            <span>04</span><div><strong>学习：23:30 后降权</strong><p>08:00–12:00、14:00–18:00权重最高；正常晚间保持高权重；22:30 后逐步降低，23:30–05:30显著降权并计入深夜学习。</p></div>
          </article>
        </div>
        <p className="standards-note">当前周期得分由上方启用的自定义周报规则计算；作息平衡指标综合睡眠达标、运动总量、娱乐时长与深夜学习占比。</p>
      </section>

      <section className="panel settings-card">
        <div className="panel-heading">
          <div><p className="card-kicker">个性化模型</p><h2>核心权重</h2></div>
          <span className="muted">当前合计 {totalWeight}</span>
        </div>
        <p className="settings-copy">权重无需强制合计 100，系统会按当前总和自动归一化。调高某一项，会提高它在每日 100 分中的相对影响。</p>
        <div className="score-weight-grid">
          {SCORE_WEIGHT_FIELDS.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <small>{field.detail}</small>
              <div><input type="number" min="0" max="100" value={state.scoring.weights[field.key]} onChange={(event) => updateWeight(field.key, Number(event.target.value))} /><em>权重</em></div>
            </label>
          ))}
        </div>
        <div className="button-row"><button type="button" className="secondary-button" onClick={() => updateState((current) => ({ ...current, scoring: defaultStudyState.scoring }))}><RotateCcw size={17} />恢复推荐权重</button></div>
      </section>
    </div>
  );
}

function RoutinePeriodCard({ title, subtitle, summary }: {
  title: string;
  subtitle: string;
  summary: PeriodSummary;
}) {
  return (
    <article className="panel routine-period-card">
      <div className="panel-heading">
        <div><p className="card-kicker">{subtitle}</p><h2>{title}</h2></div>
        <ProgressRing value={summary.periodScore} compact />
      </div>
      <div className="routine-metric-grid">
        <div><span>记录覆盖</span><strong>{Math.round(summary.recordRate * 100)}%</strong></div>
        <div><span>平均日得分</span><strong>{summary.averageDailyScore}</strong></div>
        <div><span>平均睡眠</span><strong>{formatMinutes(summary.averageSleepMinutes)}</strong></div>
        <div><span>达标睡眠</span><strong>{Math.round(summary.healthySleepRate * 100)}%</strong></div>
        <div><span>运动累计</span><strong>{formatMinutes(summary.exerciseMinutes)}</strong></div>
        <div><span>日均娱乐</span><strong>{formatMinutes(summary.averageEntertainmentMinutes)}</strong></div>
        <div><span>深夜学习</span><strong>{formatMinutes(summary.lateStudyMinutes)}</strong></div>
        <div><span>作息平衡</span><strong>{Math.round(summary.routineBalance * 100)}%</strong></div>
      </div>
    </article>
  );
}
