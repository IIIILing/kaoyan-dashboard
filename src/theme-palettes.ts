import {
  defaultDarkColors,
  defaultLightColors,
  type AppearanceSettings,
  type ThemeColors,
} from "./study-state";

export type ThemePalette = {
  id: string;
  name: string;
  description: string;
  light: ThemeColors;
  dark: ThemeColors;
};

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: "default",
    name: "浙大蓝",
    description: "克制、清晰的默认学术蓝",
    light: defaultLightColors,
    dark: defaultDarkColors,
  },
  {
    id: "forest",
    name: "松林绿",
    description: "自然沉静，适合长时间专注",
    light: { bg: "#f2f5f0", surface: "#fffef9", text: "#1d2b24", muted: "#68776d", primary: "#245c46", accent: "#4d8b6f", success: "#53886c", warn: "#a77636", danger: "#ad5757", sidebarStart: "#2e684f", sidebarEnd: "#173e2f" },
    dark: { bg: "#101713", surface: "#19221d", text: "#e7efe9", muted: "#a3b2a8", primary: "#285c46", accent: "#79b698", success: "#76a88e", warn: "#d0a260", danger: "#dc8080", sidebarStart: "#1d4b38", sidebarEnd: "#102e23" },
  },
  {
    id: "sunset",
    name: "暖阳橙",
    description: "温暖纸张感与清晰橙红强调",
    light: { bg: "#f7f1e9", surface: "#fffaf3", text: "#34251f", muted: "#806f65", primary: "#8b3f2a", accent: "#c4673d", success: "#69845f", warn: "#b78332", danger: "#b64d4d", sidebarStart: "#a84f30", sidebarEnd: "#74301f" },
    dark: { bg: "#191310", surface: "#251c18", text: "#f3e8df", muted: "#bca99c", primary: "#743522", accent: "#e18a5d", success: "#8dad82", warn: "#d8a453", danger: "#df7a72", sidebarStart: "#74351f", sidebarEnd: "#492218" },
  },
  {
    id: "violet",
    name: "暮紫",
    description: "安静的紫罗兰与柔和对比",
    light: { bg: "#f4f1f7", surface: "#fffaff", text: "#282332", muted: "#746c80", primary: "#514078", accent: "#806bb1", success: "#5e8a78", warn: "#a7793b", danger: "#b45a71", sidebarStart: "#67518f", sidebarEnd: "#3d315f" },
    dark: { bg: "#141218", surface: "#201c26", text: "#eee9f3", muted: "#aaa0b5", primary: "#463761", accent: "#aa91df", success: "#79a992", warn: "#d0a05f", danger: "#dd7c96", sidebarStart: "#463660", sidebarEnd: "#2c2340" },
  },
  {
    id: "ocean",
    name: "海盐青",
    description: "清透青色，强调节奏与效率",
    light: { bg: "#eef5f5", surface: "#fbffff", text: "#183033", muted: "#657c7e", primary: "#0d5960", accent: "#238b94", success: "#438878", warn: "#a97c38", danger: "#b3545b", sidebarStart: "#16757e", sidebarEnd: "#0b4d54" },
    dark: { bg: "#0d1618", surface: "#162326", text: "#e4f0f1", muted: "#9bb0b2", primary: "#124b50", accent: "#5bbcc4", success: "#71a99a", warn: "#d0a15c", danger: "#db7c83", sidebarStart: "#10525a", sidebarEnd: "#09353a" },
  },
  {
    id: "graphite",
    name: "石墨灰",
    description: "低饱和极简风格，突出内容本身",
    light: { bg: "#f1f2f3", surface: "#ffffff", text: "#20252a", muted: "#6e767e", primary: "#343c44", accent: "#63717d", success: "#5e8271", warn: "#9b793f", danger: "#a85757", sidebarStart: "#4a555f", sidebarEnd: "#2d353c" },
    dark: { bg: "#101214", surface: "#1b1f22", text: "#e7eaec", muted: "#a0a7ad", primary: "#343c43", accent: "#9caab5", success: "#7fa691", warn: "#c9a262", danger: "#d47b7b", sidebarStart: "#30383f", sidebarEnd: "#20262b" },
  },
];

export const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "bg", label: "页面背景" },
  { key: "surface", label: "卡片背景" },
  { key: "text", label: "主要文字" },
  { key: "muted", label: "次要文字" },
  { key: "primary", label: "主色" },
  { key: "accent", label: "强调色" },
  { key: "success", label: "完成色" },
  { key: "warn", label: "提醒色" },
  { key: "danger", label: "危险色" },
  { key: "sidebarStart", label: "侧栏起始" },
  { key: "sidebarEnd", label: "侧栏结束" },
];

function paletteColors(appearance: AppearanceSettings, mode: "light" | "dark") {
  if (appearance.paletteId === "custom") {
    return mode === "light" ? appearance.customLight : appearance.customDark;
  }
  const palette = THEME_PALETTES.find((item) => item.id === appearance.paletteId) ?? THEME_PALETTES[0];
  return palette[mode];
}

export function applyThemePalette(appearance: AppearanceSettings, mode: "light" | "dark") {
  const root = document.documentElement;
  const colors = paletteColors(appearance, mode);
  root.style.setProperty("--bg", colors.bg);
  root.style.setProperty("--bg-soft", `color-mix(in srgb, ${colors.bg} 88%, ${colors.text})`);
  root.style.setProperty("--surface", colors.surface);
  root.style.setProperty("--surface-strong", colors.surface);
  root.style.setProperty("--surface-hover", `color-mix(in srgb, ${colors.surface} 92%, ${colors.accent})`);
  root.style.setProperty("--text", colors.text);
  root.style.setProperty("--muted", colors.muted);
  root.style.setProperty("--faint", `color-mix(in srgb, ${colors.muted} 72%, ${colors.bg})`);
  root.style.setProperty("--line", `color-mix(in srgb, ${colors.muted} 24%, ${colors.bg})`);
  root.style.setProperty("--line-strong", `color-mix(in srgb, ${colors.muted} 42%, ${colors.bg})`);
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--primary-hover", `color-mix(in srgb, ${colors.primary} 82%, ${colors.text})`);
  root.style.setProperty("--primary-soft", `color-mix(in srgb, ${colors.primary} 14%, ${colors.bg})`);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-soft", `color-mix(in srgb, ${colors.accent} 16%, ${colors.bg})`);
  root.style.setProperty("--success", colors.success);
  root.style.setProperty("--success-soft", `color-mix(in srgb, ${colors.success} 16%, ${colors.bg})`);
  root.style.setProperty("--warn", colors.warn);
  root.style.setProperty("--danger", colors.danger);
  root.style.setProperty("--sidebar-start", colors.sidebarStart);
  root.style.setProperty("--sidebar-end", colors.sidebarEnd);
}
