import { RULES } from './domain';
import { DEFAULT_LAYOUT, type ShopLayout } from './shopLayout';
import { DEFAULT_SHOP_SETTINGS, type ShopSettings } from './shopSettings';

// 最初のページ（No.087）：ログインした店で、席の配置をまだ保存していなければテンプレートを選んでもらう。
// テンプレートは席の配置と設定一式（コース・飲み放題の区分・店のタイマー・時間のルール）をまとめて入れ、選んだらすぐ使える。
// 今は1つだけ。あとで足せるよう一覧にしておく。店名は入れない（店が設定で入れる）
export type TemplateSettings = Omit<ShopSettings, 'shopName'>;
export interface ShopTemplate { id: string; name: string; help: string; layout: ShopLayout; settings: TemplateSettings }
const { shopName: _shopName, ...defaultSettings } = DEFAULT_SHOP_SETTINGS;
export const SHOP_TEMPLATES: ShopTemplate[] = [
  { id: 'izakaya_21', name: '居酒屋・21卓（カウンターあり）', help: 'テーブル11卓とカウンター10席。飲み放題3区分・コース5つ・トイレのタイマー入り。',
    layout: DEFAULT_LAYOUT, settings: defaultSettings },
];
// 何もない状態から自分で作る：配置・コース・区分・店のタイマーは空。時間のルールは空にできないので、ふつうの値（L.O.90分・お席120分など）
export const BLANK_SETTINGS: TemplateSettings = { ...RULES, drinkPlans: [], courseMenus: [], shopTimers: [], closingMin: null };
export const BLANK_LAYOUT: ShopLayout = { seats: [], labels: [] };
