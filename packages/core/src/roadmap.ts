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
export const ROADMAP_EMPTY = 'いまお知らせできる予定はありません。使っていて気になることがあれば、ご意見を送ってください。';

export interface RoadmapItem {
  id: string;
  stage: RoadmapStage;
  title: string;          // 機能名ではなく、店の人ができるようになること
  detail: string;
  fromFeedback: boolean;  // ご意見から生まれた機能です。店や人の名前は持たない
}

// 載せる予定は、出す前に選んでから足す。空のあいだは画面に案内だけを出し、メニューに点は出さない
export const ROADMAP: RoadmapItem[] = [];

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
// 予定の id と、この端末で見た id の文字列から、点を出すか決める。予定が空なら出さない。
// seen が null や空の端末（まだ開いていない）は、予定があるときだけ最初の1回を出す
export function roadmapHasUnseen(ids: readonly string[], seen: string | null): boolean {
  if (ids.length === 0) return false;
  if (seen === null || seen === '') return true;
  const seenIds = new Set(seen.split(','));
  return ids.some(id => !seenIds.has(id));
}
export function shouldShowRoadmapDot(seen: string | null): boolean {
  return roadmapHasUnseen(ROADMAP.map(item => item.id), seen);
}
