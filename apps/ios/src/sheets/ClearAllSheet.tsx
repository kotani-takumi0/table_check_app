import { Text, View } from 'react-native';
import { PanelButton } from '../ui';
import { feedback } from '../feedback';
import { sheet } from './common';

// 全卓消去の確認
export function ClearAllSheet({ unpaidTables, onConfirm, onClose }: { unpaidTables: number; onConfirm(): void; onClose(): void }) {
  return <>
    <Text style={[sheet.title, sheet.alertTitle]} accessibilityRole="header">全卓を消去しますか？</Text>
    <Text style={sheet.message}>すべての卓のお客さんを画面から消します。ほかの端末の画面からも消え、元に戻せません（記録には残り、書き出しで見られます）。</Text>
    {unpaidTables > 0 && <Text style={sheet.warning}>会計前の卓が {unpaidTables} 卓あります</Text>}
    <View style={sheet.actions}>
      <PanelButton label="やめる" onPress={onClose} style={sheet.action} />
      <PanelButton label="全卓を消去" tone="danger" onPress={() => { feedback.warn(); onConfirm(); onClose(); }} style={sheet.action} />
    </View>
  </>;
}
