import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Course } from '@table-check/core/domain';
import type { ShopSettings } from '@table-check/core/shopSettings';
import { feedback } from '../feedback';
import { CloseButton, PanelButton } from '../ui';
import { SelectField } from './SelectField';
import { courseOptions, guestOptions, menuOptions } from './pickers';
import { sheet } from './common';

interface Props {
  tableId: string;
  exited: boolean;           // 退店済の卓への案内
  previousUnpaid: boolean;   // 退店した前のお客さんがお会計前のまま
  onSeat(guests: number | null, course: Course | null, menu: string | null): void;
  settings: ShopSettings;   // 店の設定（時間のルール・飲み放題の区分・コース。No.14・No.89・No.90）
  onClose(): void;
}
// ご案内（Web の SeatDialog と同じ。No.71）：最初の案内は入力が多いので、詳細のポップオーバーとは別にシートで聞く。
// 人数・コース・料理はドロップダウンで、最後に大きな「ご案内」を1つだけ押す
export function SeatSheet({ tableId, exited, previousUnpaid, onSeat, settings, onClose }: Props) {
  const [guests, setGuests] = useState<number | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  // どのコースか。コースを選んだときだけ聞く（任意）
  const [menu, setMenu] = useState<string | null>(null);
  const seat = () => { feedback.done(); onSeat(guests, course, course === null ? null : menu); onClose(); };
  return <>
    <Text style={sheet.title} accessibilityRole="header">{tableId}番にご案内</Text>
    {exited && <Text style={sheet.message}>{tableId}番は退店済みです。ご案内すると、前のお客さんの表示は新しいお客さんに置き換わります。</Text>}
    {exited && previousUnpaid && <Text style={sheet.warning}>前のお客さんはお会計済みになっていません</Text>}
    <View style={styles.fields}>
      <SelectField label="人数" value={guests} options={guestOptions('あとで入れる', guests)} onChange={setGuests} />
      <SelectField label="コース" value={course} options={courseOptions(settings.drinkPlans, course)} onChange={setCourse} />
      {course !== null && <SelectField label="料理" value={menu} options={menuOptions(settings.courseMenus, menu)} onChange={setMenu} />}
    </View>
    <PanelButton label={guests === null ? 'ご案内（人数はあとで）' : `${guests}名でご案内`} tone="primary" onPress={seat} style={styles.go} />
    <CloseButton onPress={onClose} />
  </>;
}
const styles = StyleSheet.create({
  fields: { gap: 10 },
  go: { minHeight: 64 },
});
