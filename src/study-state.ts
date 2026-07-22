export type Phase = {
  id: string;
  name: string;
  weight: number;
  progress: number;
  resources: StudyResource[];
};

export type StudyResource = {
  id: string;
  type: "book" | "chapter" | "paper" | "exercise" | "other";
  name: string;
  detail: string;
  completed: boolean;
};

export type Subject = {
  id: string;
  name: string;
  shortName: string;
  weight: number;
  accent: string;
  note: string;
  phases: Phase[];
};

export type StudySession = {
  id: string;
  date: string;
  start: string;
  end: string;
  subjectId: string;
  task: string;
  plannedMinutes: number;
  actualMinutes: number;
  completion: number;
  focus: number;
  note: string;
};

export type LifeActivity = {
  id: string;
  name: string;
  accent: string;
  active?: boolean;
};

export type ScoreWeights = {
  duration: number;
  completion: number;
  focus: number;
  review: number;
  timing: number;
  sleep: number;
  exercise: number;
};

export type WeeklyRuleMetric =
  | "averageDailyScore"
  | "recordRate"
  | "studyTarget"
  | "healthySleepRate"
  | "exerciseTarget"
  | "routineBalance";

export type WeeklyRule = {
  id: string;
  name: string;
  description: string;
  metric: WeeklyRuleMetric;
  weight: number;
  enabled: boolean;
};

export type PlanItem = {
  id: string;
  start: string;
  end: string;
  subjectId: string;
  task: string;
  note: string;
};

export type DailyPlan = {
  date: string;
  items: PlanItem[];
};

export type PlanTemplate = {
  id: string;
  name: string;
  items: PlanItem[];
};

export type ThemeColors = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  success: string;
  warn: string;
  danger: string;
  sidebarStart: string;
  sidebarEnd: string;
};

export type AppearanceSettings = {
  paletteId: string;
  customLight: ThemeColors;
  customDark: ThemeColors;
};

export type StudyState = {
  version: 1;
  profile: {
    name: string;
    target: string;
    sidebarTitle: string;
    sidebarSubtitle: string;
    sidebarIcon: string;
    targetSchool: string;
    targetDescription: string;
    examDate: string;
    dailyTargetHours: number;
    wakeTime: string;
    sleepTime: string;
  };
  scoring: {
    weights: ScoreWeights;
    weeklyRules: WeeklyRule[];
  };
  appearance: AppearanceSettings;
  lifeActivities: LifeActivity[];
  subjects: Subject[];
  sessions: StudySession[];
  plans: DailyPlan[];
  planTemplates: PlanTemplate[];
};

export const defaultLightColors: ThemeColors = {
  bg: "#f4f3ef",
  surface: "#fffefa",
  text: "#172532",
  muted: "#6c7882",
  primary: "#003b70",
  accent: "#1d6aa5",
  success: "#5d8874",
  warn: "#b17a35",
  danger: "#b85858",
  sidebarStart: "#054b80",
  sidebarEnd: "#00335f",
};

export const defaultDarkColors: ThemeColors = {
  bg: "#11161b",
  surface: "#1a2128",
  text: "#e7edf2",
  muted: "#a3afb9",
  primary: "#123f66",
  accent: "#62a8dc",
  success: "#79a895",
  warn: "#d2a15e",
  danger: "#db7d7d",
  sidebarStart: "#0c385b",
  sidebarEnd: "#082740",
};

export const defaultLifeActivities: LifeActivity[] = [
  { id: "sleep", name: "睡觉", accent: "#6f7fa5" },
  { id: "exercise", name: "运动", accent: "#3f8b72" },
  { id: "entertainment", name: "娱乐", accent: "#b27955" },
  { id: "wash", name: "个人洗漱", accent: "#4d91b8" },
  { id: "meal", name: "吃饭", accent: "#c27b43" },
  { id: "commute", name: "通勤", accent: "#8273a7" },
  { id: "housework", name: "家务", accent: "#8b9b58" },
  { id: "rest", name: "休息", accent: "#7d8790" },
  { id: "planning", name: "写计划", accent: "#5e789e" },
];

