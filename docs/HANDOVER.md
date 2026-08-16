# 考研项目管理台 · 运行与接手手册

> **用途**:给新会话 / 明天跑项目时直接照此手册操作。包含:怎么跑起来、常用命令、数据说明、代码结构、当前 Git 状态、未完成事项。
> 更早的 P2 优化交接见 [`docs/HANDOVER-P2.md`](./HANDOVER-P2.md)(内容与本手册 §6 互补)。

---

## 1. 今天怎么跑起来(5 分钟)

**环境要求**:Node ≥ 22(本机 v24.16.0)、npm。无后端、无数据库,`npm install` 后即可。

```bash
cd C:\Users\lyx20\Desktop\kaoyan-dashboard
npm install          # node_modules 已在时可跳过
npm run dev          # 本地开发 → http://localhost:5173
```

其他入口:

| 命令 | 作用 |
|---|---|
| `npm test` | 跑全部单测(当前 **77 个断言**,9 个文件) |
| `npm run build` | `tsc -b` 类型检查 + vite 打包到 `dist/` |
| `npm run preview` | 本地预览生产构建 |
| `npx tsc -b` | 只做类型检查(不需要打包) |

> ⚠️ 跑项目请**停留在 `codex/study-loop-roadmap` 分支**(当前已在此分支,见 §5)——最新的数据安全与健壮性改进只在这个分支上,`main`/线上版本还没有。

## 2. 数据与账号(务必先看)

- **所有数据只存当前浏览器的 `localStorage`**,不上传服务器;换设备/清缓存前必须**先导出 JSON 备份**(设置 → 数据安全中心,或点顶部备份提醒横幅的"立即备份")。
- 多账号隔离:顶部可快速切换账号;每个账号的目标/科目/记录完全独立。
- 已有机制(自动生效,无需配置):超 7 天未备份会弹提醒横幅;保存失败(配额满)会红色预警;关闭页面/切标签页时强制保存;多标签页互踩会提示刷新。
- 旧版单账号数据(v1/v2)首次打开自动迁移到 v3。

## 3. 代码结构速览

```
src/
├── App.tsx                  # 状态编排/持久化/账号管理/路由/undo(约 900 行)
├── main.tsx                 # 入口,包 <ErrorBoundary>
├── ErrorBoundary.tsx        # 崩溃兜底:重新加载 + 导出本机全部数据
├── study-state.ts           # 数据模型 StudyState(v3)+ 默认科目/阶段/评分
├── import-merge.ts          # 导入合并统一入口(预览与实导共用)
├── lib/                     # ★ 纯工具(全部有单测)
│   ├── normalize.ts         #   存档归一化/迁移(v1/v2→v3)
│   ├── scoring.ts           #   评分引擎(每日/周报得分)
│   ├── calendar.ts          #   学习热力图聚合/连续天数(1.5.0 新增)
│   ├── format.ts  dates.ts  #   时间/日期工具(全项目唯一实现)
│   ├── image.ts             #   图片压缩(图标/背景图存 localStorage 前)
│   ├── accounts.ts  types.ts  activities.ts
├── components/
│   ├── dialog-service.ts    # 对话框服务 alertDialog/confirmDialog/promptDialog(独立文件,无组件)
│   ├── dialogs.tsx          # 对话框组件(DialogHost/BackupDialog/RecordDialog/…)
│   ├── LearningCalendar.tsx # 学习热力图组件(总览页,1.5.0 新增)
│   ├── tables.tsx  ui.tsx   # 表格/图表/展示组件
├── views/                   # 7 个页面视图(default export,props 由 App 传入)
├── __tests__/               # 10 个测试文件 / 88 断言(会被 tsc 类型检查)
├── TimerView.tsx            # 专注计时器(较大,独立)
├── ExamsView.tsx  ReviewView.tsx  ExperiencesView.tsx
├── WeeklyInsights.tsx  ExperienceBenchmarkPanel.tsx
├── exam-data.ts  review-data.ts  experience-data.ts  schedule-data.ts
├── progress-forecast.ts  weekly-insights.ts  session-time.ts  time-range.ts
├── theme-palettes.ts
└── styles.css               # 1318 行全局样式(拆分方案见 §6.2)
```

**铁律**:改数据必须走 `updateState`(它内部调 `withUnifiedSchedule` 重建 `schedule` 聚合);纯函数改动后必须 `npm test` 全绿。

## 4. 常用 Git 约定

