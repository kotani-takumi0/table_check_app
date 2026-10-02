import { describe, expect, it } from 'vitest';
import { canReload, IDLE_BEFORE_RELOAD_MS, isOtherVersion, versionFromFile } from './appUpdate';

describe('versionFromFile', () => {
  it('version.json の version を v 付きで返す', () => {
    expect(versionFromFile({ version: '2.2.2' })).toBe('v2.2.2');
  });
  it('形が違えば null', () => {
    expect(versionFromFile(null)).toBeNull();
    expect(versionFromFile('2.2.2')).toBeNull();
    expect(versionFromFile({})).toBeNull();
    expect(versionFromFile({ version: 2 })).toBeNull();
    expect(versionFromFile({ version: '' })).toBeNull();
  });
});

describe('isOtherVersion', () => {
  it('サーバーの版が違えば読み込み直す（戻したときも）', () => {
    expect(isOtherVersion('v2.2.3', 'v2.2.2')).toBe(true);
    expect(isOtherVersion('v2.2.1', 'v2.2.2')).toBe(true);
  });
  it('同じ版か、確かめられなかったときは読み込み直さない', () => {
    expect(isOtherVersion('v2.2.2', 'v2.2.2')).toBe(false);
    expect(isOtherVersion(null, 'v2.2.2')).toBe(false);
  });
});

describe('canReload', () => {
  const idle = { busy: false, syncState: 'synced' as const, lastTouchAt: 0, now: IDLE_BEFORE_RELOAD_MS };
  it('何も開いておらず、送信済みで、1分さわっていなければ読み込み直す', () => {
    expect(canReload(idle)).toBe(true);
  });
  it('さわってから1分たっていなければ待つ', () => {
    expect(canReload({ ...idle, now: IDLE_BEFORE_RELOAD_MS - 1 })).toBe(false);
  });
  it('画面に戻ってきた直後は、さわった時刻を見ない', () => {
    expect(canReload({ ...idle, now: 1 }, true)).toBe(true);
  });
  it('詳細やダイアログを開いている間は読み込み直さない', () => {
    expect(canReload({ ...idle, busy: true })).toBe(false);
    expect(canReload({ ...idle, busy: true }, true)).toBe(false);
  });
  it('送信待ち・オフラインの間は読み込み直さない', () => {
    expect(canReload({ ...idle, syncState: 'pending' })).toBe(false);
    expect(canReload({ ...idle, syncState: 'offline' }, true)).toBe(false);
  });
});
