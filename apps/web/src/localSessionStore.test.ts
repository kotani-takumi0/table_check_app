import { describe, expect, it } from 'vitest';
import { newSession } from '@table-check/core/domain';
import { closeOuts } from '@table-check/core/closing';

describe('LocalSessionStore', () => {
  it('閉店で退店にした卓を続けて書いても、前に書いた卓が消えない（No.129）', async () => {
    const { LocalSessionStore } = await import('./localSessionStore');
    const storage = new Map<string, string>();
    Object.assign(globalThis, { window: {
      localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); } },
      addEventListener: () => undefined, removeEventListener: () => undefined,
    } });
    const store = new LocalSessionStore();
    const seatedAt = new Date(2026, 9, 3, 20).getTime();
    const closed = closeOuts([newSession('a', '12', seatedAt), newSession('b', '13', seatedAt)], new Date(2026, 9, 3, 23).getTime(), 23 * 60);
    for (const session of closed) await store.put(session);
    let latest: unknown[] = [];
    const stop = store.subscribe(sessions => { latest = sessions; });
    expect(latest).toEqual(closed);
    stop();
    Reflect.deleteProperty(globalThis, 'window');
  });
});
