export type Screen = 'floor' | 'settings' | 'layout' | 'course';
// 画面の名前（メニューと見出しで同じものを使う）
export const SCREEN_LABEL: Record<Screen, string> = { floor: 'テーブル状況', settings: '設定', layout: '席の配置', course: 'コース' };
const SCREENS: Screen[] = ['floor', 'settings'];
// メニュー：ツールバー左の「メニュー」で左から出す。フロアの上に重ねる（フロアは縮めない）。面はツールバーと同じガラス。
// 選ぶとその画面に切り替えて閉じる（No.77。以前ここにあった全卓一覧はなくした）
// account・onLeave：いまの店（ログインした店はメールアドレス）を出し、ログアウト・ログインし直すで最初の画面に戻る（No.88）
export function SideMenu({ screen, onSelect, account, shopName, onLeave, inert }: { screen: Screen; onSelect(screen: Screen): void; account: string | null; shopName: string; onLeave?(): void; inert?: boolean }) {
  return <nav id="side-menu" className="side-menu glass" aria-label="メニュー" inert={inert}>
    <ul className="side-menu-items">
      {SCREENS.map(item => <li key={item}>
        <button className="side-menu-item" aria-current={item === screen || (item === 'settings' && (screen === 'layout' || screen === 'course')) ? 'page' : undefined} onClick={() => onSelect(item)}>
          <MenuIcon screen={item} />{SCREEN_LABEL[item]}
        </button>
      </li>)}
    </ul>
    {onLeave && <div className="side-menu-account">
      <p className="side-menu-shop">{shopName || (account ? 'ログインした店' : '今の店')}{account && <span className="side-menu-email">{account}</span>}</p>
      <button className="side-menu-item" onClick={onLeave}>{account ? 'ログアウト' : 'ログインする'}</button>
    </div>}
  </nav>;
}
function MenuIcon({ screen }: { screen: Screen }) {
  return <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {screen === 'floor'
      ? <><rect x="3.5" y="4" width="7" height="7" rx="2" /><rect x="13.5" y="4" width="7" height="7" rx="2" /><rect x="3.5" y="14" width="7" height="6" rx="2" /><circle cx="17" cy="17" r="3" /></>
      : <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>}
  </svg>;
}
