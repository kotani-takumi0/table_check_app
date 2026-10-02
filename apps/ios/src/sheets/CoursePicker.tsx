import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COURSE_LABEL, COURSES, type Course } from '@table-check/core/domain';
import { COLORS } from '../theme';
import { feedback } from '../feedback';

const OPTIONS: { value: Course | null; sub: string | null }[] = [
  { value: null, sub: null },
  ...COURSES.map(course => ({ value: course, sub: course === 'premium_drinks' ? 'プレミアム' : COURSE_LABEL[course] })),
];
// 通常とコース（飲み放題の区分ごと）の4つから1つ選ぶ。選んでいるものは操作の緑で囲む
export function CoursePicker({ value, onChange }: { value: Course | null; onChange(course: Course | null): void }) {
  return (
    <View style={styles.picker} accessibilityRole="radiogroup">
      {OPTIONS.map(option => {
        const selected = value === option.value;
        return (
          <Pressable key={option.value ?? 'normal'} accessibilityRole="radio" accessibilityState={{ selected }}
            accessibilityLabel={option.value === null ? '通常' : `コース（${COURSE_LABEL[option.value]}）`}
            onPress={() => { feedback.tap(); onChange(option.value); }}
            style={({ pressed }) => [styles.option, selected && styles.selectedOption, pressed && styles.pressed]}>
            <Text style={[styles.label, selected && styles.selected]}>{option.value === null ? '通常' : 'コース'}</Text>
            {option.sub && <Text style={[styles.sub, selected && styles.selected]} numberOfLines={1} adjustsFontSizeToFit>{option.sub}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  picker: { flexDirection: 'row', gap: 8, flex: 1 },
  option: { flex: 1, minHeight: 50, paddingHorizontal: 2, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  selectedOption: { borderWidth: 2, borderColor: COLORS.action, backgroundColor: COLORS.actionBg },
  label: { fontSize: 14, color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.text },
  selected: { fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
