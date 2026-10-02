import { COURSE_LABEL, COURSES, type Course } from '@table-check/core/domain';

// 通常とコース（飲み放題の区分ごと）の4つから1つ選ぶドロップダウン。ご案内と詳細パネルで同じものを使う（No.71：大きなボタンを並べない）
export function CoursePicker({ id, value, onChange }: { id: string; value: Course | null; onChange(course: Course | null): void }) {
  return <select id={id} className="field-select" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : event.target.value as Course)}>
    <option value="">通常</option>
    {COURSES.map(course => <option key={course} value={course}>コース（{COURSE_LABEL[course]}）</option>)}
  </select>;
}
