import { useState } from 'react';
import { priceLabel, type CourseMenu } from '@table-check/core/courseMenus';
import { courseMinutes, moveDish, setOwnMinutes, stepCourseMinutes } from '@table-check/core/courseEditor';
import { COURSE_LIMITS, courseProblems, type ShopSettings } from '@table-check/core/shopSettings';

// コースを作る・直す画面（No.89。設定 → コース から開く）。下書きを直して「保存して使う」で全端末に反映する。
// 案内中の卓が使っているコース（usedBy）は消せない（ユーザー決定）
export function CourseEditor({ course, isNew, settings, usedBy, onSave, onDelete, onClose, inert }: {
  course: CourseMenu; isNew: boolean; settings: ShopSettings; usedBy: string[]; onSave(course: CourseMenu): void; onDelete(): void; onClose(): void; inert?: boolean;
}) {
  const [draft, setDraft] = useState(course);
  const problems = courseProblems(draft);
  const changed = isNew || JSON.stringify(draft) !== JSON.stringify(course);
  const own = draft.lastOrderMin !== null || draft.seatLimitMin !== null;
  const minutes = courseMinutes(draft, settings);
  const setDish = (index: number, dish: string) => setDraft(d => ({ ...d, dishes: d.dishes.map((x, i) => i === index ? dish : x) }));
  return <section className="settings course-editor" aria-labelledby="course-title" inert={inert}>
    <h1 id="course-title" className="settings-title">{isNew ? 'コースを足す' : `${priceLabel(course)} ${course.short}を直す`}</h1>
    <div className="settings-group glass">
      <h2 className="settings-group-title">コース</h2>
      <div className="course-fields">
        <label className="field-label" htmlFor="course-name">名前</label>
        <input id="course-name" className="field-select" maxLength={COURSE_LIMITS.name} placeholder="例：カジュアルコース" value={draft.name} onChange={event => setDraft(d => ({ ...d, name: event.target.value }))} />
        <label className="field-label" htmlFor="course-short">ボタンの名前</label>
        <input id="course-short" className="field-select" maxLength={COURSE_LIMITS.short} placeholder="例：カジュアル" aria-describedby="course-short-help" value={draft.short} onChange={event => setDraft(d => ({ ...d, short: event.target.value }))} />
        <p id="course-short-help" className="settings-help course-help">選ぶボタンに値段と並べて出します。同じ値段のコースを見分けられる短い名前にしてください</p>
        <label className="field-label" htmlFor="course-price">値段（円）</label>
        <input id="course-price" className="field-select" type="number" inputMode="numeric" min={0} max={COURSE_LIMITS.price} step={100} value={Number.isNaN(draft.price) ? '' : draft.price}
          onChange={event => setDraft(d => ({ ...d, price: event.target.value === '' ? NaN : Number(event.target.value) }))} />
      </div>
    </div>
    <div className="settings-group glass">
      <h2 className="settings-group-title">時間</h2>
      <div className="settings-row">
        <div className="settings-row-text">
          <strong id="course-own-label">このコースだけ L.O.・お席の時間を変える</strong>
          <p className="settings-help">{own ? 'ファーストドリンクから数えます' : `店の設定（L.O. ${settings.lastOrderMin}分・お席の時間 ${settings.seatLimitMin}分）を使います`}</p>
        </div>
        <button className="switch" role="switch" aria-checked={own} aria-labelledby="course-own-label" onClick={() => setDraft(d => setOwnMinutes(d, settings, !own))}><span className="switch-knob" /></button>
      </div>
      {own && (['lastOrderMin', 'seatLimitMin'] as const).map(key => {
        const label = key === 'lastOrderMin' ? 'L.O.' : 'お席の時間';
        const less = stepCourseMinutes(draft, settings, key, -1), more = stepCourseMinutes(draft, settings, key, 1);
        return <div key={key} className="settings-row">
          <div className="settings-row-text"><strong id={`course-${key}`}>{label}</strong></div>
          <div className="minutes-stepper" role="group" aria-labelledby={`course-${key}`}>
            <button className="panel-button small" aria-label={`${label}を短く`} disabled={!less} onClick={() => less && setDraft(less)}>−</button>
            <strong aria-live="polite">{minutes[key]}分</strong>
            <button className="panel-button small" aria-label={`${label}を長く`} disabled={!more} onClick={() => more && setDraft(more)}>＋</button>
          </div>
        </div>;
      })}
    </div>
    <div className="settings-group glass">
      <h2 className="settings-group-title">料理（出す順）</h2>
      <ol className="course-dishes">
        {draft.dishes.map((dish, i) => <li key={i} className="course-dish">
          <span className="course-dish-number" aria-hidden="true">{i + 1}</span>
          <input className="field-select" aria-label={`${i + 1}品目`} maxLength={COURSE_LIMITS.dish} placeholder="料理の名前" value={dish} onChange={event => setDish(i, event.target.value)} />
          <button className="panel-button small" aria-label={`${i + 1}品目を上へ`} disabled={i === 0} onClick={() => setDraft(d => ({ ...d, dishes: moveDish(d.dishes, i, -1) }))}>↑</button>
          <button className="panel-button small" aria-label={`${i + 1}品目を下へ`} disabled={i === draft.dishes.length - 1} onClick={() => setDraft(d => ({ ...d, dishes: moveDish(d.dishes, i, 1) }))}>↓</button>
          <button className="panel-button small danger" aria-label={`${i + 1}品目を消す`} onClick={() => setDraft(d => ({ ...d, dishes: d.dishes.filter((_, j) => j !== i) }))}>消す</button>
        </li>)}
      </ol>
      {draft.dishes.length < COURSE_LIMITS.dishes && <button className="panel-button add-plan" onClick={() => setDraft(d => ({ ...d, dishes: [...d.dishes, ''] }))}>＋ 料理を足す</button>}
    </div>
    <div className="layout-foot">
      <p className="layout-message" role="status">{problems.length ? `直すところ：${problems.join('／')}` : usedBy.length && !isNew ? `${usedBy.join('・')}番が使っているので、消せません（直すのはできます）` : changed ? '保存すると、すべての端末のコースが変わります' : ''}</p>
      {!isNew && <button className="panel-button danger" disabled={usedBy.length > 0} onClick={() => { onDelete(); onClose(); }}>このコースを消す</button>}
      <button className="panel-button" onClick={onClose}>{changed ? '保存せずにもどる' : 'もどる'}</button>
      <button className="panel-button primary" disabled={!changed || problems.length > 0} onClick={() => { onSave(draft); onClose(); }}>保存して使う</button>
    </div>
  </section>;
}
