import { COURSE_MENUS, priceLabel } from '@table-check/core/courseMenus';
import { COURSE_LABEL, COURSES, type Course } from '@table-check/core/domain';
import type { SelectOption } from './SelectField';

// ドロップダウンの選び肢（Web の CoursePicker・MenuPicker・GuestPicker と同じ並び）
export const COURSE_OPTIONS: SelectOption<Course | null>[] = [{ value: null, label: '通常' }, ...COURSES.map(course => ({ value: course, label: `コース（${COURSE_LABEL[course]}）` }))];
export const MENU_OPTIONS: SelectOption<string | null>[] = [{ value: null, label: '未定' }, ...COURSE_MENUS.map(menu => ({ value: menu.id, label: `${priceLabel(menu)} ${menu.short}` }))];
// 来店する人数は組ごとに大きく変わるので、−／＋ ではなく一度で選べるようにする（No.71）。今の人数が30名より多ければそこまで並べる
const GUESTS_PICK = 30;
export function guestOptions(emptyLabel: string, current: number | null): SelectOption<number | null>[] {
  return [{ value: null, label: emptyLabel }, ...Array.from({ length: Math.max(GUESTS_PICK, current ?? 0) }, (_, i) => ({ value: i + 1, label: `${i + 1}名` }))];
}
