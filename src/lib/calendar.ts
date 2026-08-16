import { dateOffset, localDate } from "./dates";
import type { LifeActivity, StudySession } from "../study-state";

export type CalendarDay = {
  date: string; // YYYY-MM-DD
  minutes: number; // 当天有效学习分钟(不含生活活动)
  count: number; // 当天学习记录条数
  hasRecords: boolean;
};

/** 一列一周,7 个槽位从周日(0)到周六(6);年份边界外的位置为 null。 */
export type CalendarWeek = (CalendarDay | null)[];

export type YearCalendar = {
  year: number;
  weeks: CalendarWeek[];
  /** 每月 1 日所在的周列索引与月份名(用于年视图顶部月份标签)。 */
  monthLabels: { weekIndex: number; label: string }[];
};

/** 一次遍历把所有日期的学习分钟聚合出来,避免按天反复过滤 sessions。 */
function aggregateByDate(sessions: StudySession[], activityIds: ReadonlySet<string>) {
  const byDate = new Map<string, { minutes: number; count: number }>();
  for (const session of sessions) {
    if (activityIds.has(session.subjectId)) continue;
    const entry = byDate.get(session.date) ?? { minutes: 0, count: 0 };
    entry.minutes += session.actualMinutes;
    entry.count += 1;
    byDate.set(session.date, entry);
  }
  return byDate;
}

export function studyActivityIds(activities: LifeActivity[]) {
  return new Set(activities.filter((activity) => activity.active !== false).map((activity) => activity.id));
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** GitHub 风格全年贡献图:7 行(周日..周六)× 约 53 列(周),1 月 1 日前的槽位为 null。 */
export function buildYearCalendar(year: number, sessions: StudySession[], activityIds: ReadonlySet<string>): YearCalendar {
  const byDate = aggregateByDate(sessions, activityIds);
  const daysInYear = isLeapYear(year) ? 366 : 365;
  const startOffset = new Date(year, 0, 1).getDay(); // 1 月 1 日是星期几(周日=0)
  const weeks: CalendarWeek[] = [];
  const monthLabels: { weekIndex: number; label: string }[] = [];

  for (let month = 0; month < 12; month += 1) {
    const firstOfMonth = new Date(year, month, 1);
    const dayOfYear = Math.round((firstOfMonth.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000) + 1;
    monthLabels.push({ weekIndex: Math.floor((startOffset + dayOfYear - 1) / 7), label: `${month + 1}月` });
  }

  for (let day = 1; day <= daysInYear; day += 1) {
    const date = localDate(new Date(year, 0, day));
    const info = byDate.get(date);
    const cell: CalendarDay = info
      ? { date, minutes: info.minutes, count: info.count, hasRecords: true }
      : { date, minutes: 0, count: 0, hasRecords: false };
    const index = startOffset + day - 1;
    const weekIndex = Math.floor(index / 7);
    if (!weeks[weekIndex]) weeks[weekIndex] = Array<CalendarDay | null>(7).fill(null);
    weeks[weekIndex][index % 7] = cell;
  }
  // 补齐最后一列不足 7 天的部分
  const last = weeks[weeks.length - 1];
  for (let index = 0; index < 7; index += 1) {
    if (!last[index]) last[index] = null;
  }
  return { year, weeks, monthLabels };
}

/** 月视图:7 列(周日..周六)日历网格,月初前的槽位为 null。 */
export function buildMonthCalendar(month: string, sessions: StudySession[], activityIds: ReadonlySet<string>): (CalendarDay | null)[] {
  const [year, mon] = month.split("-").map(Number);
  const byDate = aggregateByDate(sessions, activityIds);
  const first = new Date(year, mon - 1, 1);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const startWeekday = first.getDay();
  const cells: (CalendarDay | null)[] = Array(startWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = localDate(new Date(year, mon - 1, day));
    const info = byDate.get(date);
    cells.push(info
      ? { date, minutes: info.minutes, count: info.count, hasRecords: true }
      : { date, minutes: 0, count: 0, hasRecords: false });
  }
  return cells;
}

/** 从记录里推出可选年份范围(最早记录年份 .. 当前年份)。 */
export function calendarYearRange(sessions: StudySession[], anchor = localDate()): number[] {
  const currentYear = Number(anchor.slice(0, 4));
  let earliest = currentYear;
  for (const session of sessions) {
    const year = Number(session.date.slice(0, 4));
    if (Number.isFinite(year) && year < earliest) earliest = year;
  }
  const years: number[] = [];
  for (let year = earliest; year <= currentYear; year += 1) years.push(year);
  return years;
}

/** 颜色分级:0=无记录,1=<1h,2=<4h,3=<8h,4=≥8h。 */
export function calendarLevel(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 60) return 1;
  if (minutes < 240) return 2;
  if (minutes < 480) return 3;
  return 4;
}

function dayDifference(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000);
}

/** 最长连续学习天数。 */
export function longestStreak(activeDates: ReadonlySet<string>): number {
  const sorted = [...activeDates].sort();
  let best = 0;
  let run = 0;
  let previous = "";
  for (const date of sorted) {
    run = previous && dayDifference(previous, date) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    previous = date;
  }
  return best;
}

/** 当前连续学习天数(从 anchor 往前数)。 */
export function currentStreak(activeDates: ReadonlySet<string>, anchor = localDate()): number {
  let streak = 0;
  let cursor = anchor;
  while (activeDates.has(cursor)) {
    streak += 1;
    cursor = dateOffset(cursor, -1);
  }
  return streak;
}
