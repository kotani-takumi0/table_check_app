import { describe, expect, it } from 'vitest';
import type { Session } from './domain';
import { MemorySessionStore, MemoryShopTimerStore } from './memoryStores';
import { isStoreProject } from './firebaseProjects';

const session = { id: 'a', tableIds: ['1'], status: 'seated', seatedAt: 1, otoshiAt: null, loDoneAt: null, exitedAt: null, paidAt: null, guests: null, course: null, menu: null, dishesServed: 0 } as Session;

describe('MemorySessionStore', () => {
  it('入れた・消したセッションを購読者に渡す', async () => {
    const store = new MemorySessionStore();
    const seen: Session[][] = [];
    store.subscribe(sessions => seen.push(sessions));
    await store.put(session);
    await store.put({ ...session, status: 'otoshi', otoshiAt: 2 });
    await store.remove('a');
    expect(seen.map(s => s.map(x => x.status))).toEqual([[], ['seated'], ['otoshi'], []]);
  });
});
describe('MemoryShopTimerStore', () => {
  it('古い「済」で新しい「済」を上書きしない', async () => {
    const store = new MemoryShopTimerStore();
    let done = {};
    store.subscribe(d => { done = d; });
    await store.markDone('toilet_check', 20);
    await store.markDone('toilet_check', 10);
    expect(done).toEqual({ toilet_check: 20 });
  });
});
describe('isStoreProject', () => {
  it('店が使っている table-check-dev だけを店のプロジェクトとみなす', () => {
    expect(isStoreProject('table-check-dev')).toBe(true);
    expect(isStoreProject('table-check-prod')).toBe(false);
    expect(isStoreProject(undefined)).toBe(false);
  });
});
