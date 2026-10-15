---
name: Minopal
description: 飲食店ホール用の卓タイマー。一瞥で読めるフロア図
colors:
  page: "#ffffff"
  tile: "#f3f6f4"
  area: "#ebf0ed"
  ink: "#16211b"
  ink-2: "#4b5a51"
  muted: "#627168"
  line: "#e2e9e4"
  edge: "#bcc6c0"
  dash: "#a9b5ae"
  track: "#e5ebe7"
  key: "#1b7a3e"
  key-hover: "#156332"
  key-wash: "#e7f3eb"
  now: "#d93036"
  now-ink: "#b3242a"
  now-wash: "#fdf0f0"
  now-line: "#f2b8ba"
  soon: "#ffb020"
  soon-edge: "#c96f00"
  soon-ink: "#7a4300"
  soon-wash: "#fff5e3"
  soon-line: "#f1cf95"
  focus: "#ffd43d"
typography:
  display:
    fontFamily: "'Noto Sans JP', system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.3
  headline:
    fontFamily: "'Noto Sans JP', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "'Noto Sans JP', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "'Noto Sans JP', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Noto Sans JP', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.4
  seat-number:
    fontFamily: "'Inter', 'Noto Sans JP', sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  elapsed:
    fontFamily: "'Inter', 'Noto Sans JP', sans-serif"
    fontSize: "46px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  clock:
    fontFamily: "'Inter', 'Noto Sans JP', sans-serif"
    fontSize: "22px"
    fontWeight: 600
    fontFeature: "tnum"
rounded:
  mini: "6px"
  control: "8px"
  card: "10px"
  panel: "12px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.key}"
    textColor: "{colors.page}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "48px"
  button-next:
    backgroundColor: "{colors.key}"
    textColor: "{colors.page}"
    rounded: "{rounded.control}"
    height: "56px"
    width: "100%"
  button-line:
    backgroundColor: "{colors.page}"
    textColor: "{colors.key}"
    rounded: "{rounded.control}"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.now}"
    textColor: "{colors.page}"
    rounded: "{rounded.control}"
    height: "48px"
  choice:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "46px"
  choice-selected:
    backgroundColor: "{colors.key-wash}"
    textColor: "{colors.key}"
    rounded: "{rounded.control}"
    height: "46px"
  stepper-button:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    size: "56px"
  field-select:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "48px"
  seat-card:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "10px 12px"
  seat-card-soon:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  seat-card-now:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  status-band-now:
    backgroundColor: "{colors.now}"
    textColor: "{colors.page}"
    height: "32px"
  status-band-soon:
    backgroundColor: "{colors.soon}"
    textColor: "{colors.ink}"
    height: "32px"
  panel:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px 18px 18px"
    width: "360px"
  toast:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "4px 6px 4px 12px"
---

# Design System: Minopal

## Overview

**Creative North Star: "役所の書類のような卓の一覧"**

Minopal は、デジタル庁デザインシステム（DADS）のような堅実さでふるまう。卓の状態を、帳票の罫線とラベルのように、誰が見ても同じに読めるようにする。お盆を持って通りがかった人が一瞥すると、赤い帯の付いた卓へ目が行き、その帯の語（「お通し未提供」）でやることがわかる。卓を押すとそばにパネルが出て、いちばん大きい塗りのボタンを押せば状態が進む。

白い地に 1px の灰色の線、角丸 8px。ガラス・ぼかし・暗い画面（ダーク）はやめた（2026-10-06 ユーザー決定。No.107）。色はキーの緑を1色と、DADS の意味の色（赤＝いま対応、橙＝もうすぐ）だけ。ふだんの卓は白と黒だけで、段階は文字で読ませる。

**Key Characteristics:**
- 白い面と 1px の線。影は浮かぶもの（パネル・通知・メニュー）の下だけ
- 色の役割は4つ（押す・選ぶ＝緑、いま対応＝赤、もうすぐ＝橙、ふだん＝白と黒）
- 卓カードの主役は大きな経過（時:分）と、120分の物差し
- ボタンは3段：塗り・枠・下線の文字。大きい塗りのボタンは1画面に1つ
- 数字は Inter の等幅（tabular-nums）
- フォーカスは黄と黒の二重の輪

いまこの作りなのは Web（`apps/web/src/App.css`）。iOS（`apps/ios/src/theme.ts`）は前の見た目のままで、No.111 で同じ作りにする。

## Colors

どの色も「何をしてほしいか」を表し、「どの段階か」は表さない。

### Primary
- **キーの緑 Key `#1b7a3e`**：操作の色。塗りのボタン、枠のボタンと下線の文字、選んでいるもの（淡い `key-wash` の地＋緑の枠）、物差しの経過、次に出す料理の枠、移動先の空席、スイッチのオン、編集中の印、詳細を開いている卓の枠。店のタイマーのアイコンも緑。

