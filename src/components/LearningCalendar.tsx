import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  buildMonthCalendar,
  buildYearCalendar,
  calendarLevel,
  calendarYearRange,
  currentStreak,
  longestStreak,
  studyActivityIds,
} from "../lib/calendar";
import { formatMinutes } from "../lib/format";
import type { StudyState } from "../study-state";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 学习热力图:GitHub 风格贡献图,支持按年 / 按年月切换。
 * 年视图 = 7 行(周日..周六)× 全年周列;月视图 = 对齐星期的日历网格。
 * 色块按当天有效学习分钟数分级(0 / <1h / <4h / <8h / ≥8h)。
 */
export default function LearningCalendar({ state }: { state: StudyState }) {
  const activityIds = useMemo(() => studyActivityIds(state.lifeActivities), [state.lifeActivities]);
  const years = useMemo(() => calendarYearRange(state.sessions), [state.sessions]);
  const [year, setYear] = useState(() => years[years.length - 1]);
  const [month, setMonth] = useState<string>("all");

  const activeDates = useMemo(() => {
    const set = new Set<string>();
    for (const session of state.sessions) {
      if (!activityIds.has(session.subjectId)) set.add(session.date);
    }
    return set;
  }, [state.sessions, activityIds]);

  const yearCalendar = useMemo(
    () => buildYearCalendar(year, state.sessions, activityIds),
    [year, state.sessions, activityIds],
  );
  const monthCells = useMemo(
    () => (month === "all" ? null : buildMonthCalendar(month, state.sessions, activityIds)),
    [month, state.sessions, activityIds],
  );

  const yearStats = useMemo(() => {
    const days = yearCalendar.weeks.flat().filter((cell): cell is NonNullable<typeof cell> => cell !== null && cell.hasRecords);
    const minutes = days.reduce((sum, cell) => sum + cell.minutes, 0);
    return { minutes, days: days.length };
  }, [yearCalendar]);

  const monthStats = useMemo(() => {
    if (!monthCells) return null;
    const days = monthCells.filter((cell): cell is NonNullable<typeof cell> => cell !== null && cell.hasRecords);
    const minutes = days.reduce((sum, cell) => sum + cell.minutes, 0);
    return { minutes, days: days.length };
  }, [monthCells]);

  const streak = useMemo(() => currentStreak(activeDates), [activeDates]);
  const bestStreak = useMemo(() => longestStreak(activeDates), [activeDates]);

  function changeYear(nextYear: number) {
    setYear(nextYear);
    setMonth("all");
  }

  const stats = monthStats ?? yearStats;
  const rangeLabel = month === "all" ? `${year} 年` : `${Number(month.slice(5))} 月 · ${year} 年`;

  return (
    <section className="panel calendar-panel">
      <div className="panel-heading">
        <div><p className="card-kicker">长期节奏</p><h2>学习热力图</h2></div>
        <div className="calendar-summary">
          <span>{rangeLabel} 有效学习 <strong>{formatMinutes(stats.minutes)}</strong></span>
          <span>活跃 <strong>{stats.days}</strong> 天</span>
          <span>当前连续 <strong>{streak}</strong> 天</span>
          <span>最长连续 <strong>{bestStreak}</strong> 天</span>
        </div>
      </div>

      <div className="calendar-toolbar">
        <label><span>年份</span>
          <select value={year} onChange={(event) => changeYear(Number(event.target.value))}>
            {years.map((item) => <option key={item} value={item}>{item} 年</option>)}
          </select>
        </label>
        <label><span>月份</span>
          <select value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="all">全年</option>
            {Array.from({ length: 12 }, (_, index) => {
              const value = `${year}-${String(index + 1).padStart(2, "0")}`;
              return <option key={value} value={value}>{index + 1} 月</option>;
            })}
          </select>
        </label>
        <div className="calendar-legend"><BarChart3 size={13} /><span>少</span>
          {[1, 2, 3, 4].map((level) => <i key={level} className={`cal-cell l${level}`} />)}
          <span>多</span>
        </div>
      </div>

      {monthCells ? (
        <div className="calendar-month-view">
          <div className="calendar-weekdays">{WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}</div>
          <div className="calendar-month-grid">
            {monthCells.map((cell, index) => {
              if (!cell) return <span className="cal-cell blank" key={index} />;
              return (
                <span
                  key={cell.date}
                  className={`cal-cell l${calendarLevel(cell.minutes)}`}
                  title={`${cell.date} · ${formatMinutes(cell.minutes)}${cell.count ? ` · ${cell.count} 条记录` : " · 未学习"}`}
                >{cell.hasRecords ? cell.date.slice(8) : ""}</span>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="calendar-year-view">
          <div className="calendar-year-labels">
            {yearCalendar.monthLabels.map(({ weekIndex, label }) => (
              <span key={label} style={{ left: `calc(${weekIndex} * 16px)` }}>{label}</span>
            ))}
          </div>
          {WEEKDAY_LABELS.map((weekday, dayIndex) => (
            <div className="calendar-row" key={weekday}>
              <span className="calendar-row-label">{weekday}</span>
              {yearCalendar.weeks.map((week, weekIndex) => {
                const cell = week[dayIndex];
                if (!cell) return <span className="cal-cell blank" key={weekIndex} />;
                return (
                  <span
                    key={cell.date}
                    className={`cal-cell l${calendarLevel(cell.minutes)}`}
                    title={`${cell.date} · ${formatMinutes(cell.minutes)}${cell.count ? ` · ${cell.count} 条记录` : " · 未学习"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
