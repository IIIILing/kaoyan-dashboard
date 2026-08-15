import { Download } from "lucide-react";
import { ScoreGuide } from "../components/ui";
import { localDate } from "../lib/dates";
import { downloadFile, formatMinutes } from "../lib/format";
import type { DailyMetrics, PeriodSummary } from "../lib/scoring";
import { subjectProgress, type StudyState } from "../study-state";
import WeeklyInsights from "../WeeklyInsights";

export default function WeeklyView({ state, metrics, average, summary }: { state: StudyState; metrics: (DailyMetrics & { date: string })[]; average: number; summary: PeriodSummary }) {
  const maxMinutes = Math.max(...metrics.map((item) => item.actualMinutes), state.profile.dailyTargetHours * 60);
  const total = metrics.reduce((sum, item) => sum + item.actualMinutes, 0);
  function exportMarkdown() {
    const from = metrics[0]?.date ?? localDate();
    const to = metrics.at(-1)?.date ?? localDate();
    const dailyRows = metrics.map((item) => `| ${item.date} | ${(item.actualMinutes / 60).toFixed(1)}h | ${item.score} | ${formatMinutes(item.sleepMinutes)} | ${formatMinutes(item.exerciseMinutes)} |`).join("\n");
    const ruleRows = summary.ruleResults.map((rule) => `| ${rule.name} | ${rule.weight} | ${Math.round(rule.ratio * 100)}% | ${(rule.points).toFixed(1)} |`).join("\n");
    const subjectRows = state.subjects.map((subject) => `| ${subject.name} | ${subject.weight}% | ${subjectProgress(subject)}% |`).join("\n");
    const markdown = `# ${state.profile.targetSchool}考研学习周报\n\n` +
      `**周期：** ${from} 至 ${to}  \n**目标：** ${state.profile.targetDescription}  \n**周报得分：** ${summary.periodScore} / 100\n\n` +
      `## 核心摘要\n\n- 有效学习：${formatMinutes(total)}\n- 活跃天数：${metrics.filter((item) => item.hasRecords).length} / 7\n- 日均得分：${average}\n- 平均睡眠：${formatMinutes(summary.averageSleepMinutes)}\n- 运动累计：${formatMinutes(summary.exerciseMinutes)}\n\n` +
      `## 每日数据\n\n| 日期 | 有效学习 | 日得分 | 睡眠 | 运动 |\n|---|---:|---:|---:|---:|\n${dailyRows}\n\n` +
      `## 自定义评分规则\n\n| 规则 | 权重 | 达成率 | 加权分 |\n|---|---:|---:|---:|\n${ruleRows || "| 暂无启用规则 | 0 | 0% | 0 |"}\n\n` +
      `## 科目进度\n\n| 科目 | 总权重 | 当前进度 |\n|---|---:|---:|\n${subjectRows}\n\n---\n由考研项目管理台生成。\n`;
    downloadFile(markdown, `考研周报-${from}-${to}.md`, "text/markdown;charset=utf-8");
  }
  return (
    <div className="page-stack narrow-page">
      <div className="page-actions"><p className="muted">周报按当前启用的自定义规则实时计算。</p><button className="primary-button" onClick={exportMarkdown}><Download size={17} />导出 Markdown 周报</button></div>
      <section className="summary-strip weekly-summary">
        <div><span>近7日有效学习</span><strong>{formatMinutes(total)}</strong></div>
        <div><span>活跃天数</span><strong>{metrics.filter((item) => item.actualMinutes > 0).length} / 7</strong></div>
        <div><span>平均日得分</span><strong>{average}</strong></div>
        <div><span>周报得分</span><strong>{summary.periodScore}</strong></div>
      </section>
      <section className="panel chart-panel">
        <div className="panel-heading"><div><p className="card-kicker">近 7 天</p><h2>有效学习时长</h2></div><span className="muted">目标线：{state.profile.dailyTargetHours}h</span></div>
        <div className="bar-chart">
          {metrics.map((item) => (
            <div className="bar-column" key={item.date}>
              <div className="bar-value">{item.actualMinutes ? (item.actualMinutes / 60).toFixed(1) : "0"}h</div>
              <div className="bar-track"><i style={{ height: `${Math.max(2, (item.actualMinutes / maxMinutes) * 100)}%` }} /></div>
              <span>{new Date(`${item.date}T00:00:00`).toLocaleDateString("zh-CN", { weekday: "short" })}</span>
            </div>
          ))}
        </div>
      </section>
      <WeeklyInsights state={state} from={metrics[0]?.date ?? localDate()} to={metrics.at(-1)?.date ?? localDate()} />
      <section className="panel scoring-guide">
        <div className="panel-heading"><div><p className="card-kicker">实时计算</p><h2>本周规则计分</h2></div><span className="score-badge">{summary.periodScore}</span></div>
        <div className="guide-grid">{summary.ruleResults.map((rule) => <ScoreGuide key={rule.id} number={String(Math.round(rule.points))} title={`${rule.name} · 权重 ${rule.weight}`} detail={`${rule.description}；本周达成 ${Math.round(rule.ratio * 100)}%`} />)}</div>
        {!summary.ruleResults.length && <div className="schedule-empty">尚未启用周报规则，请前往“评分标准”新增或启用规则。</div>}
      </section>
    </div>
  );
}
