import { DEFAULT_FASTEST_EXPERIENCE_ID, defaultExperiences, type ExperiencePost } from "./experience-data";

export type Phase = {
  id: string;
  name: string;
  weight: number;
  progress: number;
  startDate?: string;
  targetDate?: string;
  targetProgress?: number;
  progressHistory?: PhaseProgressSnapshot[];
  resources: StudyResource[];
};

export type PhaseProgressSnapshot = {
  date: string;
  progress: number;
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
  planItemId?: string;
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

export type ScheduleDay = {
  date: string;
  planItems: PlanItem[];
  sessions: StudySession[];
};

export type PlanTemplate = {
  id: string;
  name: string;
  items: PlanItem[];
};

export type ExamPaperType = "past" | "mock" | "chapter" | "other";

export type ExamSection = {
  id: string;
  name: string;
  score: number;
  fullScore: number;
  wrongCount: number;
};

export type ExamRecord = {
  id: string;
  subjectId: string;
  date: string;
  paperType: ExamPaperType;
  paperName: string;
  score: number;
  fullScore: number;
  durationMinutes: number;
  correctRate: number;
  wrongCount: number;
  sections: ExamSection[];
  note: string;
};

export type ReviewItemKind = "knowledge" | "mistake" | "exam";

export type ReviewItem = {
  id: string;
  subjectId: string;
  kind: ReviewItemKind;
  title: string;
  detail: string;
  source: string;
  mastery: number;
  nextReviewDate: string;
  reviewCount: number;
  createdAt: string;
  lastReviewedAt?: string;
};

export type DataSafetyStatus = {
  lastExternalBackupAt: string;
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
  version: 1 | 2 | 3;
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
  schedule?: ScheduleDay[];
  planTemplates: PlanTemplate[];
  examRecords: ExamRecord[];
  reviewItems: ReviewItem[];
  dataSafety: DataSafetyStatus;
  experiences: ExperiencePost[];
  fastestExperienceId: string;
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
  version: 3,
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
      note: "按 427 分快线：7 月中启动，9 月中一轮、10 月底二轮、11 月真题",
      phases: [
        { id: "math-basic", name: "第一轮：基础课 + 300/660", weight: 30, progress: 85, resources: [
          { id: "rapid-math-basic-course", type: "chapter", name: "张宇基础课", detail: "逐节跟例题，课后立即完成对应题", completed: false },
          { id: "rapid-math-300", type: "exercise", name: "张宇基础 300 题", detail: "暑期基础阶段", completed: false },
          { id: "rapid-math-660", type: "exercise", name: "李永乐 660 高数部分", detail: "与基础课并行", completed: false },
        ] },
        { id: "math-intense", name: "第二轮：强化 30 讲 + 1000", weight: 30, progress: 0, resources: [
          { id: "rapid-math-30", type: "chapter", name: "张宇强化 30 讲", detail: "每天一节", completed: false },
          { id: "rapid-math-1000", type: "exercise", name: "张宇 1000 题", detail: "每天 5 小时以上完成对应练习", completed: false },
        ] },
        { id: "math-real", name: "08–21 年真题", weight: 25, progress: 0, resources: [
          { id: "rapid-math-real", type: "paper", name: "08–21 年数学真题", detail: "一天一套并订正；薄弱题型回查 1987–2022 同类题", completed: false },
        ] },
        { id: "math-mock", name: "15 套模拟与复盘", weight: 15, progress: 0, resources: [
          { id: "rapid-math-mock", type: "paper", name: "李林/张宇模拟卷", detail: "状态好一天一套，状态差隔天一套，合计约 15 套", completed: false },
        ] },
      ],
    },
    {
      id: "english",
      name: "英语一",
      shortName: "英一",
      weight: 20,
      accent: "#5b7f70",
      note: "按 427 分快线：8–11 月真题一轮，最后三年整卷，考前两周作文",
      phases: [
        { id: "eng-word-first", name: "词汇补缺（按个人基础）", weight: 15, progress: 85, resources: [
          { id: "rapid-eng-word", type: "other", name: "个人词汇缺口", detail: "快线作者四级 613、六级 583；基础不同需主动前移", completed: false },
        ] },
        { id: "eng-real", name: "01–22 阅读与完形一轮", weight: 35, progress: 0, resources: [
          { id: "rapid-eng-real", type: "paper", name: "01–22 年真题", detail: "8–11 月完成阅读与完形一轮", completed: false },
        ] },
        { id: "eng-translation", name: "近十年翻译", weight: 15, progress: 0, resources: [
          { id: "rapid-eng-translation", type: "paper", name: "近十年翻译真题", detail: "与阅读阶段并行", completed: false },
        ] },
        { id: "eng-mock", name: "最后三年整卷模拟", weight: 20, progress: 0, resources: [
          { id: "rapid-eng-mock", type: "paper", name: "最后三年真题", detail: "从头到尾含作文整卷模拟", completed: false },
        ] },
        { id: "eng-writing", name: "大小作文冲刺", weight: 15, progress: 0, resources: [
          { id: "rapid-eng-writing", type: "exercise", name: "大小作文", detail: "12 月最后两周每天练一篇大作文或小作文", completed: false },
        ] },
      ],
    },
    {
      id: "politics",
      name: "思想政治理论",
      shortName: "政治",
      weight: 15,
      accent: "#b47a32",
      note: "按 427 分快线：少而精，11 月预测选择、12 月肖四与主观题",
      phases: [
        { id: "pol-basic", name: "强化课 + 1000 题", weight: 30, progress: 0, resources: [
          { id: "rapid-pol-course", type: "chapter", name: "徐涛史纲/马原强化课", detail: "时间足够则完整学习", completed: false },
          { id: "rapid-pol-1000", type: "exercise", name: "肖秀荣 1000 题", detail: "快线至少完成约一半；基础弱者应尽量全做", completed: false },
        ] },
        { id: "pol-choice", name: "肖八与预测卷选择题", weight: 35, progress: 0, resources: [
          { id: "rapid-pol-choice", type: "paper", name: "肖八 / 腿姐 / 徐涛预测卷", detail: "11 月集中完成选择题", completed: false },
        ] },
        { id: "pol-recite", name: "肖四主观题", weight: 25, progress: 0, resources: [
          { id: "rapid-pol-recite", type: "other", name: "肖四大题", detail: "考前两周集中背诵", completed: false },
        ] },
        { id: "pol-mock", name: "肖四选择题与限时", weight: 10, progress: 0, resources: [
          { id: "rapid-pol-mock", type: "paper", name: "肖四", detail: "选择题约 40 分钟；大题每题约 25 分钟", completed: false },
        ] },
      ],
    },
    {
      id: "circuit",
      name: "840 电路原理",
      shortName: "840",
      weight: 30,
      accent: "#755c9f",
      note: "按 427 分快线：7 月中启动、10 月中一轮、11 月真题、考前模拟二刷",
      phases: [
        { id: "cir-first", name: "初试全程班一轮", weight: 35, progress: 0, resources: [
          { id: "rapid-cir-course", type: "chapter", name: "水木珞研初试全程班", detail: "逐节网课，7 月中至 10 月中", completed: false },
          { id: "rapid-cir-book", type: "book", name: "范承志《电路原理》", detail: "参考教材", completed: false },
        ] },
        { id: "cir-chapter", name: "宝典例题与课后题", weight: 15, progress: 0, resources: [
          { id: "rapid-cir-chapter", type: "exercise", name: "宝典例题/课后题", detail: "每节课后立即完成并订正", completed: false },
        ] },
        { id: "cir-real", name: "01–22 年真题", weight: 30, progress: 0, resources: [
          { id: "rapid-cir-real", type: "paper", name: "01–22 年真题", detail: "10 月中至 11 月中，一天一套并认真订正", completed: false },
        ] },
        { id: "cir-material", name: "6 套模拟 + 16–21 二刷", weight: 20, progress: 0, resources: [
          { id: "rapid-cir-mock", type: "paper", name: "水木珞研 6 套模拟卷", detail: "每隔一天一套", completed: false },
          { id: "rapid-cir-second", type: "paper", name: "16–21 年真题二刷", detail: "模拟后回到近六年真题", completed: false },
        ] },
      ],
    },
  ],
  sessions: [],
  plans: [],
  schedule: [],
  planTemplates: [],
  examRecords: [],
  reviewItems: [],
  dataSafety: { lastExternalBackupAt: "" },
  experiences: defaultExperiences,
  fastestExperienceId: DEFAULT_FASTEST_EXPERIENCE_ID,
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
