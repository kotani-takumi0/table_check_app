// ご意見を送る（No.125）。店の人が使いにくいところ・ほしい機能を書いて送る。
// 送り先は Firestore のいちばん上の feedback（店ごとに分けず1か所に集める）。アプリからは送るだけで読めず、読むのは Firebase コンソールから

// 1件の長さ（firestore.rules の canSendFeedback と同じ）
export const FEEDBACK_MAX = 1000;
export type FeedbackPlatform = 'web' | 'ios';
export interface FeedbackInput {
  message: string;
  version: string;          // 送った端末のアプリの版（v2.3.4）
  platform: FeedbackPlatform;
  shopName: string;         // 設定の店名（空のこともある）
}
// sent：サーバーに届いた。queued：電波が無いなどでまだ届いていない（端末に残し、つながったら送る）
export type FeedbackResult = 'sent' | 'queued';
export interface FeedbackStore {
  // 送れない（ルールで断られたなど）ときは例外にする
  send(input: FeedbackInput): Promise<FeedbackResult>;
  // false：Firebase につながない試しなので、どこにも送らない
  readonly delivers: boolean;
}

// 送る文。前後の空白を落とし、空・長すぎるときは null
export function feedbackText(draft: string): string | null {
  const text = draft.trim();
  return text === '' || text.length > FEEDBACK_MAX ? null : text;
}

export const FEEDBACK_SENT_MESSAGE: Record<FeedbackResult, string> = {
  sent: '送りました。ありがとうございます。',
  queued: '電波がつながったら送ります。ありがとうございます。',
};
export const FEEDBACK_ERROR_MESSAGE = '送れませんでした。時間をおいてもう一度お試しください。';

// Firebase につながない試し：どこにも送らない
export class NoFeedbackStore implements FeedbackStore {
  readonly delivers = false;
  async send(_input: FeedbackInput): Promise<FeedbackResult> { return 'sent'; }
}
