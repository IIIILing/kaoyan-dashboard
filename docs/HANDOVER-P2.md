# P2 体验优化 · 交接文档

> 本文件供新窗口(新会话)接手 **P2 体验优化** 时使用,包含项目现状、已完成工作、P2 待办清单与关键约定。读完本文件即可直接开工。

> **✅ P2 已完成(2025-07,提交 8b30a1c / 710e1cc / 97a224a)**:P2-B 导入预览、P2-A 33 处原生弹窗统一改造(新增 `alertDialog / confirmDialog / promptDialog` + `DialogHost`,详见 §5)、P2-C 的 CI 测试门禁 / 清死代码 / 删账号 undo 均已落地。本文件保留原清单供查阅,新窗口如接手新任务(P3),直接照 §6 环境约定开工即可。

> **📌 后续小修(2025-07,commit `d7283fb`)**:清理无引用的 `SessionTable`、README 与本文档快照同步、分支合并到 `main` 触发 CI/部署;移动端验收通过。

> **📌 数据可靠性加固(2025-07,commit `eab5840`)**:① 防抖保存加 try/catch,写入失败时顶栏显示"保存失败"并出现"存储空间不足"预警横幅(含导出备份入口);② 新增评分引擎单测 `src/__tests__/scoring.test.ts`(12 个断言,覆盖权重曲线、dailyMetrics、periodSummary),测试总数 59 → 71。

> **📌 体验与健壮性(2025-07,commit `fad8b31`)**:① 新增 `src/lib/image.ts` 图片压缩(侧栏图标压到 128px、计时器背景图压到 1280px,PNG 保透明、SVG 原样),避免 base64 撑爆配额;② 收敛重复工具函数(`localDate` 从 ExamsView/ReviewView/ExperienceBenchmarkPanel/review-data 删除副本,`timeToMinutes/minutesToTime/minutesBetween` 从 weekly-insights/schedule-data/lib-scoring 删除副本,统一走 `src/lib/format.ts` 与 `src/lib/dates.ts`);③ 多标签页互踩防护:监听 `storage` 事件,其他标签页改动数据时提示刷新;④ `GenericDialog` 增加焦点圈定(Tab 循环 + 关闭还原焦点)。

> **📌 迁移逻辑可测化(2025-07,commit `5aeab00`)**:`normalizeStudyState` 从 `App.tsx` 抽到 `src/lib/normalize.ts` 并补 6 个单测(老阶段 id 迁移、缺字段补全、防御异常数据不抛错);顺带修复隐患——科目缺 `phases` 字段时不再抛异常被吞掉,而是归一为空阶段列表。测试总数 71 → 77。

---

## 0. 一句话背景

`kaoyan-dashboard` = 2027 浙大电气工程专硕考研项目管理台。纯前端单页应用(React 19 + TypeScript 5.9 + Vite 7 + lucide-react),**无后端**,所有数据存浏览器 `localStorage`,GitHub Actions 构建部署到 GitHub Pages。

## 1. 当前状态(接手时的快照)

| 项 | 值 |
|---|---|
| 当前分支 | `codex/study-loop-roadmap` |
| 最近提交 | 见 git log(2025-07 已完成 P0+P1+P2 全部改动,含合并到 `main` 的部署提交) |
| 工作区 | 干净(无未提交改动) |
| 测试 | 59 个断言全部通过(`npm test`,含新增 import-merge 3 个) |
| 构建 | `npm run build` 通过 |
| 原生弹窗 | 全项目 `window.alert/confirm/prompt` 已清零,统一走自定义对话框 |
| 部署 | 合并到 `main` 后由 GitHub Actions 自动构建、测试并发布到 GitHub Pages |

## 2. 常用命令

```bash
npm run dev        # 本地开发(端口 5173)
npm run build      # tsc -b && vite build(类型检查 + 打包)
npm test           # 跑一次全部单测
npm run test:watch # 监听模式
npm run preview    # 预览构建产物
```

## 3. 代码结构地图(重构后)

