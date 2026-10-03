import { drinkPlanName, type Course, type DrinkPlan } from '@table-check/core/domain';

// 通常とコース（飲み放題の区分ごと）から1つ選ぶドロップダウン。詳細パネルで使う（No.71。ご案内はボタンで選ぶ。No.85）。
// 区分は店が設定で決める（No.90）。設定で消した区分を使っている卓は、その区分も残して出す
export function CoursePicker({ id, value, plans, onChange }: { id: string; value: Course | null; plans: DrinkPlan[]; onChange(course: Course | null): void }) {
  const ids = value === null || plans.some(plan => plan.id === value) ? plans.map(plan => plan.id) : [...plans.map(plan => plan.id), value];
  return <select id={id} className="field-select" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : event.target.value)}>
    <option value="">通常</option>
    {ids.map(course => <option key={course} value={course}>コース（{drinkPlanName(plans, course)}）</option>)}
  </select>;
}
