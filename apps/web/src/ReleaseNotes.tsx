import { RELEASE_NOTES, releaseDateLabel } from '@table-check/core/releaseNotes';
import { APP_VERSION } from './version';

// 最近の更新（お知らせのタブ。もとの「更新のお知らせ」。No.127）。版ごとに、何が変わったかを新しい順に出す
export function ReleaseNotes() {
  return <div className="notices-updates">
    <p className="notices-lead">版ごとに、新しくなったところをまとめています。いまの版は {APP_VERSION} です。</p>
    {RELEASE_NOTES.map(note => {
      const current = `v${note.version}` === APP_VERSION;
      return <article key={note.version} className="notices-panel" aria-labelledby={`release-${note.version}`}>
        <h2 id={`release-${note.version}`} className="notices-release-head">
          <span className="notices-title">v{note.version}</span>
          {current && <span className="notices-chip prep">いまの版</span>}
          <time className="notices-release-date" dateTime={note.date}>{releaseDateLabel(note.date)}</time>
        </h2>
        <ul className="notices-release-items">{note.items.map(item => <li key={item}>{item}</li>)}</ul>
      </article>;
    })}
  </div>;
}

// 新しい版になったあとに1回だけ出す帯（No.127）。「内容を見る」で最近の更新を開き、× で閉じる。どちらでもこの版はもう出さない
export function ReleaseBar({ onOpen, onClose }: { onOpen(): void; onClose(): void }) {
  return <div className="undo-bar release-bar" role="status">
    <span className="undo-message">{APP_VERSION} になりました</span>
    <button className="undo-button" onClick={onOpen}>内容を見る</button>
    <button className="release-bar-close" aria-label="閉じる" onClick={onClose}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </div>;
}