```
src/
├── App.tsx                  # 约 1014 行:状态编排 / 持久化 / 账号管理 / 路由 / undo / DialogHost 挂载
├── main.tsx                 # 入口,包了 <ErrorBoundary>
├── ErrorBoundary.tsx        # 全局错误边界(崩溃时可导出本机全部数据)
├── study-state.ts           # 数据模型 StudyState(v3)+ 默认值(科目/阶段/评分)
├── import-merge.ts          # 导入合并统一入口:computeImportMerge(预览与实导共用一份计算)
├── lib/                     # ★ 纯工具(全部可单测,已测)
│   ├── types.ts             # View / BackupMode / RecordDraft
│   ├── accounts.ts          # 账号类型、localStorage keys、freshStudyState
│   ├── format.ts            # 时间/分钟格式化、downloadFile
│   ├── dates.ts             # localDate / dateOffset / presetRange / isInRange…
│   ├── activities.ts        # lifeActivity(判断生活活动)
│   └── scoring.ts           # 评分引擎:dailyMetrics / periodSummary / 权重曲线
├── components/
│   ├── ui.tsx               # ProgressRing / ScoreRow / EmptyState / ScoreGuide / MiniTrend
│   ├── tables.tsx           # 日程图表、记录/计划表格(EditableSessionTable / EditablePlanTable)
│   └── dialogs.tsx          # BackupDialog / RecordDialog / PlanItemDialog / PhaseEditorDialog
│                            # + 通用对话框服务:alertDialog / confirmDialog / promptDialog / DialogHost
├── views/                   # 页面视图(均 default export,props 由 App 传入)
│   ├── Overview.tsx  TodayView.tsx  RecordsView.tsx  SubjectsView.tsx
│   ├── WeeklyView.tsx  ScoringView.tsx  SettingsView.tsx
├── __tests__/               # ★ 7 个测试文件 / 59 断言(会被 tsc -b 类型检查)
├── TimerView.tsx  ExamsView.tsx  ReviewView.tsx  ExperiencesView.tsx
├── WeeklyInsights.tsx  ExperienceBenchmarkPanel.tsx
├── exam-data.ts  review-data.ts  experience-data.ts  schedule-data.ts
├── progress-forecast.ts  weekly-insights.ts  session-time.ts  time-range.ts
└── theme-palettes.ts  styles.css(约 117KB 单一全局样式)
```

## 4. 已完成工作(新窗口**不需要**重做,了解机制即可)

- **P0-1 备份提醒横幅**:有数据且超 7 天未导出 JSON 时,页面顶部出现横幅,可"今日不再提醒"。逻辑在 `App.tsx`(常量 `BACKUP_REMINDER_DAYS` / `BACKUP_DISMISS_KEY` + `showBackupReminder` 计算 + 横幅 JSX),样式 `.backup-reminder-banner` 在 `styles.css` 末尾。
- **P0-2 关页强制保存**:`beforeunload` + `visibilitychange(hidden)` 同步写 localStorage,防防抖(250ms)窗口丢数据。用 `stateRef/accountIdRef/loadedRef` 取最新值。
- **P1-9 ErrorBoundary**:`src/ErrorBoundary.tsx`,崩溃时显示"重新加载 + 导出本机全部数据"(遍历 `kaoyan-dashboard-*` keys)。
- **P1-5 Vitest 单测**:P1 落地 56 个断言,覆盖 `session-time` / `time-range` / `schedule-data`(导入查重·顺延)/ `progress-forecast` / `exam-data` / `review-data`;P2 新增 `import-merge`(导入预览)3 个,共 59 个。改这些纯函数时**必须保证测试仍绿**。
- **P1-6 拆分 App.tsx**:2457 行 → 998 行。视图通过 props 通信,无循环依赖。

### 关键机制(改代码前必读)

