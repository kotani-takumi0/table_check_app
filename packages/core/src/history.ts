import { menuOf, priceLabel } from './courseMenus';
import { formatClock, servedTimes, STATUS_LABEL, type Session, type TableMove } from './domain';
import type { SessionRecord } from './sessionRecord';
import type { ShopSettings } from './shopSettings';

// 履歴（No.34）。その日のお客さんを CSV で書き出し、営業のあとに店長などが表計算や AI に渡して見返せるようにする。
// 「その日」は朝4時で区切る（深夜まで営業する店で、0時をまたいだお客さんを同じ日に入れる）。時刻はその端末の時間帯で数える
export const DAY_START_HOUR = 4;
const pad = (n: number) => String(n).padStart(2, '0');
// その時刻が入る営業日（"YYYY-MM-DD"）。4時より前は前の日
export function businessDayOf(at: number): string {
  const date = new Date(at);
  if (date.getHours() < DAY_START_HOUR) date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
// 営業日の始まり（その日の4時）と終わり（次の日の4時）。日付の形が違えば null
export function businessDayRange(day: string): { start: number; end: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const start = new Date(y, m, d, DAY_START_HOUR);
  if (start.getFullYear() !== y || start.getMonth() !== m || start.getDate() !== d) return null;
  return { start: start.getTime(), end: new Date(y, m, d + 1, DAY_START_HOUR).getTime() };
}
// 期間（No.113）：from の営業日の始まりから to の営業日の終わりまで。日付の形が違う・from が to より後なら null
export function businessDaysRange(from: string, to: string): { start: number; end: number } | null {
  const first = businessDayRange(from), last = businessDayRange(to);
  return first && last && first.start <= last.start ? { start: first.start, end: last.end } : null;
}
// 表計算で開いても崩れないよう、カンマ・引用符・改行を含む欄は引用符で囲む
function field(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export const CSV_HEADER = ['営業日', '卓', '人数', '区分', 'コース', '案内', 'お通し・ファーストドリンク', 'L.O.確認', '退店', '滞在（分）', 'お会計', '最後の状態', '閉店で退店', '全卓消去', '卓の動き', '料理を出した時刻'];
// 卓の動き（No.113）を1つの欄にする。例「19:10 12→13番に移動 / 19:40 14番を足す」
function tableLogText(log: TableMove[]): string {
  return log.map(move => `${formatClock(move.at)} ${move.kind === 'move' ? `${move.from}→${move.to}番に移動` : move.kind === 'add' ? `${move.to}番を足す` : `${move.from}番を外す`}`).join(' / ');
}
// 料理を出した時刻（No.131）を1つの欄にする。例「1品目 18:20 / 2品目 18:35（+15分）」。
// 前の品からの分を添えて、コースのペースを見やすくする。時刻を残す前の版で出した品は「時刻なし」
function dishTimesText(times: (number | null)[]): string {
  return times.map((at, i) => {
    if (at === null) return `${i + 1}品目 時刻なし`;
    const before = times[i - 1];
    return `${i + 1}品目 ${formatClock(at)}${typeof before === 'number' ? `（+${Math.round((at - before) / 60_000)}分）` : ''}`;
  }).join(' / ');
}
// 期間のお客さんを案内の順に1行ずつ。Excel で文字化けしないよう、先頭に BOM を付ける。
// 区分・コースは記録に写しておいたそのときの名前（No.113）で出し、写していない古い記録は今の設定の名前で出す（値段は写さないので今の値段）
export function sessionsCsv(sessions: (Session & { record?: Partial<SessionRecord> })[], settings: Pick<ShopSettings, 'drinkPlans' | 'courseMenus'>): string {
  const clock = (at: number | null) => at === null ? '' : formatClock(at);
  const rows = [...sessions].sort((a, b) => a.seatedAt - b.seatedAt).map(session => {
    const record = session.record ?? {};
    const menu = session.course === null ? null : menuOf(session.menu, settings.courseMenus);
    const plan = session.course === null ? null : settings.drinkPlans.find(p => p.id === session.course);
    return [
      record.businessDay ?? businessDayOf(session.seatedAt),
      session.tableIds.join('・'),
      session.guests ?? '',
      session.course === null ? '通常' : record.drinkPlanName ?? plan?.name ?? '消した区分',
      session.course === null ? '' : menu ? `${priceLabel(menu)} ${record.courseName ?? menu.name}` : session.menu === null ? '未定' : record.courseName ?? '消したコース',
      clock(session.seatedAt),
      clock(session.otoshiAt),
      clock(session.loDoneAt),
      clock(session.exitedAt),
      session.exitedAt === null ? '' : Math.round((session.exitedAt - session.seatedAt) / 60_000),
      session.paidAt === null ? '未払い' : `会計済（${formatClock(session.paidAt)}）`,
      STATUS_LABEL[session.status],
      session.exitedByClosing ? 'はい' : '',
      clock(session.clearedAt),
      tableLogText(session.tableLog),
      // 時刻を残す前の版で出した品も「時刻なし」で数える
      dishTimesText(servedTimes(session, session.dishesServed)),
    ];
  });
  return '\ufeff' + [CSV_HEADER, ...rows].map(row => row.map(field).join(',')).join('\r\n') + '\r\n';
}
// 書き出すファイルの名前
export function csvFileName(from: string, to: string = from): string {
  return from === to ? `minopal-${from}.csv` : `minopal-${from}_${to}.csv`;
}
