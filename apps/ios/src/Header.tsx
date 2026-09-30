import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatClock } from '@table-check/core/domain';
import { SHOP_TIMERS, shopTimerState, type ShopTimerDone, type ShopTimerId } from '@table-check/core/shopTimers';
import type { SyncState } from '@table-check/core/store';
import { version } from '../../../package.json';
import { COLORS, mix, TABULAR } from './theme';

interface Props {
  time: number;
  syncState: SyncState;
  shopTimers: ShopTimerDone;
  onShopTimerOpen(id: ShopTimerId): void;
  canClearAll: boolean;
  onClearAll(): void;
  mini: boolean;
}
// Web の Header と同じ並び：トイレのタイマー／（同期状態）バージョン 時刻 全卓消去
export function Header({ time, syncState, shopTimers, onShopTimerOpen, canClearAll, onClearAll, mini }: Props) {
  return (
    <View style={[styles.header, mini && styles.miniHeader]}>
      <View style={styles.shopTimers}>
        {SHOP_TIMERS.map(timer => {
          // 画面の時刻は1秒ごとなので、済にした直後に周期を超えて見えないよう上限をかける
          const state = shopTimerState(timer.intervalMin, shopTimers[timer.id], time);
          const rest = state.due ? '時間です' : `あと${Math.min(timer.intervalMin, Math.ceil(state.remainingMs / 60_000))}分`;
          return (
            <Pressable key={timer.id} accessibilityRole="button" accessibilityLabel={`${timer.label} ${rest}（押すと詳細）`} onPress={() => onShopTimerOpen(timer.id)}
              style={({ pressed }) => [styles.chip, mini && styles.miniChip, state.due && styles.due, pressed && styles.pressed]}>
              <Text style={[styles.chipLabel, mini && styles.miniChipLabel, state.due && styles.dueLabel, TABULAR]} numberOfLines={1}>{timer.icon} {rest}</Text>
            </Pressable>
          );
        })}
      </View>
      {syncState !== 'synced' && <Text style={[styles.sync, { color: syncState === 'pending' ? COLORS.warning : COLORS.danger }]} numberOfLines={1}>
        {syncState === 'pending' ? '送信待ち' : 'オフライン（声かけに戻ってください）'}
      </Text>}
      {!mini && <Text style={[styles.version, syncState === 'synced' && styles.pushRight]}>v{version}</Text>}
      <Text style={[styles.clock, mini && syncState === 'synced' && styles.pushRight, TABULAR]}>{formatClock(time)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="全卓を消去（確認が出ます）" disabled={!canClearAll} onPress={onClearAll}
        style={({ pressed }) => [styles.clear, mini && styles.miniClear, !canClearAll && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.clearIcon}>🗑️</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniHeader: { height: 36, gap: 6 },
  shopTimers: { flexDirection: 'row', gap: 8, flexShrink: 1 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.line, borderRadius: 17, justifyContent: 'center' },
  miniChip: { minHeight: 28, paddingHorizontal: 8 },
  chipLabel: { fontSize: 13, color: COLORS.muted },
  miniChipLabel: { fontSize: 12 },
  due: { borderColor: COLORS.danger, backgroundColor: mix(COLORS.danger, 12) },
  dueLabel: { color: COLORS.danger, fontWeight: '700' },
  sync: { marginLeft: 'auto', fontSize: 12, flexShrink: 1 },
  version: { fontSize: 11, color: COLORS.muted, opacity: 0.8 },
  pushRight: { marginLeft: 'auto' },
  clock: { fontSize: 15, color: COLORS.muted },
  clear: { minWidth: 40, minHeight: 34, paddingHorizontal: 8, borderWidth: 1, borderColor: COLORS.line, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  miniClear: { minWidth: 36, minHeight: 28, paddingHorizontal: 6 },
  clearIcon: { fontSize: 15 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
