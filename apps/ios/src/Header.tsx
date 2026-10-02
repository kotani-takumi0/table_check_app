import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatClock } from '@table-check/core/domain';
import { SHOP_TIMERS, shopTimerState, type ShopTimerDone, type ShopTimerId } from '@table-check/core/shopTimers';
import type { SyncState } from '@table-check/core/store';
import { version } from '../../../package.json';
import { COLORS, FILL, TABULAR } from './theme';
import { Glass } from './Glass';
import { CactusClock } from './CactusClock';
import Svg, { Path, Rect } from 'react-native-svg';

interface Props {
  time: number;
  syncState: SyncState;
  shopTimers: ShopTimerDone;
  onShopTimerOpen(id: ShopTimerId): void;
  canClearAll: boolean;
  onClearAll(): void;
  mini: boolean;
  listOpen: boolean;   // 全卓一覧を開いているか
  onToggleList(): void;
}
// フロアの上に浮かぶツールバー（Web の Header と同じ並び）：左に「一覧」とトイレのタイマー、右に（同期状態）バージョン・サボテンの時計の印・時刻・全卓消去
export function Header({ time, syncState, shopTimers, onShopTimerOpen, canClearAll, onClearAll, mini, listOpen, onToggleList }: Props) {
  return (
    <View style={[styles.toolbar, mini && styles.miniToolbar]} pointerEvents="box-none">
      <Glass interactive style={[styles.group, styles.listGroup, mini && styles.miniGroup]}>
        <Pressable accessibilityRole="button" accessibilityLabel="全卓一覧" accessibilityState={{ expanded: listOpen }} onPress={onToggleList}
          style={({ pressed }) => [styles.listToggle, mini && styles.miniListToggle, listOpen && styles.listToggleOpen, pressed && styles.pressed]}>
          {/* よく使う操作はアイコンにする（iOS 26：同じカプセルの中で文字とアイコンを混ぜない） */}
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={listOpen ? COLORS.actionText : COLORS.text} strokeWidth={1.8} strokeLinecap="round" accessible={false}>
            <Rect x={3} y={4} width={18} height={16} rx={4} /><Path d="M9 4v16M5.5 8.5h1M5.5 12h1M5.5 15.5h1" />
          </Svg>
        </Pressable>
      </Glass>
      <Glass interactive style={[styles.group, styles.shopTimers, mini && styles.miniGroup]}>
        {SHOP_TIMERS.map(timer => {
          // 画面の時刻は1秒ごとなので、済にした直後に周期を超えて見えないよう上限をかける
          const state = shopTimerState(timer.intervalMin, shopTimers[timer.id], time);
          const rest = state.due ? '時間です' : `あと${Math.min(timer.intervalMin, Math.ceil(state.remainingMs / 60_000))}分`;
          return (
            <Pressable key={timer.id} accessibilityRole="button" accessibilityLabel={`${timer.label} ${rest}（押すと詳細）`} onPress={() => onShopTimerOpen(timer.id)}
              style={({ pressed }) => [styles.chip, mini && styles.miniChip, state.due && styles.due, pressed && styles.pressed]}>
              <Text style={[styles.chipLabel, mini && styles.miniChipLabel, state.due && styles.dueLabel, TABULAR]} numberOfLines={1} ellipsizeMode="tail">{timer.icon} {rest}</Text>
            </Pressable>
          );
        })}
      </Glass>
      <Glass interactive style={[styles.group, styles.right, mini && styles.miniGroup]}>
        {syncState !== 'synced' && <Text style={[styles.sync, { color: syncState === 'pending' ? COLORS.soonText : COLORS.nowText }]} numberOfLines={1}>
          {syncState === 'pending' ? '送信待ち' : 'オフライン（声かけに戻ってください）'}
        </Text>}
        {!mini && <Text style={styles.version}>v{version}</Text>}
        <CactusClock time={time} size={mini ? 18 : 22} />
        <Text style={[styles.clock, mini && styles.miniClock, TABULAR]}>{formatClock(time)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="全卓を消去（確認が出ます）" disabled={!canClearAll} onPress={onClearAll}
          style={({ pressed }) => [styles.clear, mini && styles.miniClear, !canClearAll && styles.disabled, pressed && styles.pressed]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={COLORS.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
            <Path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" />
          </Svg>
        </Pressable>
      </Glass>
    </View>
  );
}
// ツールバーの高さ（フロアはこの下に少しもぐらせる。App の FLOOR_TOP）
export const TOOLBAR_HEIGHT = { regular: 48, mini: 40 } as const;
const styles = StyleSheet.create({
  toolbar: { position: 'absolute', zIndex: 5, top: 0, left: 0, right: 0, height: TOOLBAR_HEIGHT.regular, flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniToolbar: { height: TOOLBAR_HEIGHT.mini, gap: 6 },
  group: { height: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, borderRadius: 24 },
  miniGroup: { gap: 4, paddingHorizontal: 4, borderRadius: 20 },
  shopTimers: { flexShrink: 1, minWidth: 0 },
  listGroup: { flexShrink: 0 },
  listToggle: { minWidth: 36, minHeight: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  miniListToggle: { minWidth: 30, minHeight: 30, borderRadius: 15 },
  listToggleOpen: { backgroundColor: COLORS.actionBg },
  // 狭い画面でオフラインの長い文言が出ても、右のまとまりは60%までに縮め、文言を省略してトイレのボタンの場所を残す
  right: { marginLeft: 'auto', flexShrink: 1, minWidth: 0, maxWidth: '60%', gap: 10, paddingLeft: 14 },
  // 幅が足りないときはチップごと縮め、文字を省略する（Web の .shop-timer と同じ）
  chip: { flexShrink: 1, minWidth: 0, minHeight: 36, paddingHorizontal: 12, borderWidth: 1, borderColor: 'transparent', borderRadius: 18, backgroundColor: FILL, justifyContent: 'center' },
  miniChip: { minHeight: 30, paddingHorizontal: 8 },
  chipLabel: { fontSize: 13, color: COLORS.muted },
  miniChipLabel: { fontSize: 12 },
  due: { borderColor: COLORS.now, backgroundColor: COLORS.nowBg },
  dueLabel: { color: COLORS.nowText, fontWeight: '700' },
  sync: { fontSize: 12, flexShrink: 1 },
  version: { flexShrink: 0, fontSize: 11, color: COLORS.muted, opacity: 0.8 },
  clock: { flexShrink: 0, fontSize: 17, fontWeight: '500', color: COLORS.text },
  miniClock: { fontSize: 14 },
  clear: { flexShrink: 0, minWidth: 36, minHeight: 36, borderRadius: 18, backgroundColor: FILL, alignItems: 'center', justifyContent: 'center' },
  miniClear: { minWidth: 30, minHeight: 30, borderRadius: 15 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
