import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from './theme';
import { Glass } from './Glass';
import { feedback } from './feedback';
import { PanelButton } from './ui';
import { PASSWORD_MIN, signUpProblem } from '@table-check/core/auth';

// 開発中（Expo Go）だけ出す「テスト用でログイン」。値は .env.development.local の EXPO_PUBLIC_TEST_LOGIN_*（リリースのビルドには入らない）
const TEST_LOGIN = __DEV__ && process.env.EXPO_PUBLIC_TEST_LOGIN_EMAIL && process.env.EXPO_PUBLIC_TEST_LOGIN_PASSWORD
  ? { email: process.env.EXPO_PUBLIC_TEST_LOGIN_EMAIL, password: process.env.EXPO_PUBLIC_TEST_LOGIN_PASSWORD } : null;

// 最初の画面（Web の LoginScreen と同じ。No.88）：ログインするか、ログインせずに今の店のデータで使うかを選ぶ。選んだ結果はこの端末で覚える。
// はじめての店はここでアカウントを作る（No.094）。作るとそのままログインし、最初のページ（No.087）に進む
export function LoginScreen({ busy, error, onLogin, onSignUp, onGuest }: { busy: boolean; error: string; onLogin(email: string, password: string): void; onSignUp(email: string, password: string): void; onGuest(): void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState('');
  const signup = mode === 'signup';
  const shown = problem || error;
  const submit = () => {
    feedback.tap();
    if (!signup) { onLogin(email, password); return; }
    const found = signUpProblem(email, password, confirm);
    setProblem(found);
    if (!found) onSignUp(email, password);
  };
  const switchMode = () => { feedback.tap(); setMode(signup ? 'login' : 'signup'); setProblem(''); setConfirm(''); };
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Glass tint={0.84} style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">Minopal</Text>
          <View style={styles.form}>
            <Text style={styles.groupTitle}>{signup ? 'アカウントを作る' : 'ログイン'}</Text>
            <Text style={styles.label}>メールアドレス</Text>
            <TextInput accessibilityLabel="メールアドレス" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
              keyboardType="email-address" textContentType={signup ? 'emailAddress' : 'username'} autoComplete="email" />
            <Text style={styles.label}>パスワード{signup && `（${PASSWORD_MIN}文字以上）`}</Text>
            <TextInput accessibilityLabel="パスワード" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry textContentType={signup ? 'newPassword' : 'password'}
              autoComplete={signup ? 'new-password' : 'password'} returnKeyType={signup ? 'next' : 'go'} onSubmitEditing={signup ? undefined : submit} />
            {signup && <>
              <Text style={styles.label}>パスワード（確認のため、もう一度）</Text>
              <TextInput accessibilityLabel="パスワード（確認）" style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry textContentType="newPassword" autoComplete="new-password"
                returnKeyType="go" onSubmitEditing={submit} />
            </>}
            {shown !== '' && <Text style={styles.error} accessibilityRole="alert">{shown}</Text>}
            <PanelButton label={signup ? busy ? 'アカウントを作っています…' : 'アカウントを作る' : busy ? 'ログインしています…' : 'ログイン'} tone="primary" disabled={busy} onPress={submit} style={styles.button} />
            <View style={styles.switchRow}>
              <Text style={styles.help}>{signup ? 'アカウントがある店は' : 'はじめての店は'}</Text>
              <Pressable accessibilityRole="button" disabled={busy} onPress={switchMode} hitSlop={10}><Text style={styles.link}>{signup ? 'ログイン' : 'アカウントを作る'}</Text></Pressable>
            </View>
            {TEST_LOGIN && !signup && <PanelButton label="テスト用でログイン（開発中だけ）" disabled={busy} onPress={() => onLogin(TEST_LOGIN.email, TEST_LOGIN.password)} style={styles.button} />}
          </View>
          <View style={styles.guest}>
            <PanelButton label="ログインせずに使う" disabled={busy} onPress={() => { feedback.tap(); onGuest(); }} style={styles.button} />
            <Text style={styles.help}>今の店（ログインなしで使っている店）のデータで使います。</Text>
          </View>
        </Glass>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 420, gap: 20, padding: 24, borderRadius: 24 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  form: { gap: 8 },
  groupTitle: { fontSize: 14, fontWeight: '700', color: COLORS.muted },
  label: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  input: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 12, backgroundColor: COLORS.bg, fontSize: 16, color: COLORS.text },
  error: { fontSize: 15, fontWeight: '700', color: COLORS.nowText },
  button: { minHeight: 48, marginTop: 4 },
  guest: { gap: 6, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  help: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', gap: 4, marginTop: 8 },
  link: { fontSize: 14, fontWeight: '700', color: COLORS.actionText, textDecorationLine: 'underline' },
});
