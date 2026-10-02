import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { GRID, type SeatKind } from '@table-check/core/layout';
import { LABEL_MAX_LENGTH, NOTICE_AREAS, type ShopLayout } from '@table-check/core/shopLayout';
import { LAYOUT_BLOCKS, useLayoutEditor } from '@table-check/core/useLayoutEditor';
import { COLORS, FILL } from './theme';
import { Glass } from './Glass';
import { feedback } from './feedback';
import { PanelButton } from './ui';
import { SelectField, type SelectOption } from './sheets/SelectField';

const KIND_OPTIONS: SelectOption<SeatKind>[] = [{ value: 'table', label: 'テーブル' }, { value: 'counter', label: 'カウンター席' }];
const GAP = 4;
type Box = { col: number; colSpan: number; row: number; rowSpan: number };

// 席の配置を作り直す画面（Web の LayoutEditor と同じ。No.86）。中身は core の useLayoutEditor を Web と共有する。
// マス目は向きを変えても横向き（15列×7行）のまま。iPad の横向きは左にブロック、縦向き・スマホは上にブロックを出す
export function LayoutEditor({ layout, occupied, onSave, onClose, top, portrait, mini }: {
  layout: ShopLayout; occupied: Set<string>; onSave(layout: ShopLayout): Promise<void>; onClose(): void; top: number; portrait: boolean; mini: boolean;
}) {
  const { draft, block, setBlock, selected, select, seat, label, locked, isOccupied, pressCell, resize, remove, setSeatId, setSeatKind, setLabelText,
    conflict, reload, resetToDefault, changed, saving, canSave, save, status } = useLayoutEditor({ layout, occupied, onSave, onClose });
  const [gridWidth, setGridWidth] = useState(0);
  const cell = (gridWidth - GAP * (GRID.cols - 1)) / GRID.cols;
  const frame = (box: Box): ViewStyle => ({
    position: 'absolute', left: (box.col - 1) * (cell + GAP), top: (box.row - 1) * (cell + GAP),
    width: box.colSpan * cell + (box.colSpan - 1) * GAP, height: box.rowSpan * cell + (box.rowSpan - 1) * GAP,
  });
  const target = seat ?? label;
  const stacked = portrait || mini;
  const cells = [];
  for (let row = 1; row <= GRID.rows; row++) for (let col = 1; col <= GRID.cols; col++) {
    cells.push(<Pressable key={`${col}-${row}`} accessibilityRole="button" accessibilityLabel={`${row}行${col}列（${target ? 'ここへ動かす' : 'ここに置く'}）`}
      onPress={() => { feedback.tap(); pressCell(col, row); }} style={({ pressed }) => [styles.cell, frame({ col, row, colSpan: 1, rowSpan: 1 }), pressed && styles.cellPressed]} />);
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: top }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">席の配置</Text>
      <Text style={styles.help}>{stacked ? '上' : '左'}のブロックを選んでマス目を押すと置けます。置いた卓を押すと、卓番・種類・大きさを変えたり、別のマスを押して動かしたりできます。</Text>
      <View style={[styles.body, stacked && styles.stackedBody]}>
        <Glass tint={0.84} style={[styles.side, stacked && styles.stackedSide]}>
          {selected === null ? <>
            <Text style={styles.groupTitle}>ブロック</Text>
            <View style={[styles.blocks, stacked && styles.stackedBlocks]} accessibilityRole="radiogroup" accessibilityLabel="置くブロック">
              {LAYOUT_BLOCKS.map(b => {
                const checked = block === b.key;
                return (
                  <Pressable key={b.key} accessibilityRole="radio" accessibilityState={{ checked }} onPress={() => { feedback.tap(); setBlock(b.key); }}
                    style={({ pressed }) => [styles.block, stacked && styles.stackedBlock, checked && styles.blockChecked, pressed && styles.pressed]}>
                    <View style={[styles.blockShape, b.kind === 'counter' && styles.round, b.kind === 'label' && styles.dashed, { width: b.colSpan * 12, height: b.rowSpan * 12 }]} />
                    <Text style={[styles.blockName, checked && styles.blockNameChecked]}>{b.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </> : <>
            <Text style={styles.groupTitle}>{seat ? `${seat.id}番` : `「${label?.text}」`}を直す</Text>
            {seat && <>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>卓番</Text>
                <TextInput accessibilityLabel="卓番" style={[styles.input, locked && styles.inputDisabled]} keyboardType="number-pad" maxLength={3} value={seat.id} editable={!locked} onChangeText={setSeatId} />
              </View>
              <SelectField label="種類" value={seat.kind} options={KIND_OPTIONS} onChange={setSeatKind} />
              {locked && <Text style={styles.help}>お客さんがいる卓なので、卓番を変えたり消したりできません（動かす・大きさを変えるのはできます）</Text>}
            </>}
            {label && <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>ことば</Text>
              <TextInput accessibilityLabel="ことば" style={styles.input} maxLength={LABEL_MAX_LENGTH} value={label.text} onChangeText={setLabelText} />
            </View>}
            {target && <View style={styles.sizes} accessibilityRole="none" accessibilityLabel="大きさ">
              <SizeRow name="幅" value={target.colSpan} onLess={() => resize(-1, 0)} onMore={() => resize(1, 0)} />
              <SizeRow name="高さ" value={target.rowSpan} onLess={() => resize(0, -1)} onMore={() => resize(0, 1)} />
            </View>}
            <Text style={styles.help}>動かすときは、マス目の空いているところを押します。</Text>
            <View style={styles.actions}>
              <PanelButton label="直し終わる" onPress={() => { feedback.tap(); select(null); }} style={styles.action} />
              <PanelButton label="消す" tone="danger" disabled={locked} onPress={() => { feedback.warn(); remove(); }} style={styles.action} />
            </View>
          </>}
        </Glass>
        <View style={styles.gridArea}>
          <View style={styles.gridFrame} onLayout={event => setGridWidth(event.nativeEvent.layout.width - 16)}>
            {gridWidth > 0 && <View style={{ height: GRID.rows * cell + (GRID.rows - 1) * GAP }}>
              {cells}
              {NOTICE_AREAS.map((notice, i) => <View key={i} pointerEvents="none" style={[styles.notice, frame(notice)]}>
                <Text style={styles.noticeText} numberOfLines={1} adjustsFontSizeToFit>{i === 0 ? '通知の場所' : '縦'}</Text>
              </View>)}
              {draft.labels.map((l, i) => {
                const current = selected?.type === 'label' && selected.index === i;
                return <Pressable key={`label-${i}`} accessibilityRole="button" accessibilityLabel={`ことば「${l.text}」（押すと直す）`} onPress={() => { feedback.tap(); select({ type: 'label', index: i }); }}
                  style={[styles.item, styles.labelItem, frame(l), current && styles.selected]}>
                  <Text style={styles.labelText} numberOfLines={1} adjustsFontSizeToFit>{l.text}</Text>
                </Pressable>;
              })}
              {draft.seats.map((s, i) => {
                const current = selected?.type === 'seat' && selected.index === i;
                return <Pressable key={`seat-${i}`} accessibilityRole="button" accessibilityLabel={`${s.id}番 ${s.kind === 'table' ? 'テーブル' : 'カウンター席'}（押すと直す）`}
                  onPress={() => { feedback.tap(); select({ type: 'seat', index: i }); }}
                  style={[styles.item, frame(s), s.kind === 'counter' && styles.round, isOccupied(i) && styles.occupied, current && styles.selected]}>
                  <Text style={[styles.seatText, mini && styles.miniSeatText]} numberOfLines={1} adjustsFontSizeToFit>{s.id}</Text>
                </Pressable>;
              })}
            </View>}
          </View>
        </View>
      </View>
      <Text style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">{status}</Text>
      <View style={styles.foot}>
        {conflict && <PanelButton label="最新を読み込む" disabled={saving} onPress={() => { feedback.tap(); reload(); }} style={styles.footButton} />}
        <PanelButton label="最初の配置に戻す" onPress={() => { feedback.tap(); resetToDefault(); }} style={styles.footButton} />
        <PanelButton label={changed ? '保存せずにもどる' : 'もどる'} onPress={() => { feedback.tap(); onClose(); }} style={styles.footButton} />
        <PanelButton label={saving ? '保存しています…' : '保存して使う'} tone="primary" disabled={!canSave} onPress={() => { feedback.done(); save(); }} style={styles.footButton} />
      </View>
    </ScrollView>
  );
}
// 幅・高さをマス1つずつ変える（No.75：テーブルの大きさを大きく・小さくできるように）
function SizeRow({ name, value, onLess, onMore }: { name: string; value: number; onLess(): void; onMore(): void }) {
  return (
    <View style={styles.sizeRow}>
      <Text style={styles.fieldLabel}>{name}</Text>
      <PanelButton label="−" onPress={() => { feedback.tap(); onLess(); }} style={styles.sizeButton} />
      <Text style={styles.sizeValue} accessibilityLabel={`${name} ${value}マス`}>{value}マス</Text>
      <PanelButton label="＋" onPress={() => { feedback.tap(); onMore(); }} style={styles.sizeButton} />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 12, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  help: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  body: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stackedBody: { flexDirection: 'column', alignItems: 'stretch' },
  side: { width: 260, gap: 10, padding: 14, borderRadius: 20 },
  stackedSide: { width: '100%' },
  groupTitle: { fontSize: 14, fontWeight: '700', color: COLORS.muted },
  blocks: { gap: 6 },
  stackedBlocks: { flexDirection: 'row', flexWrap: 'wrap' },
  block: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderWidth: 2, borderColor: 'transparent', borderRadius: 14, backgroundColor: FILL },
  stackedBlock: { flexGrow: 1 },
  blockChecked: { borderColor: COLORS.action, backgroundColor: COLORS.actionBg },
  blockShape: { borderWidth: 1.5, borderColor: COLORS.lineStrong, borderRadius: 4, backgroundColor: COLORS.surface },
  round: { borderRadius: 999 },
  dashed: { borderStyle: 'dashed' },
  blockName: { fontSize: 14, color: COLORS.text },
  blockNameChecked: { fontWeight: '700' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  fieldLabel: { width: 56, fontSize: 15, fontWeight: '700', color: COLORS.text },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 12, backgroundColor: COLORS.bg, fontSize: 16, color: COLORS.text },
  inputDisabled: { opacity: 0.5 },
  sizes: { gap: 8 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sizeButton: { width: 48, minHeight: 44, paddingHorizontal: 0 },
  sizeValue: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  pressed: { opacity: 0.6 },
  gridArea: { flex: 1, alignSelf: 'stretch' },
  // padding を変えたら onLayout で引く幅（左右の合計 16）も合わせる
  gridFrame: { padding: 8, borderRadius: 20, backgroundColor: COLORS.surface },
  cell: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.line, borderRadius: 6 },
  cellPressed: { backgroundColor: COLORS.actionBg },
  notice: { alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: FILL },
  noticeText: { fontSize: 12, color: COLORS.muted },
  item: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.lineStrong, borderRadius: 10, backgroundColor: COLORS.dialFace },
  labelItem: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  labelText: { fontSize: 14, color: COLORS.muted },
  seatText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  miniSeatText: { fontSize: 11 },
  occupied: { backgroundColor: COLORS.actionBg },
  selected: { borderWidth: 3, borderColor: COLORS.action },
  status: { minHeight: 19, fontSize: 14, lineHeight: 19, color: COLORS.muted },
  foot: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footButton: { flexGrow: 1, minWidth: 150, minHeight: 44 },
});
