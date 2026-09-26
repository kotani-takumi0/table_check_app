export type Status = 'seated' | 'otoshi' | 'lo_done' | 'exited';
export const STATUS_LABEL: Record<Status, string> = {
  seated: 'ご案内済み', otoshi: 'お通し提供済み', lo_done: 'L.O.確認済み', exited: '退店済み',
};
export const STATUS_SHORT: Record<Status, string> = {
  seated: '案内済', otoshi: 'お通し済', lo_done: 'L.O.済', exited: '退店済',
};
export interface Session {
  id: string;
  tableIds: string[];
  status: Status;
  seatedAt: number;
  otoshiAt: number | null;
  loDoneAt: number | null;
  exitedAt: number | null;
}
export const RULES = { otoshiWarnMin: 15, lastOrderMin: 90, seatLimitMin: 120, exitedKeepMin: 5 } as const;
export type Alert = 'none' | 'soon' | 'now';
export type AlertReason = 'otoshi_missing' | 'last_order' | 'seat_limit' | null;
const MINUTE = 60_000;
export function newSession(id: string, tableId: string, at: number): Session {
  return { id, tableIds: [tableId], status: 'seated', seatedAt: at, otoshiAt: null, loDoneAt: null, exitedAt: null };
}
export function nextStatus(s: Status): Status | null {
  return { seated: 'otoshi', otoshi: 'lo_done', lo_done: 'exited', exited: null }[s] as Status | null;
}
export function advance(session: Session, at: number): Session {
  switch (session.status) {
    case 'seated': return { ...session, status: 'otoshi', otoshiAt: at };
    case 'otoshi': return { ...session, status: 'lo_done', loDoneAt: at };
    case 'lo_done': return { ...session, status: 'exited', exitedAt: at };
    case 'exited': return session;
  }
}
export function revert(session: Session): Session | null {
  switch (session.status) {
    case 'seated': return null;
    case 'otoshi': return { ...session, status: 'seated', otoshiAt: null };
    case 'lo_done': return { ...session, status: 'otoshi', loDoneAt: null };
    case 'exited': return { ...session, status: 'lo_done', exitedAt: null };
  }
}
export function timerOf(session: Session, now: number): { label: string; elapsedMs: number } {
  const [label, at] = session.status === 'seated'
    ? ['案内から', session.seatedAt] as const
    : session.status === 'exited'
      ? ['退店から', session.exitedAt] as const
      : ['お通しから', session.otoshiAt] as const;
  return { label, elapsedMs: Math.max(0, now - (at ?? now)) };
}
export function alertOf(session: Session, now: number): { level: Alert; reason: AlertReason } {
  if (session.status === 'seated' && now - session.seatedAt >= RULES.otoshiWarnMin * MINUTE) {
    return { level: 'now', reason: 'otoshi_missing' };
  }
  if ((session.status === 'otoshi' || session.status === 'lo_done') && session.otoshiAt !== null) {
    const elapsed = now - session.otoshiAt;
    if (elapsed >= RULES.seatLimitMin * MINUTE) return { level: 'now', reason: 'seat_limit' };
    if (session.status === 'otoshi' && elapsed >= RULES.lastOrderMin * MINUTE) return { level: 'soon', reason: 'last_order' };
  }
  return { level: 'none', reason: null };
}
// お通しから L.O. の時間を過ぎても L.O.確認済みにしていないセッション（お通しが古い順）
export function lastOrderDue(sessions: Session[], now: number): Session[] {
  return sessions
    .filter(s => s.status === 'otoshi' && s.otoshiAt !== null && now - s.otoshiAt >= RULES.lastOrderMin * MINUTE)
    .sort((a, b) => (a.otoshiAt ?? 0) - (b.otoshiAt ?? 0));
}
export function isVisible(session: Session, now: number): boolean {
  return session.status !== 'exited' || (session.exitedAt !== null && now - session.exitedAt < RULES.exitedKeepMin * MINUTE);
}
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(seconds / 60);
  const tail = `${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return minutes < 60 ? tail : `${Math.floor(minutes / 60)}:${tail}`;
}
export function formatClock(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
// "HH:MM" を near に最も近い日付の時刻にする（日付をまたぐ営業に対応）
export function clockTimeNear(hhmm: string, near: number): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  const candidates = [-1, 0, 1].map(offset => {
    const date = new Date(near);
    date.setDate(date.getDate() + offset);
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return date.getTime();
  });
  return candidates.reduce((best, c) => Math.abs(c - near) < Math.abs(best - near) ? c : best);
}
export type EditableTime = 'seatedAt' | 'otoshiAt';
// 案内 ≤ お通し ≤ L.O.確認・退店・現在 の順を崩す修正は null
export function editTime(session: Session, field: EditableTime, at: number, now: number): Session | null {
  if (field === 'otoshiAt' && session.otoshiAt === null) return null;
  const edited = { ...session, [field]: at };
  const upper = Math.min(now, edited.loDoneAt ?? Infinity, edited.exitedAt ?? Infinity);
  const otoshiAt = edited.otoshiAt ?? edited.seatedAt;
  return edited.seatedAt <= otoshiAt && otoshiAt <= upper ? edited : null;
}
