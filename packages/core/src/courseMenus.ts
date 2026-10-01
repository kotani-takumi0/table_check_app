// コースのメニュー（料理と提供順）。公式HP（https://mucho-amigo.com/course/ 、2026-09-30 取得）から。
// いまはコードに直接書いているが、あとでお店の人が入力できるようにする予定なので、メニューはここ1か所にまとめる。
// id は Firestore に保存するので変えない（firestore.rules の isMenuOrNull も同じ一覧）
export interface CourseMenu {
  id: string;
  name: string;
  price: number;      // 税込の値段（円）。お店ではコースを値段で呼ぶので、選ぶボタンは値段を大きく出す
  short: string;      // 選ぶボタン用の短い名前（同じ値段のコースを見分ける）
  dishes: string[];   // 提供順
}
// 選ぶボタンに並べる順（値段の安い順）
export const COURSE_MENUS: readonly CourseMenu[] = [
  {
    id: 'nijikai', price: 1500, name: '二次会Mexicanコース', short: '二次会', dishes: [
      'プレミアムアボカドのワカモレ・フレスコ＆トルティーヤチップ',
      'チチャロン＆2種の自家製テーブルサルサ',
      '新鮮魚介のメキシカンクラシック・セビーチェ',
      '4種のチーズ ケサディーヤ',
      'MUCHO特製フラワートルティーヤのメキシカンタコス',
    ],
  },
  {
    id: 'casual', price: 3000, name: 'カジュアルメキシカンコース', short: 'カジュアル', dishes: [
      'プレミアムアボカドのワカモレ・フレスコ＆トルティーヤチップ',
      'チチャロン＆2種の自家製テーブルサルサ',
      '新鮮魚介のセビーチェ',
      'メキシコ発祥シーザーサラダ',
      '4種のチーズ ケサディーヤ',
      '自家製トルティーヤのメキシカンタコス',
      'スパイスマリネのグリルチキン～ファフィータ仕立て～',
      'バニラアイス with メキシカンスパイス Tajin',
    ],
  },
  {
    id: 'meat_share', price: 4000, name: 'TEX-MEX ミートシェアコース', short: 'ミートシェア', dishes: [
      '2種のテーブルサルサ＆プレミアムアボカドのワカモレ・フレスコ',
      '新鮮魚介のセビーチェ',
      '具沢山コブサラダ',
      'TEX-MEX スライダーバーガー',
      'バッファロー・チキンウイング',
      'メキシコ産三元豚太郎のローストポーク～ファフィータ仕立て～',
      'スパイシーチリコンカンミートのタコライス',
      'バニラアイス with メキシカンスパイス Tajin',
    ],
  },
  {
    id: 'cheese', price: 4000, name: 'メキシカンチーズコース', short: 'チーズ', dishes: [
      'プレミアムアボカドのワカモレ・フレスコ＆トルティーヤチップ',
      '新鮮魚介のセビーチェ',
      'チチャロン＆2種の自家製テーブルサルサ',
      'アボカドとサボテンのメキシカンサラダ～自家製フレッシュサルサ和え～',
      '4種のチーズのケサディーヤ',
      '石焼きチーズ鍋 ケソ・フンディード（アボカド／シュリンプ）',
      '特製トルティーヤ＆バケットセット',
      'ケソ・フンディードのソースで仕上げるチーズリゾット',
      'バニラアイス with メキシカンスパイス Tajin',
    ],
  },
  {
    id: 'premium', price: 5000, name: 'プレミアムメキシカンコース', short: 'プレミアム', dishes: [
      'プレミアムアボカドのワカモレ・フレスコ＆トルティーヤチップ',
      '新鮮魚介のセビーチェ・クラシコ',
      '神の海老のメキシカン・シュリンプカクテル',
      'アボカドとサボテンのメキシカンサラダ',
      '峯野牛 特上赤身ステーキのファフィータ',
      '特製トルティーヤセット',
      '彩り焼き野菜のメキシカングリル',
      'アロス・ア・ラ・メヒカーナ',
      'バニラアイス with メキシカンスパイス Tajin',
    ],
  },
];
export function menuOf(id: string | null): CourseMenu | null {
  return COURSE_MENUS.find(menu => menu.id === id) ?? null;
}
export function priceLabel(menu: CourseMenu): string {
  // iOS（Hermes）でも同じ表示になるよう、桁区切りは自分で入れる
  return `${String(menu.price).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}円`;
}
export function isMenuId(value: unknown): value is string {
  return typeof value === 'string' && menuOf(value) !== null;
}
