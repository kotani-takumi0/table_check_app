import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from './theme';
import { Glass } from './Glass';
import { feedback } from './feedback';
import { PanelButton } from './ui';

// 開発中（Expo Go）だけ出す「テスト用でログイン」。値は .env.development.local の EXPO_PUBLIC_TEST_LOGIN_*（リリースのビルドには入らない）
const TEST_LOGIN = __DEV__ && process.env.EXPO_PUBLIC_TEST_LOGIN_EMAIL && process.env.EXPO_PUBLIC_TEST_LOGIN_PASSWORD
  ? { email: process.env.EXPO_PUBLIC_TEST_LOGIN_EMAIL, password: process.env.EXPO_PUBLIC_TEST_LOGIN_PASSWORD } : null;

// 最初の画面（Web の LoginScreen と同じ。No.88）：ログインするか、ログインせずに今の店のデータで使うかを選ぶ。選んだ結果はこの端末で覚える
export function LoginScreen({ busy, error, onLogin, onGuest }: { busy: boolean; error: string; onLogin(email: string, password: string): void; onGuest(): void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Glass tint={0.84} style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">Minopal</Text>
          <View style={styles.form}>
            <Text style={styles.groupTitle}>ログイン</Text>
            <Text style={styles.label}>メールアドレス</Text>
            <TextInput accessibilityLabel="メールアドレス" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
              keyboardType="email-address" textContentType="username" autoComplete="email" />
            <Text style={styles.label}>パスワード</Text>
            <TextInput accessibilityLabel="パスワード" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="password"
              returnKeyType="go" onSubmitEditing={() => onLogin(email, password)} />
            {error !== '' && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
            <PanelButton label={busy ? 'ログインしています…' : 'ログイン'} tone="primary" disabled={busy} onPress={() => { feedback.tap(); onLogin(email, password); }} style={styles.button} />
            {TEST_LOGIN && <PanelButton label="テスト用でログイン（開発中だけ）" disabled={busy} onPress={() => onLogin(TEST_LOGIN.email, TEST_LOGIN.password)} style={styles.button} />}
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
});
