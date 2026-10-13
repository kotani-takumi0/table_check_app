import type { User } from 'firebase/auth';
import { doc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';
import { FeedbackRejected, feedbackDocId, feedbackTicket, type FeedbackAck, type FeedbackInput, type FeedbackStore } from './feedback';
import { GUEST_BASE, type ShopBase } from './shopPath';

// ここまで待って受け取れなければ、届いたか未確認として返す。書き込みはそのあとでも続き、受け取ったら confirmed が解決する
const SEND_WAIT_MS = 8_000;

function permissionDenied(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'permission-denied';
}

// feedback/{uid}_{印} に1件ずつ書く（No.125・No.144）。同じ書き込みで feedbackPace/{uid} を進め、間隔が空くまで次は送れない。
// ログインした店はその店のアカウントの uid を shop に入れる
export class FirestoreFeedbackStore implements FeedbackStore {
  readonly delivers = true;
  constructor(private db: Firestore, private userReady: Promise<User>, private base: ShopBase = GUEST_BASE) {}
  async send({ message, version, platform, shopName }: FeedbackInput): Promise<FeedbackAck> {
    const user = await this.userReady;
    const ticket = feedbackTicket();
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, 'feedbackPace', user.uid), { lastAt: serverTimestamp(), ticket });
    batch.set(doc(this.db, 'feedback', feedbackDocId(user.uid, ticket)), {
      message, version, platform, shopName, shop: this.base.length >= 2 ? this.base[1] : null, createdAt: serverTimestamp(),
    });
    let resolveConfirmed!: () => void;
    let rejectConfirmed!: (error: unknown) => void;
    const confirmed = new Promise<void>((resolve, reject) => { resolveConfirmed = resolve; rejectConfirmed = reject; });
    confirmed.catch(() => undefined);
    const settled = batch.commit().then(() => {
      resolveConfirmed();
      return 'sent' as const;
    }, (error: unknown) => {
      const wrapped = permissionDenied(error) ? new FeedbackRejected() : error;
      rejectConfirmed(wrapped);
      throw wrapped;
    });
    settled.catch(() => undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = new Promise<'queued'>(resolve => { timer = setTimeout(() => resolve('queued'), SEND_WAIT_MS); });
    try {
      const delivery = await Promise.race([settled, wait]);
      return { delivery, confirmed: delivery === 'sent' ? Promise.resolve() : confirmed };
    } finally {
      clearTimeout(timer);
    }
  }
}