- **数据更新必须走 `updateState`**(App.tsx 内),它内部统一调用 `withUnifiedSchedule` 重建 `schedule` 聚合;直接 `setState` 会破坏 `schedule` 一致性。视图组件收到的 `updateState` 就是它。
- **localStorage keys**(定义在 `src/lib/accounts.ts` 与 `App.tsx`):
  - `kaoyan-dashboard-accounts-v1` — 账号注册表
  - `kaoyan-dashboard-account-state-v1:<accountId>` — 每个账号一份完整 StudyState
  - `kaoyan-dashboard-state-v1` — 旧版单账号数据(自动迁移)
  - `kaoyan-dashboard-theme`、`kaoyan-dashboard-backup-dismissed-at`
- **undo 基础设施**:`offerUndo(message, restore)` + 8 秒 toast,已在删除记录/计划上使用,可复用到其他破坏性操作。
- **测试文件在 `src/__tests__/`,被 `tsconfig.app.json` 的 `include: ["src"]` 覆盖**,`tsc -b` 会类型检查它们 —— 写测试时类型必须正确。

## 5. P2 优化清单(新窗口的主线任务)

### P2-A 原生弹窗统一改造(核心,共 33 处,11 个文件)

现状:项目大量使用 `window.alert / window.confirm / window.prompt`,与精致的定制对话框风格不一致,移动端体验差、样式不可控。

**建议做法**:在 `src/components/dialogs.tsx` 新增通用 `AlertDialog` / `ConfirmDialog` / `InputDialog`(可参考 `TimerView.tsx` 里 `DialogShell` 的 `.dialog-backdrop` 模式与 `styles.css` 中 `.dialog-backdrop / .record-dialog / .dialog-heading / .dialog-footer` 现有样式),封装为**可返回 Promise** 的 API(如 `confirmDialog({title, message}) => Promise<boolean>`),再逐个替换。

**全量清单(文件 : 行号)**:行号以本次提交 `34e5b5f` 为准。

**alert(信息/错误提示,15 处)**:

| 文件 | 行 | 内容 |
|---|---|---|
| `src/App.tsx` | 522 | 请输入账号名称 |
| `src/App.tsx` | 526 | 已有同名账号 |
| `src/App.tsx` | 552 | 账号名称不能为空 |
| `src/App.tsx` | 559 | 已有同名账号 |
| `src/App.tsx` | 576 | 当前账号不能删除 |
| `src/App.tsx` | 657 | 只能从今天的计划开始计时 |
| `src/App.tsx` | 754 | 无法导入:文件格式错误 |
| `src/App.tsx` | 780 | 导入完成统计报告(长文本) |
| `src/ErrorBoundary.tsx` | 59 | 已导出 N 个数据项 |
| `src/ExperiencesView.tsx` | 93 | 至少保留一条经验 |
| `src/ExperiencesView.tsx` | 148 | 经验导入完成 |
| `src/ExperiencesView.tsx` | 150 | 经验导入失败 |
| `src/views/SubjectsView.tsx` | 47 | 科目 JSON 导入失败 |
| `src/views/SettingsView.tsx` | 127 | 图标格式错误 |
| `src/views/SettingsView.tsx` | 131 | 图标超 2MB |

**confirm(二次确认,17 处)**:注意其中 4 处是 `window.confirm(...) && updateState(...)` **表达式形式**,替换时要改成 `if (await confirmDialog(...)) { ... }`:

| 文件 | 行 | 内容 | 形式 |
|---|---|---|---|
| `src/App.tsx` | 580 | 删除账号(含数据) | 普通 |
| `src/App.tsx` | 973 | 恢复初始数据 | 普通(内联在 props) |
| `src/components/dialogs.tsx` | 241 | 删除整个阶段 | 普通 |
| `src/ExamsView.tsx` | 63 | 删除成绩记录 | 普通 |
| `src/ExperiencesView.tsx` | 96 | 删除经验贴 | 普通 |
| `src/ExperiencesView.tsx` | 113 | 删除经验自定义科目 | 普通 |
| `src/ReviewView.tsx` | 73 | 删除复习项 | ★ 表达式 |
| `src/TimerView.tsx` | 426 | 删除自定义效果 | 普通 |
| `src/TimerView.tsx` | 459 | 放弃当前计时 | 普通(三目内) |
| `src/views/ScoringView.tsx` | 86 | 删除评分规则 | ★ 表达式 |
| `src/views/SubjectsView.tsx` | 19 | 新增阶段(会改权重结构) | 普通 |
| `src/views/SubjectsView.tsx` | 38 | 导入科目替换确认 | 普通 |
| `src/views/SettingsView.tsx` | 99 | 删除生活活动(有引用时) | 普通 |
| `src/views/SettingsView.tsx` | 226 | 删除考试科目 | ★ 表达式 |
| `src/views/TodayView.tsx` | 60 | 复制前一天(会替换) | 普通 |
| `src/views/TodayView.tsx` | 66 | 应用模板(会替换) | 普通 |
| `src/views/TodayView.tsx` | 71 | 删除计划模板 | 普通 |

