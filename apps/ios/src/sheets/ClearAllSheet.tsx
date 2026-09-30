import { Text, View } from 'react-native';
import { PanelButton } from '../ui';
import { feedback } from '../feedback';
import { sheet } from './common';

// 全卓消去の確認
export function ClearAllSheet({ unpaidTables, onConfirm, onClose }: { unpaidTables: number; onConfirm(): void; onClose(): void }) {
  return <>
    <Text style={sheet.title} accessibilityRole="header">全卓を消去しますか？</Text>
    <Text style={sheet.message}>すべての卓の案内・時刻・お会計の記録を消します。ほかの端末の画面からも消え、元に戻せません。</Text>
    {unpaidTables > 0 && <Text style={sheet.warning}>会計前の卓が {unpaidTables} 卓あります</Text>}
    <View style={sheet.actions}>
      <PanelButton label="やめる" onPress={onClose} style={sheet.action} />
      <PanelButton label="全卓を消去" tone="danger" onPress={() => { feedback.warn(); onConfirm(); onClose(); }} style={sheet.action} />
    </View>
  </>;
}
