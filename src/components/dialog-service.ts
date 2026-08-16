import type { ReactNode } from "react";

// ---- 通用对话框服务(Promise API)----
// alertDialog / confirmDialog / promptDialog 返回 Promise,可取代 window.alert / confirm / prompt。
// 调用方任意位置调用即可;App.tsx 中挂载一次 <DialogHost /> 负责渲染,队列按顺序逐条弹出。
// 独立成文件,避免与组件同文件导致 react-refresh 警告。

export type DialogKind = "alert" | "confirm" | "prompt";

export type DialogRequest = {
  id: number;
  kind: DialogKind;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  defaultValue?: string;
  placeholder?: string;
  resolve: (value: boolean | string | null) => void;
};

export type DialogOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  defaultValue?: string;
  placeholder?: string;
};

let dialogQueue: DialogRequest[] = [];
const dialogListeners = new Set<() => void>();
let nextDialogId = 1;

function notifyDialogListeners() {
  dialogListeners.forEach((listener) => listener());
}

function enqueueDialog(options: DialogOptions, kind: DialogKind, resolve: DialogRequest["resolve"]) {
  dialogQueue = [...dialogQueue, { id: nextDialogId++, kind, resolve, ...options }];
  notifyDialogListeners();
}

export function alertDialog(options: Omit<DialogOptions, "cancelLabel" | "danger" | "defaultValue" | "placeholder">): Promise<void> {
  return new Promise((resolve) => {
    enqueueDialog(options, "alert", () => resolve());
  });
}

export function confirmDialog(options: Omit<DialogOptions, "defaultValue" | "placeholder">): Promise<boolean> {
  return new Promise((resolve) => {
    enqueueDialog(options, "confirm", (value) => resolve(value === true));
  });
}

export function promptDialog(options: Omit<DialogOptions, "danger">): Promise<string | null> {
  return new Promise((resolve) => {
    enqueueDialog(options, "prompt", (value) => resolve(typeof value === "string" ? value : null));
  });
}

export function settleDialog(id: number, value: boolean | string | null) {
  const request = dialogQueue.find((item) => item.id === id);
  if (!request) return;
  request.resolve(value);
  dialogQueue = dialogQueue.filter((item) => item.id !== id);
  notifyDialogListeners();
}

/** DialogHost 订阅队列变化(返回取消订阅函数)。 */
export function subscribeDialogQueue(listener: () => void) {
  dialogListeners.add(listener);
  return () => {
    dialogListeners.delete(listener);
  };
}

/** 当前应展示的对话框请求(队首),没有则返回 null。 */
export function currentDialogRequest() {
  return dialogQueue[0] ?? null;
}