### Secondary
- **いま対応の赤 Now `#d93036`**：お通し未提供・お席の時間の卓、オフライン、店のタイマーの「時間です」、全卓消去。卓は 2px の赤い枠と、赤く塗った下の帯（白い文字）、赤い物差し。パネルの中では淡い `now-wash` の地に `now-ink` の文字。

### Tertiary
- **もうすぐの橙 Soon `#ffb020`**：L.O.の時間の卓と送信待ち。卓は 2px の `soon-edge` の枠と、橙に塗った下の帯（墨の文字）、`soon-edge` の物差し。

### Neutral
- **面 Page `#ffffff`**：ヘッダー、卓カード、パネル、設定のまとまり。
- **地 Tile `#f3f6f4`**：画面の地（うっすら緑）。空席はこの地に点線。
- **場所 Area `#ebf0ed`**：カウンターなど、フロアのことばの場所。
- **墨 Ink `#16211b` / Ink-2 `#4b5a51` / Muted `#627168`**：本文・卓番 / 補助の文字・残り時間 / 空席の卓番・版の表示。
- **線 Line `#e2e9e4` / Edge `#bcc6c0` / Dash `#a9b5ae`**：区切りの線 / 卓・入力・ふつうのボタンの枠 / 空席の点線。
- **物差しの地 Track `#e5ebe7`**。

### Named Rules
**The 色は知らせ Rule.** 色が付くのは対応が要る卓だけ。新しい段階を足しても色は増やさず、段階は文字で出す。

**The 4つの役割 Rule.** 押す・選ぶ・移動先は緑。急ぎは赤（いま）か橙（もうすぐ）のどちらかに入れる。緑を飾りに使わない。

**The 印だけは別 Rule.** 名前「Minopal」の横の印（2×2の四角。緑・淡い緑の丸・緑・右下だけ赤）とアプリのアイコンは、この役割の外のロゴとして扱う（2026-10-07 ユーザー決定）。印の赤は知らせではないので、ほかの場所の飾りに赤を広げない。iOS のアイコン（`apps/ios/assets/app.icon`）は、形と色を印と同じにし（透けない塗り、白の地）、Liquid Glass はふちの光とごく薄い影だけ使う。

**The 語が本体 Rule.** 警告には必ず短い語（「お席の時間」「お通し未提供」「L.O.の時間」）を付ける。色だけでは伝えない。

**The 4.5:1 Rule.** 文字は置かれる地に対して 4.5:1 以上。

## Typography

**Body Font:** Noto Sans JP（400 / 500 / 700 / 800）
**Number Font:** Inter（500 / 600 / 700、`tnum` と `cv11`）。卓番・経過・時刻・人数・分など数字だけ

**Character:** 公共の書類のような、癖のない日本語のゴシック。時刻と経過は1分ごとに変わるので、桁の幅が動かないよう数字は Inter の等幅にする。本文は 16px が基準、字間は 0.02em。

### Hierarchy
- **Display**（700、26px）：設定・席の配置などの画面の題、ログインの名前。
- **Headline**（700、24px）：詳細パネルの今の段階（「ご案内済み」）。
- **Title**（700、17px）：設定のまとまりの見出し、ヘッダーの名前。
- **Body**（400、16px）：本文。ボタンは 15px・700。補助の説明は 13px。
- **Label**（700、14px）：入力の見出し、卓カードの下の帯。
- **Seat Number**（Inter 700、20px）：卓番。カウンター 17px、スマホ 12px。
- **Elapsed**（Inter 600、大きい卓は最大 46px）：卓カードの経過。マスの大きさに合わせて縮める。
- **Clock**（Inter 600、22px）：ヘッダーの時刻。

### Named Rules
**The 等幅の数字 Rule.** 時刻・経過・人数・品数など、数字には Inter と `tabular-nums` を使う。

**The 10px の床 Rule.** 10px より小さい文字は作らない。入らないなら要素を外して詳細パネルへ送る。

## Layout

フロア図が画面のすべて。上に白い固定のヘッダー（高さ 56px、スマホは 48px）、その下に店の席の並びを 15列×10行のマス目でそのまま置く（No.108）。マスはすべて同じ大きさの正方形で、画面に縦横とも入るいちばん大きい大きさ（横向きのタブレットで約64px）。何も置いていないマスも薄い面で見せ、画面全体を1枚のマス目にする。