export const defaultStudyState: StudyState = {
  version: 1,
  profile: {
    name: "Jimmy",
    target: "2027 浙江大学电气工程专硕",
    sidebarTitle: "浙研Z 2027",
    sidebarSubtitle: "电气专硕",
    sidebarIcon: "",
    targetSchool: "浙江大学",
    targetDescription: "电气工程专硕 · 数一 / 英一 / 840",
    examDate: "2026-12-20",
    dailyTargetHours: 8.5,
    wakeTime: "07:30",
    sleepTime: "23:00",
  },
  scoring: {
    weights: {
      duration: 25,
      completion: 15,
      focus: 10,
      review: 5,
      timing: 15,
      sleep: 20,
      exercise: 10,
    },
    weeklyRules: [
      { id: "weekly-daily-score", name: "记录日平均分", description: "综合每日学习质量与作息表现", metric: "averageDailyScore", weight: 75, enabled: true },
      { id: "weekly-coverage", name: "记录覆盖", description: "本周期有记录的天数占比", metric: "recordRate", weight: 10, enabled: true },
      { id: "weekly-routine", name: "作息平衡", description: "睡眠、运动、娱乐与深夜学习的综合表现", metric: "routineBalance", weight: 15, enabled: true },
    ],
  },
  appearance: {
    paletteId: "default",
    customLight: defaultLightColors,
    customDark: defaultDarkColors,
  },
  lifeActivities: defaultLifeActivities,
  subjects: [
    {
      id: "math",
      name: "数学一",
      shortName: "数一",
      weight: 35,
      accent: "#1565a7",
      note: "除概率统计外，基础内容已完成一轮",
      phases: [
        { id: "math-basic", name: "基础一轮", weight: 30, progress: 85, resources: [] },
        { id: "math-intense", name: "强化刷题", weight: 30, progress: 0, resources: [] },
        { id: "math-real", name: "历年真题", weight: 25, progress: 0, resources: [] },
        { id: "math-mock", name: "模考复盘", weight: 15, progress: 0, resources: [] },
      ],
    },
    {
      id: "english",
      name: "英语一",
      shortName: "英一",
      weight: 20,
      accent: "#5b7f70",
      note: "计划 7 月底完成单词第一轮",
      phases: [
        { id: "eng-word-first", name: "单词一轮", weight: 25, progress: 85, resources: [] },
        { id: "eng-word-second", name: "单词二轮", weight: 25, progress: 0, resources: [] },
        { id: "eng-real", name: "15 年真题", weight: 30, progress: 0, resources: [] },
        { id: "eng-mock", name: "模拟卷 20 套", weight: 10, progress: 0, resources: [] },
        { id: "eng-writing", name: "写作模板", weight: 10, progress: 0, resources: [] },
      ],
    },
    {
      id: "politics",
      name: "思想政治理论",
      shortName: "政治",
      weight: 15,
      accent: "#b47a32",
      note: "尚未开始",
      phases: [
        { id: "pol-basic", name: "基础课程", weight: 30, progress: 0, resources: [] },
        { id: "pol-choice", name: "选择题强化", weight: 35, progress: 0, resources: [] },
        { id: "pol-recite", name: "主观题背诵", weight: 25, progress: 0, resources: [] },
        { id: "pol-mock", name: "套卷模考", weight: 10, progress: 0, resources: [] },
      ],
    },
    {
      id: "circuit",
      name: "840 电路原理",
      shortName: "840",
      weight: 30,
      accent: "#755c9f",
      note: "专业课尚未开始",
      phases: [
        { id: "cir-first", name: "一轮复习", weight: 30, progress: 0, resources: [] },
        { id: "cir-chapter", name: "章节习题", weight: 20, progress: 0, resources: [] },
        { id: "cir-real", name: "历年真题", weight: 30, progress: 0, resources: [] },
        { id: "cir-material", name: "机构资料", weight: 20, progress: 0, resources: [] },
      ],
    },
  ],
  sessions: [],
  plans: [],
  planTemplates: [],
};

export function subjectProgress(subject: Subject) {
  const totalWeight = subject.phases.reduce((sum, phase) => sum + phase.weight, 0) || 1;
  return Math.round(
    subject.phases.reduce((sum, phase) => sum + phase.progress * phase.weight, 0) /
      totalWeight,
  );
}

export function projectProgress(subjects: Subject[]) {
  const totalWeight = subjects.reduce((sum, subject) => sum + subject.weight, 0) || 1;
  return Math.round(
    subjects.reduce(
      (sum, subject) => sum + subjectProgress(subject) * subject.weight,
      0,
    ) / totalWeight,
  );
}
