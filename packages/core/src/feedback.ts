// ご意見を送る（No.125）。店の人が使いにくいところ・ほしい機能を書いて送る。
// 送り先は Firestore のいちばん上の feedback（店ごとに分けず1か所に集める）。アプリからは送るだけで読めず、読むのは Firebase コンソールから

// 1件の長さ（firestore.rules の canSendFeedback と同じ）
export const FEEDBACK_MAX = 1000;
// 連続送信の間隔（firestore.rules の duration.value(30, 's') と同じ）。ルールは「30秒よりあと」なので、画面では1秒多く待つ
export const FEEDBACK_INTERVAL_MS = 30_000;
const FEEDBACK_INTERVAL_SLACK_MS = 1_000;
export const FEEDBACK_TICKET_RE = /^[a-z0-9]{16}$/;
export const FEEDBACK_SENT_AT_KEY = 'minopal:feedbackSentAt';
export const FEEDBACK_WAIT_MESSAGE = '少し待ってから、もう一度送ってください。';
export const FEEDBACK_UNCONFIRMED_MESSAGE = '届いたか確かめています。送り直さなくて大丈夫です。';

// ルールで断られたとき（間隔が短い）。画面はこの文を出す
export class FeedbackRejected extends Error {
  constructor() {
    super(FEEDBACK_WAIT_MESSAGE);
    this.name = 'FeedbackRejected';
  }
}
const TICKET_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
// 送信ごとに変える印。文書 id に使い、1回の書き込みで1件だけに束ねる
export function feedbackTicket(random: () => number = Math.random): string {
  let ticket = '';
  for (let i = 0; i < 16; i++) ticket += TICKET_ALPHABET[Math.floor(random() * TICKET_ALPHABET.length)];
  return ticket;
}
export function feedbackDocId(uid: string, ticket: string): string {
  return `${uid}_${ticket}`;
}
// 次に送れるまで残っている時間（ミリ秒）。0 なら送ってよい
export function feedbackCooldownMs(lastSentAt: number | null, nowMs: number): number {
  if (lastSentAt === null) return 0;
  return Math.max(0, FEEDBACK_INTERVAL_MS + FEEDBACK_INTERVAL_SLACK_MS - (nowMs - lastSentAt));
}
export type FeedbackPlatform = 'web' | 'ios';
export interface FeedbackInput {
  message: string;
  version: string;          // 送った端末のアプリの版（v2.3.4）
  platform: FeedbackPlatform;
  shopName: string;         // 設定の店名（空のこともある）
}
// sent：サーバーが受け取った。queued：8秒待っても、受け取ったかまだ分からない
export type FeedbackDelivery = 'sent' | 'queued';
export interface FeedbackAck {
  delivery: FeedbackDelivery;
  // 受け取ったと分かったときに解決する。queued でもあとから解決し、断られたら拒否する
  confirmed: Promise<void>;
}
// 受け取ったと確かめてから、下書きを消し、次に送れるまでの待ち時間を始める
export function feedbackAccepted(delivery: FeedbackDelivery): boolean {
  return delivery === 'sent';
}
export interface FeedbackStore {
  // 送れない（ルールで断られたなど）ときは例外にする
  send(input: FeedbackInput): Promise<FeedbackAck>;
  // false：Firebase につながない試しなので、どこにも送らない
  readonly delivers: boolean;
}

// 前の店の分が届いても、いまの店には「送りました」を出さない。待ちは始める。
// 30秒の制限はサーバーがユーザーごとにかけるので、始めないと次の送信が断られて失敗に見える
export function feedbackArrival(sentShop: string, currentShop: string): { showSent: boolean; startWait: true } {
  return { showSent: sentShop === currentShop, startWait: true };
}
export function feedbackWaitNote(remainSec: number): string {
  return `続けて送るには少し待ってください（あと${remainSec}秒）`;
}

// 店が替わったとき。下書きを消し、届いたか確かめている最中でも押せない状態を解く（意図どおり）
export function feedbackShopSwitch(keptShop: string, keptDraft: string, shopId: string): { shop: string; draft: string; checking: false } {
  if (keptShop === shopId) return { shop: keptShop, draft: keptDraft, checking: false };
  return { shop: shopId, draft: '', checking: false };
}

// 送る文。前後の空白を落とし、空・長すぎるときは null
export function feedbackText(draft: string): string | null {
  const text = draft.trim();
  return text === '' || text.length > FEEDBACK_MAX ? null : text;
}

export const FEEDBACK_SENT_MESSAGE = '送りました。ありがとうございます。';
export const FEEDBACK_ERROR_MESSAGE = '送れませんでした。時間をおいてもう一度お試しください。';

// Firebase につながない試し：どこにも送らない
export class NoFeedbackStore implements FeedbackStore {
  readonly delivers = false;
  async send(_input: FeedbackInput): Promise<FeedbackAck> {
    return { delivery: 'sent', confirmed: Promise.resolve() };
  }
}
