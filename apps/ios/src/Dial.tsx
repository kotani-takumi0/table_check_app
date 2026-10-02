import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { arcPath, dialPoint, formatHourMinute, type Dial as DialValue } from '@table-check/core/dial';
import { COLORS, TABULAR } from './theme';

const C = 50, R = 44;
// 縁の12個の点（アイコンのトゲ）。10分ごと
const DOTS = Array.from({ length: 12 }, (_, i) => dialPoint(i / 12, C, C, R));
// 卓の文字盤（Web の Dial と同じ）：塗った丸の中に経過（時:分）。12時から時計回りに経過の弧が伸び、お席の時間（120分）で一周する。
// 縁の 90〜120分（L.O.から退席まで）に淡い琥珀の帯。読み上げは「経過35分、L.O.まで55分」
// band：帯の範囲（0〜1）。退店の時刻を決めた卓は core の bandOf でずらす。null は帯を出さない（カウンターの小さい文字盤・時間制限なし）
// textScale：中の時:分の大きさ（文字盤の直径に対する割合）。スマホの小さい文字盤では大きめにする
export function Dial({ dial, label, size, face, arc, band, textScale = 0.24 }: { dial: DialValue; label: string; size: number; face: string; arc: string; band: { from: number; to: number } | null; textScale?: number }) {
  const waiting = dial.elapsedMin === null;
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: dial.limitMin, now: Math.min(dial.elapsedMin ?? 0, dial.limitMin), text: label }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx={C} cy={C} r={R} fill={face} />
        {band && <Path d={arcPath(band.from, band.to, C, C, R)} stroke={COLORS.dialBand} strokeWidth={5} fill="none" />}
        {DOTS.map((dot, i) => <Circle key={i} cx={dot.x} cy={dot.y} r={1.8} fill={COLORS.dialDot} />)}
        {dial.progress > 0 && <Path d={arcPath(0, dial.progress, C, C, R)} stroke={arc} strokeWidth={5} strokeLinecap="round" fill="none" />}
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <Text style={[waiting ? styles.waiting : styles.time, { fontSize: size * (waiting ? textScale * 2 / 3 : textScale) }, TABULAR]} numberOfLines={1}>
            {waiting ? '開始前' : formatHourMinute(dial.elapsedMin ?? 0)}
          </Text>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  time: { fontWeight: '700', color: COLORS.text },
  waiting: { fontWeight: '700', color: COLORS.muted },
});
