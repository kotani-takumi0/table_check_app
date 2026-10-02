import { describe, expect, it } from 'vitest';
import { loginErrorMessage, parseLoginMode } from './auth';
import { accountBase, GUEST_BASE, shopPath } from './shopPath';

describe('ログイン（No.88）', () => {
  it('端末で覚えた使い方を読む（壊れた値は未選択）', () => {
    expect(parseLoginMode('guest')).toBe('guest');
    expect(parseLoginMode('account')).toBe('account');
    for (const bad of [null, '', 'admin']) expect(parseLoginMode(bad)).toBeNull();
  });
  it('ログインできなかった理由をお店の人の言葉にする', () => {
    expect(loginErrorMessage({ code: 'auth/invalid-credential' })).toBe('メールアドレスかパスワードが違います');
    expect(loginErrorMessage({ code: 'auth/network-request-failed' })).toContain('インターネット');
    expect(loginErrorMessage(new Error('x'))).toBe('ログインできませんでした。もう一度ためしてください');
  });
  it('今の店はいちばん上、ログインした店は shops/{uid}/ の下に置く', () => {
    expect(shopPath(GUEST_BASE, 'sessions')).toBe('sessions');
    expect(shopPath(accountBase('abc'), 'sessions')).toBe('shops/abc/sessions');
  });
});
