import { useState } from 'react';
import { SHOP_NAME_MAX, stepMinutes, type MinuteSetting, type ShopSettings } from '@table-check/core/shopSettings';

// 設定の画面（メニューの「設定」）。店全体の設定は全端末に反映する
export function Settings({ settings, onChange, onOpenLayout, inert }: { settings: ShopSettings; onChange(change: Partial<ShopSettings>): void; onOpenLayout(): void; inert?: boolean }) {
  return <section className="settings" aria-labelledby="settings-title" inert={inert}>
    <h1 id="settings-title" className="settings-title">設定</h1>
    <div className="settings-group glass">
      <h2 className="settings-group-title">時間のルール</h2>
      <SwitchRow id="time-limit-off" label="時間制限なし" checked={settings.timeLimitOff} onChange={timeLimitOff => onChange({ timeLimitOff })}
        help="空いている日などに、L.O.・お席の時間の通知と色を止めます。経過の時間とお通しの警告はそのまま出します。" />
      {/* No.14：店ごとに分を決める。L.O.・お席の時間は案内（コースはファーストドリンク）から数える */}
      <MinutesRow settings={settings} field="lastOrderMin" label="L.O." help="案内から数えます（コースはファーストドリンクから）" onChange={onChange} />
      <MinutesRow settings={settings} field="seatLimitMin" label="お席の時間" help="案内から数えます（コースはファーストドリンクから）" onChange={onChange} />
      <SwitchRow id="otoshi" label="お通しを出す" checked={settings.otoshi} onChange={otoshi => onChange({ otoshi })}
        help="出さない店は「お通し提供済み」を「ファーストドリンク提供済み」と呼び、お通し未提供の警告を出しません。" />
      {settings.otoshi && <MinutesRow settings={settings} field="otoshiWarnMin" label="お通しの警告" help="案内からこの時間たってもお通しがまだなら知らせます" onChange={onChange} />}
      <MinutesRow settings={settings} field="exitedKeepMin" label="退店済みを残す" help="退店したあと、卓に退店済みを出しておく時間" onChange={onChange} />
      <p className="settings-note">変えると、すべての端末にすぐ反映されます。</p>
    </div>
    <div className="settings-group glass">
      <h2 className="settings-group-title">お店</h2>
      <ShopNameRow name={settings.shopName} onSave={shopName => onChange({ shopName })} />
      <div className="settings-row">
        <div className="settings-row-text">
          <strong>席の配置</strong>
          <p className="settings-help">卓の場所・大きさ・卓番と、カウンターなどのことばを、マス目にブロックを置いて作り直します。すべての端末に反映されます。</p>
        </div>
        <button className="panel-button" onClick={onOpenLayout}>変える</button>
      </div>
    </div>
  </section>;
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
// 店名：入力を終えたら（ほかを押す・Enter）保存する。打っている途中では保存しない
function ShopNameRow({ name, onSave }: { name: string; onSave(name: string): void }) {
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);
  const value = editing ? draft : name;
  const save = () => { setEditing(false); const trimmed = draft.trim(); if (trimmed !== name) onSave(trimmed); };
  return <div className="settings-row">
    <div className="settings-row-text">
      <label htmlFor="shop-name"><strong>店名</strong></label>
      <p className="settings-help">ログインしたときに、どの店か分かるように出します</p>
    </div>
    <input id="shop-name" className="field-select shop-name" maxLength={SHOP_NAME_MAX} placeholder="店の名前" value={value}
      onFocus={() => { setDraft(name); setEditing(true); }} onChange={event => setDraft(event.target.value)} onBlur={save}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
  </div>;
}
