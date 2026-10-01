import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { occupantOf, type Session } from '@table-check/core/domain';
import { GRID, PORTRAIT_GRID, rotateClockwise, SEATS } from '@table-check/core/layout';
import { COLORS } from './theme';
import { SeatCard } from './SeatCard';

interface Props {
  sessions: Session[];
  time: number;
  portrait: boolean;
  mini: boolean;
  picking: boolean;
  onSeat(tableId: string): void;
  onNext(session: Session): void;
  onOpen(session: Session, from: string): void;
  onPay(session: Session): void;
  toasts: ReactNode;   // 通知。フロア図の空き（横向きはカウンター上辺の右）に置く
}
interface Area { col: number; row: number; colSpan: number; rowSpan: number }
// Web の App.css と同じ飾りの位置（grid の列・行）。縦向きは時計回りに90°回した位置
const DECOR = {
  landscape: {
    counterLabel: { col: 1, row: 3, colSpan: 4, rowSpan: 4 },
    toasts: { col: 6, row: 2, colSpan: 10, rowSpan: 1 },
    // 線：行の上端（horizontal）か列の左端（vertical）に、間隔の半分だけずらして引く
    lines: [
      { dir: 'h', at: 2, from: 1, to: 15 }, { dir: 'h', at: 5, from: 7, to: 15 },
      { dir: 'v', at: 10, from: 2, to: 7 }, { dir: 'v', at: 13, from: 2, to: 7 },
    ],
  },
  portrait: {
    counterLabel: { col: 2, row: 1, colSpan: 4, rowSpan: 4 },
    toasts: { col: 1, row: 6, colSpan: 6, rowSpan: 1 },
    lines: [
      { dir: 'v', at: 7, from: 1, to: 15 }, { dir: 'v', at: 4, from: 7, to: 15 },
      { dir: 'h', at: 10, from: 1, to: 6 }, { dir: 'h', at: 13, from: 1, to: 6 },
    ],
  },
} as const;
// フロア図：Web と同じ 15列×7行（縦向きは 7列×15行）に卓を並べる
export function Floor({ sessions, time, portrait, mini, picking, onSeat, onNext, onOpen, onPay, toasts }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const grid = portrait ? PORTRAIT_GRID : GRID;
  const seats = portrait ? SEATS.map(rotateClockwise) : SEATS;
  const decor = portrait ? DECOR.portrait : DECOR.landscape;
  const gx = mini ? 4 : 6;
  const gy = mini ? 4 : portrait ? 6 : 12;
  const cellW = (size.width - gx * (grid.cols - 1)) / grid.cols;
  // スマホは3行（卓番・状態・タイマー）が読める高さを確保し、足りなければ縦にスクロール
  // 3行の行の高さ（13pt×3）と余白・枠で 48pt あれば足りる（SeatCard の mini の行の高さを変えたらここも合わせる）
  const cellH = Math.max(mini ? 48 : 0, (size.height - gy * (grid.rows - 1)) / grid.rows);
  const contentHeight = cellH * grid.rows + gy * (grid.rows - 1);
  const x = (col: number) => (col - 1) * (cellW + gx);
  const y = (row: number) => (row - 1) * (cellH + gy);
  const frame = (a: Area): ViewStyle => ({ left: x(a.col), top: y(a.row), width: a.colSpan * cellW + (a.colSpan - 1) * gx, height: a.rowSpan * cellH + (a.rowSpan - 1) * gy });
  const ready = size.width > 0 && size.height > 0;
  return (
    <View style={styles.floor} onLayout={event => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
      {ready && <ScrollView scrollEnabled={contentHeight > size.height + 1} contentContainerStyle={{ height: contentHeight }} showsVerticalScrollIndicator={false}>
        {decor.lines.map(line => <View key={`${line.dir}${line.at}`} pointerEvents="none" style={[styles.line, line.dir === 'h'
          ? { left: x(line.from), width: x(line.to + 1) - gx - x(line.from), top: y(line.at) - gy / 2, height: StyleSheet.hairlineWidth * 2 }
          : { top: y(line.from), height: y(line.to + 1) - gy - y(line.from), left: x(line.at) - gx / 2, width: StyleSheet.hairlineWidth * 2 }]} />)}
        <View pointerEvents="none" style={[styles.counterLabel, frame(decor.counterLabel)]}><Text style={styles.counterText}>カウンター</Text></View>
        {seats.map(seat => (
          <SeatCard key={seat.id} seat={seat} session={occupantOf(sessions, seat.id, time)} time={time} frame={frame(seat)}
            onSeat={onSeat} onNext={onNext} onOpen={onOpen} onPay={onPay} mini={mini} picking={picking} />
        ))}
        <View pointerEvents="box-none" style={[styles.toasts, frame(decor.toasts)]}>{toasts}</View>
      </ScrollView>}
    </View>
  );
}
const styles = StyleSheet.create({
  floor: { flex: 1 },
  line: { position: 'absolute', backgroundColor: COLORS.line },
  counterLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  counterText: { color: COLORS.muted, fontSize: 14 },
  toasts: { position: 'absolute', gap: 4 },
});
