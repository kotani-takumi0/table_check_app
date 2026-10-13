import { useEffect, useRef, useState } from 'react';
import { FEEDBACK_ERROR_MESSAGE, FEEDBACK_MAX, FEEDBACK_SENT_AT_KEY, FEEDBACK_SENT_MESSAGE, FEEDBACK_UNCONFIRMED_MESSAGE, FEEDBACK_WAIT_MESSAGE, FeedbackRejected, feedbackAccepted, feedbackCooldownMs, feedbackShopSwitch, feedbackText, type FeedbackStore } from '@table-check/core/feedback';
import { APP_VERSION } from './version';

// メニューで別の画面に移るとこの部品は外れる。下書きはここに残し、戻したときに出す。店が替わったら空にする
let keptDraft = '';
let keptShop = '';
function draftForShop(shopId: string): { draft: string; checking: false } {
  const next = feedbackShopSwitch(keptShop, keptDraft, shopId);
  keptShop = next.shop;
  keptDraft = next.draft;
  return next;
}

function readSentAt(): number | null {
  try {
    const raw = window.localStorage.getItem(FEEDBACK_SENT_AT_KEY);
    if (raw === null) return null;
    const at = Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch { return null; }
}

// ご意見を送る（お知らせのタブ。もとの画面。No.125）。書いた文と、版・店名を一緒に送る。連続では送れない
export function FeedbackForm({ feedbackStore, shopName, shopId }: { feedbackStore: FeedbackStore; shopName: string; shopId: string }) {
  const [draft, setDraft] = useState(() => draftForShop(shopId).draft);
  const updateDraft = (next: string) => { keptDraft = next; setDraft(next); };
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'pending' | 'error'; message: string } | null>(null);
  // 確かめている途中で店が替わったら、下書きは消え、押せない状態も解ける（意図どおり）
  useEffect(() => { const next = draftForShop(shopId); setDraft(next.draft); setResult(null); setChecking(next.checking); }, [shopId]);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
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
    try { window.localStorage.setItem(FEEDBACK_SENT_AT_KEY, String(at)); } catch { /* 覚えられなくても、このページでは待てる */ }
    if (!alive.current) return;
    setSentAt(at);
    setNowMs(at);
  };
  const accept = (sentText: string) => {
    if (keptShop === shopId && feedbackText(keptDraft) === sentText) { keptDraft = ''; if (alive.current) setDraft(''); }
    rememberSent();
    if (alive.current) setResult({ tone: 'ok', message: FEEDBACK_SENT_MESSAGE });
  };
  const fail = (error: unknown) => {
    console.error(error);
    if (!alive.current) return;
    if (error instanceof FeedbackRejected) { rememberSent(); setResult({ tone: 'error', message: FEEDBACK_WAIT_MESSAGE }); return; }
    setResult({ tone: 'error', message: FEEDBACK_ERROR_MESSAGE });
  };
  const send = () => {
    if (text === null) return;
    if (feedbackCooldownMs(sentAt, Date.now()) > 0) { setResult({ tone: 'error', message: FEEDBACK_WAIT_MESSAGE }); return; }
    const sentText = text;
    setBusy(true);
    setResult(null);
    feedbackStore.send({ message: sentText, version: APP_VERSION, platform: 'web', shopName }).then(ack => {
      if (feedbackAccepted(ack.delivery)) accept(sentText);
      else {
        if (alive.current) { setChecking(true); setResult({ tone: 'pending', message: FEEDBACK_UNCONFIRMED_MESSAGE }); }
        void ack.confirmed.then(() => { if (alive.current) setChecking(false); accept(sentText); }, error => { if (alive.current) setChecking(false); fail(error); });
      }
    }, fail).finally(() => { if (alive.current) setBusy(false); });
  };
  return <div className="notices-feedback">
    <p className="notices-lead">使いにくいところ・ほしい機能・おかしな動きなど、なんでも書いてください。作っている人に届きます。</p>
    <div className="notices-panel notices-feedback-panel">
      <label htmlFor="feedback-text" className="notices-label">ご意見</label>
      <textarea id="feedback-text" className="field-select notices-text" rows={7} maxLength={FEEDBACK_MAX} value={draft} disabled={busy} readOnly={checking}
        placeholder="例：トイレチェックのボタンが押しにくい" aria-describedby="feedback-note" onChange={event => { updateDraft(event.target.value); setResult(null); }} />
      <div className="notices-feedback-foot">
        <p id="feedback-note" className="notices-note">
          {feedbackStore.delivers ? `アプリの版（${APP_VERSION}）${shopName ? `と店名（${shopName}）` : ''}も一緒に送ります。` : '試しなので、どこにも送られません。'}
        </p>
        <span className="notices-count" aria-hidden="true">{draft.length}/{FEEDBACK_MAX}</span>
      </div>
      {result && <p className={result.tone === 'ok' ? 'notices-status' : result.tone === 'pending' ? 'notices-pending' : 'notices-error'} role={result.tone === 'error' ? 'alert' : 'status'}>{result.message}</p>}
      <button type="button" className="panel-button primary notices-send" disabled={busy || checking || text === null || cooldown > 0} onClick={send}>
        {checking ? '確かめています…' : busy ? '送っています…' : cooldown > 0 ? `あと${Math.ceil(cooldown / 1000)}秒` : '送る'}
      </button>
    </div>
  </div>;
}