- **マス目の隙間**：6px（スマホは4px）。
- **縦向き**：卓・ことばを置いている行までを、時計回りに90°回して出す（今の配置なら 7列×15行）。
- **卓カードの姿**：大きい卓（卓番・人数／区分／大きな経過／物差し／下の帯）、低い卓（卓番・人数・段階・経過を1行に、その下に物差し。帯は出さず、警告は段階の語を赤・橙で塗る）、細い卓（上から卓番、人数と区分、経過、物差し、帯）、カウンター（卓番・経過・物差し。警告は下の色の線）、スマホ（卓番・経過・物差し・帯。低いマスは帯を省き、警告は下の色の線）。
- **狭い画面**（No.146）：マスは 56px（スマホは 44px）より小さくしない。画面幅に合わせて縮めるのはそこまでで、入りきらなければ配置図だけを縦に、必要なら横にもスクロールする。上の帯は固定。卓番・段階の文字は 11px、経過の文字は 14px より小さくしない。通知のベルを押すと、その卓まで動いて少し光らせる。下限に当たらない iPad や大きいスマホは、今の見た目のまま。
- **パネル**：押した卓のそばに出す（右に入らなければ左）。後ろは暗くせず、開いている卓を緑の枠で囲む。スマホは下から出すシート（No.110）。
- **設定**：左に見出しの目次（幅200px、いま見ているまとまりを緑）、右に白いまとまり（最大720px）。スマホは目次を隠す。
- **余白**：4 / 6 / 8 / 12 / 16 / 24px。

## Elevation & Depth

基本は平ら。面の区別は 1px の線と地の色で付ける。卓カードはごく薄い影（`lift`）だけ。影を落とすのは、フロアの上に浮かぶもの（詳細パネル・ご案内・確認・通知・メニュー）の下だけ。

### Shadow Vocabulary
- **lift**（`0 1px 2px rgb(22 33 27 / 0.06)`）：卓カード、席の配置のブロック。
- **float**（`0 2px 6px` と `0 16px 40px`、墨の8%・16%）：パネル・通知・メニュー・ログインのカード。
- **急ぎの卓**（`0 2px 10px`、赤・橙の12%）：いま対応・もうすぐの卓カード。

### Named Rules
**The 暗くするのは全卓消去だけ Rule.** 卓のそばに出すパネルとポップオーバーは後ろを暗くしない。後ろを止める（暗くする）のは全卓消去の確認だけ。メニューの後ろはごく薄く（12%）。

## Shapes

角丸は小さく、段は少なく：ボタン・入力・チップ 8px、卓カード 10px、パネル・設定のまとまり・ログイン 12px。カプセルの形と丸いボタンは使わない（スイッチのつまみだけ丸）。空席はテーブルもカウンターも四角の点線。

## Components

### Buttons
3段。大きい塗りのボタンは1画面に1つだけ。
- **塗り（Primary）**：緑の地に白の文字、高さ48px。詳細パネルの「次にやること」は 56px・18px で幅いっぱい。ご案内の「2名でご案内」も 56px。
- **枠（Line）**：白の地に緑の枠と文字。「お会計済みにする」など次に大事な操作。
- **下線の文字（Text）**：緑の文字に下線（4px 離す）。「1つ戻す」「料理をすべて見る」など控えめな操作。
- **ふつう（Secondary）**：白の地に灰色の枠（`edge`）と墨の文字。−／＋、「修正」「やめる」「もどる」など。
- **消す（Danger）**：赤の枠と文字。全卓消去の確認の中だけ赤の塗り。
- **Focus**：墨の 3px の輪を 2px 離し、その外に黄色（`#ffd43d`）の 6px。
- **Disabled**：地の色に線の枠、薄墨の文字。

### Chips
- **選ぶボタン（コース・料理・よく来る人数）**：高さ46px、灰色の枠。選ぶと 2px の緑の枠と淡い緑の地、緑の文字（コース・料理は先頭に ✓）。
- **卓のチップ（団体）**：灰色の枠、高さ36px。右の × で外す。
- **ヘッダーの店のタイマー**：地の色の塗り、高さ34px、緑の線のアイコン・名前（墨の700）・残り時間。時間が来たら淡い赤の地と赤の枠・文字。

### Inputs / Fields
- **Style**：高さ48px（パネルの中は44px）、白の地、灰色の 1px の枠、角丸8px。ドロップダウンは右に下向きの矢印。時刻の欄は Inter。
- **Focus**：黄と黒の二重の輪。
- **Error**：欄の下に赤の文字（14px・700）で理由を出す。

### Navigation
- **ヘッダー**：白い帯（56px）。左にメニュー・印と名前「Minopal」・区切りの線・店のタイマー、右に同期（✓ 同期済み）・版・時刻・ゴミ箱。アイコンのボタンは 40px の四角で、押すと地の色。
- **メニュー**：ヘッダーの下から左に出す白い引き出し（幅280px）。いまの画面は淡い緑の地に緑の文字。下にいまの店とログイン・ログアウト。
- **移動先を選んでいる間**：ヘッダーの場所に、淡い緑の地と緑の下線の帯を出す。

