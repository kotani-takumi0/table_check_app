import { COURSE_MENUS } from '@table-check/core/courseMenus';

const OPTIONS: { value: string | null; label: string; name: string }[] = [
  { value: null, label: '未定', name: '未定' },
  ...COURSE_MENUS.map(menu => ({ value: menu.id, label: menu.short, name: menu.name })),
];
// どのコースか（料理のメニュー）を選ぶ。任意なので「未定」のままでもよい。ご案内の確認と詳細パネルで同じものを使う
export function MenuPicker({ value, onChange, labelledBy }: { value: string | null; onChange(menu: string | null): void; labelledBy: string }) {
  return <div className="menu-picker" role="group" aria-labelledby={labelledBy}>
    {OPTIONS.map(option => <button key={option.value ?? 'none'} className="course-option course" aria-pressed={value === option.value}
      aria-label={option.name} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
