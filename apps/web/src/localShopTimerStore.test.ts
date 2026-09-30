import { describe, expect, it } from 'vitest';

describe('LocalShopTimerStore', () => {
  it('保存できなくても、このページでは両方の済を保つ', async () => {
    const { LocalShopTimerStore } = await import('./localShopTimerStore');
    const listeners: string[] = [];
    Object.assign(globalThis, { window: {
      localStorage: { getItem: () => null, setItem: () => { throw new Error('quota'); } },
      addEventListener: (type: string) => listeners.push(type), removeEventListener: () => undefined,
    } });
    const store = new LocalShopTimerStore();
    let latest = {};
    const stop = store.subscribe(done => { latest = done; });
    await store.markDone('toilet_check', 1);
    await store.markDone('toilet_clean', 2);
    expect(latest).toEqual({ toilet_check: 1, toilet_clean: 2 });
    stop();
    Reflect.deleteProperty(globalThis, 'window');
  });
  it('別タブが同時に別のタイマーを済にしても両方残る', async () => {
    const { LocalShopTimerStore } = await import('./localShopTimerStore');
    const storage = new Map<string, string>();
    Object.assign(globalThis, { window: {
      localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); } },
      addEventListener: () => undefined, removeEventListener: () => undefined,
    } });
    const tabA = new LocalShopTimerStore(), tabB = new LocalShopTimerStore();
    let latestA = {};
    tabA.subscribe(done => { latestA = done; });
    tabB.subscribe(() => undefined);
    await tabA.markDone('toilet_check', 1);
    await tabB.markDone('toilet_clean', 2);
    expect(new LocalShopTimerStore()['read']()).toEqual({ toilet_check: 1, toilet_clean: 2 });
    await tabA.markDone('toilet_check', 3);
    expect(latestA).toEqual({ toilet_check: 3, toilet_clean: 2 });
    Reflect.deleteProperty(globalThis, 'window');
  });
});
