import { useCallback, useState } from 'react';
import { releaseNoteOf, SEEN_RELEASE_KEY, shouldAnnounce } from '@table-check/core/releaseNotes';
import { APP_VERSION } from './version';

function readSeen(): string | null {
  try { return window.localStorage.getItem(SEEN_RELEASE_KEY); } catch { return null; }
}
// 新しい版のお知らせを出すか（No.127）。見た版はこのブラウザに覚える。覚えられない環境では、開くたびに1回出る
export function useReleaseAnnounce(): { announce: boolean; markSeen(): void } {
  const [announce, setAnnounce] = useState(() => shouldAnnounce(readSeen(), APP_VERSION));
  const markSeen = useCallback(() => {
    setAnnounce(false);
    const note = releaseNoteOf(APP_VERSION);
    try { if (note) window.localStorage.setItem(SEEN_RELEASE_KEY, note.version); } catch { /* 覚えられなくても、このページでは出さない */ }
  }, []);
  return { announce, markSeen };
}
