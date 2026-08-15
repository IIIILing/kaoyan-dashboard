import type { DateRange } from "../schedule-data";

export function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function dateOffset(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
}

export function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00`);
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86_400_000));
}

export function recentDates(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return localDate(date);
  });
}

export function presetRange(preset: "day" | "week" | "month", anchor: string): DateRange {
  if (preset === "day") return { from: anchor, to: anchor };
  const date = new Date(`${anchor}T12:00:00`);
  if (preset === "week") {
    const mondayOffset = (date.getDay() + 6) % 7;
    const from = dateOffset(anchor, -mondayOffset);
    return { from, to: dateOffset(from, 6) };
  }
  const from = `${anchor.slice(0, 7)}-01`;
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from, to: localDate(last) };
}

export function isInRange(date: string, range: DateRange) {
  return date >= range.from && date <= range.to;
}
