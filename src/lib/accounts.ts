import { defaultStudyState, type StudyState } from "../study-state";

export type DashboardAccount = {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
};

export type AccountRegistry = {
  version: 1;
  activeAccountId: string;
  accounts: DashboardAccount[];
};

export const LEGACY_LOCAL_KEY = "kaoyan-dashboard-state-v1";
export const ACCOUNT_REGISTRY_KEY = "kaoyan-dashboard-accounts-v1";
export const ACCOUNT_STATE_PREFIX = "kaoyan-dashboard-account-state-v1:";

export function accountStateKey(accountId: string) {
  return `${ACCOUNT_STATE_PREFIX}${accountId}`;
}

/** 以默认配置为基础生成一个全新账号的初始状态(深拷贝,避免共享引用)。 */
export function freshStudyState(name: string) {
  const next = JSON.parse(JSON.stringify(defaultStudyState)) as StudyState;
  next.profile.name = name;
  return next;
}
