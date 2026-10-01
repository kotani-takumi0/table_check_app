import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Course } from '@table-check/core/domain';
import { COLORS } from '../theme';
import { feedback } from '../feedback';
import { PanelButton } from '../ui';
import { CoursePicker } from './CoursePicker';
import { MenuPicker } from './MenuPicker';
import { GuestStepper } from './GuestStepper';
import { sheet } from './common';

const QUICK_GUESTS = [1, 2, 3, 4, 5, 6, 7, 8];
interface Props {
  tableId: string;
  exited: boolean;           // 退店済の卓への案内
  previousUnpaid: boolean;   // 退店した前のお客さんがお会計前のまま
  onSeat(guests: number | null, course: Course | null, menu: string | null): void;
  onClose(): void;
}
// ご案内の確認と、コース・人数（Web の SeatDialog と同じ）。人数のボタンを押したらその場で案内する
export function SeatSheet({ tableId, exited, previousUnpaid, onSeat, onClose }: Props) {
  const [course, setCourse] = useState<Course | null>(null);
  // どのコースか。コースを選んだときだけ聞く（任意）
  const [menu, setMenu] = useState<string | null>(null);
  // 「9名以上」を押したら −／＋ で選ぶ
  const [many, setMany] = useState<number | null>(null);
  const seat = (guests: number | null) => { feedback.done(); onSeat(guests, course, course === null ? null : menu); onClose(); };
  return <>
    <Text style={sheet.title} accessibilityRole="header">{tableId}番にご案内</Text>
    {exited && <Text style={sheet.message}>{tableId}番は退店済みです。ご案内すると、前のお客さんの表示は新しいお客さんに置き換わります。</Text>}
    {exited && previousUnpaid && <Text style={sheet.warning}>前のお客さんはお会計済みになっていません</Text>}
    <View style={styles.group}>
      <Text style={sheet.question}>コース</Text>
      <CoursePicker value={course} onChange={setCourse} />
      {course !== null && <>
        <Text style={[sheet.text, sheet.muted]}>どのコースですか？（あとでも選べます）</Text>
        <MenuPicker value={menu} onChange={setMenu} />
      </>}
    </View>
    <View style={styles.group}>
      <Text style={sheet.question}>何名様ですか？</Text>
      <View style={styles.grid}>
        {QUICK_GUESTS.map(n => (
          <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n}名でご案内`} onPress={() => seat(n)}
            style={({ pressed }) => [styles.guest, pressed && styles.pressed]}>
            <Text style={styles.guestLabel}>{n}</Text>
          </Pressable>
        ))}
      </View>
      {many === null
        ? <PanelButton label="9名以上" onPress={() => { feedback.tap(); setMany(QUICK_GUESTS.length + 1); }} />
        : <GuestStepper value={many} onChange={setMany}>
          <PanelButton label={`${many}名でご案内`} tone="primary" onPress={() => seat(many)} style={styles.grow} />
        </GuestStepper>}
    </View>
    <View style={sheet.actions}>
      <PanelButton label="人数はあとで" onPress={() => seat(null)} style={sheet.action} />
      <PanelButton label="やめる" onPress={onClose} style={sheet.action} />
    </View>
  </>;
}
const styles = StyleSheet.create({
  group: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  guest: { flexBasis: '22%', flexGrow: 1, minHeight: 56, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  guestLabel: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  grow: { flex: 1 },
  pressed: { opacity: 0.6 },
});
