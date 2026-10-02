import { COURSE_MENUS, priceLabel } from '@table-check/core/courseMenus';

// どのコースか（料理のメニュー）を選ぶドロップダウン。お店ではコースを値段で呼ぶので値段を先に出し、同じ値段のコースは名前で見分ける。
// 任意なので「未定」のままでもよい。ご案内と詳細パネルで同じものを使う
export function MenuPicker({ id, value, onChange }: { id: string; value: string | null; onChange(menu: string | null): void }) {
  return <select id={id} className="field-select" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : event.target.value)}>
    <option value="">未定</option>
    {COURSE_MENUS.map(menu => <option key={menu.id} value={menu.id}>{priceLabel(menu)} {menu.short}</option>)}
  </select>;
}
