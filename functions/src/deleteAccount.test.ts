import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  RECENT_LOGIN_REQUIRED,
  deleteOwnAccount,
  feedbackBelongsToAccount,
  isRecentAuthTime,
  performAccountDeletion,
} from "./deleteAccount";

// 本物の Firebase にはつながない。firebase emulators:exec（demo-minopal）の中だけで動かす
const NORTH = "owner-north-172";
const SOUTH = "owner-south-172";
const TICKET = "a".repeat(16);
const GUEST_TICKET = "b".repeat(16);

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

async function exists(path: string): Promise<boolean> {
  return (await getFirestore().doc(path).get()).exists;
}

async function seedShop(uid: string, shopName: string): Promise<void> {
  const db = getFirestore();
  await db.doc(`shops/${uid}/sessions/visit-1`).set({ shopName, status: "seated" });
  await db.doc(`shops/${uid}/layoutHistory/change-1`).set({ shopName });
  await db.doc(`shops/${uid}/shopSettings/main`).set({ shopName });
  await db.doc(`shops/${uid}/tables/1`).set({ sessionId: "visit-1" });
  await db.doc(`feedback/${uid}_${TICKET}`).set({
    message: "架空の店からの試しの文",
    shopName,
    shop: uid,
    platform: "ios",
  });
  // ログインせずに送ったご意見は shop が null で、文書 id だけが uid
  await db.doc(`feedback/${uid}_${GUEST_TICKET}`).set({
    message: "ログインなしの試しの文",
    shopName,
    shop: null,
    platform: "ios",
  });
  await db.doc(`feedbackPace/${uid}`).set({ ticket: TICKET });
}

async function seedShared(): Promise<void> {
  const db = getFirestore();
  await db.doc("sessions/shared-guest").set({ shopName: "いまの店", status: "seated" });
  await db.doc("layoutHistory/shared-guest").set({ shopName: "いまの店" });
  // 文書 id は北口店の uid で始まるが、中身は南口店のご意見。消してはいけない
  await db.doc(`feedback/${NORTH}_${"c".repeat(16)}`).set({
    message: "ほかの店の文",
    shopName: "架空の南口店",
    shop: SOUTH,
    platform: "ios",
  });
  // 印の形ではない id。範囲には入っても消さない
  await db.doc(`feedback/${NORTH}_extra_${"d".repeat(16)}`).set({
    message: "印の形ではない",
    shop: null,
    platform: "ios",
  });
}

async function createUser(uid: string): Promise<void> {
  await getAuth().createUser({ uid, email: `${uid}@example.com`, password: "password123" });
}

async function userExists(uid: string): Promise<boolean> {
  try {
    await getAuth().getUser(uid);
    return true;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
    if (code === "auth/user-not-found") return false;
    throw error;
  }
}

async function wipe(): Promise<void> {
  const db = getFirestore();
  await db.recursiveDelete(db.collection("shops"));
  await db.recursiveDelete(db.collection("feedback"));
  await db.recursiveDelete(db.collection("feedbackPace"));
  await db.recursiveDelete(db.collection("sessions"));
  await db.recursiveDelete(db.collection("layoutHistory"));
  for (const uid of [NORTH, SOUTH]) {
    if (await userExists(uid)) await getAuth().deleteUser(uid);
  }
}

before(async () => {
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
  assert.ok(project.startsWith("demo-"), `テストは demo- プロジェクトだけです: ${project}`);
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "Firestore エミュレータがありません");
  assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, "Auth エミュレータがありません");
  if (getApps().length === 0) initializeApp({ projectId: project });
  await wipe();
});

after(async () => {
  await wipe();
});

test("ご意見の持ち主は shop か、自分の uid の文書 id だけで決める", () => {
  assert.equal(feedbackBelongsToAccount(`${NORTH}_${TICKET}`, NORTH, NORTH), true);
  assert.equal(feedbackBelongsToAccount(`${NORTH}_${GUEST_TICKET}`, null, NORTH), true);
  assert.equal(feedbackBelongsToAccount(`${NORTH}_${"c".repeat(16)}`, SOUTH, NORTH), false);
  assert.equal(feedbackBelongsToAccount(`${NORTH}_extra_${"d".repeat(16)}`, null, NORTH), false);
  assert.equal(feedbackBelongsToAccount(`${SOUTH}_${TICKET}`, null, NORTH), false);
  assert.equal(isRecentAuthTime(1_000, 1_000 + 5 * 60), true);
  assert.equal(isRecentAuthTime(1_000, 1_000 + 5 * 60 + 1), false);
  assert.equal(isRecentAuthTime(undefined, 1_000), false);
});

