import { useState, type CSSProperties } from 'react';
import { GRID } from '@table-check/core/layout';
import type { ShopLayout } from '@table-check/core/shopLayout';
import { BLANK_LAYOUT, SHOP_TEMPLATES, type ShopTemplate } from '@table-check/core/shopTemplates';
import { LayoutEditor } from './LayoutEditor';

// 最初のページ（No.087）：ログインした店で、席の配置をまだ保存していなければ出す。
// テンプレートを選ぶと、配置と設定一式を入れてすぐ使い始める。「自分で作る」は何もないマス目から配置を作る（保存すると使い始める）
export function FirstPage({ account, onTemplate, onBlank, onLeave }: { account: string; onTemplate(template: ShopTemplate): Promise<void>; onBlank(layout: ShopLayout): Promise<void>; onLeave(): void }) {
  const [blank, setBlank] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (blank) return <main className="app"><LayoutEditor layout={BLANK_LAYOUT} occupied={new Set()} onSave={onBlank} onClose={() => setBlank(false)} /></main>;
  const choose = (template: ShopTemplate) => {
    setBusy(true);
    setError('');
    onTemplate(template).catch((reason: unknown) => { setError(`始められませんでした。もう一度押してください（${reason instanceof Error ? reason.message : '理由が分かりません'}）`); setBusy(false); });
  };
  return <main className="first-page">
    <section className="first-card" aria-labelledby="first-title">
      <h1 id="first-title">お店の形を選んでください</h1>
      <p className="settings-help">選ぶと、席の配置とコース・飲み放題の区分・店のタイマー・時間のルールが入り、すぐに使えます。あとから設定でいつでも変えられます。</p>
      <div className="template-list">
        {SHOP_TEMPLATES.map(template => <button key={template.id} className="template-choice" disabled={busy} onClick={() => choose(template)}>
          <LayoutPreview layout={template.layout} />
          <strong>{template.name}</strong>
          <p className="settings-help">{template.help}</p>
        </button>)}
        <button className="template-choice" disabled={busy} onClick={() => setBlank(true)}>
          <div className="template-preview blank" aria-hidden="true">＋</div>
          <strong>何もない状態から自分で作る</strong>
          <p className="settings-help">マス目に卓を置いて配置を作ります。コース・区分・店のタイマーはあとから設定で足します。</p>
        </button>
      </div>
      {error && <p className="confirm-warning" role="alert">{error}</p>}
      <div className="first-foot">
        <p className="settings-help">{account} でログインしています</p>
        <button className="panel-button" disabled={busy} onClick={onLeave}>ログアウト</button>
      </div>
    </section>
  </main>;
}
// テンプレートの配置を小さく見せる（卓・目印の場所だけ）
function LayoutPreview({ layout }: { layout: ShopLayout }) {
  const area = (box: { col: number; colSpan: number; row: number; rowSpan: number }): CSSProperties => ({ gridColumn: `${box.col} / span ${box.colSpan}`, gridRow: `${box.row} / span ${box.rowSpan}` });
  return <div className="template-preview" aria-hidden="true" style={{ '--cols': GRID.cols, '--rows': GRID.rows } as CSSProperties}>
    {layout.labels.map((label, i) => <span key={`l${i}`} className="label" style={area(label)} />)}
    {layout.seats.map(seat => <span key={seat.id} className={seat.kind} style={area(seat)} />)}
  </div>;
}
