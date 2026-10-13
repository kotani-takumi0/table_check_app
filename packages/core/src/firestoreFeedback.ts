import type { User } from 'firebase/auth';
import { doc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';
import { FeedbackRejected, feedbackDocId, feedbackTicket, type FeedbackInput, type FeedbackResult, type FeedbackStore } from './feedback';
import { GUEST_BASE, type ShopBase } from './shopPath';

// サーバーに届くのをここまで待つ。届かなければ「つながったら送る」と出す（書き込みは端末に残り、あとで届く）
const SEND_WAIT_MS = 8_000;

function permissionDenied(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'permission-denied';
}

// feedback/{uid}_{印} に1件ずつ書く（No.125・No.144）。同じ書き込みで feedbackPace/{uid} を進め、間隔が空くまで次は送れない。
// ログインした店はその店のアカウントの uid を shop に入れる
export class FirestoreFeedbackStore implements FeedbackStore {
  readonly delivers = true;
  constructor(private db: Firestore, private userReady: Promise<User>, private base: ShopBase = GUEST_BASE) {}
  async send({ message, version, platform, shopName }: FeedbackInput): Promise<FeedbackResult> {
    const user = await this.userReady;
    const ticket = feedbackTicket();
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, 'feedbackPace', user.uid), { lastAt: serverTimestamp(), ticket });
    batch.set(doc(this.db, 'feedback', feedbackDocId(user.uid, ticket)), {
      message, version, platform, shopName, shop: this.base.length >= 2 ? this.base[1] : null, createdAt: serverTimestamp(),
    });
    const write = batch.commit().catch(error => { throw permissionDenied(error) ? new FeedbackRejected() : error; });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = new Promise<FeedbackResult>(resolve => { timer = setTimeout(() => resolve('queued'), SEND_WAIT_MS); });
    try {
      return await Promise.race([write.then((): FeedbackResult => 'sent'), wait]);
    } finally {
      clearTimeout(timer);
      // 待ちきれずに返したあとで断られたら、記録だけ残す
      write.catch(error => console.error(error));
    }
  }
}
