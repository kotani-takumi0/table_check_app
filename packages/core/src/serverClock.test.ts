import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { now, setServerOffset } from './clock';
import { estimateOffset, startServerClock, type KeyValueStorage } from './serverClock';

// サーバーの時刻は、端末の時計より 1000ms 進んでいることにする
const server = vi.hoisted(() => ({ ahead: 1000, write: (): Promise<void> => Promise.resolve() }));
vi.mock('firebase/firestore', () => {
  class Timestamp {
    constructor(private ms: number) {}
    toMillis() { return this.ms; }
  }
  return {
    Timestamp,
    doc: () => ({}),
    serverTimestamp: () => null,
    setDoc: () => server.write(),
    getDocFromServer: async () => ({ data: () => ({ at: new Timestamp(Date.now() + server.ahead) }) }),
  };
});
const db = {} as Firestore;
const offset = () => now() - Date.now();
// 読み書きの Promise を先に進める
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
let stop: () => void = () => undefined;
beforeEach(() => {
  // 端末の時計を止めて、往復の時間で時差がずれないようにする
  vi.spyOn(Date, 'now').mockReturnValue(10_000);
  setServerOffset(0);
  server.write = () => Promise.resolve();
});
afterEach(() => { stop(); vi.restoreAllMocks(); });

it.each([
  [1000, 1200, 5000, 3900],
  [0, 0, 0, 0],
  [1000, 1200, 500, -600],
  [1000, 1201, 5000, 3900],
])('estimateOffset(%i, %i, %i) = %i', (sentAt, receivedAt, serverAt, expected) => {
  expect(estimateOffset(sentAt, receivedAt, serverAt)).toBe(expected);
});
it('保存してあった時差を、測り終える前から使う', () => {
  server.write = () => new Promise(() => undefined);
  stop = startServerClock(db, 'u', { getItem: () => '500', setItem: () => undefined });
  expect(offset()).toBe(500);
});
it('非同期の保存先から読んだ時差も使う', async () => {
  server.write = () => new Promise(() => undefined);
  stop = startServerClock(db, 'u', { getItem: async () => '500', setItem: async () => undefined });
  await flush();
  expect(offset()).toBe(500);
});
it('測った時差を保存し、あとから届いた古い値で上書きしない', async () => {
  let resolveSaved: (value: string) => void = () => undefined;
  const saved: KeyValueStorage = {
    getItem: () => new Promise(resolve => { resolveSaved = resolve; }),
    setItem: vi.fn(async () => undefined),
  };
  stop = startServerClock(db, 'u', saved);
  await flush();
  expect(saved.setItem).toHaveBeenCalledWith('table-check:offset', '1000');
  resolveSaved('500');
  await flush();
  expect(offset()).toBe(1000);
});
it('保存先が使えなくても時差を測る', async () => {
  const broken: KeyValueStorage = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('quota'); },
  };
  stop = startServerClock(db, 'u', broken);
  await flush();
  expect(offset()).toBe(1000);
});
