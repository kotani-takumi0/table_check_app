import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { arcPath, DIAL_BAND, DIAL_MIN, dialPoint, formatHourMinute, type Dial as DialValue } from '@table-check/core/dial';
import { COLORS, TABULAR } from './theme';

const C = 50, R = 44;
// 縁の12個の点（アイコンのトゲ）。10分ごと
const DOTS = Array.from({ length: 12 }, (_, i) => dialPoint(i / 12, C, C, R));
const BAND = arcPath(DIAL_BAND.fromMin / DIAL_MIN, DIAL_BAND.toMin / DIAL_MIN, C, C, R);
// 卓の文字盤（Web の Dial と同じ）：塗った丸の中に経過（時:分）。12時から時計回りに経過の弧が伸び、120分で一周する。
// 縁の 90〜120分（L.O.から退席まで）に淡い琥珀の帯。読み上げは「経過35分、L.O.まで55分」
export function Dial({ dial, label, size, face, arc }: { dial: DialValue; label: string; size: number; face: string; arc: string }) {
  const waiting = dial.elapsedMin === null;
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: DIAL_MIN, now: Math.min(dial.elapsedMin ?? 0, DIAL_MIN), text: label }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx={C} cy={C} r={R} fill={face} />
        <Path d={BAND} stroke={COLORS.dialBand} strokeWidth={5} fill="none" />
        {DOTS.map((dot, i) => <Circle key={i} cx={dot.x} cy={dot.y} r={1.8} fill={COLORS.dialDot} />)}
        {dial.progress > 0 && <Path d={arcPath(0, dial.progress, C, C, R)} stroke={arc} strokeWidth={5} strokeLinecap="round" fill="none" />}
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <Text style={[waiting ? styles.waiting : styles.time, { fontSize: size * (waiting ? 0.16 : 0.24) }, TABULAR]} numberOfLines={1}>
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
