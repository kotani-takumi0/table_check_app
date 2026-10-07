import { describe, expect, it } from 'vitest';
import { version } from '../../../package.json';
import { RELEASE_NOTES, releaseDateLabel, releaseNoteOf, shouldAnnounce } from './releaseNotes';

const parts = (v: string) => v.split('.').map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

describe('RELEASE_NOTES', () => {
  it('今の版（package.json）のお知らせがある。版を上げたら書き足す', () => {
    expect(releaseNoteOf(version)).toBeDefined();
  });
  it('新しい版から順に並び、同じ版が2つ無い', () => {
    RELEASE_NOTES.slice(1).forEach((note, i) => expect(newer(RELEASE_NOTES[i].version, note.version)).toBe(true));
  });
  it('どの版も日付と1つ以上の項目がある', () => {
    for (const note of RELEASE_NOTES) {
      expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(note.items.length).toBeGreaterThan(0);
      note.items.forEach(item => expect(item.trim()).not.toBe(''));
    }
  });
});

describe('releaseNoteOf', () => {
  it('v付きでも引ける', () => {
    expect(releaseNoteOf('v2.3.3')?.version).toBe('2.3.3');
    expect(releaseNoteOf('2.3.3')?.version).toBe('2.3.3');
    expect(releaseNoteOf('v9.9.9')).toBeUndefined();
  });
});

describe('shouldAnnounce', () => {
  it('まだ見ていない版なら出す（この機能の前から使っている端末も1回出す）', () => {
    expect(shouldAnnounce(null, 'v2.3.3')).toBe(true);
    expect(shouldAnnounce('2.3.2', 'v2.3.3')).toBe(true);
  });
  it('見た版なら出さない', () => {
    expect(shouldAnnounce('2.3.3', 'v2.3.3')).toBe(false);
  });
  it('お知らせの無い版では出さない', () => {
    expect(shouldAnnounce(null, 'v9.9.9')).toBe(false);
  });
});

describe('releaseDateLabel', () => {
  it('年月日にする', () => {
    expect(releaseDateLabel('2026-10-07')).toBe('2026年10月7日');
  });
});
