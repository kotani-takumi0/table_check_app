// 今後の予定（No.144）。店の人に、これからできるようになることを短く知らせる。
// 中身はアプリの中に文章で持つ（releaseNotes.ts と同じ）。Notion から自動では出さない。載せるものは選んでから足す。
// 日付は出さない。「準備中」「検討中」の2段階。セキュリティの修正は載せない。
// ご意見から生まれたものは fromFeedback だけを立てる。店や人の名前は入れない。

export const ROADMAP_STAGES = ['preparing', 'considering'] as const;
export type RoadmapStage = typeof ROADMAP_STAGES[number];
export const ROADMAP_STAGE_LABEL: Record<RoadmapStage, string> = { preparing: '準備中', considering: '検討中' };

export const ROADMAP_TITLE_MAX = 80;
export const ROADMAP_DETAIL_MAX = 200;
export const ROADMAP_FROM_FEEDBACK_LABEL = 'ご意見から生まれた機能です';
export const ROADMAP_NOTE = '予定は変わることがあります。時期はお約束できないため、「準備中」「検討中」で表しています。';
export const ROADMAP_CTA_TITLE = 'ほしい機能はありますか？';
export const ROADMAP_CTA_DETAIL = 'いただいたご意見をもとに予定を決めています。';

export interface RoadmapItem {
  id: string;
  stage: RoadmapStage;
  title: string;          // 機能名ではなく、店の人ができるようになること
  detail: string;
  fromFeedback: boolean;  // ご意見から生まれた機能です。店や人の名前は持たない
}

// 見本の例で仮置きしている。載せる予定は、出す前に選ぶ
export const ROADMAP: RoadmapItem[] = [
  {
    id: 'overtime-seats',
    stage: 'preparing',
    title: '時間を過ぎた席が、ひと目で分かるようになります',
    detail: '時間超過の席は赤い枠で囲み、時間切れの画面でも警告をいちばん上に大きく出します。',
    fromFeedback: true,
  },
  {
    id: 'phone-seat-text',
    stage: 'preparing',
    title: 'スマホでも卓番号と人数が大きく読めるようになります',
    detail: '小さかった卓番号・人数・状態の文字を大きくします。',
    fromFeedback: true,
  },
  {
    id: 'voice-seating',
    stage: 'considering',
    title: '「○卓○名様ご案内です」の声で着席にできるようになります',
    detail: 'ボタンの押し忘れを減らすための機能です。声は保存しません。',
    fromFeedback: false,
  },
  {
    id: 'day-review',
    stage: 'considering',
    title: '営業のあとに、1日の席の動きを振り返れるようになります',
    detail: '来店組数や平均の滞在時間、混んだ時間帯をまとめて見られます。',
    fromFeedback: false,
  },
];

export function roadmapGroups(): { stage: RoadmapStage; items: RoadmapItem[] }[] {
  return ROADMAP_STAGES
    .map(stage => ({ stage, items: ROADMAP.filter(item => item.stage === stage) }))
    .filter(group => group.items.length > 0);
}

// この端末で見た予定（id をカンマでつないだもの）。新しい id が足されたときだけ、メニューに点を出す
export const SEEN_ROADMAP_KEY = 'minopal:seenRoadmap';
export function roadmapSeenValue(): string {
  return ROADMAP.map(item => item.id).join(',');
}
// seen が null の端末（この画面をまだ開いていない）も、最初の1回は点を出す
export function shouldShowRoadmapDot(seen: string | null): boolean {
  if (ROADMAP.length === 0) return false;
  if (seen === null || seen === '') return true;
  const seenIds = new Set(seen.split(','));
  return ROADMAP.some(item => !seenIds.has(item.id));
}
