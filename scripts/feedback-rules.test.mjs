// ご意見の連続送信（セキュリティ強化）を、ローカルの Firestore エミュレータだけで確かめる。
// プロジェクトは demo- なので、本番や開発の Firebase にはつながない。
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-minopal',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
});

function feedbackBody() {
  return {
    message: 'ボタンが小さい',
    version: 'v2.4.2',
    platform: 'web',
    shopName: '',
    shop: null,
    createdAt: serverTimestamp(),
  };
}
function sendBatch(db, uid, ticket) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'feedbackPace', uid), { lastAt: serverTimestamp(), ticket });
  batch.set(doc(db, 'feedback', `${uid}_${ticket}`), feedbackBody());
  return batch.commit();
}

const uid = 'alice';
const ticket = 'a'.repeat(16);
try {
  await testEnv.clearFirestore();
  const db = testEnv.authenticatedContext(uid).firestore();
  await assertSucceeds(sendBatch(db, uid, ticket));
  await assertFails(sendBatch(db, uid, 'b'.repeat(16)));
  await assertFails(setDoc(doc(db, 'feedback', `${uid}_${'c'.repeat(16)}`), feedbackBody()));
  await assertFails(setDoc(doc(db, 'feedback', 'autoId1234567890'), feedbackBody()));
  await assertFails(getDoc(doc(db, 'feedback', `${uid}_${ticket}`)));
  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(sendBatch(anon, uid, 'd'.repeat(16)));
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'feedbackPace', uid), {
      lastAt: Timestamp.fromMillis(Date.now() - 60_000),
      ticket: 'z'.repeat(16),
    });
  });
  await assertSucceeds(sendBatch(testEnv.authenticatedContext(uid).firestore(), uid, 'e'.repeat(16)));
  console.log('feedback rules: ok');
} finally {
  await testEnv.cleanup();
}
