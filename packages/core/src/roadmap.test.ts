import { describe, expect, it } from 'vitest';
import { ROADMAP, ROADMAP_DETAIL_MAX, ROADMAP_EMPTY, ROADMAP_STAGES, ROADMAP_TITLE_MAX, roadmapGroups, roadmapHasUnseen, roadmapSeenValue, shouldShowRoadmapDot } from './roadmap';

describe('ROADMAP', () => {
  it('出す予定を選ぶまでは空で、点を出さない', () => {
    expect(ROADMAP).toEqual([]);
    expect(roadmapGroups()).toEqual([]);
    expect(roadmapSeenValue()).toBe('');
    expect(shouldShowRoadmapDot(null)).toBe(false);
    expect(shouldShowRoadmapDot('')).toBe(false);
    expect(shouldShowRoadmapDot('old-plan')).toBe(false);
    expect(ROADMAP_EMPTY).toBe('いまお知らせできる予定はありません。使っていて気になることがあれば、ご意見を送ってください。');
  });
  it('足した予定は段階・長さの決まりを守り、日付や店や人の名前を持たない', () => {
    const stages = ROADMAP.map(item => item.stage);
    const preparing = stages.lastIndexOf('preparing');
    const considering = stages.indexOf('considering');
    if (preparing >= 0 && considering >= 0) expect(considering).toBeGreaterThan(preparing);
    for (const item of ROADMAP) {
      expect(ROADMAP_STAGES).toContain(item.stage);
      expect(Object.keys(item).sort()).toEqual(['detail', 'fromFeedback', 'id', 'stage', 'title']);
      expect(item.fromFeedback).toBeTypeOf('boolean');
      expect(item.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(item.title.endsWith('なります')).toBe(true);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.title.length).toBeLessThanOrEqual(ROADMAP_TITLE_MAX);
      expect(item.detail.length).toBeGreaterThan(0);
      expect(item.detail.length).toBeLessThanOrEqual(ROADMAP_DETAIL_MAX);
      expect(`${item.title}${item.detail}`).not.toMatch(/\d{4}年|\d+月\d+日|セキュリティ|脆弱/);
    }
    expect(new Set(ROADMAP.map(item => item.id)).size).toBe(ROADMAP.length);
    const groups = roadmapGroups();
    expect(groups.every(group => group.items.length > 0)).toBe(true);
    expect(groups.reduce((sum, group) => sum + group.items.length, 0)).toBe(ROADMAP.length);
  });
});

describe('roadmapHasUnseen', () => {
  const ids = ['overtime-seats', 'phone-seat-text'];
  it('予定が空なら点を出さない', () => {
    expect(roadmapHasUnseen([], null)).toBe(false);
    expect(roadmapHasUnseen([], '')).toBe(false);
  });
  it('まだ見ていない端末は点を出す', () => {
    expect(roadmapHasUnseen(ids, null)).toBe(true);
    expect(roadmapHasUnseen(ids, '')).toBe(true);
  });
  it('いまの予定を見たら出さない。新しい予定が足されたら出す', () => {
    expect(roadmapHasUnseen(ids, ids.join(','))).toBe(false);
    expect(roadmapHasUnseen(ids, 'phone-seat-text')).toBe(true);
    expect(roadmapHasUnseen(ids, `${ids.join(',')},old-plan`)).toBe(false);
  });
});
