import { describe, expect, it } from 'vitest';
import { ROADMAP, ROADMAP_DETAIL_MAX, ROADMAP_STAGES, ROADMAP_TITLE_MAX, roadmapGroups, roadmapSeenValue, shouldShowRoadmapDot } from './roadmap';

describe('ROADMAP', () => {
  it('準備中が先、検討中があと。日付・店や人の名前は持たない', () => {
    const stages = ROADMAP.map(item => item.stage);
    const preparing = stages.lastIndexOf('preparing');
    const considering = stages.indexOf('considering');
    expect(preparing).toBeGreaterThanOrEqual(0);
    expect(considering).toBeGreaterThan(preparing);
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
  });
  it('段階ごとにまとまり、空の段階は出さない', () => {
    expect(roadmapGroups().map(group => group.stage)).toEqual(['preparing', 'considering']);
    const count = roadmapGroups().reduce((sum, group) => sum + group.items.length, 0);
    expect(count).toBe(ROADMAP.length);
  });
});

describe('shouldShowRoadmapDot', () => {
  it('まだ見ていない端末は点を出す', () => {
    expect(shouldShowRoadmapDot(null)).toBe(true);
    expect(shouldShowRoadmapDot('')).toBe(true);
  });
  it('いまの予定を見たら出さない。新しい予定が足されたら出す', () => {
    expect(shouldShowRoadmapDot(roadmapSeenValue())).toBe(false);
    const seen = new Set(roadmapSeenValue().split(','));
    const extra = [...seen].slice(1).join(',');
    expect(shouldShowRoadmapDot(extra)).toBe(true);
    expect(shouldShowRoadmapDot(`${roadmapSeenValue()},old-plan`)).toBe(false);
  });
});
