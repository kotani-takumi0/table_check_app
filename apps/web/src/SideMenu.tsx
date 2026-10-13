export type Screen = 'floor' | 'settings' | 'layout' | 'course' | 'notices';
// 画面の名前（メニューと見出しで同じものを使う）
export const SCREEN_LABEL: Record<Screen, string> = { floor: 'テーブル状況', settings: '設定', layout: '席の配置', course: 'コース', notices: 'お知らせ' };
const SCREENS: Screen[] = ['floor', 'settings', 'notices'];
// メニュー：ツールバー左の「メニュー」で左から出す。フロアの上に重ねる（フロアは縮めない）。面はツールバーと同じガラス。
// 選ぶとその画面に切り替えて閉じる（No.77。以前ここにあった全卓一覧はなくした）
// account・onLeave：いまの店（ログインした店はメールアドレス）を出し、ログアウト・ログインし直すで最初の画面に戻る（No.88）
// roadmapNew：新しい予定があるとき、お知らせに点を出す（No.144。営業中の画面には出さない）
export function SideMenu({ screen, onSelect, account, shopName, onLeave, leaveError, inert, roadmapNew = false }: { screen: Screen; onSelect(screen: Screen): void; account: string | null; shopName: string; onLeave?(): void; leaveError: string; inert?: boolean; roadmapNew?: boolean }) {
  return <nav id="side-menu" className="side-menu sheet" aria-label="メニュー" inert={inert}>
    <ul className="side-menu-items">
      {SCREENS.map(item => <li key={item}>
        <button className="side-menu-item" aria-current={item === screen || (item === 'settings' && (screen === 'layout' || screen === 'course')) ? 'page' : undefined}
          aria-label={item === 'notices' && roadmapNew ? 'お知らせ、新しい予定があります' : undefined} onClick={() => onSelect(item)}>
          <MenuIcon screen={item} />{SCREEN_LABEL[item]}
          {item === 'notices' && roadmapNew && <span className="side-menu-dot" aria-hidden="true" />}
        </button>
      </li>)}
    </ul>
    {onLeave && <div className="side-menu-account">
      <p className="side-menu-shop">{shopName || (account ? 'ログインした店' : '今の店')}{account && <span className="side-menu-email">{account}</span>}</p>
      <button className="side-menu-item" onClick={onLeave}>{account ? 'ログアウト' : 'ログインする'}</button>
      {leaveError && <p className="side-menu-error" role="alert">{leaveError}</p>}
    </div>}
  </nav>;
}
function MenuIcon({ screen }: { screen: Screen }) {
  return <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {screen === 'floor'
      ? <><rect x="3.5" y="4" width="7" height="7" rx="2" /><rect x="13.5" y="4" width="7" height="7" rx="2" /><rect x="3.5" y="14" width="7" height="6" rx="2" /><circle cx="17" cy="17" r="3" /></>
      : screen === 'notices'
      ? <path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 4.2 1.8 5.5 1.8 5.5H4.7S6.5 13.2 6.5 9zM10 18.2a2 2 0 0 0 4 0" />
      : <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>}
  </svg>;
}
