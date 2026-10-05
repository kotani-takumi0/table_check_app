import { StyleSheet, Text, View } from 'react-native';
import { formatClock } from '@table-check/core/domain';
import { CloseButton, PanelButton } from '../ui';
import { feedback } from '../feedback';
import { sheet } from './common';
import { ShopTimerGlyph } from '../ShopTimerGlyph';
import { COLORS } from '../theme';

// ヘッダーのトイレタイマーの詳細。押しただけでリセットしないよう、ここで「済にしてリセット」を押す
export function ShopTimerSheet({ label, icon, doneAt, onReset, onClose }: { label: string; icon: string; doneAt: number | undefined; onReset(): void; onClose(): void }) {
  return <>
    <View style={styles.title}>
      <ShopTimerGlyph icon={icon} size={24} color={COLORS.text} />
      <Text style={[sheet.title, sheet.alertTitle, styles.titleText]} accessibilityRole="header">{label}</Text>
    </View>
    <View style={sheet.row}>
      <Text style={sheet.rowLabel}>前回</Text>
      <Text style={[sheet.text, doneAt === undefined && sheet.muted]}>{doneAt === undefined ? 'まだ済にしていません' : `${formatClock(doneAt)} に済`}</Text>
    </View>
    <View style={sheet.actions}>
      <PanelButton label="済にしてリセット" tone="primary" onPress={() => { feedback.done(); onReset(); onClose(); }} style={sheet.action} />
    </View>
    <CloseButton onPress={onClose} />
  </>;
}

// 題：アイコン＋名前（右上の × と重ならないよう、余白は題の文字に付けたまま）
const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleText: { flexShrink: 1 },
});
