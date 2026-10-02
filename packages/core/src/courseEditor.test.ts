import { describe, expect, it } from 'vitest';
import { coursesInUse, courseMinutes, moveDish, newCourse, putCourse, setOwnMinutes, stepCourseMinutes } from './courseEditor';
import { DEFAULT_COURSE_MENUS } from './courseMenus';
import { advance, newSession } from './domain';
import { courseProblems, DEFAULT_SHOP_SETTINGS, parseShopSettings } from './shopSettings';

const settings = DEFAULT_SHOP_SETTINGS;
const casual = DEFAULT_COURSE_MENUS[1];
describe('コースを作る・直す（No.89）', () => {
  it('新しいコースは空の下書きで、そのままでは保存できない', () => {
    const draft = newCourse(DEFAULT_COURSE_MENUS, 1000);
    expect(draft.id).toMatch(/^menu_[a-z0-9]+$/);
    expect(courseProblems(draft).length).toBeGreaterThan(0);
    expect(courseProblems({ ...draft, name: 'カジュアル', short: 'カジュアル', price: 3000, dishes: ['サラダ'] })).toEqual([]);
  });
  it('このコースだけの時間は店の設定から始め、step ずつ動かし、L.O. はお席の時間に届かない', () => {
    const own = setOwnMinutes(casual, settings, true);
    expect(courseMinutes(own, settings)).toEqual({ lastOrderMin: 90, seatLimitMin: 120 });
    expect(stepCourseMinutes(own, settings, 'lastOrderMin', -1)).toMatchObject({ lastOrderMin: 85, seatLimitMin: 120 });
    expect(stepCourseMinutes({ ...own, lastOrderMin: 115 }, settings, 'lastOrderMin', 1)).toBeNull();
    expect(setOwnMinutes(own, settings, false)).toMatchObject({ lastOrderMin: null, seatLimitMin: null });
    expect(courseProblems({ ...casual, lastOrderMin: 120, seatLimitMin: 120 })).toContain('L.O. はお席の時間より前にしてください');
  });
  it('料理を上下に動かし、端では動かさない', () => {
    expect(moveDish(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveDish(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
  it('保存は同じ id を置き換え、無ければ最後に足す（前後の空白は落とす）', () => {
    expect(putCourse(DEFAULT_COURSE_MENUS, { ...casual, name: ' 新カジュアル ' })?.[1].name).toBe('新カジュアル');
    const added = putCourse(DEFAULT_COURSE_MENUS, { ...casual, id: 'menu_x', dishes: [' 前菜 '] });
    expect(added).toHaveLength(DEFAULT_COURSE_MENUS.length + 1);
    expect(added?.at(-1)?.dishes).toEqual(['前菜']);
    const full = Array.from({ length: 20 }, (_, i) => ({ ...casual, id: `menu_${i}` }));
    expect(putCourse(full, { ...casual, id: 'menu_new' })).toBeNull();
    expect(putCourse(full, { ...casual, id: 'menu_3', name: '直した' })?.[3].name).toBe('直した');
  });
  it('案内中の卓が使っているコースと卓番を返す（通常の卓・未選択は数えない）', () => {
    const use = coursesInUse([advance(newSession('a', '12', 0, 4, 'drinks', 'casual'), 0), newSession('b', '14', 0, 2, 'drinks'), newSession('c', '21', 0)], 0, settings);
    expect([...use]).toEqual([['casual', ['12']]]);
  });
  it('保存されたコースの一覧は確かめて読み、壊れたコースは落とす', () => {
    expect(parseShopSettings({}).courseMenus).toEqual(DEFAULT_COURSE_MENUS);
    expect(parseShopSettings({ courseMenus: [{ ...casual, id: 'menu_a' }, { ...casual, id: 'menu_b', dishes: [] }, { ...casual, id: 'menu_a' }] }).courseMenus.map(m => m.id)).toEqual(['menu_a']);
  });
});
