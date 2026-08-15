import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileUp,
  HardDrive,
  Moon,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Sun,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { DashboardAccount } from "../lib/accounts";
import { alertDialog, confirmDialog } from "../components/dialogs";
import { COLOR_FIELDS, THEME_PALETTES } from "../theme-palettes";
import {
  defaultStudyState,
  type LifeActivity,
  type StudyState,
  type Subject,
  type ThemeColors,
} from "../study-state";

export default function SettingsView({
  state,
  accounts,
  activeAccountId,
  updateState,
  onSwitchAccount,
  onAddAccount,
  onRenameAccount,
  onDeleteAccount,
  lastSavedAt,
  onExport,
  onImport,
  onReset,
}: {
  state: StudyState;
  accounts: DashboardAccount[];
  activeAccountId: string;
  updateState: (updater: (current: StudyState) => StudyState) => void;
  onSwitchAccount: (accountId: string) => void;
  onAddAccount: (name: string) => boolean;
  onRenameAccount: (accountId: string, name: string) => boolean;
  onDeleteAccount: (accountId: string) => void;
  lastSavedAt: string;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
}) {
  const [customMode, setCustomMode] = useState<"light" | "dark">("light");
  const [newAccountName, setNewAccountName] = useState("");
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const backupTimestamp = state.dataSafety.lastExternalBackupAt;
  const backupAgeDays = backupTimestamp ? Math.floor((Date.now() - new Date(backupTimestamp).getTime()) / 86_400_000) : null;
  const backupNeedsAttention = backupAgeDays === null || backupAgeDays >= 7;
  const dataVolume = state.sessions.length + state.plans.reduce((sum, plan) => sum + plan.items.length, 0) + state.examRecords.length + state.reviewItems.length;
  const stateSizeKb = Math.max(1, Math.round(new Blob([JSON.stringify(state)]).size / 1024));
  useEffect(() => {
    setAccountNames(Object.fromEntries(accounts.map((account) => [account.id, account.name])));
  }, [accounts]);
  function addNewAccount(event: React.FormEvent) {
    event.preventDefault();
    if (onAddAccount(newAccountName)) setNewAccountName("");
  }
  function commitAccountName(account: DashboardAccount) {
    const draft = accountNames[account.id] ?? account.name;
    if (!onRenameAccount(account.id, draft)) {
      setAccountNames((current) => ({ ...current, [account.id]: account.name }));
    }
  }
  function updateProfile(key: keyof StudyState["profile"], value: string | number) {
    updateState((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  }
  function updateSubject(id: string, changes: Partial<Subject>) {
    updateState((current) => ({ ...current, subjects: current.subjects.map((subject) => subject.id === id ? { ...subject, ...changes } : subject) }));
  }
  function updateLifeActivity(id: string, changes: Partial<LifeActivity>) {
    updateState((current) => ({
      ...current,
      lifeActivities: current.lifeActivities.map((activity) => activity.id === id ? { ...activity, ...changes } : activity),
    }));
  }
  function addSubject() {
    const subject: Subject = { id: crypto.randomUUID(), name: "新考试科目", shortName: "新科目", weight: 0, accent: "#4f7ea8", note: "点击科目进度新增复习阶段", phases: [] };
    updateState((current) => ({ ...current, subjects: [...current.subjects, subject] }));
  }
  function addLifeActivity() {
    const activity: LifeActivity = { id: `life-${crypto.randomUUID()}`, name: "新生活活动", accent: "#6287a8" };
    updateState((current) => ({ ...current, lifeActivities: [...current.lifeActivities, activity] }));
  }
  async function deleteLifeActivity(activity: LifeActivity) {
    const referenced = state.sessions.some((session) => session.subjectId === activity.id)
      || state.plans.some((plan) => plan.items.some((item) => item.subjectId === activity.id))
      || state.planTemplates.some((template) => template.items.some((item) => item.subjectId === activity.id));
    if (!await confirmDialog({
      title: "删除生活活动",
      message: referenced
        ? `“${activity.name}”已有记录或计划，删除后会从新增下拉框隐藏，历史数据仍会保留。确定继续吗？`
        : `确定删除生活活动“${activity.name}”？`,
      danger: true,
      confirmLabel: referenced ? "隐藏活动" : "删除",
    })) return;
    updateState((current) => ({
      ...current,
      lifeActivities: referenced
        ? current.lifeActivities.map((item) => item.id === activity.id ? { ...item, active: false } : item)
        : current.lifeActivities.filter((item) => item.id !== activity.id),
    }));
  }
  function updateCustomColor(key: keyof ThemeColors, value: string) {
    updateState((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        paletteId: "custom",
        [customMode === "light" ? "customLight" : "customDark"]: {
          ...(customMode === "light" ? current.appearance.customLight : current.appearance.customDark),
          [key]: value,
        },
      },
    }));
  }
  function uploadSidebarIcon(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      void alertDialog({ title: "无法上传图标", message: "请选择 PNG、JPG、WEBP 或 SVG 图片。" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      void alertDialog({ title: "无法上传图标", message: "图标图片不能超过 2 MB。" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateProfile("sidebarIcon", String(reader.result));
    reader.readAsDataURL(file);
  }
  return (
    <div className="page-stack settings-page">
      <section className="panel settings-card account-settings-card">
        <div className="panel-heading">
          <div><p className="card-kicker">研友空间</p><h2>账号管理</h2></div>
          <div className="account-count"><Users size={18} /><span>{accounts.length} 个账号</span></div>
        </div>
        <p className="settings-copy">每个账号拥有完全独立的目标、科目、计划和时间记录。顶部可随时快速切换，页面只会显示当前账号的数据，适合在同一台设备上轮流记录和监督进度。</p>
        <form className="account-add-form" onSubmit={addNewAccount}>
          <label>
            <span>新增研友账号</span>
            <input
              value={newAccountName}
              maxLength={30}
              placeholder="输入姓名或昵称"
              onChange={(event) => setNewAccountName(event.target.value)}
            />
          </label>
          <button className="primary-button" type="submit"><UserPlus size={17} />新增并切换</button>
        </form>
        <div className="account-list">
          {accounts.map((account) => {
            const active = account.id === activeAccountId;
            return (
              <article className={active ? "active" : ""} key={account.id}>
                <div className="account-avatar" aria-hidden="true">
                  {(accountNames[account.id] ?? account.name).trim().slice(0, 1).toLocaleUpperCase() || "研"}
                </div>
                <label>
                  <span>账号名称</span>
                  <input
                    value={accountNames[account.id] ?? account.name}
                    maxLength={30}
                    onChange={(event) => setAccountNames((current) => ({
                      ...current,
                      [account.id]: event.target.value,
                    }))}
                    onBlur={() => commitAccountName(account)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                </label>
                <div className="account-meta">
                  {active
                    ? <strong>当前账号</strong>
                    : <span>上次切换 {new Date(account.lastActiveAt).toLocaleDateString("zh-CN")}</span>}
                </div>
                <div className="account-actions">
                  {!active && <button type="button" className="secondary-button" onClick={() => onSwitchAccount(account.id)}>切换</button>}
                  {!active && <button type="button" className="danger-button" onClick={() => onDeleteAccount(account.id)}><Trash2 size={15} />删除</button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">项目基线</p><h2>考研目标</h2></div><Save size={19} /></div>
        <div className="form-grid">
          <label><span>称呼</span><input value={state.profile.name} onChange={(e) => updateProfile("name", e.target.value)} /></label>
          <label className="wide"><span>目标项目</span><input value={state.profile.target} onChange={(e) => updateProfile("target", e.target.value)} /></label>
          <label><span>侧栏主标题</span><input value={state.profile.sidebarTitle} onChange={(e) => updateProfile("sidebarTitle", e.target.value)} /></label>
          <label className="wide"><span>侧栏副标题</span><input value={state.profile.sidebarSubtitle} onChange={(e) => updateProfile("sidebarSubtitle", e.target.value)} /></label>
          <div className="wide sidebar-icon-setting">
            <div><span className="field-label">侧栏图标</span><p className="settings-copy">上传后会保存在本机浏览器，并替换左侧标题旁的 Z 图标。</p></div>
            <div className="sidebar-icon-actions">
              <div className="sidebar-icon-preview">{state.profile.sidebarIcon ? <img src={state.profile.sidebarIcon} alt="当前侧栏图标" /> : "Z"}</div>
              <label className="secondary-button file-button"><FileUp size={16} />上传图标<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={uploadSidebarIcon} /></label>
              {state.profile.sidebarIcon && <button type="button" className="danger-button" onClick={() => updateProfile("sidebarIcon", "")}>恢复 Z</button>}
            </div>
          </div>
          <label><span>目标院校</span><input value={state.profile.targetSchool} onChange={(e) => updateProfile("targetSchool", e.target.value)} /></label>
          <label className="wide"><span>目标说明</span><input value={state.profile.targetDescription} onChange={(e) => updateProfile("targetDescription", e.target.value)} /></label>
          <label><span>暂定初试日期</span><input type="date" value={state.profile.examDate} onChange={(e) => updateProfile("examDate", e.target.value)} /></label>
          <label><span>每日目标小时</span><input type="number" min="1" max="16" step="0.5" value={state.profile.dailyTargetHours} onChange={(e) => updateProfile("dailyTargetHours", Number(e.target.value))} /></label>
          <label><span>目标起床</span><input type="time" value={state.profile.wakeTime} onChange={(e) => updateProfile("wakeTime", e.target.value)} /></label>
          <label><span>目标睡觉</span><input type="time" value={state.profile.sleepTime} onChange={(e) => updateProfile("sleepTime", e.target.value)} /></label>
        </div>
      </section>
      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">考试配置</p><h2>考试科目与总进度权重</h2></div><div className="heading-actions"><span className="muted">合计 {state.subjects.reduce((sum, subject) => sum + subject.weight, 0)}%</span><button className="primary-button" onClick={addSubject}><Plus size={16} />新增科目</button></div></div>
        <div className="subject-settings-list">{state.subjects.map((subject) => <article key={subject.id}>
          <label><span>科目名称</span><input value={subject.name} onChange={(event) => updateSubject(subject.id, { name: event.target.value })} /></label>
          <label><span>简称</span><input value={subject.shortName} onChange={(event) => updateSubject(subject.id, { shortName: event.target.value })} /></label>
          <label><span>权重</span><input type="number" min="0" max="100" value={subject.weight} onChange={(event) => updateSubject(subject.id, { weight: Math.max(0, Number(event.target.value)) })} /></label>
          <label><span>科目颜色</span><input type="color" value={subject.accent} onChange={(event) => updateSubject(subject.id, { accent: event.target.value })} /></label>
          <label className="subject-note-field"><span>科目说明</span><input value={subject.note} onChange={(event) => updateSubject(subject.id, { note: event.target.value })} /></label>
          <button onClick={async () => {
            if (await confirmDialog({
              title: "删除考试科目",
              message: `确定删除考试科目“${subject.name}”？对应阶段会一起删除，已有时间记录不会自动删除。`,
              danger: true,
              confirmLabel: "删除",
            })) {
              updateState((current) => ({ ...current, subjects: current.subjects.filter((item) => item.id !== subject.id) }));
            }
          }} aria-label="删除科目"><Trash2 size={16} /></button>
        </article>)}</div>
      </section>
      <section className="panel settings-card">
        <div className="panel-heading"><div><p className="card-kicker">生活安排</p><h2>生活活动管理</h2></div><div className="heading-actions"><span className="muted">{state.lifeActivities.filter((activity) => activity.active !== false).length} 个活动</span><button className="primary-button" type="button" onClick={addLifeActivity}><Plus size={16} />新增活动</button></div></div>
        <p className="settings-copy">生活活动会出现在计划和时间记录的“科目 / 活动”下拉框中，不会计入有效学习时长。删除已有数据使用过的活动时，历史记录会保留但该活动会从新增列表隐藏。</p>
        <div className="life-activity-settings-list">
          {state.lifeActivities.filter((activity) => activity.active !== false).map((activity) => <article key={activity.id}>
            <span className="activity-color-dot" style={{ background: activity.accent }} />
            <label><span>活动名称</span><input value={activity.name} onChange={(event) => updateLifeActivity(activity.id, { name: event.target.value })} /></label>
            <label><span>活动颜色</span><input type="color" value={activity.accent} onChange={(event) => updateLifeActivity(activity.id, { accent: event.target.value })} /></label>
            <button type="button" className="rule-delete" onClick={() => deleteLifeActivity(activity)} aria-label={`删除生活活动${activity.name}`}><Trash2 size={16} /></button>
          </article>)}
          {!state.lifeActivities.some((activity) => activity.active !== false) && <div className="schedule-empty">还没有生活活动，点击“新增活动”开始配置。</div>}
        </div>
      </section>
      <section className="panel settings-card appearance-settings">
        <div className="panel-heading"><div><p className="card-kicker">视觉外观</p><h2>页面配色方案</h2></div><Palette size={20} /></div>
        <p className="settings-copy">六套方案均分别设计了亮色与暗色版本，侧栏的模式开关会自动使用对应配色。也可以进入自定义调色盘逐项调整。</p>
        <div className="palette-grid">
          {THEME_PALETTES.map((palette) => <button className={state.appearance.paletteId === palette.id ? "active" : ""} key={palette.id} onClick={() => updateState((current) => ({ ...current, appearance: { ...current.appearance, paletteId: palette.id } }))}><span className="palette-swatches"><i style={{ background: palette.light.primary }} /><i style={{ background: palette.light.accent }} /><i style={{ background: palette.dark.bg }} /><i style={{ background: palette.dark.accent }} /></span><strong>{palette.name}</strong><small>{palette.description}</small></button>)}
          <button className={state.appearance.paletteId === "custom" ? "active custom" : "custom"} onClick={() => updateState((current) => ({ ...current, appearance: { ...current.appearance, paletteId: "custom" } }))}><span className="palette-swatches custom-wheel"><Palette size={22} /></span><strong>自定义调色盘</strong><small>独立调节亮色与暗色的全部关键颜色</small></button>
        </div>
        {state.appearance.paletteId === "custom" && <div className="custom-palette-editor">
          <div className="mode-tabs"><button className={customMode === "light" ? "active" : ""} onClick={() => setCustomMode("light")}><Sun size={15} />亮色配色</button><button className={customMode === "dark" ? "active" : ""} onClick={() => setCustomMode("dark")}><Moon size={15} />暗色配色</button></div>
          <div className="color-picker-grid">{COLOR_FIELDS.map((field) => { const colors = customMode === "light" ? state.appearance.customLight : state.appearance.customDark; return <label key={field.key}><span>{field.label}</span><div><input type="color" value={colors[field.key]} onChange={(event) => updateCustomColor(field.key, event.target.value)} /><code>{colors[field.key]}</code></div></label>; })}</div>
          <div className="button-row"><button className="secondary-button" onClick={() => updateState((current) => ({ ...current, appearance: { ...defaultStudyState.appearance, paletteId: "custom" } }))}><RotateCcw size={16} />重置自定义配色</button></div>
        </div>}
      </section>
      <section className="panel settings-card data-safety-card">
        <div className="panel-heading"><div><p className="card-kicker">数据安全中心</p><h2>本机存储与外部备份</h2></div><HardDrive size={19} /></div>
        <p className="settings-copy">自动保存只保护当前浏览器里的副本；JSON 下载才是可迁移、可恢复的外部备份。</p>
        <div className="data-safety-grid">
          <article className="positive"><span>最近自动保存</span><strong>{lastSavedAt ? (Date.now() - new Date(lastSavedAt).getTime() < 60_000 ? "刚刚" : new Date(lastSavedAt).toLocaleString("zh-CN")) : "正在读取"}</strong><small>当前账号 · 浏览器本机</small></article>
          <article className={backupNeedsAttention ? "negative" : "positive"}><span>最近外部备份</span><strong>{backupTimestamp ? (backupAgeDays === 0 ? "今天" : `${backupAgeDays} 天前`) : "从未备份"}</strong><small>{backupTimestamp ? new Date(backupTimestamp).toLocaleString("zh-CN") : "请立即导出一个 JSON 文件"}</small></article>
          <article><span>数据条目</span><strong>{dataVolume}</strong><small>时间、计划、成绩与复习项</small></article>
          <article><span>本机数据量</span><strong>{stateSizeKb} KB</strong><small>{state.subjects.length} 科目 · {state.experiences.length} 篇经验</small></article>
        </div>
        {backupNeedsAttention && <div className="backup-warning"><AlertTriangle size={18} /><div><strong>{backupAgeDays === null ? "还没有外部备份" : `外部备份已经 ${backupAgeDays} 天未更新`}</strong><span>清除浏览器数据、更换设备或浏览器故障都可能导致本机副本丢失。</span></div></div>}
        <div className="button-row"><button className="primary-button" onClick={onExport}><Download size={17} />立即备份</button><button className="secondary-button" onClick={onImport}><FileUp size={17} />导入备份</button><button className="danger-button" onClick={onReset}><RotateCcw size={17} />恢复初始数据</button></div>
      </section>
    </div>
  );
}
