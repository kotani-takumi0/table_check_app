// 人数のドロップダウン（No.71）。来店する人数は組ごとに大きく変わるので、−／＋ ではなく一度で選べるようにする。
// 空（あとで）も選べる。GUESTS_PICK より多い人数は、すでに入っているときだけ並べる
const GUESTS_PICK = 30;
export function GuestPicker({ id, value, onChange, emptyLabel = 'あとで' }: { id: string; value: number | null; onChange(guests: number | null): void; emptyLabel?: string }) {
  const counts = Array.from({ length: Math.max(GUESTS_PICK, value ?? 0) }, (_, i) => i + 1);
  return <select id={id} className="field-select" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}>
    <option value="">{emptyLabel}</option>
    {counts.map(n => <option key={n} value={n}>{n}名</option>)}
  </select>;
}
