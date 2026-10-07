import { describe, expect, it } from 'vitest';
import { FEEDBACK_MAX, feedbackText, NoFeedbackStore } from './feedback';

describe('feedbackText', () => {
  it('前後の空白を落とす', () => {
    expect(feedbackText('  ボタンが小さい\n')).toBe('ボタンが小さい');
  });
  it('空・空白だけは送らない', () => {
    expect(feedbackText('')).toBeNull();
    expect(feedbackText(' \n\t ')).toBeNull();
  });
  it('長さはルールと同じ上限まで', () => {
    expect(feedbackText('あ'.repeat(FEEDBACK_MAX))).toHaveLength(FEEDBACK_MAX);
    expect(feedbackText('あ'.repeat(FEEDBACK_MAX + 1))).toBeNull();
  });
});

describe('NoFeedbackStore', () => {
  it('試しはどこにも送らない', async () => {
    const store = new NoFeedbackStore();
    expect(store.delivers).toBe(false);
    await expect(store.send({ message: 'x', version: 'v2.3.4', platform: 'web', shopName: '' })).resolves.toBe('sent');
  });
});
