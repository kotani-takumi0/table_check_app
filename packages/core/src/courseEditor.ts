import type { CourseMenu } from './courseMenus';
import { isVisible, type Session } from './domain';
import { newCourseMenuId, stepMinutes, type ShopSettings } from './shopSettings';

// コースを作る・直す画面（No.89）の中身。Web と iOS で同じものを使い、見た目だけそれぞれで作る
export function newCourse(menus: CourseMenu[], now: number): CourseMenu {
  return { id: newCourseMenuId(menus, now), name: '', short: '', price: 0, dishes: [''], lastOrderMin: null, seatLimitMin: null };
}
// このコースの L.O.・お席の時間（決めていなければ店の設定）
export function courseMinutes(menu: CourseMenu, settings: ShopSettings): { lastOrderMin: number; seatLimitMin: number } {
  return { lastOrderMin: menu.lastOrderMin ?? settings.lastOrderMin, seatLimitMin: menu.seatLimitMin ?? settings.seatLimitMin };
}
// このコースだけ時間を変える・店の設定に戻す
export function setOwnMinutes(menu: CourseMenu, settings: ShopSettings, own: boolean): CourseMenu {
  return own ? { ...menu, ...courseMinutes(menu, settings) } : { ...menu, lastOrderMin: null, seatLimitMin: null };
}
// 設定の画面と同じく step ずつ動かす。範囲の外や、L.O. がお席の時間に届く変更は null
export function stepCourseMinutes(menu: CourseMenu, settings: ShopSettings, key: 'lastOrderMin' | 'seatLimitMin', direction: 1 | -1): CourseMenu | null {
  const change = stepMinutes({ ...settings, ...courseMinutes(menu, settings) }, key, direction);
  return change ? { ...menu, ...courseMinutes(menu, settings), ...change } : null;
}
// 料理を1つ上・下へ動かす（端では動かさない）
export function moveDish(dishes: string[], index: number, direction: 1 | -1): string[] {
  const to = index + direction;
  if (to < 0 || to >= dishes.length) return dishes;
  const next = [...dishes];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
// 保存する形に整える（前後の空白を落とす）。同じ id があれば置き換え、無ければ最後に足す
export function putCourse(menus: CourseMenu[], menu: CourseMenu): CourseMenu[] {
  const tidy = { ...menu, name: menu.name.trim(), short: menu.short.trim(), dishes: menu.dishes.map(dish => dish.trim()) };
  return menus.some(m => m.id === menu.id) ? menus.map(m => m.id === menu.id ? tidy : m) : [...menus, tidy];
}
// 案内中の卓が使っているコース（コースの id → 卓番）。使っている間は消せない（No.89 ユーザー決定）
export function coursesInUse(sessions: Session[], now: number, settings: ShopSettings): Map<string, string[]> {
  const use = new Map<string, string[]>();
  for (const session of sessions) {
    if (session.course === null || session.menu === null || !isVisible(session, now, settings)) continue;
    use.set(session.menu, [...(use.get(session.menu) ?? []), ...session.tableIds]);
  }
  return use;
}
