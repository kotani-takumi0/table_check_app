import { describe, expect, it } from 'vitest';
import { loginErrorMessage, parseLoginMode, signUpErrorMessage, signUpProblem } from './auth';
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
describe('新規登録（No.094）', () => {
  it('登録の前に、メール・パスワードの長さ・確認用を確かめる', () => {
    expect(signUpProblem(' ', 'abcdef', 'abcdef')).toBe('メールアドレスを入れてください');
    expect(signUpProblem('a@b.jp', 'abcde', 'abcde')).toBe('パスワードは6文字以上にしてください');
    expect(signUpProblem('a@b.jp', 'abcdef', 'abcdeg')).toBe('パスワードが確認用と違います');
    expect(signUpProblem('a@b.jp', 'abcdef', 'abcdef')).toBe('');
  });
  it('作れなかった理由を、お店の人が読める言葉にする', () => {
    expect(signUpErrorMessage({ code: 'auth/email-already-in-use' })).toContain('ログインしてください');
    expect(signUpErrorMessage({ code: 'auth/invalid-email' })).toBe('メールアドレスの形が違います');
    expect(signUpErrorMessage({ code: 'auth/network-request-failed' })).toContain('インターネット');
    expect(signUpErrorMessage(new Error('x'))).toBe('アカウントを作れませんでした。もう一度ためしてください');
  });
});
