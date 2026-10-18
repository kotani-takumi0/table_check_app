import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldPath, getFirestore, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";

// Firestore の場所は firebase.json には無い。プロジェクトの決めごと（東京）に合わせ、Functions も同じ場所にする。
export const FUNCTIONS_REGION = "asia-northeast1";
// 呼び出したトークンの auth_time がこの秒数より古ければ拒否する（パスワードの入れ直しを求める）
export const RECENT_LOGIN_SECONDS = 5 * 60;
export const RECENT_LOGIN_REQUIRED = "recent-login-required";
// ご意見の文書 id は feedback.ts の feedbackDocId（uid + "_" + 16文字の印）
const FEEDBACK_TICKET = /^[a-z0-9]{16}$/;

// 呼び出しの形だけ。uid は auth から取り、data は見ない
export interface AccountDeletionToken {
  auth_time?: number;
  firebase?: { sign_in_provider?: string };
}

export interface AccountDeletionCall {
  auth?: { uid: string; token: AccountDeletionToken } | null;
  app?: unknown;
  data?: unknown;
}

export type AuthUserDeleter = (uid: string) => Promise<void>;

// 既定では強制しない。ENFORCE_APP_CHECK=true のときだけ、トークンが無い・無効なら拒否する
export function appCheckEnforced(): boolean {
  return process.env.ENFORCE_APP_CHECK === "true";
}

// auth_time は秒。時計の進みすぎ（1分まで）は許す
export function isRecentAuthTime(authTime: unknown, nowSec: number): boolean {
  if (typeof authTime !== "number" || !Number.isFinite(authTime)) return false;
  const age = nowSec - authTime;
  return age <= RECENT_LOGIN_SECONDS && age >= -60;
}

// 匿名はパスワードが無く、入り直すと別の利用者になる。そのときだけ auth_time を見ない。ほかのログイン方法は見る
export function recentLoginRequired(token: AccountDeletionToken | undefined, nowSec: number): boolean {
  if (token?.firebase?.sign_in_provider === "anonymous") return false;
  return !isRecentAuthTime(token?.auth_time, nowSec);
}

// このアカウントのご意見だけ。shop が自分の uid ならログインした店。shop が null なら文書 id が自分の uid のときだけ（今の店）
// shop がほかの uid の文書は、id が似ていても消さない
export function feedbackBelongsToAccount(id: string, shop: unknown, uid: string): boolean {
  if (shop === uid) return true;
  if (shop !== null && shop !== undefined) return false;
  const prefix = `${uid}_`;
  if (!id.startsWith(prefix)) return false;
  return FEEDBACK_TICKET.test(id.slice(prefix.length));
}

function ensureAdmin(): void {
  if (getApps().length > 0) return;
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (projectId) initializeApp({ projectId });
  else initializeApp();
}

function assertAccountUid(uid: string): void {
  // パスに使えない uid では消さない（auth.uid 以外は受け取らない）
  if (!uid || uid.includes("/")) {
    throw new HttpsError("permission-denied", "アカウントを確認できません");
  }
}

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof (error as { code: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return "";
}

async function deleteRefs(db: Firestore, refs: DocumentReference[]): Promise<void> {
  const unique = [...new Map(refs.map((ref) => [ref.path, ref])).values()];
  for (let i = 0; i < unique.length; i += 450) {
    const batch = db.batch();
    for (const ref of unique.slice(i, i + 450)) batch.delete(ref);
    await batch.commit();
  }
}

// feedback は店ごとのサブコレクションではなく、いちばん上に1か所。文書 id は `{uid}_{印}`、ログインした店は shop に uid を入れる。
// ルールで uid ごとの文書になっているのは feedbackPace/{uid}（連続送信の間隔）と clockProbes/{uid}（時計合わせ）だけ。
// いちばん上の sessions や layoutHistory は「ログインせずに使う」店の共有で、このアカウントのものではないので消さない
async function deleteOwnedFeedback(db: Firestore, uid: string): Promise<void> {
  const refs: DocumentReference[] = [];
  const byShop = await db.collection("feedback").where("shop", "==", uid).get();
  for (const doc of byShop.docs) {
    if (feedbackBelongsToAccount(doc.id, doc.get("shop"), uid)) refs.push(doc.ref);
  }
  const prefix = `${uid}_`;
  const byId = await db.collection("feedback").orderBy(FieldPath.documentId()).startAt(prefix).endAt(`${prefix}\uf8ff`).get();
  for (const doc of byId.docs) {
    if (feedbackBelongsToAccount(doc.id, doc.get("shop"), uid)) refs.push(doc.ref);
  }
  refs.push(db.collection("feedbackPace").doc(uid));
  refs.push(db.collection("clockProbes").doc(uid));
  await deleteRefs(db, refs);
}

// 店のデータ（shops/{uid} 以下）とご意見を消してから、Auth のユーザーを消す。途中で失敗しても、もう一度呼べば続きから終わる
export async function performAccountDeletion(uid: string, deleteUser: AuthUserDeleter = (id) => getAuth().deleteUser(id)): Promise<void> {
  assertAccountUid(uid);
  ensureAdmin();
  const db = getFirestore();
  await db.recursiveDelete(db.doc(`shops/${uid}`));
  await deleteOwnedFeedback(db, uid);
  try {
    await deleteUser(uid);
  } catch (error) {
    if (errorCode(error) === "auth/user-not-found") return;
    throw error;
  }
}

export async function deleteOwnAccount(request: AccountDeletionCall): Promise<{ deleted: true }> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "ログインが必要です");
  }
  assertAccountUid(uid);
  const nowSec = Math.floor(Date.now() / 1000);
  if (recentLoginRequired(request.auth?.token, nowSec)) {
    throw new HttpsError("failed-precondition", "パスワードを入れ直してから、もう一度消してください", {
      reason: RECENT_LOGIN_REQUIRED,
    });
  }
  // App Check はサーバーで確かめる。方針は記録だけ（トークンが無い・無効でも、強制する設定でなければ消す）
  if (!request.app) {
    logger.warn("App Check のトークンが無い、または無効です");
    if (appCheckEnforced()) {
      throw new HttpsError("failed-precondition", "アプリの確認ができません", { reason: "app-check-required" });
    }
  }
  // request.data（uid や shopId）は見ない。消す店はログインしている uid だけ
  await performAccountDeletion(uid);
  return { deleted: true };
}

// プラットフォームの enforceAppCheck は false のままにする。無効なトークンも関数まで届き、上で記録できる。
// 強制するときは ENFORCE_APP_CHECK=true にする（あとからオンにする）
// 同時に動く数を抑えて、繰り返し呼ばれたときの費用を頭打ちにする
export const deleteAccount = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: false, maxInstances: 5 },
  (request) => deleteOwnAccount(request),
);
