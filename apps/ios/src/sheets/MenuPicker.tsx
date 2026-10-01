import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COURSE_MENUS, priceLabel } from '@table-check/core/courseMenus';
import { COLORS, mix } from '../theme';
import { feedback } from '../feedback';

const OPTIONS: { value: string | null; label: string; sub: string | null; name: string }[] = [
  { value: null, label: '未定', sub: null, name: '未定' },
  ...COURSE_MENUS.map(menu => ({ value: menu.id, label: priceLabel(menu), sub: menu.short, name: `${priceLabel(menu)} ${menu.name}` })),
];
// どのコースか（料理のメニュー）を選ぶ（Web の MenuPicker と同じ）。値段を大きく出し、同じ値段のコースは名前で見分ける。
// 任意なので「未定」のままでもよい
export function MenuPicker({ value, onChange }: { value: string | null; onChange(menu: string | null): void }) {
  return (
    <View style={styles.picker} accessibilityRole="radiogroup">
      {OPTIONS.map(option => {
        const selected = value === option.value;
        return (
          <Pressable key={option.value ?? 'none'} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={option.name}
            onPress={() => { feedback.tap(); onChange(option.value); }}
            style={({ pressed }) => [styles.option, selected && styles.selectedOption, pressed && styles.pressed]}>
            <Text style={[styles.label, selected && styles.selected]} numberOfLines={1} adjustsFontSizeToFit>{option.label}</Text>
            {option.sub && <Text style={[styles.sub, selected && styles.selected]} numberOfLines={1} adjustsFontSizeToFit>{option.sub}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  option: { flexBasis: '30%', flexGrow: 1, minHeight: 50, paddingHorizontal: 4, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  selectedOption: { borderWidth: 2, borderColor: COLORS.course_wait, backgroundColor: mix(COLORS.course_wait, 12) },
  label: { fontSize: 15, color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.text },
  selected: { fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
