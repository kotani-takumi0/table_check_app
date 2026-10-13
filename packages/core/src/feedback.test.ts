import { describe, expect, it } from 'vitest';
import { FEEDBACK_INTERVAL_MS, FEEDBACK_MAX, FEEDBACK_TICKET_RE, FEEDBACK_UNCONFIRMED_MESSAGE, feedbackAccepted, feedbackArrival, feedbackCooldownMs, feedbackDocId, feedbackOnReject, feedbackShopSwitch, feedbackText, feedbackTicket, feedbackWaitNote, NoFeedbackStore } from './feedback';

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

describe('feedback の間隔', () => {
  it('印はルールと同じ16文字で、文書 id は uid と印をつなぐ', () => {
    const ticket = feedbackTicket(() => 0);
    expect(ticket).toBe('a'.repeat(16));
    expect(FEEDBACK_TICKET_RE.test(ticket)).toBe(true);
    expect(feedbackDocId('shopUid', ticket)).toBe(`shopUid_${ticket}`);
  });
  it('送った直後は待てて、間隔のあとは送れる', () => {
    expect(feedbackCooldownMs(null, 1_000)).toBe(0);
    expect(feedbackCooldownMs(1_000, 1_000)).toBe(FEEDBACK_INTERVAL_MS + 1_000);
    expect(feedbackCooldownMs(1_000, 1_000 + FEEDBACK_INTERVAL_MS + 1_000)).toBe(0);
  });
  it('間隔は30秒（firestore.rules の duration.value(30, \'s\') と同じ）', () => {
    expect(FEEDBACK_INTERVAL_MS).toBe(30_000);
    expect(FEEDBACK_MAX).toBe(1000);
  });
  it('受け取ったと確かめるまで、下書きは消さない', () => {
    expect(feedbackAccepted('sent')).toBe(true);
    expect(feedbackAccepted('queued')).toBe(false);
    expect(FEEDBACK_UNCONFIRMED_MESSAGE).toBe('届いたか確かめています。送り直さなくて大丈夫です。');
  });
  it('確かめている途中で店が替わったら、下書きは消え押せない状態は解ける', () => {
    expect(feedbackShopSwitch('shop-a', 'トイレが押しにくい', 'shop-b')).toEqual({ shop: 'shop-b', draft: '', checking: false });
    expect(feedbackShopSwitch('shop-a', 'トイレが押しにくい', 'shop-a')).toEqual({ shop: 'shop-a', draft: 'トイレが押しにくい', checking: false });
  });
  it('前の店の分が届いても、いまの店には送りましたを出さず待ちだけ始める', () => {
    expect(feedbackArrival('shop-a', 'shop-b')).toEqual({ showSent: false, startWait: true });
    expect(feedbackArrival('shop-a', 'shop-a')).toEqual({ showSent: true, startWait: true });
    expect(feedbackWaitNote(12)).toBe('続けて送るには少し待ってください（あと12秒）');
  });
  it('画面を離れたあとに断られても、待ちを先に記録する', () => {
    expect(feedbackOnReject(false)).toEqual({ remember: true, showMessage: false });
    expect(feedbackOnReject(true)).toEqual({ remember: true, showMessage: true });
  });
});

describe('NoFeedbackStore', () => {
  it('試しはどこにも送らない', async () => {
    const store = new NoFeedbackStore();
    expect(store.delivers).toBe(false);
    await expect(store.send({ message: 'x', version: 'v2.3.4', platform: 'web', shopName: '' })).resolves.toMatchObject({ delivery: 'sent' });
  });
});