**prompt(输入,1 处)**:

| 文件 | 行 | 内容 |
|---|---|---|
| `src/views/TodayView.tsx` | 51 | 保存计划模板时输入模板名 |

**验收标准**:全项目 `grep -rn "window\.(alert|confirm|prompt)"` 结果为 0(ErrorBoundary 里的可保留或一并改造,建议一并改)。

### P2-B 导入预览(核心)

现状(`src/App.tsx`):`readImportFile` 解析 JSON → `setImportCandidate` → 用户选日期范围点"合并导入"→ `importData` 直接 merge,合并报告**导入之后**才用 alert 弹出。

**目标**:导入确认前展示预览 —— "将新增 X 条时间记录、重复 Y、顺延 Z、跳过 W;计划同理;模板/成绩/复习各 N 个",用户确认后才真正合并。

**建议方案**:
- `mergeImportedSessions / mergeImportedPlans / mergeImportedTemplates / mergeExamRecords / mergeReviewItems` 都是**纯函数且已单测**,返回的 `report` 可直接用于 dry-run 预览,不需要二次实现。
- 在 `BackupDialog`(`src/components/dialogs.tsx`)的 import 模式中,或新增一个 PreviewDialog,展示上面这些 report 汇总;确认回调沿用 `importData`。
- 注意:`importData` 按日期范围筛选后再 merge,预览应与筛选结果一致(先 filter 再 merge 得到 report 用于展示)。

### P2-C 可选优化(时间充裕再做)

1. **CI 加测试门禁** — ✅ 已做(`deploy-pages.yml` 在 build 前执行 `npm test`,测试失败不发布)
2. **清死代码** — ✅ 已做(`PlanTable`、后续清理的 `SessionTable` 均已删除)
3. **破坏性操作接入 undo** — ✅ 已做(删账号接入 `offerUndo`)
4. **移动端验收** — ✅ 已做(2025-07 响应式验收通过:`.sidebar` 抽屉、`EditableSessionTable`、`DayScheduleChart` 在 640/768/860px 断点下表现正常)

## 6. 环境与约定(本仓库工作环境)

- 本机为 Windows,**沙箱模式下 `vite build` / `vitest` 会因 spawn 子进程报 EPERM**,跑构建/测试命令时需申请 `danger-full-access` 权限并附带一句理由;`npx tsc -b` 不需要(纯进程内)。
- git identity 已配置:`iiiling <2077880746@qq.com>`;提交用中文 message,按 `type: 描述` 风格(参考 `feat: 数据安全增强与工程重构`)。
- 提交前务必 `npm test` + `npm run build` 全绿。
- `styles.css` 是单一全局样式(116KB),新增组件样式追加到文件末尾即可,沿用现有 CSS 变量(`--accent / --surface / --line / --warn / --danger` 等)。

## 7. 建议执行顺序

1. **P2-B 导入预览**(纯增量,不动 33 处弹窗,先拿到一个完整交付)
2. **P2-A 弹窗改造**(工程量最大:先做通用对话框组件 + Promise API,再按 alert → confirm → prompt 分批替换,每批跑一次 build+test)
3. **P2-C 可选**按需做

每完成一项:`npm test` + `npm run build`,通过后按功能点分次提交。