test("自分の店のサブコレクションとご意見だけを消し、ほかの店と今の店は残す", async () => {
  await wipe();
  await createUser(NORTH);
  await createUser(SOUTH);
  await seedShop(NORTH, "架空の北口店");
  await seedShop(SOUTH, "架空の南口店");
  await seedShared();
  await getFirestore().doc(`clockProbes/${NORTH}`).set({ at: 1 });

  const result = await deleteOwnAccount({
    auth: { uid: NORTH, token: { auth_time: nowSec() } },
    // 引数の uid は無視する
    data: { uid: SOUTH, shopId: SOUTH },
  });
  assert.deepEqual(result, { deleted: true });

  for (const path of [
    `shops/${NORTH}/sessions/visit-1`,
    `shops/${NORTH}/layoutHistory/change-1`,
    `shops/${NORTH}/shopSettings/main`,
    `shops/${NORTH}/tables/1`,
    `feedback/${NORTH}_${TICKET}`,
    `feedback/${NORTH}_${GUEST_TICKET}`,
    `feedbackPace/${NORTH}`,
  ]) {
    assert.equal(await exists(path), false, path);
  }
  assert.equal(await userExists(NORTH), false);

  for (const path of [
    `shops/${SOUTH}/sessions/visit-1`,
    `shops/${SOUTH}/layoutHistory/change-1`,
    `shops/${SOUTH}/shopSettings/main`,
    `feedback/${SOUTH}_${TICKET}`,
    `feedback/${SOUTH}_${GUEST_TICKET}`,
    `feedbackPace/${SOUTH}`,
    `feedback/${NORTH}_${"c".repeat(16)}`,
    `feedback/${NORTH}_extra_${"d".repeat(16)}`,
    "sessions/shared-guest",
    "layoutHistory/shared-guest",
    `clockProbes/${NORTH}`,
  ]) {
    assert.equal(await exists(path), true, path);
  }
  assert.equal(await userExists(SOUTH), true);
});

test("ログインしていない呼び出しは拒否し、データは残る", async () => {
  await wipe();
  await createUser(NORTH);
  await seedShop(NORTH, "架空の北口店");
  await assert.rejects(
    () => deleteOwnAccount({ auth: null, data: { uid: NORTH } }),
    (error: unknown) => error instanceof HttpsError && error.code === "unauthenticated",
  );
  assert.equal(await exists(`shops/${NORTH}/sessions/visit-1`), true);
  assert.equal(await userExists(NORTH), true);
});

test("auth_time が5分より古いと拒否し、データは残る", async () => {
  await wipe();
  await createUser(NORTH);
  await seedShop(NORTH, "架空の北口店");
  await assert.rejects(
    () => deleteOwnAccount({ auth: { uid: NORTH, token: { auth_time: nowSec() - 301 } }, data: { uid: SOUTH } }),
    (error: unknown) => {
      assert.ok(error instanceof HttpsError);
      assert.equal(error.code, "failed-precondition");
      assert.deepEqual(error.details, { reason: RECENT_LOGIN_REQUIRED });
      return true;
    },
  );
  await assert.rejects(
    () => deleteOwnAccount({ auth: { uid: NORTH, token: {} } }),
    (error: unknown) => error instanceof HttpsError && error.code === "failed-precondition",
  );
  assert.equal(await exists(`shops/${NORTH}/layoutHistory/change-1`), true);
  assert.equal(await exists(`feedback/${NORTH}_${TICKET}`), true);
  assert.equal(await userExists(NORTH), true);
});

test("店のデータを消したあと Auth の削除に失敗しても、もう一度呼ぶと終わる", async () => {
  await wipe();
  await createUser(NORTH);
  await createUser(SOUTH);
  await seedShop(NORTH, "架空の北口店");
  await seedShop(SOUTH, "架空の南口店");

  await assert.rejects(() => performAccountDeletion(NORTH, async () => {
    throw new Error("auth delete failed");
  }));
  assert.equal(await exists(`shops/${NORTH}/sessions/visit-1`), false);
  assert.equal(await exists(`feedback/${NORTH}_${TICKET}`), false);
  assert.equal(await exists(`feedbackPace/${NORTH}`), false);
  assert.equal(await userExists(NORTH), true);
  assert.equal(await exists(`shops/${SOUTH}/sessions/visit-1`), true);

  await performAccountDeletion(NORTH);
  assert.equal(await userExists(NORTH), false);
  // ユーザーが既に居なくても、もう一度呼んで落ちない
  await performAccountDeletion(NORTH);
  assert.equal(await exists(`shops/${SOUTH}/shopSettings/main`), true);
  assert.equal(await userExists(SOUTH), true);
});

test("App Check は既定では強制せず、設定したときだけ拒否する", async () => {
  await wipe();
  await createUser(NORTH);
  await seedShop(NORTH, "架空の北口店");
  const previous = process.env.ENFORCE_APP_CHECK;
  process.env.ENFORCE_APP_CHECK = "true";
  try {
    await assert.rejects(
      () => deleteOwnAccount({ auth: { uid: NORTH, token: { auth_time: nowSec() } } }),
      (error: unknown) => error instanceof HttpsError && error.code === "failed-precondition",
    );
    assert.equal(await exists(`shops/${NORTH}/sessions/visit-1`), true);
    assert.equal(await userExists(NORTH), true);
  } finally {
    if (previous === undefined) delete process.env.ENFORCE_APP_CHECK;
    else process.env.ENFORCE_APP_CHECK = previous;
  }

  // トークンが無くても、強制していなければ消える（記録だけ）
  await deleteOwnAccount({ auth: { uid: NORTH, token: { auth_time: nowSec() } } });
  assert.equal(await exists(`shops/${NORTH}/sessions/visit-1`), false);
  assert.equal(await userExists(NORTH), false);
});
