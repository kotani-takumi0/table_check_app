import { useCallback, useState } from 'react';
import { roadmapSeenValue, SEEN_ROADMAP_KEY, shouldShowRoadmapDot } from '@table-check/core/roadmap';

function readSeen(): string | null {
  try { return window.localStorage.getItem(SEEN_ROADMAP_KEY); } catch { return null; }
}
// 新しい予定が入ったあと、メニューに点を1回出す（No.144）。見た予定はこのブラウザに覚える。営業中の画面には出さない
export function useRoadmapDot(): { show: boolean; markSeen(): void } {
  const [show, setShow] = useState(() => shouldShowRoadmapDot(readSeen()));
  const markSeen = useCallback(() => {
    setShow(false);
    try { window.localStorage.setItem(SEEN_ROADMAP_KEY, roadmapSeenValue()); } catch { /* 覚えられなくても、このページでは出さない */ }
  }, []);
  return { show, markSeen };
}
