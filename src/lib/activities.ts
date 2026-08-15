import { defaultLifeActivities, type LifeActivity } from "../study-state";

/** 判断一个分类 id 是否为「生活活动」(睡眠/运动/娱乐等),而非考试科目。 */
export function lifeActivity(subjectId: string, activities: LifeActivity[] = defaultLifeActivities) {
  return activities.find((item) => item.id === subjectId && item.active !== false);
}
