import { useState } from 'react';
import { FEEDBACK_ERROR_MESSAGE, FEEDBACK_MAX, FEEDBACK_SENT_MESSAGE, feedbackText, type FeedbackStore } from '@table-check/core/feedback';
import { APP_VERSION } from './version';

// ご意見を送る画面（メニューの「ご意見を送る」。No.125）。書いた文と、版・店名を一緒に送る
export function FeedbackForm({ feedbackStore, shopName, inert }: { feedbackStore: FeedbackStore; shopName: string; inert?: boolean }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const text = feedbackText(draft);
  const send = () => {
    if (text === null) return;
    setBusy(true);
    setResult(null);
    feedbackStore.send({ message: text, version: APP_VERSION, platform: 'web', shopName }).then(sent => {
      setDraft('');
      setResult({ ok: true, message: FEEDBACK_SENT_MESSAGE[sent] });
    }, (error: unknown) => {
      console.error(error);
      setResult({ ok: false, message: FEEDBACK_ERROR_MESSAGE });
    }).finally(() => setBusy(false));
  };
  return <section className="settings" aria-labelledby="feedback-title" inert={inert}>
    <div className="settings-head">
      <h1 id="feedback-title" className="settings-title">ご意見を送る</h1>
      <p className="settings-help">使いにくいところ・ほしい機能・おかしな動きなど、なんでも書いてください。作っている人に届きます。</p>
    </div>
    <div className="settings-group sheet feedback-group">
      <label htmlFor="feedback-text" className="feedback-label"><strong>ご意見</strong></label>
      <textarea id="feedback-text" className="field-select feedback-text" rows={7} maxLength={FEEDBACK_MAX} value={draft} disabled={busy}
        placeholder="例：トイレチェックのボタンが押しにくい" aria-describedby="feedback-note" onChange={event => { setDraft(event.target.value); setResult(null); }} />
      <div className="feedback-foot">
        <p id="feedback-note" className="settings-help">
          {feedbackStore.delivers ? `アプリの版（${APP_VERSION}）${shopName ? `と店名（${shopName}）` : ''}も一緒に送ります。` : '試しなので、どこにも送られません。'}
        </p>
        <span className="feedback-count" aria-hidden="true">{draft.length}/{FEEDBACK_MAX}</span>
      </div>
      <div className="feedback-actions">
        {result && <p className={`settings-help ${result.ok ? '' : 'feedback-error'}`} role={result.ok ? 'status' : 'alert'}>{result.message}</p>}
        <button className="panel-button primary" disabled={busy || text === null} onClick={send}>{busy ? '送っています…' : '送る'}</button>
      </div>
    </div>
  </section>;
}
