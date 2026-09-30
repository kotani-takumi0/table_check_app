import { COURSE_LABEL, COURSES, type Course } from '@table-check/core/domain';

const OPTIONS: { value: Course | null; sub: string | null }[] = [
  { value: null, sub: null },
  ...COURSES.map(course => ({ value: course, sub: course === 'premium_drinks' ? 'プレミアム' : COURSE_LABEL[course] })),
];
// 通常とコース（飲み放題の区分ごと）の4つから1つ選ぶ。ご案内の確認と詳細パネルで同じものを使う
export function CoursePicker({ value, onChange, labelledBy }: { value: Course | null; onChange(course: Course | null): void; labelledBy: string }) {
  return <div className="course-picker" role="group" aria-labelledby={labelledBy}>
    {OPTIONS.map(option => <button key={option.value ?? 'normal'} className={`course-option ${option.value === null ? 'normal' : 'course'}`}
      aria-pressed={value === option.value} aria-label={option.value === null ? '通常' : `コース（${COURSE_LABEL[option.value]}）`}
      onClick={() => onChange(option.value)}>
      {option.value === null ? '通常' : <>コース<span className="course-sub">{option.sub}</span></>}
    </button>)}
  </div>;
}
