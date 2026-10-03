import { priceLabel, type CourseMenu } from '@table-check/core/courseMenus';
import { drinkPlanName, type Course, type DrinkPlan } from '@table-check/core/domain';
import type { SelectOption } from './SelectField';

// ドロップダウンの選び肢（Web の CoursePicker・MenuPicker・GuestPicker と同じ並び）
// 飲み放題の区分は店が設定で決める（No.90）。設定で消した区分を使っている卓は、その区分も残して出す
export function courseOptions(plans: DrinkPlan[], current: Course | null): SelectOption<Course | null>[] {
  const ids = current === null || plans.some(plan => plan.id === current) ? plans.map(plan => plan.id) : [...plans.map(plan => plan.id), current];
  return [{ value: null, label: '通常' }, ...ids.map(course => ({ value: course, label: `コース（${drinkPlanName(plans, course)}）` }))];
}
// コースは店が設定で作る（No.89）。設定で消したコースを選んでいる卓は、そのコースも残して出す
export function menuOptions(menus: CourseMenu[], current: string | null): SelectOption<string | null>[] {
  const options: SelectOption<string | null>[] = [{ value: null, label: '未定' }, ...menus.map(menu => ({ value: menu.id, label: `${priceLabel(menu)} ${menu.short}` }))];
  return current !== null && !menus.some(menu => menu.id === current) ? [...options, { value: current, label: '消したコース' }] : options;
}
// 詳細パネルで人数を直すときの選び肢（No.71。ご案内は −／＋ とよく来る人数。No.85）。今の人数が30名より多ければそこまで並べる
const GUESTS_PICK = 30;
export function guestOptions(emptyLabel: string, current: number | null): SelectOption<number | null>[] {
  return [{ value: null, label: emptyLabel }, ...Array.from({ length: Math.max(GUESTS_PICK, current ?? 0) }, (_, i) => ({ value: i + 1, label: `${i + 1}名` }))];
}
