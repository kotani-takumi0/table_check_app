import { describe, expect, it } from 'vitest';
import { EDITING_FRESH_MS, editingSessionIds, NoEditingStore } from './editing';

describe('編集中の印', () => {
  it('新しい印だけを出す（端末が落ちて消せなかった古い印は出さない）', () => {
    const marks = [{ sessionId: 'a', at: 1000 }, { sessionId: 'b', at: 1000 - EDITING_FRESH_MS }, { sessionId: 'a', at: 500 }];
    expect([...editingSessionIds(marks, 1000 + EDITING_FRESH_MS - 1)]).toEqual(['a']);
    expect([...editingSessionIds(marks, 1000 + EDITING_FRESH_MS)]).toEqual([]);
  });
  it('Firebase につながないときは、ほかの端末の印は無い', () => {
    let seen: unknown = null;
    new NoEditingStore().subscribe(marks => { seen = marks; });
    expect(seen).toEqual([]);
  });
});
