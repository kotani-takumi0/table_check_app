import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { occupantOf, type Session } from '@table-check/core/domain';
import type { ShopSettings } from '@table-check/core/shopSettings';
import { GRID, PORTRAIT_GRID, rotateClockwise } from '@table-check/core/layout';
import { rotateLabelClockwise, type ShopLayout } from '@table-check/core/shopLayout';
import { COLORS } from './theme';
import { SeatCard } from './SeatCard';

interface Props {
  sessions: Session[];
  time: number;
  portrait: boolean;
  mini: boolean;
  picking: boolean;
  onSeat(tableId: string): void;
  onOpen(session: Session, from: string, at?: { x: number; y: number }): void;
  editingIds: Set<string>;   // ほかの端末で詳細を開いているお客さん（No.72）
  settings: ShopSettings;   // 店の設定（時間のルール・飲み放題の区分・コース。No.14・No.89・No.90）
  layout: ShopLayout;      // 席の配置（No.75。編集は設定 → 席の配置）
  toasts: ReactNode;   // 通知。フロア図の空き（横向きはカウンター上辺の右）に置く
}
interface Area { col: number; row: number; colSpan: number; rowSpan: number }
// Web の App.css と同じ通知の位置（grid の列・行）。縦向きは時計回りに90°回した位置（core の NOTICE_AREAS は空けてある）
const TOASTS = {
  landscape: { col: 6, row: 2, colSpan: 10, rowSpan: 1 },
  portrait: { col: 1, row: 6, colSpan: 6, rowSpan: 1 },
} as const;
// フロア図：Web と同じ 15列×7行（縦向きは 7列×15行）に卓を並べる
export function Floor({ sessions, time, editingIds, settings, layout, portrait, mini, picking, onSeat, onOpen, toasts }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const grid = portrait ? PORTRAIT_GRID : GRID;
  const seats = portrait ? layout.seats.map(rotateClockwise) : layout.seats;
  const labels = portrait ? layout.labels.map(rotateLabelClockwise) : layout.labels;
  const toastArea = portrait ? TOASTS.portrait : TOASTS.landscape;
  const gx = mini ? 4 : 6;
  const gy = mini ? 4 : portrait ? 6 : 12;
  const cellW = (size.width - gx * (grid.cols - 1)) / grid.cols;
  // スマホは3行（卓番・状態・タイマー）が読める高さを確保し、足りなければ縦にスクロール
  // 3行の行の高さ（13pt×3）と余白・枠で 48pt あれば足りる（SeatCard の mini の行の高さを変えたらここも合わせる）
  const cellH = Math.max(mini ? 48 : 0, (size.height - gy * (grid.rows - 1)) / grid.rows);
  const contentHeight = cellH * grid.rows + gy * (grid.rows - 1);
  const x = (col: number) => (col - 1) * (cellW + gx);
  const y = (row: number) => (row - 1) * (cellH + gy);
  const frame = (a: Area): ViewStyle & { width: number; height: number } => ({ left: x(a.col), top: y(a.row), width: a.colSpan * cellW + (a.colSpan - 1) * gx, height: a.rowSpan * cellH + (a.rowSpan - 1) * gy });
  const ready = size.width > 0 && size.height > 0;
  return (
    <View style={styles.floor} onLayout={event => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
      {ready && <ScrollView scrollEnabled={contentHeight > size.height + 1} contentContainerStyle={{ height: contentHeight }} showsVerticalScrollIndicator={false}>
        {labels.map((label, i) => <View key={i} pointerEvents="none" style={[styles.counterLabel, frame(label)]}><Text style={styles.counterText}>{label.text}</Text></View>)}
        {seats.map(seat => (
          <SeatCard key={seat.id} seat={seat} session={occupantOf(sessions, seat.id, time, settings)} time={time} frame={frame(seat)}
            editing={(() => { const occupant = occupantOf(sessions, seat.id, time, settings); return occupant !== undefined && editingIds.has(occupant.id); })()}
            onSeat={onSeat} onOpen={onOpen} settings={settings} mini={mini} picking={picking} />
        ))}
        <View pointerEvents="box-none" style={[styles.toasts, frame(toastArea)]}>{toasts}</View>
      </ScrollView>}
    </View>
  );
}
const styles = StyleSheet.create({
  floor: { flex: 1 },
  counterLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  counterText: { color: COLORS.muted, fontSize: 14 },
  toasts: { position: 'absolute', gap: 4 },
});
