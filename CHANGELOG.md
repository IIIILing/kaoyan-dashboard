# 更新日志

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。所有改动按里程碑记录,git 提交号见括号。

## [1.5.0] - 2026-08 学习热力图

- **新功能:学习热力图**(总览页):GitHub 风格贡献图,支持**按年 / 按年月切换**;色块按当天有效学习分钟分级(0 / <1h / <4h / <8h / ≥8h);月视图为对齐星期的日历网格;附带"当前连续 / 最长连续学习天数"指标(`src/lib/calendar.ts` + `src/components/LearningCalendar.tsx`)
- **优化**:对话框服务函数(`alertDialog / confirmDialog / promptDialog`)拆到独立文件 `src/components/dialog-service.ts`,react-refresh lint 警告清零(全项目 0 问题 0 警告)
- **优化**:浏览器标题随视图切换(如"考研项目管理台 · 今日计划")
- 测试:77 → 88 个断言(日历聚合、连续天数)

## [1.4.0] - 2026-08 工程规范

- **工程规范**:引入 ESLint(flat config,TypeScript + React Hooks 规则)与 Prettier,新增 `npm run lint` / `npm run format`;清理未使用导入/变量与 render 期副作用(`Date.now`)
- **样式拆分**:`src/styles.css`(1318 行)按模块拆成 `src/styles/` 下 4 个文件(`base/components/timer/extras`),原文件改为 `@import` 清单,产物逐字节一致
- **性能**:视图全部改为 React.lazy 按需分包,主包 gzip 137.7KB → 100KB(-27%)
- 新增 `docs/HANDOVER.md` 运行与接手手册

## [1.3.0] - 2026-08 数据可靠性与健壮性

- **保存失败预警**:防抖保存加 try/catch,localStorage 配额不足时顶栏显示"保存失败"+ 页面顶部预警横幅(含导出备份入口),不再静默丢数据
- **图片压缩存储**:新增 `src/lib/image.ts`,侧栏图标压到 128px、计时器背景图压到 1280px 再存 localStorage
- **工具函数收敛**:`localDate` / `timeToMinutes` 等副本从 7 个模块删除,统一到 `src/lib/format.ts` / `dates.ts`
- **多标签页防护**:监听 `storage` 事件,其他标签页改动数据时提示刷新
- **对话框焦点圈定**:`GenericDialog` Tab 循环 + 关闭还原焦点
- **迁移逻辑可测化**:`normalizeStudyState` 抽到 `src/lib/normalize.ts` 并补 6 个迁移单测;修复科目缺 `phases` 时静默丢账号数据的隐患
- 测试:71 → 77 个断言(评分引擎、状态迁移)

## [1.2.0] - 2026-08 体验优化(P2)

- **导入预览**:合并确认前展示"新增/重复/顺延/跳过"试算(`src/import-merge.ts`,预览与实导共用同一份计算)
- **统一定制对话框**:33 处 `window.alert/confirm/prompt` 全部替换为 `alertDialog / confirmDialog / promptDialog`(Promise API + `DialogHost` 队列)
- **CI 测试门禁**:GitHub Actions 在部署前运行 `npm test`,失败不发布
- **删账号接入 undo**;清理死代码;移动端响应式验收通过

## [1.1.0] - 2026-08 数据安全与工程重构(P0+P1)

- **全局备份提醒横幅**:超 7 天未导出 JSON 时提示,可当日关闭
- **关页强制保存**:`beforeunload` / `visibilitychange` 同步写 localStorage,防抖窗口内不丢数据
- **全局错误边界**:渲染异常不再白屏,提供"重新加载 + 导出本机全部数据"
- **测试体系**:引入 Vitest,56 个断言覆盖重叠检测、导入查重/顺延、进度预测、数据归一化
- **App.tsx 拆分**:2457 行 → 约 1000 行,工具函数进 `src/lib/`,视图独立成文件

## [1.0.0] - 2026-07 初始版本

- 2027 浙大电气专硕考研项目管理台:多账号隔离、分时记录、科目阶段进度、周报、透明评分、亮暗主题、JSON 导入导出
