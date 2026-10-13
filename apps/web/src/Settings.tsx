import { Fragment, useRef, useState } from 'react';
import type { DrinkPlan } from '@table-check/core/domain';
import { priceLabel, type CourseMenu } from '@table-check/core/courseMenus';
import { newShopTimerId, SHOP_TIMER_LIMITS, stepInterval, type ShopTimer, type ShopTimerId } from '@table-check/core/shopTimers';
import { FALLBACK_SHOP_TIMER_ICON, SHOP_TIMER_ICONS, shopTimerIcon } from '@table-check/core/shopTimerIcons';
import { ShopTimerGlyph } from './ShopTimerGlyph';
import { CLOSING_CHOICES, closingLabel } from '@table-check/core/closing';
import { COURSE_LIMITS, DRINK_PLAN_NAME_MAX, DRINK_PLANS_MAX, newDrinkPlanId, SHOP_NAME_MAX, stepMinutes, type MinuteSetting, type ShopSettings } from '@table-check/core/shopSettings';

// 設定の画面（メニューの「設定」）。店全体の設定は全端末に反映する
// No.114：時間のルール（分数）はほとんど変えないので最後に置く。空いている日に切り替える「時間制限なし」だけは「今日の営業」として上に出す
const SETTINGS_SECTIONS = [
  { id: 'today', label: '今日の営業' }, { id: 'shop', label: 'お店' }, { id: 'course', label: 'コース' }, { id: 'timers', label: '店のタイマー' }, { id: 'record', label: '記録' }, { id: 'time', label: '時間のルール' },
] as const;
// onEditCourse：コースを直す画面を開く（null は新しいコースを足す。No.89）
// onExportCsv：期間（はじめ〜おわりの営業日）のお客さんを CSV で書き出し、書き出した人数（組）を返す（No.34・No.113）
export function Settings({ settings, onChange, onOpenLayout, onEditCourse, today, onExportCsv, inert }: { settings: ShopSettings; onChange(change: Partial<ShopSettings>): void; onOpenLayout(): void; onEditCourse(id: string | null): void; today: string; onExportCsv(from: string, to: string): Promise<number>; inert?: boolean }) {
  // 左の目次（No.107。デジタル庁のサイトと同じ形）：押すとその見出しへ動き、いま見ているまとまりを緑にする
  const scroller = useRef<HTMLElement>(null);
  const [active, setActive] = useState<string>(SETTINGS_SECTIONS[0].id);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    // 下まで動かしたら、最後のまとまりが短くて上まで来なくても最後を選ぶ
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    const current = atEnd ? SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1]
      : [...SETTINGS_SECTIONS].reverse().find(section => (document.getElementById(`settings-${section.id}`)?.getBoundingClientRect().top ?? Infinity) - top <= 24) ?? SETTINGS_SECTIONS[0];
    setActive(current.id);
  };
  return <section ref={scroller} className="settings has-toc" aria-labelledby="settings-title" inert={inert} onScroll={onScroll}>
    <nav className="settings-toc" aria-label="設定の目次">
      <ul>
        {SETTINGS_SECTIONS.map(section => <li key={section.id}><a href={`#settings-${section.id}`} aria-current={active === section.id ? 'true' : undefined}
          onClick={event => { event.preventDefault(); document.getElementById(`settings-${section.id}`)?.scrollIntoView({ block: 'start' }); setActive(section.id); }}>{section.label}</a></li>)}
      </ul>
    </nav>
    <div className="settings-main">
    <div className="settings-head">
      <h1 id="settings-title" className="settings-title">設定</h1>
      <p className="settings-help">変えると、すべての端末にすぐ反映されます。</p>
    </div>
    <div id="settings-today" className="settings-group sheet" role="group" aria-labelledby="settings-today-title">
      <h2 id="settings-today-title" className="settings-group-title">今日の営業</h2>
      <SwitchRow id="time-limit-off" label="時間制限なし" checked={settings.timeLimitOff} onChange={timeLimitOff => onChange({ timeLimitOff })}
        help="空いている日などに、L.O.・お席の時間の通知と色を止めます。経過の時間とお通しの警告はそのまま出します。" />
    </div>
    <div id="settings-shop" className="settings-group sheet" role="group" aria-labelledby="settings-shop-title">
      <h2 id="settings-shop-title" className="settings-group-title">お店</h2>
      <ShopNameRow name={settings.shopName} onSave={shopName => onChange({ shopName })} />
      <div className="settings-row">
        <div className="settings-row-text">
          <strong>席の配置</strong>
          <p className="settings-help">卓の場所・大きさ・卓番と、入口・キッチンなどの目印を、マス目にブロックを置いて作り直します。すべての端末に反映されます。</p>
        </div>
        <button className="panel-button" onClick={onOpenLayout}>変える</button>
      </div>
      <ClosingRow closingMin={settings.closingMin} onChange={closingMin => onChange({ closingMin })} />
    </div>
    <div id="settings-course" className="settings-group sheet" role="group" aria-labelledby="settings-course-title">
      <h2 id="settings-course-title" className="settings-group-title">コース</h2>
      <DrinkPlanRows plans={settings.drinkPlans} onChange={drinkPlans => onChange({ drinkPlans })} />
      <CourseRows menus={settings.courseMenus} onEdit={onEditCourse} />
    </div>
    <div id="settings-timers" className="settings-group sheet" role="group" aria-labelledby="settings-timers-title">
      <h2 id="settings-timers-title" className="settings-group-title">店のタイマー</h2>
      <ShopTimerRows timers={settings.shopTimers} onChange={shopTimers => onChange({ shopTimers })} />
    </div>
    <div id="settings-record" className="settings-group sheet" role="group" aria-labelledby="settings-record-title">
      <h2 id="settings-record-title" className="settings-group-title">記録</h2>
      <ExportRow today={today} onExport={onExportCsv} />
    </div>
    <div id="settings-time" className="settings-group sheet" role="group" aria-labelledby="settings-time-title">
      <h2 id="settings-time-title" className="settings-group-title">時間のルール</h2>
      {/* No.14・No.132：店ごとに分を決める。L.O.・お席の時間はお通し（コースはファーストドリンク）から数える */}
      <MinutesRow settings={settings} field="lastOrderMin" label="L.O." help={settings.otoshi ? 'お通しから数えます（コースはファーストドリンクから）' : '案内から数えます（コースはファーストドリンクから）'} onChange={onChange} />
      <MinutesRow settings={settings} field="seatLimitMin" label="お席の時間" help={settings.otoshi ? 'お通しから数えます（コースはファーストドリンクから）' : '案内から数えます（コースはファーストドリンクから）'} onChange={onChange} />
      <SwitchRow id="otoshi" label="お通しを出す" checked={settings.otoshi} onChange={otoshi => onChange({ otoshi })}
        help="出さない店は「お通し提供済み」を「ファーストドリンク提供済み」と呼び、L.O.・お席の時間は案内から数えます。お通し未提供の警告は出しません。" />
      {settings.otoshi && <MinutesRow settings={settings} field="otoshiWarnMin" label="お通しの警告" help="案内からこの時間たってもお通しがまだなら知らせます" onChange={onChange} />}
      <MinutesRow settings={settings} field="exitedKeepMin" label="退店済みを残す" help="退店したあと、卓に退店済みを出しておく時間" onChange={onChange} />
    </div>
    </div>
  </section>;
}
// その日のお客さんを CSV で書き出す（No.34）。営業のあとに表計算や AI に渡して見返す。日は朝4時で区切る
function ExportRow({ today, onExport }: { today: string; onExport(from: string, to: string): Promise<number> }) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const run = () => {
    setBusy(true);
    setMessage('');
    onExport(from, to).then(count => setMessage(count === 0 ? 'この期間のお客さんはいませんでした' : `${count}組を書き出しました`),
      (error: unknown) => setMessage(`書き出せませんでした（${error instanceof Error ? error.message : '理由が分かりません'}）`)).finally(() => setBusy(false));
  };
  // No.113：期間を選んでまとめて書き出す。1日だけなら、はじめとおわりを同じ日にする
  return <div className="settings-row export-row">
    <div className="settings-row-text">
      <strong id="export-title">お客さんを CSV で書き出す</strong>
      <p id="export-help" className="settings-help">選んだ期間のお客さんを、卓・人数・コース・時刻・お会計・卓の動きと一緒に1組1行で書き出します。日は朝4時で区切ります（0時を過ぎたお客さんも前の日に入ります）。全卓消去したお客さんも、消した時刻と一緒に入ります。</p>
      {message && <p className="settings-help" role="status">{message}</p>}
    </div>
    <div className="export-range" role="group" aria-labelledby="export-title" aria-describedby="export-help">
      <input id="export-from" aria-label="はじめの日" type="date" className="field-select" value={from} max={today} onChange={event => { setFrom(event.target.value); if (event.target.value > to) setTo(event.target.value); }} />
      <span aria-hidden="true">〜</span>
      <input id="export-to" aria-label="おわりの日" type="date" className="field-select" value={to} min={from} max={today} onChange={event => setTo(event.target.value)} />
    </div>
    <button className="panel-button" disabled={busy || from === '' || to === '' || from > to} onClick={run}>{busy ? '書き出しています…' : '書き出す'}</button>
  </div>;
}
// 閉店時刻（No.129）。閉店が近づくとアプリを触らなくなるので、過ぎても退店していない卓を閉店で退店にして、その日の記録を閉じる
function ClosingRow({ closingMin, onChange }: { closingMin: number | null; onChange(closingMin: number | null): void }) {
  return <div className="settings-row">
    <div className="settings-row-text">
      <label htmlFor="closing-time"><strong>閉店時刻</strong></label>
      <p id="closing-help" className="settings-help">この時刻を過ぎても退店していない卓を、閉店時刻で退店にします。記録には「閉店で退店」と残ります。閉店時刻より後に案内した卓は、朝4時に退店にします。</p>
    </div>
    <select id="closing-time" className="field-select" aria-describedby="closing-help" value={closingMin ?? ''}
      onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}>
      <option value="">決めない</option>
      {CLOSING_CHOICES.map(min => <option key={min} value={min}>{closingLabel(min)}</option>)}
    </select>
  </div>;
}
function SwitchRow({ id, label, help, checked, onChange }: { id: string; label: string; help: string; checked: boolean; onChange(checked: boolean): void }) {
  return <div className="settings-row">
    <div className="settings-row-text">
      <strong id={`${id}-label`}>{label}</strong>
      <p id={`${id}-help`} className="settings-help">{help}</p>
    </div>
    <button className="switch" role="switch" aria-checked={checked} aria-labelledby={`${id}-label`} aria-describedby={`${id}-help`}
      onClick={() => onChange(!checked)}><span className="switch-knob" /></button>
  </div>;
}
// 分を −／＋ で変える（1回で5分。退店済みは1分）。L.O. はお席の時間より前にしかできない
function MinutesRow({ settings, field, label, help, onChange }: { settings: ShopSettings; field: MinuteSetting; label: string; help: string; onChange(change: Partial<ShopSettings>): void }) {
  const less = stepMinutes(settings, field, -1), more = stepMinutes(settings, field, 1);
  return <div className="settings-row">
    <div className="settings-row-text">
      <strong id={`${field}-label`}>{label}</strong>
      <p className="settings-help">{help}</p>
    </div>
    <div className="minutes-stepper" role="group" aria-labelledby={`${field}-label`}>
      <button className="panel-button small" aria-label={`${label}を短く`} disabled={!less} onClick={() => less && onChange(less)}>−</button>
      <strong aria-live="polite">{settings[field]}分</strong>
      <button className="panel-button small" aria-label={`${label}を長く`} disabled={!more} onClick={() => more && onChange(more)}>＋</button>
    </div>
  </div>;
}
function ShopNameRow({ name, onSave }: { name: string; onSave(name: string): void }) {
  return <div className="settings-row">
    <div className="settings-row-text">
      <label htmlFor="shop-name"><strong>店名</strong></label>
      <p className="settings-help">ログインしたときに、どの店か分かるように出します</p>
    </div>
    <SavedInput id="shop-name" value={name} maxLength={SHOP_NAME_MAX} placeholder="店の名前" onSave={onSave} />
  </div>;
}
// 飲み放題の区分（No.90）：名前を直す・足す・消す。消しても、その区分で案内中の卓はそのまま（名前は「消した区分」と出す）
function DrinkPlanRows({ plans, onChange }: { plans: DrinkPlan[]; onChange(plans: DrinkPlan[]): void }) {
  return <>
    <div className="settings-row">
      <div className="settings-row-text">
        <strong>飲み放題の区分</strong>
        <p className="settings-help">ご案内のときに選ぶと、その卓はコースになります（L.O.・お席の時間はファーストドリンクから数えます）。区分が無ければコースは選べません。</p>
      </div>
    </div>
    {plans.map((plan, i) => <div key={plan.id} className="settings-row drink-plan-row">
      <SavedInput id={`drink-plan-${plan.id}`} label={`区分${i + 1}の名前`} value={plan.name} maxLength={DRINK_PLAN_NAME_MAX} placeholder="区分の名前"
        onSave={name => { if (name !== '') onChange(plans.map(p => p.id === plan.id ? { ...p, name } : p)); }} />
      <button className="panel-button small danger" aria-label={`「${plan.name}」を消す`} onClick={() => onChange(plans.filter(p => p.id !== plan.id))}>消す</button>
    </div>)}
    {plans.length < DRINK_PLANS_MAX && <button className="panel-button add-plan" onClick={() => onChange([...plans, { id: newDrinkPlanId(plans, Date.now()), name: '新しい区分' }])}>＋ 区分を足す</button>}
  </>;
}
// コースのメニュー（No.89）：値段と名前・料理の数・時間を並べ、「直す」で1つずつ直す
function CourseRows({ menus, onEdit }: { menus: CourseMenu[]; onEdit(id: string | null): void }) {
  return <>
    <div className="settings-row course-list-head">
      <div className="settings-row-text">
        <strong>料理のコース</strong>
        <p className="settings-help">ご案内のときに「料理」で選びます。料理を出す順に並べておくと、詳細で1品ずつ進められます。</p>
      </div>
    </div>
    {menus.map(menu => <div key={menu.id} className="settings-row">
      <div className="settings-row-text">
        <strong>{priceLabel(menu)} {menu.short}</strong>
        <p className="settings-help">{menu.name}・{menu.dishes.length}品{menu.lastOrderMin !== null || menu.seatLimitMin !== null ? '・このコースだけの時間あり' : ''}</p>
      </div>
      <button className="panel-button" aria-label={`${priceLabel(menu)} ${menu.short}を直す`} onClick={() => onEdit(menu.id)}>直す</button>
    </div>)}
    {menus.length < COURSE_LIMITS.menus && <button className="panel-button add-plan" onClick={() => onEdit(null)}>＋ コースを足す</button>}
  </>;
}
// 店のタイマー（No.91）：トイレチェックのように、決まった間隔でやる作業。ツールバーに並べ、時間になったら知らせる
function ShopTimerRows({ timers, onChange }: { timers: ShopTimer[]; onChange(timers: ShopTimer[]): void }) {
  const put = (timer: ShopTimer) => onChange(timers.map(t => t.id === timer.id ? timer : t));
  // アイコン（No.99）：左のボタンで、そのタイマーの下に候補を開く。選ぶと閉じて、ボタンに戻る
  const [picking, setPicking] = useState<ShopTimerId | null>(null);
  const pick = (timer: ShopTimer, icon: string) => {
    if (icon !== timer.icon) put({ ...timer, icon });
    setPicking(null);
    requestAnimationFrame(() => document.getElementById(`timer-icon-${timer.id}`)?.focus());
  };
  return <>
    <p className="settings-help">ツールバーにアイコンと残り時間を出し、時間になったら知らせます。{SHOP_TIMER_LIMITS.timers}つまで。</p>
    {timers.map((timer, i) => {
      const less = stepInterval(timer, -1), more = stepInterval(timer, 1);
      const current = shopTimerIcon(timer.icon);
      const open = picking === timer.id;
      return <Fragment key={timer.id}><div className="settings-row shop-timer-row">
        <button id={`timer-icon-${timer.id}`} className="timer-icon-button" aria-expanded={open} aria-controls={`timer-icons-${timer.id}`}
          aria-label={`タイマー${i + 1}のアイコンを変える（いまは${current.name}）`} onClick={() => setPicking(open ? null : timer.id)}>
          <ShopTimerGlyph icon={timer.icon} className="timer-icon-glyph" />
        </button>
        <SavedInput id={`timer-label-${timer.id}`} label={`タイマー${i + 1}の名前`} value={timer.label} maxLength={SHOP_TIMER_LIMITS.label} placeholder="作業の名前"
          onSave={label => { if (label !== '') put({ ...timer, label }); }} />
        <div className="minutes-stepper" role="group" aria-label={`${timer.label}の間隔`}>
          <button className="panel-button small" aria-label={`${timer.label}の間隔を短く`} disabled={!less} onClick={() => less && put(less)}>−</button>
          <strong aria-live="polite">{timer.intervalMin}分ごと</strong>
          <button className="panel-button small" aria-label={`${timer.label}の間隔を長く`} disabled={!more} onClick={() => more && put(more)}>＋</button>
        </div>
        <button className="panel-button small danger" aria-label={`「${timer.label}」を消す`} onClick={() => onChange(timers.filter(t => t.id !== timer.id))}>消す</button>
      </div>
      {open && <div id={`timer-icons-${timer.id}`} className="icon-picker" role="group" aria-label={`${timer.label}のアイコン`}>
        {SHOP_TIMER_ICONS.map(icon => <button key={icon.id} className="icon-choice" aria-pressed={icon.id === current.id} onClick={() => pick(timer, icon.id)}>
          <ShopTimerGlyph icon={icon.id} className="icon-choice-glyph" /><span>{icon.name}</span>
        </button>)}
      </div>}</Fragment>;
    })}
    {timers.length < SHOP_TIMER_LIMITS.timers && <button className="panel-button add-plan"
      onClick={() => onChange([...timers, { id: newShopTimerId(timers, Date.now()), label: '新しいタイマー', icon: FALLBACK_SHOP_TIMER_ICON, intervalMin: 60 }])}>＋ タイマーを足す</button>}
  </>;
}
// 文字の設定：入力を終えたら（ほかを押す・Enter）保存する。打っている途中・かな漢字変換を確定する Enter では保存しない
function SavedInput({ id, label, value, maxLength, placeholder, onSave }: { id: string; label?: string; value: string; maxLength: number; placeholder: string; onSave(value: string): void }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const save = () => { setEditing(false); const trimmed = draft.trim(); if (trimmed !== value) onSave(trimmed); };
  return <input id={id} aria-label={label} className="field-select setting-input" maxLength={maxLength} placeholder={placeholder} value={editing ? draft : value}
    onFocus={() => { setDraft(value); setEditing(true); }} onChange={event => setDraft(event.target.value)} onBlur={save}
    onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur(); }} />;
}
