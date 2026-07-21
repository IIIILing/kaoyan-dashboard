export type Phase = {
  id: string;
  name: string;
  weight: number;
  progress: number;
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

export type ScoreWeights = {
  duration: number;
  completion: number;
  focus: number;
  review: number;
  timing: number;
  sleep: number;
  exercise: number;
};

export type StudyState = {
  version: 1;
  profile: {
    name: string;
    target: string;
    examDate: string;
    dailyTargetHours: number;
    wakeTime: string;
    sleepTime: string;
  };
  scoring: {
    weights: ScoreWeights;
  };
  subjects: Subject[];
  sessions: StudySession[];
};

export const defaultStudyState: StudyState = {
  version: 1,
  profile: {
    name: "Jimmy",
    target: "2027 浙江大学电气工程专硕",
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
  },
  subjects: [
    {
      id: "math",
      name: "数学一",
      shortName: "数一",
      weight: 35,
      accent: "#1565a7",
      note: "除概率统计外，基础内容已完成一轮",
      phases: [
        { id: "math-basic", name: "基础一轮", weight: 30, progress: 85 },
        { id: "math-intense", name: "强化刷题", weight: 30, progress: 0 },
        { id: "math-real", name: "历年真题", weight: 25, progress: 0 },
        { id: "math-mock", name: "模考复盘", weight: 15, progress: 0 },
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
        { id: "eng-word-first", name: "单词一轮", weight: 25, progress: 85 },
        { id: "eng-word-second", name: "单词二轮", weight: 25, progress: 0 },
        { id: "eng-real", name: "15 年真题", weight: 30, progress: 0 },
        { id: "eng-mock", name: "模拟卷 20 套", weight: 10, progress: 0 },
        { id: "eng-writing", name: "写作模板", weight: 10, progress: 0 },
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
        { id: "pol-basic", name: "基础课程", weight: 30, progress: 0 },
        { id: "pol-choice", name: "选择题强化", weight: 35, progress: 0 },
        { id: "pol-recite", name: "主观题背诵", weight: 25, progress: 0 },
        { id: "pol-mock", name: "套卷模考", weight: 10, progress: 0 },
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
        { id: "cir-first", name: "一轮复习", weight: 30, progress: 0 },
        { id: "cir-chapter", name: "章节习题", weight: 20, progress: 0 },
        { id: "cir-real", name: "历年真题", weight: 30, progress: 0 },
        { id: "cir-material", name: "机构资料", weight: 20, progress: 0 },
      ],
    },
  ],
  sessions: [],
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
