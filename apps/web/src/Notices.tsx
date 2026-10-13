import { ROADMAP_CTA_DETAIL, ROADMAP_CTA_TITLE, ROADMAP_EMPTY, ROADMAP_FROM_FEEDBACK_LABEL, ROADMAP_NOTE, ROADMAP_STAGE_LABEL, roadmapGroups } from '@table-check/core/roadmap';
import type { FeedbackStore } from '@table-check/core/feedback';
import { FeedbackForm } from './FeedbackForm';
import { ReleaseNotes } from './ReleaseNotes';

export type NoticeTab = 'roadmap' | 'updates' | 'feedback';
const TABS: { id: NoticeTab; label: string }[] = [
  { id: 'roadmap', label: '今後の予定' },
  { id: 'updates', label: '最近の更新' },
  { id: 'feedback', label: 'ご意見を送る' },
];

// お知らせ（No.144）。今後の予定・最近の更新・ご意見を送るを、1つの画面のタブにまとめる
export function Notices({ tab, onTab, roadmapNew, feedbackStore, shopName, shopId, inert }: {
  tab: NoticeTab; onTab(tab: NoticeTab): void; roadmapNew: boolean; feedbackStore: FeedbackStore; shopName: string; shopId: string; inert?: boolean;
}) {
  return <section className="notices" aria-label="お知らせ" inert={inert}>
    <div className="notices-wrap">
      <h1 className="sr-only">お知らせ</h1>
      <div className="notices-tabs" role="tablist" aria-label="お知らせの種類">
        {TABS.map(item => <button key={item.id} type="button" role="tab" id={`notice-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`notice-panel-${item.id}`}
          className={`notices-tab${tab === item.id ? ' on' : ''}`} onClick={() => onTab(item.id)}>
          {item.label}
          {item.id === 'roadmap' && roadmapNew && <span className="notices-dot"><span className="sr-only">新しい予定</span></span>}
        </button>)}
      </div>
      <div role="tabpanel" id={`notice-panel-${tab}`} aria-labelledby={`notice-tab-${tab}`}>
        {tab === 'roadmap' ? <Roadmap onFeedback={() => onTab('feedback')} />
          : tab === 'updates' ? <ReleaseNotes />
          : <FeedbackForm feedbackStore={feedbackStore} shopName={shopName} shopId={shopId} />}
      </div>
    </div>
  </section>;
}

function Roadmap({ onFeedback }: { onFeedback(): void }) {
  const groups = roadmapGroups();
  if (groups.length === 0) return <div className="notices-panel notices-empty">
    <p className="notices-empty-text">{ROADMAP_EMPTY}</p>
    <button type="button" className="notices-cta-button" onClick={onFeedback}>ご意見を送る</button>
  </div>;
  return <>
    {groups.map(group => <section key={group.stage} aria-labelledby={`roadmap-${group.stage}`}>
      <h2 id={`roadmap-${group.stage}`} className="notices-stage">{ROADMAP_STAGE_LABEL[group.stage]}</h2>
      <div className="notices-panel">
        {group.items.map(item => <article key={item.id} className="notices-row">
          <span className={`notices-chip${item.stage === 'preparing' ? ' prep' : ''}`}>{ROADMAP_STAGE_LABEL[item.stage]}</span>
          <div>
            <h3 className="notices-title">{item.title}</h3>
            <p className="notices-detail">{item.detail}</p>
            {item.fromFeedback && <p className="notices-from"><SpeechIcon />{ROADMAP_FROM_FEEDBACK_LABEL}</p>}
          </div>
        </article>)}
      </div>
    </section>)}
    <p className="notices-note">{ROADMAP_NOTE}</p>
    <div className="notices-cta">
      <div>
        <p className="notices-cta-title">{ROADMAP_CTA_TITLE}</p>
        <p className="notices-detail">{ROADMAP_CTA_DETAIL}</p>
      </div>
      <button type="button" className="notices-cta-button" onClick={onFeedback}>ご意見を送る</button>
    </div>
  </>;
}

function SpeechIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v7a1.5 1.5 0 0 1-1.5 1.5H10l-3.5 3v-3H6.5A1.5 1.5 0 0 1 5 13.5z" />
  </svg>;
}
