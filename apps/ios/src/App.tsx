import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { now } from '@table-check/core/clock';
import { COURSE_LABEL, displayOf, formatElapsed, occupantOf, STATUS_CARD, timerOf, type Session } from '@table-check/core/domain';
import { SEATS, type Seat } from '@table-check/core/layout';
import { worstSyncState, type SyncState } from '@table-check/core/store';
import { useSessions } from '@table-check/core/useSessions';
import { version } from '../../../package.json';
import { services, type Services } from './services';

// 土台の確認用の画面：卓ごとの状態を一覧で出し、Web で操作した内容が届くことを確かめる（操作と見た目は No.057 で作る）
// テーブル → カウンターの順に、卓番の小さい順で並べる
const ROWS = [...SEATS].sort((a, b) => (a.kind === b.kind ? Number(a.id) - Number(b.id) : a.kind === 'table' ? -1 : 1));
const SYNC_LABEL: Record<SyncState, string | null> = { synced: null, pending: '送信待ち', offline: 'オフライン' };

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.screen}>
        {services ? <Floor services={services} /> : <Text style={styles.message}>apps/ios/.env.development.local に Firebase の設定がありません</Text>}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Floor({ services: { store, shopTimerStore, projectId } }: { services: Services }) {
  const { sessions } = useSessions(store);
  const [time, setTime] = useState(now);
  useEffect(() => {
    const interval = setInterval(() => setTime(now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const [sessionSync, setSessionSync] = useState<SyncState>('synced');
  const [shopTimerSync, setShopTimerSync] = useState<SyncState>('synced');
  useEffect(() => store.subscribeSync?.(setSessionSync), [store]);
  useEffect(() => shopTimerStore.subscribeSync?.(setShopTimerSync), [shopTimerStore]);
  const sync = SYNC_LABEL[worstSyncState([sessionSync, shopTimerSync])];
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Minopal</Text>
        {sync && <Text style={styles.sync}>{sync}</Text>}
        <Text style={styles.meta}>v{version} · {projectId}</Text>
      </View>
      <FlatList
        data={ROWS}
        keyExtractor={seat => seat.id}
        renderItem={({ item }) => <Row seat={item} session={occupantOf(sessions, item.id, time)} time={time} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </>
  );
}

function Row({ seat, session, time }: { seat: Seat; session?: Session; time: number }) {
  if (!session) {
    return (
      <View style={styles.row}>
        <Text style={styles.seat}>{seat.id}</Text>
        <Text style={styles.empty}>空席</Text>
      </View>
    );
  }
  const timer = timerOf(session, time);
  const details = [
    seat.kind === 'table' ? `${session.guests ?? '?'}名` : null,
    session.course ? COURSE_LABEL[session.course] : null,
    session.tableIds.length > 1 ? `団体 ${session.tableIds.join('・')}` : null,
    session.paidAt !== null ? '会計済み' : null,
  ].filter(Boolean).join(' · ');
  return (
    <View style={styles.row}>
      <Text style={styles.seat}>{seat.id}</Text>
      <View style={styles.body}>
        <Text style={styles.status}>{STATUS_CARD[displayOf(session.status, session.course)]}</Text>
        {details !== '' && <Text style={styles.details}>{details}</Text>}
      </View>
      <Text style={styles.timer}>{timer.elapsedMs === null ? '--:--' : formatElapsed(timer.elapsedMs)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  message: { margin: 16, fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  title: { fontSize: 20, fontWeight: '700' },
  sync: { fontSize: 14, color: '#b45309' },
  meta: { marginLeft: 'auto', fontSize: 12, color: '#666' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#ddd', marginLeft: 16 },
  seat: { width: 36, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  body: { flex: 1 },
  empty: { flex: 1, fontSize: 16, color: '#999' },
  status: { fontSize: 16 },
  details: { marginTop: 2, fontSize: 13, color: '#666' },
  timer: { fontSize: 18, fontVariant: ['tabular-nums'] },
});