### Toasts
フロアの上の右下に1件ずつ出すポップアップ（幅560px、角丸12px、急ぎの色の枠と float の影。スマホはヘッダーのすぐ下に幅いっぱい）。左に急ぎの色の淡い丸とアイコン（店のタイマーはその線のアイコン、L.O.は時計）、文言は 15px・700 で2行まで。右に「ほか N件」（淡い塗りのピル）、主な操作（緑の塗り）、「閉じる」（下線の文字）。下の 3px の線が10秒で縮みきるとヘッダーの「通知 N」（淡い赤の地に赤の枠、数は赤の丸）にしまう。マウスを乗せている間とキーボードで操作している間は線を止める。通知が消えるのは主な操作を押したときだけ。

### Panels
詳細パネル・ご案内は、押した卓のそばに出す白いパネル（幅360px、角丸12px）。上に卓番の黒い札と「2名・通常」、その下に今の段階（24px）、経過と残り時間、警告は淡い赤の囲み。並び：段階と経過 → 次にやること（塗り） → お会計（枠） → 1つ戻す（下線） → 料理 → 「変更する」（折りたたみ、行は線で区切る）。右上に 40px の ×。0.2秒で下から現れ、動きを減らす設定では止める。

スマホ（幅か高さが600px以下）では、同じ中身を下から出すシートにする（No.110）。幅いっぱい（最大560px）、高さは画面の86%まで、上の角だけ 18px の丸み。上に引き手（40×5px）があり、下へ 80px 以上引いて離すと閉じ、少しなら戻る。後ろはうっすら（22%）暗くする。下は端末のホームバーの分も空ける。

### Switch
iOS の切り替えと同じ形（52×32px）。オンは緑、オフは灰色。

### Seat Card（Signature Component）
フロアの卓カード。白い面・灰色の 1px の枠・角丸10px。
- **中身**：左上に卓番、右上に人数、2行目に飲み放題の区分（通常）・料理の進み・会計済、真ん中に大きな経過（時:分）、その下に物差し、最下段に段階の帯（左に段階、右に「L.O.まで55分」など）。
- **物差し**：高さ6px（小さいカードは4px）。経過を緑で塗り、お席の時間（ふつう120分）で右端に届く。L.O.（ふつう90分、退店の時刻を決めた卓はずらす）に墨の目盛り。時間制限なしの間は目盛りを出さない。
- **もうすぐ**：2px の橙の枠、橙の帯、橙の物差し。
- **いま対応**：2px の赤の枠、赤の帯（白の文字）、赤の物差し。
- **空席**：地の上に点線の四角、卓番は薄墨の500。
- **退店済**：中身を不透明度 50%。
- **詳細を開いている卓**：3px の緑の枠を 3px 離して囲む。
- **編集中（ほかの端末）**：2px の緑の点線と、上の辺の真ん中に緑の小さな札。

## Do's and Don'ts

### Do:
- **Do** 色は役割（`key` `now` `soon` と地）を通して使う。
- **Do** 警告を足すときは「いま対応」か「もうすぐ」のどちらかに入れ、短い語を用意する。
- **Do** 数字には Inter と `tabular-nums` を使う。
- **Do** 押せるものは 48px を既定にし、場所がないときだけ 36px、下限は 32px。
- **Do** 新しい知らせはポップアップで出し、しばらくしたらヘッダーにしまう。フロアに知らせ専用の場所は取らない。
- **Do** ボタンは塗り・枠・下線の文字の3段から選ぶ。
- **Do** 見た目を変えるときは `apps/web/src/App.css`（と iOS の `apps/ios/src/theme.ts`）を直し、そのあと `design-system/` へ写す。

### Don't:
- **Don't** ガラス・ぼかし・暗い画面（ダーク）を使わない。
- **Don't** カプセルの形や丸すぎるボタンを使わない。角丸は 8〜12px。
- **Don't** 段階ごとに色を付けない。
- **Don't** 緑を、押す・選ぶ・移動先以外に使わない。
- **Don't** 卓カードを文字盤（茎の時計）に戻さない。経過は物差しで出す。
- **Don't** 10px より小さい文字、32px より小さい押せるものを作らない。
- **Don't** 1画面に大きい塗りのボタンを2つ以上置かない。次にやることは1つ。
- **Don't** 全卓消去の確認のほかで、後ろを暗くして止めない。
- **Don't** 絵文字をアイコンに使わない。アイコンはメニュー・ゴミ箱と同じ線（24 の枠、太さ 1.8、角は丸）で描く（店のタイマーは `packages/core/src/shopTimerIcons.ts` の9つから選ぶ）。
