import { priceLabel, type CourseMenu } from '@table-check/core/courseMenus';

// どのコースか（料理のメニュー）を選ぶドロップダウン。お店ではコースを値段で呼ぶので値段を先に出し、同じ値段のコースは名前で見分ける。
// 任意なので「未定」のままでもよい。ご案内と詳細パネルで同じものを使う。コースは店が設定で作る（No.89）
export function MenuPicker({ id, value, menus, onChange }: { id: string; value: string | null; menus: CourseMenu[]; onChange(menu: string | null): void }) {
  return <select id={id} className="field-select" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : event.target.value)}>
    <option value="">未定</option>
    {menus.map(menu => <option key={menu.id} value={menu.id}>{priceLabel(menu)} {menu.short}</option>)}
    {value !== null && !menus.some(menu => menu.id === value) && <option value={value}>消したコース</option>}
  </select>;
}
