import type { Subject } from "./study-state";

export type DatePrecision = "explicit" | "inferred" | "approximate";

export type ExperienceMilestone = {
  id: string;
  phaseId?: string;
  title: string;
  startMonthDay: string;
  endMonthDay: string;
  detail: string;
  workload: string;
  sourcePages: number[];
  datePrecision: DatePrecision;
};

export type ExperienceSubject = {
  id: string;
  name: string;
  shortName: string;
  score?: number;
  summary: string;
  materials: string[];
  methods: string[];
  milestones: ExperienceMilestone[];
  examStrategy: string;
  pitfalls: string[];
  sourceNotes: string[];
};

export type ExperiencePost = {
  id: string;
  title: string;
  authorLabel: string;
  totalScore?: number;
  school: string;
  major: string;
  prepStartLabel: string;
  prepStartMonthDay: string;
  dailyHours: string;
  overview: string;
  subjects: ExperienceSubject[];
  overallAdvice: string[];
  preservedText: string[];
  source: {
    document: string;
    pdfPages: number[];
    printedPages: number[];
    note: string;
  };
};

export type ExperienceArchive = {
  kind: "kaoyan-experience-library";
  version: 1;
  exportedAt: string;
  fastestExperienceId: string;
  experiences: ExperiencePost[];
};

export const CANONICAL_EXPERIENCE_SUBJECTS = [
  { id: "math", name: "数学一", shortName: "数一" },
  { id: "english", name: "英语一", shortName: "英一" },
  { id: "circuit", name: "840 电路", shortName: "电路" },
  { id: "politics", name: "思想政治理论", shortName: "政治" },
] as const;

function milestone(
  id: string,
  phaseId: string,
  title: string,
  startMonthDay: string,
  endMonthDay: string,
  detail: string,
  workload: string,
  sourcePages: number[],
  datePrecision: DatePrecision = "explicit",
): ExperienceMilestone {
  return { id, phaseId, title, startMonthDay, endMonthDay, detail, workload, sourcePages, datePrecision };
}

export const DEFAULT_FASTEST_EXPERIENCE_ID = "whitepaper-experience-2";