- 身份已配置:`iiiling <2077880746@qq.com>`;提交信息用中文,`type: 描述` 风格(如 `feat: ...` / `fix: ...` / `refactor: ...` / `docs: ...`)。
- 推送命令若提示凭据:`GIT_TERMINAL_PROMPT=0` 下 Git Credential Manager 一般直接用缓存 token。
- CI:推送到 `main` 触发 GitHub Actions(`npm ci → npm test → npm run build → 部署 GitHub Pages`),测试失败不发布。

## 5. 当前 Git 状态(2026-08 快照)

| 项 | 状态 |
|---|---|
| 工作分支 | `codex/study-loop-roadmap`(工作区干净) |
| codex ↔ origin | 完全同步 |
| main ↔ origin/main | 完全同步 |
| **main 落后 codex** | **5 个提交**(见下) |

**⚠️ 线上版本落后**:`origin/main` 只到 `2c6dc0c`(含 P0+P1+P2 全部 + 清理),但下面 5 个提交**只在 codex 分支,未合并上线**:

| 提交 | 内容 |
|---|---|
| `d47d8b7` | 文档:移动端验收完成 |
| `eab5840` | 保存失败预警(配额满不再静默丢数据)+ 评分引擎单测 |
| `fad8b31` | 图片压缩存储 / 工具函数收敛 / 多标签页防护 / 对话框焦点圈定 |
| `5aeab00` | normalize 抽取到 lib + 6 个迁移单测(含修复:科目缺 phases 不再丢账号数据) |
| `5864539` | 文档:补充提交编号 |

**上线方式**(需要时):`git fetch origin` → `git checkout main` → `git merge origin/main`(先同步远端,可能还有其他窗口的提交)→ `git merge codex/study-loop-roadmap` → `git push origin main`(触发 CI 自动部署)。若与远端 main 冲突,以远端为准合并。

## 6. 未完成事项(按优先级)

> ✅ **2026-08 已完成四项工程规范优化**(见提交,均在本地分支):
> - **ESLint/Prettier**:`eslint.config.js`(ESLint 10 flat config,TS + react-hooks)+ `.prettierrc`(无分号/双引号/120 列);`npm run lint` 已清零错误(仅 3 个 fast-refresh 提示);注意:未批量跑 `prettier --write`(超长单行 JSX 会产生巨大 diff)
> - **styles.css 拆分**:已按 §6.2 方案拆成 `src/styles/` 下 4 个文件,`styles.css` 变为 `@import` 清单,构建产物逐字节一致(同 hash)
> - **React.lazy 分包**:11 个视图全部懒加载,主包 gzip 137.7KB → 100KB
> - **CHANGELOG + 版本**:新增 `CHANGELOG.md`,版本升至 `1.4.0`

### 6.1 ESLint / Prettier ✅ 已完成
- 配置见 `eslint.config.js`(关闭了 v7 新规则 `set-state-in-effect`,它对挂载初始化的同步 setState 过于激进;`react-hooks/purity` 保持开启,SettingsView 的相对时间显示已改为每分钟跳动的 `now` 状态)
- 遗留:`react-refresh/only-export-components` 有 3 个警告(dialogs.tsx 同时导出组件与对话框服务函数),可接受;若想清零,把 `alertDialog/confirmDialog/promptDialog` 挪到独立文件。

### 6.2 styles.css 拆分 ✅ 已完成
- `src/styles.css`(manifest)→ `src/styles/{base,components,timer,extras}.css`;后续新增样式直接追加到对应文件(新加的 `.view-loading` 在 extras.css 末尾)。

### 6.3 React.lazy 按视图分包 ✅ 已完成
- `App.tsx` 顶部 11 个视图均为 `lazy(() => import(...))`,视图区包在单个 `<Suspense fallback={...}>` 内;新加视图记得同样用 `lazy` 引入。

### 6.4 CHANGELOG + 版本号 ✅ 已完成
- `CHANGELOG.md` 按里程碑记录(1.0.0 → 1.4.0),`package.json` 版本 `1.4.0`。

### 6.5 更早的低优先(可长期搁置)
- 评分引擎分钟级循环/`withUnifiedSchedule` 全量重建:数据量上几千条再优化。
- 移动端已验收通过,无需再动。

## 7. 环境注意事项(本机)

- Windows 环境。**沙箱模式下 `vite build` / `vitest` 会因 spawn 子进程报 EPERM**(是沙箱限制,不是代码问题);若审批被禁用,这类命令无法在代理窗口里跑,请在用户自己的终端执行,或调整沙箱策略。
- `dist/`、`*.tsbuildinfo` 已被 `.gitignore` 忽略,不会污染工作区。
- 部署产物地址:GitHub Pages(由 CI 自动更新,`base: /kaoyan-dashboard/`)。
