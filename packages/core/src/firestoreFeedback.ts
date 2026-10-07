import type { User } from 'firebase/auth';
import { collection, doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import type { FeedbackInput, FeedbackResult, FeedbackStore } from './feedback';
import { GUEST_BASE, type ShopBase } from './shopPath';

// サーバーに届くのをここまで待つ。届かなければ「つながったら送る」と出す（書き込みは端末に残り、あとで届く）
const SEND_WAIT_MS = 8_000;

// feedback/{自動の id} に1件ずつ書く（No.125）。ログインした店はその店のアカウントの uid を shop に入れる
export class FirestoreFeedbackStore implements FeedbackStore {
  readonly delivers = true;
  constructor(private db: Firestore, private userReady: Promise<User>, private base: ShopBase = GUEST_BASE) {}
  async send({ message, version, platform, shopName }: FeedbackInput): Promise<FeedbackResult> {
    await this.userReady;
    const ref = doc(collection(this.db, 'feedback'));
    const write = setDoc(ref, { message, version, platform, shopName, shop: this.base.length >= 2 ? this.base[1] : null, createdAt: serverTimestamp() });
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