export const defaultExperiences: ExperiencePost[] = [
  {
    id: "whitepaper-experience-1",
    title: "经验贴一 · 433 分高分路线",
    authorLabel: "天津某 985 电气考生",
    totalScore: 433,
    school: "浙江大学",
    major: "电气工程专硕",
    prepStartLabel: "数学 3 月、英语 2 月、电路 3 月、政治 9 月分科启动",
    prepStartMonthDay: "02-01",
    dailyHours: "原文未给统一时长；数学模考常安排 8:30–11:30，电路真题常安排 15:00–18:00",
    overview: "本科就读天津某 985，初试 433 分并以第一名上岸电力电子方向。路线长、轮次多，强调纸质做题、错题归纳与反复重做。",
    subjects: [
      {
        id: "math",
        name: "数学一",
        shortName: "数一",
        score: 150,
        summary: "3–5 月以李永乐全书自学并同步做李林 880；6 月中完成一轮，7 月中完成二刷；8 月补 660、330、108 与严选题，9 月中开始真题，10 月进入高强度模拟。",
        materials: ["李永乐全书（提高篇）", "李林 880", "李永乐 660", "李林 330", "李林 108", "严选题", "李林 6+4", "张宇 8+4", "武忠祥 6+6", "李艳芳 3 套", "余丙森 5 套", "共创超越卷", "周洋鑫试卷"],
        methods: ["全程以自学为主，一天一章", "学完一章立即做 880 对应基础篇并对答案", "一刷标记错题，二刷只做标记题并写入错题本", "每份练习完成后再整理错题并归纳解法", "模考后留足一小时检查，不执着模考分数"],
        milestones: [
          milestone("exp1-math-basic", "math-basic", "基础一轮 + 880 一刷", "03-01", "06-15", "李永乐全书自学，高数后学线代，概率论与线代综合篇并行；一章一练。", "约一天一章；6 月中完成 880 一刷", [50]),
          milestone("exp1-math-intense", "math-intense", "880 二刷与拓展强化", "06-16", "09-15", "7 月中完成 880 二刷；8 月做 660 并反复整理错题，之后完成 330、108、严选题。", "错题多轮重做；9 月中前完成强化材料", [50]),
          milestone("exp1-math-real", "math-real", "历年真题", "09-15", "09-30", "从 2003 年真题起，一天 1–2 套。", "一天 1–2 套", [50]),
          milestone("exp1-math-mock", "math-mock", "80+ 套模拟与复盘", "10-01", "12-19", "上午 8:30–11:30 限时做卷，晚上归纳错题；后期选择高质量卷认真复做。", "一天 1–2 套，累计约 80 套（含往年题）", [50]),
        ],
        examStrategy: "用约 2.5 小时完成作答并预留约 1 小时检查；把模拟当作练习与水平校准。",
        pitfalls: ["该路线自学强度很高，不一定适合所有人", "模拟卷数量不是目标，认真复盘比刷量更重要"],
        sourceNotes: ["原文明确：数学 150 分。", "3–5 月自学；880 一刷约 6 月中完成、二刷约 7 月中完成。", "10 月起大量限时模拟，做过多位老师的卷。"],
      },
      {
        id: "english",
        name: "英语一",
        shortName: "英一",
        score: 76,
        summary: "2 月开始每日约 50 个新词，考前完成约三轮；7 月启动阅读，9 月 20 日左右完成 01–20 年一刷，随后二刷并加入新题型、完形、翻译与作文，12 月整卷模拟。",
        materials: ["墨墨背单词", "英语一小黄书", "唐迟阅读逻辑课", "石雷鹏作文课", "2010 年后真题", "保留 2021、2022 年真题"],
        methods: ["词汇每天约两页/50 个新词并持续滚动", "阅读先精读、全文翻译、标生词，再看唐迟逻辑", "二刷阶段按题型训练并同步完成新题型和翻译", "作文隔天一篇；保留最后两三年真题整卷模拟"],
        milestones: [
          milestone("exp1-eng-word", "eng-word-first", "词汇滚动三轮", "02-01", "12-19", "墨墨每天约 50 个新词，持续到考前。", "约 50 个新词/天", [49, 50]),
          milestone("exp1-eng-real", "eng-real", "01 年起阅读真题三轮", "07-01", "11-15", "先每日一篇，后每日两篇；9 月 20 日左右完成一刷并保留 21、22 年。", "一刷 1–2 篇/天；二刷配合题型训练", [49]),
          milestone("exp1-eng-translation", "eng-translation", "新题型、完形与翻译", "09-21", "11-30", "10 年后的题目按题型推进，通常一天一篇并与阅读并行。", "一天一篇左右", [49]),
          milestone("exp1-eng-writing", "eng-writing", "作文模板与练习", "11-15", "12-19", "学习石雷鹏作文课，掌握通用句型，12 月隔天写一篇。", "12 月约两天一篇", [49, 50]),
          milestone("exp1-eng-mock", "eng-mock", "留题整卷模拟", "12-01", "12-15", "从 2010 年起按套卷训练，最后用保留的 21、22 年真题模拟。", "一天一套至 12 月中", [49, 50]),
        ],
        examStrategy: "保留最近两三年真题作整卷模拟；若阅读已做三遍，可用英二阅读维持手感。",
        pitfalls: ["一刷阅读错得多很正常，不要因此影响心态", "新题型虽分值小也不能忽视"],
        sourceNotes: ["原文明确：英语一 76 分。", "一刷阅读约在 9 月 20 日结束；11 月中进入题型三刷和作文。"],
      },
      {
        id: "circuit",
        name: "840 电路",
        shortName: "电路",
        score: 136,
        summary: "3 月进入水木珞研全程班；每章网课后立即做宝典 S 对应题并标记疑难，基础班约 7 月完成；7–10 月强化并二刷宝典 S，10 月起做真题，11 月底前三刷，12 月回到冲刺卷、真题与错题。",
        materials: ["水木珞研全程班", "宝典 S", "群每日一题与月考", "浙江大学 840 历年真题", "冲刺卷"],
        methods: ["每章视频后立即做宝典 S 对应练习", "不会的题标记并在群内提问", "强化阶段把宝典 S 二刷，难题可做 4–5 遍", "真题每题至少验算两遍，首轮查缺补漏，近年题多刷"],
        milestones: [
          milestone("exp1-cir-first", "cir-first", "全程班基础一轮", "03-01", "07-01", "跟课学习并同步宝典 S 章节练习、每日一题和月考。", "每学完一章立即做对应题", [51]),
          milestone("exp1-cir-chapter", "cir-chapter", "强化课 + 宝典 S 二刷", "07-01", "10-01", "反复整理方法，个别题目做 4–5 遍。", "7–10 月持续", [51]),
          milestone("exp1-cir-real", "cir-real", "真题多轮", "10-01", "11-30", "下午 3–6 点做真题；前期一天约两套，近年难题二刷、三刷、四刷。", "一天约 1–2 套", [51]),
          milestone("exp1-cir-material", "cir-material", "冲刺卷与错题回炉", "12-01", "12-19", "反复做冲刺卷、往年真题与宝典 S 标记题。", "持续复盘至考前", [51]),
        ],
        examStrategy: "计算量大，每道题尽量验算两遍；遇到陌生结构先化简并寻找与往年题、宝典 S 的同构。",
        pitfalls: ["近年题型可能明显变难，不要只做一遍", "计算错误代价高，需要稳定的验算流程"],
        sourceNotes: ["原文明确：840 电路 136 分。", "基础班约 7 月结束；10 月开始真题；三刷约 11 月底结束。"],
      },
      {
        id: "politics",
        name: "思想政治理论",
        shortName: "政治",
        score: 71,
        summary: "9 月才启动，用徐涛核心考案与强化班视频约一个半月过知识点，同时完成 1000 题一刷；之后用腿姐冲刺背诵手册加深记忆并二刷 1000 题，11 月起集中做预测选择题，12 月背肖四主观题。",
        materials: ["徐涛核心考案", "徐涛强化班", "肖秀荣 1000 题", "腿姐冲刺背诵手册", "肖八", "腿姐/徐涛/米鹏预测卷", "肖四"],
        methods: ["第一轮以建立书本印象为主，不边听课边机械翻书", "背诵手册每天约 1.5 小时并二刷 1000 题", "预测卷只做选择题，逐题看解析", "肖四主观题反复背，尽量覆盖每题"],
        milestones: [
          milestone("exp1-pol-basic", "pol-basic", "核心考案 + 强化班", "09-01", "10-15", "约一个半月完成知识点一轮，同时 1000 题一刷。", "每天跟课并做题", [48]),
          milestone("exp1-pol-choice", "pol-choice", "背诵手册 + 1000 题二刷", "10-16", "10-31", "每天约 1.5 小时过背诵手册并二刷。", "约 1.5 小时/天", [48, 49]),
          milestone("exp1-pol-mock", "pol-mock", "肖八与多家预测选择题", "11-01", "12-01", "肖八选择题做 3 遍，11 月初至 12 月 20 日基本每天两套选择题并复盘解析。", "约两套选择题/天", [49]),
          milestone("exp1-pol-recite", "pol-recite", "肖四主观题背诵", "12-01", "12-19", "肖四到手后集中反复背主观题。", "覆盖并写满每道大题", [49]),
        ],
        examStrategy: "选择题与主观题时间预先分配；纸质卷做题并圈关键词。",
        pitfalls: ["只做选择题不看解析会损失复盘价值", "主观题不要只押少数题"],
        sourceNotes: ["原文明确：政治 71 分，选择约 36、主观约 35。", "9 月开始；11 月进入预测卷；12 月背肖四。"],
      },
    ],
    overallAdvice: ["决定考研后保持态度端正，不以外部困难为借口。", "重视纸质练习、错题记录与反复重做。", "题量之外，更要形成检查和复盘流程。"],
    preservedText: ["初试总分 433：政治 71、英语一 76、数学一 150、840 电路 136。", "作者自述本科为天津某 985 电气专业，并以初试第一名上岸浙大电力电子。"],
    source: { document: "27浙大报考白皮书_扫描版(1).pdf", pdfPages: [48, 49, 50, 51], printedPages: [47, 48, 49, 50], note: "逐页视觉核对后结构化；月份和题量按原文保留。" },
  },
  {
    id: DEFAULT_FASTEST_EXPERIENCE_ID,
    title: "经验贴二 · 7 月中旬启动快线",
    authorLabel: "短周期高分考生",
    totalScore: 427,
    school: "浙江大学",
    major: "电气工程专硕",
    prepStartLabel: "7 月中旬小学期结束后启动",
    prepStartMonthDay: "07-15",
    dailyHours: "7–8 月 5–6 小时；9–11 月 8–9 小时；12 月约 9.5 小时",
    overview: "三篇中明确起步最晚、备考周期最短的一篇，因此作为快线基准。总分 427，强调数学长时段投入、真题整卷训练与专业课快速跟班推进。",
    subjects: [
      {
        id: "math",
        name: "数学一",
        shortName: "数一",
        score: 145,
        summary: "7 月中旬到 9 月中旬完成数学一轮；之后每天投入 5 小时以上完成张宇强化 30 讲和 1000 题，10 月下旬完成二轮；真题 08–21 年每天一张，11 月中进入模拟，约做 15 套。",
        materials: ["张宇基础课", "张宇基础 300 题", "李永乐 660（高数部分）", "张宇强化 30 讲", "张宇 1000 题", "08–21 年真题", "李林四套卷/八套卷", "张宇四套卷/八套卷", "张宇真题大全解"],
        methods: ["基础课每一节跟例题，课后立即做对应题", "二轮每天至少 5 小时，一天一节强化课并做对应 1000 题", "真题一天一张并订正，完成后按同类题回查 1987–2022 年题目", "线代和概率统计题型固定，可用相对少的时间拿分"],
        milestones: [
          milestone("exp2-math-basic", "math-basic", "第一轮：基础课 + 300/660", "07-15", "09-15", "张宇基础课逐节例题，暑假做基础 300 题和李永乐 660 高数部分。", "7 月中旬至 9 月中旬", [53]),
          milestone("exp2-math-intense", "math-intense", "第二轮：强化 30 讲 + 1000", "09-16", "10-31", "每天一节张宇强化课并完成对应 1000 题。", "每天 5 小时以上", [53]),
          milestone("exp2-math-real", "math-real", "08–21 年真题", "11-01", "11-15", "一天一张并订正，平均约 130 分。", "一天一套", [53]),
          milestone("exp2-math-mock", "math-mock", "15 套模拟", "11-16", "12-19", "状态好一天一套，状态差隔天一套；李林与张宇模拟卷合计约 15 套。", "约 15 套", [53]),
        ],
        examStrategy: "选填约 1 小时、大题约 2 小时；真题和模拟遇到薄弱题型时回查同类历年题归纳方法。",
        pitfalls: ["错了一道填空且考后仍不会，说明不能只看总分而忽略盲点", "老师选择需要试课，不要只看名气"],
        sourceNotes: ["原文明确：数学一 145 分。", "第一轮 7 月中旬至 9 月中旬；二轮约 10 月下旬完成；真题完成时已到 11 月中。"],
      },
      {
        id: "english",
        name: "英语一",
        shortName: "英一",
        score: 81,
        summary: "英语基础较好（四级 613、六级 583）。8–11 月只做一遍 01–22 年阅读、完形和近十年翻译；12 月最后两周每天练一篇大/小作文，并保留最后三年真题作整卷模拟。",
        materials: ["01–22 年英语一真题", "近十年翻译真题", "最后三年真题整卷", "作文练习"],
        methods: ["按自身英语基础压缩时间，不机械复制别人的词汇安排", "8–11 月完成阅读、完形与翻译", "最后三年真题从头到尾含作文整卷模拟", "12 月最后两周每天练一篇大作文或小作文"],
        milestones: [
          milestone("exp2-eng-word", "eng-word-first", "按基础补词汇", "07-15", "08-31", "原文英语基础较好，未单列背词路线；该时间窗为接入快线进度的保守换算。", "按个人基础加减", [52], "inferred"),
          milestone("exp2-eng-real", "eng-real", "01–22 阅读与完形一轮", "08-01", "11-30", "原文明确 8–11 月完成一轮阅读和完形。", "一轮完成", [52]),
          milestone("exp2-eng-translation", "eng-translation", "近十年翻译", "08-01", "11-30", "与阅读阶段并行。", "近十年真题", [52]),
          milestone("exp2-eng-mock", "eng-mock", "最后三年整卷模拟", "12-01", "12-19", "从头到尾包含作文，适应时间与考场环境。", "保留 3 套真题", [52], "approximate"),
          milestone("exp2-eng-writing", "eng-writing", "大小作文冲刺", "12-06", "12-19", "最后两周每天练一篇大作文或小作文。", "每天一篇", [52]),
        ],
        examStrategy: "完形约 20 分钟、阅读约 70 分钟、翻译约 15 分钟、小作文约 25 分钟、大作文约 50 分钟；阅读速度过快导致扣分，应主动控速。",
        pitfalls: ["该路线依赖较好的英语基础，不能无条件照搬", "必须保留最后三年整卷，并连作文一起模拟"],
        sourceNotes: ["原文明确：英语一 81 分，客观约扣 12、主观约扣 7。", "8–11 月完成阅读/完形/翻译；12 月最后两周练作文。"],
      },
      {
        id: "circuit",
        name: "840 电路",
        shortName: "电路",
        score: 126,
        summary: "因时间短且专业课基础弱，选择水木珞研初试全程班。7 月中旬启动，10 月中旬完成第一轮；10 月中至 11 月中每天一套 01–22 年真题并订正；随后做 6 套模拟并二刷 16–21 年真题。",
        materials: ["范承志《电路原理》", "水木珞研初试全程班", "宝典例题与课后题", "01–22 年真题", "水木珞研 6 套模拟卷", "16–21 年真题二刷"],
        methods: ["每节网课都看，课后做宝典例题与课后题并及时总结", "真题一天一套并认真订正", "模拟卷隔天一套，出卷风格贴近真题", "最后二刷近六年真题"],
        milestones: [
          milestone("exp2-cir-first", "cir-first", "初试全程班一轮", "07-15", "10-15", "逐节网课，配套宝典例题与课后题。", "约 3 个月", [53]),
          milestone("exp2-cir-chapter", "cir-chapter", "章节题同步消化", "07-15", "10-15", "每节课后立即完成对应例题和课后题并订正。", "与一轮并行", [53]),
          milestone("exp2-cir-real", "cir-real", "01–22 年真题", "10-16", "11-15", "每天一套，认真订正。", "一天一套", [53]),
          milestone("exp2-cir-material", "cir-material", "6 套模拟 + 16–21 二刷", "11-16", "12-19", "先隔天一套模拟，后回到 16–21 年真题二刷。", "6 套模拟；近 6 年真题二刷", [53]),
        ],
        examStrategy: "不要因近年未考某题型就忽视；大计算题要预留验算时间，过程清晰可争取步骤分。",
        pitfalls: ["一轮错题很多时应及时总结方法", "今年出现多年未考图论题，押题式删知识点风险很高"],
        sourceNotes: ["原文明确：840 电路 126 分。", "10 月中旬完成一轮；10 月中到 11 月中做真题；之后 6 套模拟与近年题二刷。"],
      },
      {
        id: "politics",
        name: "思想政治理论",
        shortName: "政治",
        score: 75,
        summary: "政治投入较少：徐涛史纲/马原强化课配合约一半肖秀荣 1000 题；11 月做肖八与腿姐、徐涛预测卷选择题；12 月做肖四选择题，考前两周背肖四主观题。",
        materials: ["肖秀荣 1000 题（约一半）", "徐涛史纲/马原强化课", "腿姐冲刺班", "肖八", "腿姐/徐涛预测卷", "肖四"],
        methods: ["时间紧时优先毛中特、思修预测卷选择题", "时间足够则看完强化课并完成 1000 题", "11 月集中预测卷选择题，12 月肖四", "考前两周背肖四主观题"],
        milestones: [
          milestone("exp2-pol-basic", "pol-basic", "强化课 + 1000 题", "09-01", "10-31", "原文未给具体起始日；按 11 月进入预测卷倒推为 9–10 月。", "完成约一半 1000 题", [52], "inferred"),
          milestone("exp2-pol-choice", "pol-choice", "肖八与多家预测选择题", "11-01", "11-30", "肖八、腿姐和徐涛预测卷选择题。", "11 月集中完成", [52]),
          milestone("exp2-pol-mock", "pol-mock", "肖四选择题与限时", "12-01", "12-19", "做肖四选择题，并按 40 分钟选择题 + 大题限时练习。", "选择题约 40 分钟", [52]),
          milestone("exp2-pol-recite", "pol-recite", "肖四主观题", "12-06", "12-19", "考前两周背肖四主观题。", "考前两周", [52]),
        ],
        examStrategy: "选择题约 40 分钟；五道大题每题约 25 分钟，答案框尽量写满，来不及时保持有条理地补充材料。",
        pitfalls: ["时间紧时不要平均用力，应优先高收益模块", "该路线政治投入很少，基础弱者应前移启动时间"],
        sourceNotes: ["原文明确：政治 75 分，客观约 40、主观约 35。", "11 月做预测卷选择题；12 月做肖四并在考前两周背主观题。"],
      },
    ],
    overallAdvice: ["短周期路线必须按阶段提高有效时长：暑期 5–6 小时，9–11 月 8–9 小时。", "数学占用最长时段；英语根据既有基础压缩或扩充。", "真题要整卷、限时并订正，不能只追求做完。", "作息重效率，作者通常 9:30 后才出门学习。"],
    preservedText: ["初试总分 427：政治 75、英语一 81、数学一 145、840 电路 126。", "7 月中旬小学期结束后开始准备；7–8 月 5–6 小时，9–11 月 8–9 小时，12 月约 9.5 小时。"],
    source: { document: "27浙大报考白皮书_扫描版(1).pdf", pdfPages: [52, 53, 54], printedPages: [51, 52, 53], note: "三篇中备考起步最晚，故定义为快线；带 inferred 的日期为按原文前后阶段换算。" },
  },
  {
    id: "whitepaper-experience-3",
    title: "经验贴三 · 421 分稳健路线",
    authorLabel: "浙大电气考生",
    totalScore: 421,
    school: "浙江大学",
    major: "电气工程专硕",
    prepStartLabel: "英语/数学 3 月，专业课 6 月，政治 8 月中旬",
    prepStartMonthDay: "03-01",
    dailyHours: "上午数学、下午专业课、晚间与零碎时间英语和政治；通常 9:30 后出门，重效率不追时长",
    overview: "总分 421，强调先做月计划，再按上午数学、下午专业课、晚间英语政治分配。数学基础阶段集中完成，英语靠长期词汇和多轮阅读，专业课用全程班减少信息搜集成本。",
    subjects: [
      {
        id: "math",
        name: "数学一",
        shortName: "数一",
        score: 145,
        summary: "3–5 月完成数学基础课程和 660 一轮，随后三科习题二刷并记录错题；提高阶段跟课做 660/330，二刷后用 880 补线代与概率；真题从 2010 年起，随后做模拟并持续总结。",
        materials: ["数学基础课程", "李永乐 660", "330", "李林 880", "2010 年后真题", "各老师模拟卷"],
        methods: ["基础阶段集中学习数学，3–5 月完成三门基础课程", "练习先一轮再二刷，记录重复做错的题", "线代与概率薄弱处用 880 补充", "模拟每套都总结错题和知识点，考前回到少量错题保持手感"],
        milestones: [
          milestone("exp3-math-basic", "math-basic", "基础课 + 660 一轮", "03-01", "05-31", "完成高数、线代、概率基础课程及相关练习。", "3 个月集中学习", [55]),
          milestone("exp3-math-intense", "math-intense", "习题二刷 + 提高课", "06-01", "08-31", "二刷 660/330，并以 880 补线代和概率。", "错题记录并反复做", [55], "approximate"),
          milestone("exp3-math-real", "math-real", "2010 年后真题", "09-01", "10-15", "真题做一轮并记录错题，前期已覆盖部分真题所以不再二刷。", "按套推进", [55], "approximate"),
          milestone("exp3-math-mock", "math-mock", "模拟与框架复盘", "10-16", "12-19", "模拟卷基本都做；考前不再整套，改为错题与知识框架。", "每套复盘", [55], "approximate"),
        ],
        examStrategy: "模拟用于识别水平并建立信心；临考不盲目堆整套卷，保持手感并回看知识框架。",
        pitfalls: ["前期很迷茫时要靠模拟反馈校准", "做完不总结，模拟价值会大幅下降"],
        sourceNotes: ["原文明确：数学一 145 分。", "3–5 月基础课和 660 一轮；之后二刷、提高、真题和模拟。"],
      },
      {
        id: "english",
        name: "英语一",
        shortName: "英一",
        score: 80,
        summary: "3 月起用扇贝/红宝书每天约 80 词；6 月开始真题阅读，一刷每天两篇，只对答案看解析，之后看唐迟并二刷精读；新题型并入阅读，完形后置，翻译后期每天两句，作文用石雷鹏句型写历年真题。",
        materials: ["扇贝", "红宝书", "英语一真题", "唐迟阅读课", "宋逸轩新题型课", "石雷鹏作文课"],
        methods: ["利用零碎时间每天约 80 词，滚动一两轮后负担明显下降", "阅读一刷求覆盖，二刷精读并标题型", "新题型并入阅读；完形等词汇量上来再做", "翻译后期每天两句，先划结构再组织答案", "作文只看课程前三节后，用通用句型写历年真题"],
        milestones: [
          milestone("exp3-eng-word", "eng-word-first", "词汇长期滚动", "03-01", "12-19", "红宝书/扇贝每天约 80 个，根据自身情况调整。", "约 80 个/天", [54, 55]),
          milestone("exp3-eng-real", "eng-real", "真题阅读一刷、二刷", "06-01", "10-31", "一刷每天两篇，二刷看唐迟后精读并标题型。", "一刷两篇/天", [55], "approximate"),
          milestone("exp3-eng-translation", "eng-translation", "新题型、完形与翻译", "09-01", "12-19", "新题型并入阅读；翻译后期每天两句。", "翻译两句/天", [55], "approximate"),
          milestone("exp3-eng-writing", "eng-writing", "作文真题练习", "10-15", "12-19", "看石雷鹏课程前三节后，用常用句型写历年真题作文。", "按历年题练习", [55], "approximate"),
          milestone("exp3-eng-mock", "eng-mock", "整卷与时间适应", "12-01", "12-19", "原文未给独立整卷数量，按后期综合练习保守换算。", "按需", [55], "inferred"),
        ],
        examStrategy: "翻译先划分句子结构并在草稿纸组织语言；作文依靠通用句型熟练输出。",
        pitfalls: ["前期背词会吃力，但滚动一两轮后会明显轻松", "阅读只看正确率、不总结题型和错误原因会限制提升"],
        sourceNotes: ["原文明确：英语一 80 分。", "3 月背词；6 月开始阅读；翻译和完形后置。"],
      },
      {
        id: "circuit",
        name: "840 电路",
        shortName: "电路",
        score: 119,
        summary: "6 月开始专业课，先看课程视频，每章完成后做宝典对应章节；按部就班结束后做真题，一般每天一两套；随后二刷，考前整理完整知识框架。",
        materials: ["水木珞研全程班", "宝典章节题", "浙江大学 840 历年真题", "机构整理知识点与真题"],
        methods: ["每学完一章就完成宝典对应章节题", "全程班结束后每天做 1–2 套真题", "完成后再二刷，考前整理完整知识框架", "不懂及时在群内提问，利用机构信息降低搜集成本"],
        milestones: [
          milestone("exp3-cir-first", "cir-first", "全程班课程一轮", "06-01", "09-30", "逐章看视频并完成对应章节。", "约 4 个月", [55, 56], "approximate"),
          milestone("exp3-cir-chapter", "cir-chapter", "宝典章节题", "06-01", "09-30", "每章学完立即做宝典对应题。", "与课程同步", [55, 56], "approximate"),
          milestone("exp3-cir-real", "cir-real", "真题一轮", "10-01", "11-15", "全程班后开始真题，一天一两套。", "一天 1–2 套", [56], "approximate"),
          milestone("exp3-cir-material", "cir-material", "真题二刷与框架", "11-16", "12-19", "二刷真题，考前像数学一样整理知识框架。", "持续至考前", [56], "approximate"),
        ],
        examStrategy: "跟紧全程班和群内节奏，利用整理好的知识点与真题节省信息搜集时间。",
        pitfalls: ["作者本科基础和信息搜集能力较弱，独自摸索成本高", "遇到不会的问题不要因不好意思而不提问"],
        sourceNotes: ["原文明确：840 电路 119 分。", "约 6 月开始专业课；课程章节完成后刷真题，再二刷并整理框架。"],
      },
      {
        id: "politics",
        name: "思想政治理论",
        shortName: "政治",
        score: 77,
        summary: "8 月中旬开始，晚饭后看徐涛课程并跟着勾画；腿姐技巧班后做笔记抓重点；预测卷出来后刷题并记录错题，肖八每天一套并二刷，肖四前二刷肖八，肖四到手后主攻大题答案。",
        materials: ["徐涛课程", "腿姐技巧班", "各老师预测卷", "肖八", "肖四", "小程序刷题"],
        methods: ["课程阶段以跟画和缓解焦虑为主，不要求一次掌握", "技巧班后做重点笔记，不迷信机械选项技巧", "肖八一天一套，不会的知识点归纳并二刷", "其他预测卷用碎片时间刷并记录错题", "肖四到手后主攻大题答案"],
        milestones: [
          milestone("exp3-pol-basic", "pol-basic", "徐涛课程 + 腿姐技巧", "08-15", "10-31", "晚饭后听课，后期按技巧班重点做笔记。", "晚间推进", [54]),
          milestone("exp3-pol-choice", "pol-choice", "预测卷 + 肖八", "11-01", "12-05", "肖八一天一套并二刷，其他卷用碎片时间完成。", "肖八一天一套", [54], "approximate"),
          milestone("exp3-pol-mock", "pol-mock", "肖八二刷与错题", "11-15", "12-05", "肖四前完成肖八二刷并回看总结。", "错题复盘", [54], "approximate"),
          milestone("exp3-pol-recite", "pol-recite", "肖四大题", "12-06", "12-19", "肖四到手后主要背大题答案，尽量四套都背。", "4 套尽量全背", [54], "approximate"),
        ],
        examStrategy: "前期快速过课减轻焦虑，后期以肖八选择题与肖四大题为明确抓手。",
        pitfalls: ["不要迷信几短选几、三选几等机械技巧", "任务虽多但单项耗时不长，应按节点推进"],
        sourceNotes: ["原文明确：政治 77 分。", "8 月中旬开始；肖八每天一套；肖四出来后主攻大题。"],
      },
    ],
    overallAdvice: ["先估算每月学到哪里，再拆成日计划。", "按上午数学、下午专业课、晚间英语政治分配，减少切换。", "学习时长不是唯一指标，作者重效率且常 9:30 后才出门。", "报班的价值之一是节省专业课信息搜集成本并获得答疑。"],
    preservedText: ["初试总分 421：政治 77、英语一 80、数学一 145、840 电路 119。", "正式大块学习约从 6 月开始；每天上午数学、下午专业课、晚间与零碎时间英语政治。"],
    source: { document: "27浙大报考白皮书_扫描版(1).pdf", pdfPages: [54, 55, 56], printedPages: [53, 54, 55], note: "逐页视觉核对后结构化；原文未给日期处用 approximate/inferred 标记。" },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function pageList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function canonicalSubjectId(id: string, name: string) {
  const text = `${id} ${name}`.toLowerCase();
  if (text.includes("math") || text.includes("数学") || text.includes("数一")) return "math";
  if (text.includes("english") || text.includes("英语") || text.includes("英一")) return "english";
  if (text.includes("circuit") || text.includes("电路") || text.includes("840")) return "circuit";
  if (text.includes("politics") || text.includes("政治") || text.includes("101")) return "politics";
  return id || crypto.randomUUID();
}

function emptySubject(id: string, name: string, shortName: string): ExperienceSubject {
  return { id, name, shortName, summary: "", materials: [], methods: [], milestones: [], examStrategy: "", pitfalls: [], sourceNotes: [] };
}

function normalizeMilestone(value: unknown): ExperienceMilestone | null {
  if (!isRecord(value)) return null;
  const title = stringValue(value.title);
  if (!title) return null;
  const precision = value.datePrecision;
  return {
    ...value,
    id: stringValue(value.id, crypto.randomUUID()),
    phaseId: stringValue(value.phaseId) || undefined,
    title,
    startMonthDay: stringValue(value.startMonthDay),
    endMonthDay: stringValue(value.endMonthDay),
    detail: stringValue(value.detail),
    workload: stringValue(value.workload),
    sourcePages: pageList(value.sourcePages),
    datePrecision: precision === "explicit" || precision === "inferred" || precision === "approximate" ? precision : "approximate",
  } as ExperienceMilestone;
}

function normalizeSubject(value: unknown): ExperienceSubject | null {
  if (!isRecord(value)) return null;
  const name = stringValue(value.name);
  const rawId = stringValue(value.id);
  if (!name && !rawId) return null;
  const id = canonicalSubjectId(rawId, name);
  const canonical = CANONICAL_EXPERIENCE_SUBJECTS.find((item) => item.id === id);
  return {
    ...value,
    id,
    name: name || canonical?.name || "自定义科目",
    shortName: stringValue(value.shortName, canonical?.shortName || name.slice(0, 4) || "科目"),
    score: numberValue(value.score),
    summary: stringValue(value.summary),
    materials: stringList(value.materials),
    methods: stringList(value.methods),
    milestones: Array.isArray(value.milestones) ? value.milestones.map(normalizeMilestone).filter((item): item is ExperienceMilestone => Boolean(item)) : [],
    examStrategy: stringValue(value.examStrategy),
    pitfalls: stringList(value.pitfalls),
    sourceNotes: stringList(value.sourceNotes),
  } as ExperienceSubject;
}

export function normalizeExperience(value: unknown): ExperiencePost | null {
  if (!isRecord(value)) return null;
  const title = stringValue(value.title);
  if (!title) return null;
  const importedSubjects = Array.isArray(value.subjects)
    ? value.subjects.map(normalizeSubject).filter((item): item is ExperienceSubject => Boolean(item))
    : [];
  const subjects = [...importedSubjects];
  for (const canonical of CANONICAL_EXPERIENCE_SUBJECTS) {
    if (!subjects.some((subject) => subject.id === canonical.id)) {
      subjects.push(emptySubject(canonical.id, canonical.name, canonical.shortName));
    }
  }
  const source = isRecord(value.source) ? value.source : {};
  return {
    ...value,
    id: stringValue(value.id, crypto.randomUUID()),
    title,
    authorLabel: stringValue(value.authorLabel, "未署名考生"),
    totalScore: numberValue(value.totalScore),
    school: stringValue(value.school, "浙江大学"),
    major: stringValue(value.major, "电气工程专硕"),
    prepStartLabel: stringValue(value.prepStartLabel),
    prepStartMonthDay: stringValue(value.prepStartMonthDay),
    dailyHours: stringValue(value.dailyHours),
    overview: stringValue(value.overview),
    subjects,
    overallAdvice: stringList(value.overallAdvice),
    preservedText: stringList(value.preservedText),
    source: {
      ...source,
      document: stringValue(source.document),
      pdfPages: pageList(source.pdfPages),
      printedPages: pageList(source.printedPages),
      note: stringValue(source.note),
    },
  } as ExperiencePost;
}

export function normalizeExperiences(value: unknown) {
  if (!Array.isArray(value)) return defaultExperiences.map((item) => structuredClone(item));
  const normalized = value.map(normalizeExperience).filter((item): item is ExperiencePost => Boolean(item));
  return normalized.length ? normalized : defaultExperiences.map((item) => structuredClone(item));
}

export function createEmptyExperience(): ExperiencePost {
  return {
    id: crypto.randomUUID(),
    title: "新经验贴",
    authorLabel: "未署名考生",
    school: "浙江大学",
    major: "电气工程专硕",
    prepStartLabel: "",
    prepStartMonthDay: "",
    dailyHours: "",
    overview: "",
    subjects: CANONICAL_EXPERIENCE_SUBJECTS.map((item) => emptySubject(item.id, item.name, item.shortName)),
    overallAdvice: [],
    preservedText: [],
    source: { document: "", pdfPages: [], printedPages: [], note: "" },
  };
}

export function createEmptyExperienceSubject(): ExperienceSubject {
  return emptySubject(crypto.randomUUID(), "自定义科目", "科目");
}

export function parseExperienceImport(value: unknown) {
  let candidates: unknown[] = [];
  let fastestExperienceId = "";
  if (Array.isArray(value)) candidates = value;
  else if (isRecord(value) && Array.isArray(value.experiences)) {
    candidates = value.experiences;
    fastestExperienceId = stringValue(value.fastestExperienceId);
  } else if (isRecord(value)) candidates = [value];
  const experiences = candidates.map(normalizeExperience).filter((item): item is ExperiencePost => Boolean(item));
  if (!experiences.length) return null;
  return { experiences, fastestExperienceId };
}

export function createExperienceArchive(experiences: ExperiencePost[], fastestExperienceId: string): ExperienceArchive {
  return {
    kind: "kaoyan-experience-library",
    version: 1,
    exportedAt: new Date().toISOString(),
    fastestExperienceId,
    experiences,
  };
}

function cycleDate(monthDay: string, examDate: string) {
  if (!/^\d{2}-\d{2}$/.test(monthDay)) return null;
  const year = Number(examDate.slice(0, 4));
  const date = new Date(`${year}-${monthDay}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function milestoneProgress(milestoneValue: ExperienceMilestone, today: string, examDate: string) {
  const start = cycleDate(milestoneValue.startMonthDay, examDate);
  const end = cycleDate(milestoneValue.endMonthDay, examDate);
  const current = new Date(`${today}T12:00:00`);
  if (!start || !end || Number.isNaN(current.getTime())) return null;
  if (current < start) return 0;
  if (current >= end) return 100;
  const duration = Math.max(1, end.getTime() - start.getTime());
  return Math.round((current.getTime() - start.getTime()) / duration * 100);
}

export function benchmarkPhaseProgress(experience: ExperiencePost | undefined, subjectId: string, phaseId: string, today: string, examDate: string) {
  const item = experience?.subjects.find((subject) => subject.id === subjectId)?.milestones.find((entry) => entry.phaseId === phaseId);
  return item ? milestoneProgress(item, today, examDate) : null;
}

export function benchmarkSubjectProgress(experience: ExperiencePost | undefined, subject: Subject, today: string, examDate: string) {
  const weighted = subject.phases.map((phase) => ({
    weight: phase.weight,
    progress: benchmarkPhaseProgress(experience, subject.id, phase.id, today, examDate),
  })).filter((item): item is { weight: number; progress: number } => item.progress !== null);
  if (!weighted.length) return null;
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;
  return Math.round(weighted.reduce((sum, item) => sum + item.progress * item.weight, 0) / totalWeight);
}

export function benchmarkProjectProgress(experience: ExperiencePost | undefined, subjects: Subject[], today: string, examDate: string) {
  const weighted = subjects.map((subject) => ({
    weight: subject.weight,
    progress: benchmarkSubjectProgress(experience, subject, today, examDate),
  })).filter((item): item is { weight: number; progress: number } => item.progress !== null);
  if (!weighted.length) return null;
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;
  return Math.round(weighted.reduce((sum, item) => sum + item.progress * item.weight, 0) / totalWeight);
}
