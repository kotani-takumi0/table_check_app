import { DEFAULT_DRINK_PLANS, isCourse, RULES, type DrinkPlan, type Rules } from './domain';
import type { SyncState } from './store';

// 店全体の設定。全端末で共有する（Firestore の shopSettings/main）。
// 時間のルール（No.14）と店名。timeLimitOff は空いている日などに L.O.・お席の時間の通知と色を止める（No.80）。
// 空いているかどうかは日によって違うので、自動では切り替えず、人がオン・オフする
export interface ShopSettings extends Rules {
  shopName: string;         // 店名（ログインした店を見分ける。No.88 で使う）
  drinkPlans: DrinkPlan[];  // 飲み放題の区分（No.90）。選ぶとコースになる。並べる順
}
export const DEFAULT_SHOP_SETTINGS: ShopSettings = { ...RULES, shopName: '', drinkPlans: DEFAULT_DRINK_PLANS };
export const SHOP_NAME_MAX = 30;
export const DRINK_PLANS_MAX = 10;
export const DRINK_PLAN_NAME_MAX = 20;
// 区分の一覧を読む。壊れた項目・同じ id は落とす。一覧そのものが無い・壊れているときは最初の一覧（空の一覧はそのまま＝コースを使わない店）
function parseDrinkPlans(value: unknown): DrinkPlan[] {
  if (!Array.isArray(value)) return DEFAULT_DRINK_PLANS;
  const plans: DrinkPlan[] = [];
  for (const item of value.slice(0, DRINK_PLANS_MAX)) {
    const plan = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
    if (isCourse(plan.id) && typeof plan.name === 'string' && plan.name.trim() !== '' && plan.name.length <= DRINK_PLAN_NAME_MAX
      && !plans.some(p => p.id === plan.id)) plans.push({ id: plan.id, name: plan.name });
  }
  return plans;
}
// 新しく足す区分の id。既存の id と重ならないよう時刻から作る（英小文字・数字・_）
export function newDrinkPlanId(plans: DrinkPlan[], now: number): string {
  for (let n = now; ; n++) { const id = `plan_${n.toString(36)}`; if (!plans.some(plan => plan.id === id)) return id; }
}
// 分で決める項目と、選べる範囲・1回で動かす分（firestore.rules の shopSettings も同じ範囲）
export type MinuteSetting = 'otoshiWarnMin' | 'lastOrderMin' | 'seatLimitMin' | 'exitedKeepMin';
export const MINUTE_SETTINGS: Record<MinuteSetting, { min: number; max: number; step: number }> = {
  otoshiWarnMin: { min: 5, max: 60, step: 5 },
  lastOrderMin: { min: 10, max: 295, step: 5 },
  seatLimitMin: { min: 30, max: 300, step: 5 },
  exitedKeepMin: { min: 1, max: 30, step: 1 },
};
const isMinutes = (value: unknown, key: MinuteSetting): value is number =>
  Number.isInteger(value) && (value as number) >= MINUTE_SETTINGS[key].min && (value as number) <= MINUTE_SETTINGS[key].max;
// 保存された値を読む。壊れた値や無い項目は既定値にする。L.O. がお席の時間より後なら、どちらも既定値にする
export function parseShopSettings(data: unknown): ShopSettings {
  const d = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  const minutes = (key: MinuteSetting) => isMinutes(d[key], key) ? d[key] as number : DEFAULT_SHOP_SETTINGS[key];
  let lastOrderMin = minutes('lastOrderMin'), seatLimitMin = minutes('seatLimitMin');
  if (lastOrderMin >= seatLimitMin) ({ lastOrderMin, seatLimitMin } = DEFAULT_SHOP_SETTINGS);
  return {
    timeLimitOff: d.timeLimitOff === true,
    otoshiWarnMin: minutes('otoshiWarnMin'), lastOrderMin, seatLimitMin, exitedKeepMin: minutes('exitedKeepMin'),
    otoshi: d.otoshi !== false,
    shopName: typeof d.shopName === 'string' && d.shopName.length <= SHOP_NAME_MAX ? d.shopName : '',
    drinkPlans: parseDrinkPlans(d.drinkPlans),
  };
}
// 分の項目を step だけ増やす・減らす。範囲の外や、L.O. がお席の時間に届く変更は null（ボタンを押せなくする）
export function stepMinutes(settings: ShopSettings, key: MinuteSetting, direction: 1 | -1): Partial<ShopSettings> | null {
  const value = settings[key] + direction * MINUTE_SETTINGS[key].step;
  if (!isMinutes(value, key)) return null;
  const next = { ...settings, [key]: value };
  return next.lastOrderMin < next.seatLimitMin ? { [key]: value } : null;
}
export interface ShopSettingsStore {
  subscribe(cb: (settings: ShopSettings) => void): () => void;
  // 変えた項目だけを渡す（ほかの項目はそのまま残す）
  update(change: Partial<ShopSettings>): Promise<void>;
  subscribeSync?(cb: (state: SyncState) => void): () => void;
}
// Firebase につながずに試すときの保存先。アプリを開いている間だけ覚える
export class MemoryShopSettingsStore implements ShopSettingsStore {
  private settings = DEFAULT_SHOP_SETTINGS;
  private subscribers = new Set<(settings: ShopSettings) => void>();
  subscribe(cb: (settings: ShopSettings) => void): () => void {
    this.subscribers.add(cb);
    cb(this.settings);
    return () => { this.subscribers.delete(cb); };
  }
  async update(change: Partial<ShopSettings>): Promise<void> {
    this.settings = { ...this.settings, ...change };
    this.subscribers.forEach(cb => cb(this.settings));
  }
}
