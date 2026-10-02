import { RULES } from '@table-check/core/domain';
import type { ShopSettings } from '@table-check/core/shopSettings';

// 設定の画面（メニューの「設定」）。店全体の設定は全端末に反映する
export function Settings({ settings, onTimeLimitOff, onOpenLayout, inert }: { settings: ShopSettings; onTimeLimitOff(off: boolean): void; onOpenLayout(): void; inert?: boolean }) {
  return <section className="settings" aria-labelledby="settings-title" inert={inert}>
    <h1 id="settings-title" className="settings-title">設定</h1>
    <div className="settings-group glass">
      <h2 className="settings-group-title">時間のルール</h2>
      <div className="settings-row">
        <div className="settings-row-text">
          <strong id="time-limit-off-label">時間制限なし</strong>
          <p id="time-limit-off-help" className="settings-help">空いている日などに、L.O.・お席の時間の通知と色を止めます。経過の時間とお通しの警告はそのまま出します。すべての端末に反映されます。</p>
        </div>
        {/* No.80：空いているかは日によって違うので、自動では切り替えずにここでオン・オフする */}
        <button className="switch" role="switch" aria-checked={settings.timeLimitOff} aria-labelledby="time-limit-off-label" aria-describedby="time-limit-off-help"
          onClick={() => onTimeLimitOff(!settings.timeLimitOff)}><span className="switch-knob" /></button>
      </div>
      <p className="settings-note">ふだんのルール：お通しは案内から{RULES.otoshiWarnMin}分、L.O.は{RULES.lastOrderMin}分、お席の時間は{RULES.seatLimitMin}分（コースはファーストドリンクから数えます）</p>
    </div>
    <div className="settings-group glass">
      <h2 className="settings-group-title">お店</h2>
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
