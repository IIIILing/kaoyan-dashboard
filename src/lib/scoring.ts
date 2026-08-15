import {
  defaultLifeActivities,
  defaultStudyState,
  type LifeActivity,
  type ScoreWeights,
  type StudySession,
  type WeeklyRuleMetric,
} from "../study-state";

export function clampRatio(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function studyTimeWeight(minute: number) {
  if (minute < 5 * 60 + 30) return 0.15;
  if (minute < 8 * 60) return 0.9;
  if (minute < 12 * 60) return 1.05;
  if (minute < 14 * 60) return 0.85;
  if (minute < 18 * 60) return 1.05;
  if (minute < 22 * 60 + 30) return 1;
  if (minute < 23 * 60 + 30) return 0.7;
  return 0.3;
}

export function exerciseTimeWeight(minute: number) {
  const morning = minute >= 6 * 60 && minute < 9 * 60;
  const afternoon = minute >= 16 * 60 && minute < 20 * 60 + 30;
  if (morning || afternoon) return 1;
  if (
    (minute >= 9 * 60 && minute < 11 * 60 + 30) ||
    (minute >= 14 * 60 && minute < 16 * 60)
  ) return 0.75;
  if (minute >= 20 * 60 + 30 && minute < 22 * 60) return 0.6;
  if (minute >= 23 * 60 + 30 || minute < 5 * 60 + 30) return 0;
  return 0.35;
}

export function sessionTimeWeight(session: StudySession, weightAt: (minute: number) => number) {
  const duration = Math.min(24 * 60, Math.max(0, Math.round(session.actualMinutes)));
  if (!duration) return 0;
  const start = timeToMinutes(session.start);
  let total = 0;
  for (let offset = 0; offset < duration; offset += 1) {
    total += weightAt((start + offset) % (24 * 60));
  }
  return total / duration;
}

function sleepQualityRatio(minutes: number) {
  if (minutes >= 7 * 60 && minutes <= 9 * 60) return 1;
  if (minutes < 7 * 60) return clampRatio((minutes - 5 * 60) / (2 * 60));
  return clampRatio((11 * 60 - minutes) / (2 * 60));
}

function sessionMinutesMatching(session: StudySession, matches: (minute: number) => boolean) {
  const duration = Math.min(24 * 60, Math.max(0, Math.round(session.actualMinutes)));
  const start = timeToMinutes(session.start);
  let total = 0;
  for (let offset = 0; offset < duration; offset += 1) {
    if (matches((start + offset) % (24 * 60))) total += 1;
  }
  return total;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function dailyMetrics(
  sessions: StudySession[],
  targetHours: number,
  weights: ScoreWeights,
  activities: LifeActivity[] = defaultLifeActivities,
) {
  const activityIds = new Set(activities.map((activity) => activity.id));
  const studySessions = sessions.filter((item) => !activityIds.has(item.subjectId));
  const sleepSessions = sessions.filter((item) => item.subjectId === "sleep");
  const exerciseSessions = sessions.filter((item) => item.subjectId === "exercise");
  const actualMinutes = studySessions.reduce((sum, item) => sum + item.actualMinutes, 0);
  const weightedStudyMinutes = studySessions.reduce(
    (sum, item) => sum + item.actualMinutes * sessionTimeWeight(item, studyTimeWeight),
    0,
  );
  const completion = actualMinutes
    ? studySessions.reduce((sum, item) => sum + item.completion * item.actualMinutes, 0) /
      actualMinutes
    : 0;
  const focus = actualMinutes
    ? studySessions.reduce((sum, item) => sum + item.focus * item.actualMinutes, 0) /
      actualMinutes
    : 0;
  const review = actualMinutes
    ? studySessions.reduce(
        (sum, item) => sum + (item.note.trim().length >= 6 ? item.actualMinutes : 0),
        0,
      ) / actualMinutes
    : 0;
  const hourRatio = clampRatio(weightedStudyMinutes / Math.max(1, targetHours * 60));
  const timingRatio = actualMinutes ? clampRatio(weightedStudyMinutes / actualMinutes) : 0;
  const sleepMinutes = sleepSessions.reduce((sum, item) => sum + item.actualMinutes, 0);
  const exerciseMinutes = exerciseSessions.reduce((sum, item) => sum + item.actualMinutes, 0);
  const entertainmentMinutes = sessions
    .filter((item) => item.subjectId === "entertainment")
    .reduce((sum, item) => sum + item.actualMinutes, 0);
  const lateStudyMinutes = studySessions.reduce(
    (sum, item) => sum + sessionMinutesMatching(
      item,
      (minute) => minute >= 23 * 60 + 30 || minute < 5 * 60 + 30,
    ),
    0,
  );
  const exerciseTimingRatio = exerciseMinutes
    ? exerciseSessions.reduce(
        (sum, item) => sum + item.actualMinutes * sessionTimeWeight(item, exerciseTimeWeight),
        0,
      ) / exerciseMinutes
    : 0;
  const exerciseDurationRatio = exerciseMinutes < 30
    ? exerciseMinutes / 30
    : exerciseMinutes <= 90
      ? 1
      : Math.max(0.7, 1 - (exerciseMinutes - 90) / 200);
  const componentRatios = {
    duration: hourRatio,
    completion: completion / 100,
    focus: focus / 5,
    review,
    timing: timingRatio,
    sleep: sleepQualityRatio(sleepMinutes),
    exercise: exerciseDurationRatio * (0.7 + exerciseTimingRatio * 0.3),
  };
  const scoreParts = {
    duration: componentRatios.duration * Math.max(0, weights.duration),
    completion: componentRatios.completion * Math.max(0, weights.completion),
    focus: componentRatios.focus * Math.max(0, weights.focus),
    review: componentRatios.review * Math.max(0, weights.review),
    timing: componentRatios.timing * Math.max(0, weights.timing),
    sleep: componentRatios.sleep * Math.max(0, weights.sleep),
    exercise: componentRatios.exercise * Math.max(0, weights.exercise),
  };
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  const score = Math.round(
    Object.values(scoreParts).reduce((sum, value) => sum + value, 0) / totalWeight * 100,
  );
  return {
    actualMinutes,
    weightedStudyMinutes,
    completion,
    focus,
    review,
    timingRatio,
    sleepMinutes,
    exerciseMinutes,
    entertainmentMinutes,
    lateStudyMinutes,
    scoreParts,
    score,
    hourRatio,
    hasRecords: sessions.length > 0,
  };
}

export type DailyMetrics = ReturnType<typeof dailyMetrics>;

export function sessionsForDate(sessions: StudySession[], date: string) {
  return sessions.filter((item) => item.date === date).sort((a, b) => a.start.localeCompare(b.start));
}

export function periodSummary(
  sessions: StudySession[],
  dates: string[],
  targetHours: number,
  weights: ScoreWeights,
  weeklyRules = defaultStudyState.scoring.weeklyRules,
  activities: LifeActivity[] = defaultLifeActivities,
) {
  const days = dates.map((date) => dailyMetrics(sessionsForDate(sessions, date), targetHours, weights, activities));
  const recordedDays = days.filter((item) => item.hasRecords);
  const sleepDays = days.filter((item) => item.sleepMinutes > 0);
  const averageDailyScore = recordedDays.length
    ? recordedDays.reduce((sum, item) => sum + item.score, 0) / recordedDays.length
    : 0;
  const recordRate = recordedDays.length / Math.max(1, dates.length);
  const healthySleepRate = sleepDays.length
    ? sleepDays.filter((item) => item.sleepMinutes >= 7 * 60 && item.sleepMinutes <= 9 * 60).length /
      sleepDays.length
    : 0;
  const exerciseMinutes = days.reduce((sum, item) => sum + item.exerciseMinutes, 0);
  const exerciseTarget = dates.length / 7 * 150;
  const averageEntertainmentMinutes = Math.round(
    days.reduce((sum, item) => sum + item.entertainmentMinutes, 0) / Math.max(1, dates.length),
  );
  const totalStudyMinutes = days.reduce((sum, item) => sum + item.actualMinutes, 0);
  const lateStudyMinutes = days.reduce((sum, item) => sum + item.lateStudyMinutes, 0);
  const entertainmentBalance = averageEntertainmentMinutes <= 120
    ? 1
    : clampRatio((240 - averageEntertainmentMinutes) / 120);
  const lateStudyBalance = totalStudyMinutes
    ? clampRatio(1 - lateStudyMinutes / totalStudyMinutes)
    : 0;
  const routineBalance =
    healthySleepRate * 0.4 +
    clampRatio(exerciseMinutes / Math.max(1, exerciseTarget)) * 0.3 +
    entertainmentBalance * 0.15 +
    lateStudyBalance * 0.15;
  const metricRatios: Record<WeeklyRuleMetric, number> = {
    averageDailyScore: clampRatio(averageDailyScore / 100),
    recordRate,
    studyTarget: clampRatio(totalStudyMinutes / Math.max(1, dates.length * targetHours * 60)),
    healthySleepRate,
    exerciseTarget: clampRatio(exerciseMinutes / Math.max(1, exerciseTarget)),
    routineBalance,
  };
  const enabledRules = weeklyRules.filter((rule) => rule.enabled && rule.weight > 0);
  const ruleWeight = enabledRules.reduce((sum, rule) => sum + rule.weight, 0) || 1;
  const ruleResults = enabledRules.map((rule) => ({
    ...rule,
    ratio: metricRatios[rule.metric],
    points: metricRatios[rule.metric] * rule.weight,
  }));
  const periodScore = Math.round(ruleResults.reduce((sum, rule) => sum + rule.points, 0) / ruleWeight * 100);
  return {
    days: dates.length,
    periodScore,
    averageDailyScore: Math.round(averageDailyScore),
    recordRate,
    averageSleepMinutes: sleepDays.length
      ? Math.round(sleepDays.reduce((sum, item) => sum + item.sleepMinutes, 0) / sleepDays.length)
      : 0,
    healthySleepRate,
    exerciseMinutes,
    exerciseTarget: Math.round(exerciseTarget),
    exerciseDays: days.filter((item) => item.exerciseMinutes >= 20).length,
    averageEntertainmentMinutes,
    totalStudyMinutes,
    lateStudyMinutes,
    routineBalance,
    ruleResults,
  };
}

export type PeriodSummary = ReturnType<typeof periodSummary>;
