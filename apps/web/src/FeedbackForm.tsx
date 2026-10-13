import { useEffect, useState } from 'react';
import { FEEDBACK_ERROR_MESSAGE, FEEDBACK_MAX, FEEDBACK_SENT_AT_KEY, FEEDBACK_SENT_MESSAGE, FEEDBACK_WAIT_MESSAGE, FeedbackRejected, feedbackCooldownMs, feedbackText, type FeedbackStore } from '@table-check/core/feedback';
import { APP_VERSION } from './version';

// メニューで別の画面に移るとこの部品は外れる。下書きはここに残し、戻したときに出す
let keptDraft = '';

function readSentAt(): number | null {
  try {
    const raw = window.localStorage.getItem(FEEDBACK_SENT_AT_KEY);
    if (raw === null) return null;
    const at = Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch { return null; }
}

// ご意見を送る（お知らせのタブ。もとの画面。No.125）。書いた文と、版・店名を一緒に送る。連続では送れない
export function FeedbackForm({ feedbackStore, shopName }: { feedbackStore: FeedbackStore; shopName: string }) {
  const [draft, setDraft] = useState(keptDraft);
  const updateDraft = (next: string) => { keptDraft = next; setDraft(next); };
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(readSentAt);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (sentAt === null) return;
    const timer = window.setInterval(() => {
      const next = Date.now();
      setNowMs(next);
      if (feedbackCooldownMs(sentAt, next) === 0) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [sentAt]);
  const text = feedbackText(draft);
  const cooldown = feedbackCooldownMs(sentAt, nowMs);
  const rememberSent = () => {
    const at = Date.now();
    setSentAt(at);
    setNowMs(at);
    try { window.localStorage.setItem(FEEDBACK_SENT_AT_KEY, String(at)); } catch { /* 覚えられなくても、このページでは待てる */ }
  };
  const send = () => {
    if (text === null) return;
    if (feedbackCooldownMs(sentAt, Date.now()) > 0) { setResult({ ok: false, message: FEEDBACK_WAIT_MESSAGE }); return; }
    setBusy(true);
    setResult(null);
    feedbackStore.send({ message: text, version: APP_VERSION, platform: 'web', shopName }).then(sent => {
      updateDraft('');
      rememberSent();
      setResult({ ok: true, message: FEEDBACK_SENT_MESSAGE[sent] });
    }, (error: unknown) => {
      console.error(error);
      if (error instanceof FeedbackRejected) { rememberSent(); setResult({ ok: false, message: FEEDBACK_WAIT_MESSAGE }); return; }
      setResult({ ok: false, message: FEEDBACK_ERROR_MESSAGE });
    }).finally(() => setBusy(false));
  };
  return <div className="notices-feedback">
    <p className="notices-lead">使いにくいところ・ほしい機能・おかしな動きなど、なんでも書いてください。作っている人に届きます。</p>
    <div className="notices-panel notices-feedback-panel">
      <label htmlFor="feedback-text" className="notices-label">ご意見</label>
      <textarea id="feedback-text" className="field-select notices-text" rows={7} maxLength={FEEDBACK_MAX} value={draft} disabled={busy}
        placeholder="例：トイレチェックのボタンが押しにくい" aria-describedby="feedback-note" onChange={event => { updateDraft(event.target.value); setResult(null); }} />
      <div className="notices-feedback-foot">
        <p id="feedback-note" className="notices-note">
          {feedbackStore.delivers ? `アプリの版（${APP_VERSION}）${shopName ? `と店名（${shopName}）` : ''}も一緒に送ります。` : '試しなので、どこにも送られません。'}
        </p>
        <span className="notices-count" aria-hidden="true">{draft.length}/{FEEDBACK_MAX}</span>
      </div>
      {result && <p className={result.ok ? 'notices-status' : 'notices-error'} role={result.ok ? 'status' : 'alert'}>{result.message}</p>}
      <button type="button" className="panel-button primary notices-send" disabled={busy || text === null || cooldown > 0} onClick={send}>
        {busy ? '送っています…' : cooldown > 0 ? `あと${Math.ceil(cooldown / 1000)}秒` : '送る'}
      </button>
    </div>
  </div>;
}
