import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GRID } from '@table-check/core/layout';
import type { ShopLayout } from '@table-check/core/shopLayout';
import { BLANK_LAYOUT, SHOP_TEMPLATES, type ShopTemplate } from '@table-check/core/shopTemplates';
import { COLORS, useScreen } from './theme';
import { Glass } from './Glass';
import { feedback } from './feedback';
import { PanelButton } from './ui';
import { LayoutEditor } from './LayoutEditor';

// 最初のページ（Web の FirstPage と同じ。No.087）：ログインした店で、席の配置をまだ保存していなければ出す。
// テンプレートを選ぶと配置と設定一式を入れてすぐ使い始める。「自分で作る」は何もないマス目から配置を作る
export function FirstPage({ account, onTemplate, onBlank, onLeave }: { account: string; onTemplate(template: ShopTemplate): Promise<void>; onBlank(layout: ShopLayout): Promise<void>; onLeave(): void }) {
  const { portrait, mini } = useScreen();
  const [blank, setBlank] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (blank) return <LayoutEditor layout={BLANK_LAYOUT} occupied={new Set()} onSave={onBlank} onClose={() => setBlank(false)} top={16} portrait={portrait} mini={mini} />;
  const choose = (template: ShopTemplate) => {
    feedback.tap();
    setBusy(true);
    setError('');
    onTemplate(template).catch((reason: unknown) => { setError(`始められませんでした。もう一度押してください（${reason instanceof Error ? reason.message : '理由が分かりません'}）`); setBusy(false); });
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Glass tint={0.84} style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">お店の形を選んでください</Text>
        <Text style={styles.help}>選ぶと、席の配置とコース・飲み放題の区分・店のタイマー・時間のルールが入り、すぐに使えます。あとから設定でいつでも変えられます。</Text>
        <View style={[styles.list, !mini && styles.row]}>
          {SHOP_TEMPLATES.map(template => <Pressable key={template.id} accessibilityRole="button" accessibilityLabel={`${template.name}で始める`} disabled={busy} onPress={() => choose(template)}
            style={({ pressed }) => [styles.choice, !mini && styles.half, (pressed || busy) && styles.dim]}>
            <LayoutPreview layout={template.layout} />
            <Text style={styles.name}>{template.name}</Text>
            <Text style={styles.help}>{template.help}</Text>
          </Pressable>)}
          <Pressable accessibilityRole="button" accessibilityLabel="何もない状態から自分で作る" disabled={busy} onPress={() => { feedback.tap(); setBlank(true); }}
            style={({ pressed }) => [styles.choice, !mini && styles.half, (pressed || busy) && styles.dim]}>
            <View style={[styles.preview, styles.blank]}><Text style={styles.plus}>＋</Text></View>
            <Text style={styles.name}>何もない状態から自分で作る</Text>
            <Text style={styles.help}>マス目に卓を置いて配置を作ります。コース・区分・店のタイマーはあとから設定で足します。</Text>
          </Pressable>
        </View>
        {error !== '' && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
        <View style={styles.foot}>
          <Text style={[styles.help, styles.account]} numberOfLines={1}>{account} でログインしています</Text>
          <PanelButton label="ログアウト" disabled={busy} onPress={() => { feedback.tap(); onLeave(); }} style={styles.leave} />
        </View>
      </Glass>
    </ScrollView>
  );
}
// テンプレートの配置を小さく見せる（卓・目印の場所だけ）
function LayoutPreview({ layout }: { layout: ShopLayout }) {
  const [width, setWidth] = useState(0);
  const cell = width / GRID.cols;
  const frame = (box: { col: number; colSpan: number; row: number; rowSpan: number }) => ({ left: (box.col - 1) * cell + 1, top: (box.row - 1) * cell + 1, width: box.colSpan * cell - 2, height: box.rowSpan * cell - 2 });
  return <View style={styles.preview} onLayout={event => setWidth(event.nativeEvent.layout.width - 12)} accessible={false}>
    <View style={{ width, height: cell * GRID.rows }}>
      {width > 0 && layout.labels.map((label, i) => <View key={`l${i}`} style={[styles.mark, styles.label, frame(label)]} />)}
      {width > 0 && layout.seats.map(seat => <View key={seat.id} style={[styles.mark, seat.kind === 'counter' && styles.round, frame(seat)]} />)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 720, gap: 16, padding: 24, borderRadius: 24 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  help: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  list: { gap: 12 },
  row: { flexDirection: 'row' },
  choice: { gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface },
  half: { flex: 1 },
  dim: { opacity: 0.6 },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  preview: { aspectRatio: 15 / 10, padding: 6, borderRadius: 10, backgroundColor: COLORS.bg },
  blank: { alignItems: 'center', justifyContent: 'center' },
  plus: { fontSize: 28, color: COLORS.muted },
  mark: { position: 'absolute', borderRadius: 3, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.surface },
  round: { borderRadius: 99 },
  label: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  error: { fontSize: 15, fontWeight: '700', color: COLORS.nowText },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  account: { flex: 1 },
  leave: { minHeight: 44, paddingHorizontal: 20 },
});
