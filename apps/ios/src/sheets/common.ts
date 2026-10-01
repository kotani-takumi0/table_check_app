import { StyleSheet } from 'react-native';
import { COLORS } from '../theme';

// シートの中で共通の見た目（Web の .panel・.time-row など）
export const sheet = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  rowLabel: { width: 56, fontSize: 15, color: COLORS.text },
  text: { fontSize: 15, color: COLORS.text },
  muted: { color: COLORS.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, flexBasis: 0, minWidth: 120 },
  message: { fontSize: 15, lineHeight: 24, color: COLORS.text },
  warning: { fontSize: 15, fontWeight: '700', color: COLORS.danger },
  question: { fontSize: 16, fontWeight: '700', color: COLORS.text },
});
