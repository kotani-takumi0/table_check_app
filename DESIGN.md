---
name: Minopal
description: 飲食店ホール用の卓タイマー。一瞥で読めるフロア図
colors:
  sand-ground: "#f3f1ee"
  sand-surface: "#fefdfc"
  sand-ink: "#2d2b28"
  sand-muted: "#68625c"
  sand-line: "#dad5d0"
  sand-line-strong: "#ccc7c1"
  fill: "rgba(45, 43, 40, 0.07)"
  nopal: "#305a12"
  on-nopal: "#ffffff"
  nopal-text: "#305a12"
  nopal-wash: "#e7f7df"
  tuna: "#f6623a"
  on-tuna: "#4d1708"
  tuna-text: "#ab340f"
  tuna-wash: "#ffede8"
  tuna-line: "#ffb29d"
  tuna-face: "#ffe2da"
  amber: "#ffc762"
  on-amber: "#3b2700"
  amber-text: "#825b00"
  amber-wash: "#ffefd5"
  amber-line: "#ecc176"
  amber-face: "#ffe6bd"
  amber-arc: "#dda949"
  dial-face: "#f3f1ee"
  dial-dot: "#b8b2ab"
  dial-band: "#f7d08f"
typography:
  display:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.3
  headline:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.2
  label:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.3
  seat-number:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
  guest-count:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: "1.5em"
    fontWeight: 900
    lineHeight: 1
    fontFeature: "tnum"
  dial-time:
    fontFamily: "'Roboto Mono', monospace"
    fontSize: "24px"
    fontWeight: 700
    fontFeature: "tnum"
  clock:
    fontFamily: "'Roboto Mono', monospace"
    fontSize: "17px"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  mini: "6px"
  card: "12px"
  group: "20px"
  popover: "26px"
  panel: "32px"
  alert: "36px"
  pill: "999px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  panel: "22px"
components:
  button-primary:
    backgroundColor: "{colors.nopal}"
    textColor: "{colors.on-nopal}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
    height: "50px"
  button-next:
    backgroundColor: "{colors.nopal}"
    textColor: "{colors.on-nopal}"
    rounded: "{rounded.pill}"
    height: "60px"
    width: "100%"
  button-secondary:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
    height: "50px"
  button-danger:
    backgroundColor: "{colors.tuna-wash}"
    textColor: "{colors.tuna-text}"
    rounded: "{rounded.pill}"
    height: "50px"
  choice:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    height: "48px"
  choice-selected:
    backgroundColor: "{colors.nopal}"
    textColor: "{colors.on-nopal}"
    rounded: "{rounded.pill}"
    height: "48px"
  stepper-button:
    backgroundColor: "{colors.sand-surface}"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.pill}"
    size: "64px"
  field-select:
    backgroundColor: "{colors.sand-ground}"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.card}"
    padding: "0 12px"
    height: "48px"
  seat-card:
    backgroundColor: "{colors.sand-surface}"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.card}"
    padding: "8px 12px 10px"
  seat-card-soon:
    backgroundColor: "{colors.amber-wash}"
    textColor: "{colors.amber-text}"
    rounded: "{rounded.card}"
  seat-card-now:
    backgroundColor: "{colors.tuna-wash}"
    textColor: "{colors.tuna-text}"
    rounded: "{rounded.card}"
  badge-now:
    backgroundColor: "{colors.tuna}"
    textColor: "{colors.on-tuna}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  badge-soon:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.on-amber}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  panel:
    backgroundColor: "{colors.sand-surface}"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.panel}"
    padding: "22px"
    width: "440px"
  toast:
    backgroundColor: "{colors.sand-surface}"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 5px 4px 16px"
---

# Design System: Minopal

## Overview

**Creative North Star: "ホールの壁時計"**

Minopal は、居酒屋のホールに掛かった壁時計のようにふるまう。お盆を持って通りがかった人が、一瞬見上げただけで「どの卓に、何を、いつまでに」がわかる。ふだんは静かで、時間が来た卓だけが色づく。色は飾りではなく、時計の針と同じく「知らせ」として働く。

雰囲気は静かで落ち着いている。暖かい灰色の地（sand）に、無彩色の卓カードが店の席の並びのまま並ぶ。カードの主役は、アイコンの「茎の時計」から生まれた文字盤（120分で一周する経過の弧と、縁の12個の点）。色はアイコンのウチワサボテンから取った4つの役割だけで、段階（案内済・お通し済など）は色ではなく文字で読ませる。

部品の手触りは iOS にそろえる。カプセルのボタン、浮かぶ操作の層だけに使う Liquid Glass、iOS 26 のアラートや通知バナー、iOS のスイッチ。フロアの卓は内容なのでガラスにせず、平らに置く。

**Key Characteristics:**
- 4つの色の役割（地・操作・いま対応・もうすぐ）だけ。ふだんの卓は無彩色
- 段階は文字、急ぎは色と語の両方で出す
- 卓カードの主役は文字盤。数字はすべて等幅（tabular-nums）
- ガラスは浮かぶ操作の層（ツールバー・パネル・通知）だけ
- 押せるものは指で押せる大きさ（主要50px、下限32px）
- Web はライトとダーク、iOS はライトだけ

## Colors

アイコンのウチワサボテンから作った4つの役割。どの色も「何をしてほしいか」を表し、「どの段階か」は表さない。

### Primary
- **茎の緑 Nopal**：操作の色。主ボタンの塗り、選んでいるもの、次に出す料理の枠、移動先の空席、スイッチのオン、編集中の印。文字に使うときは `nopal-text`（ダークでは段11に上げる）。淡い地の `nopal-wash` は、選んでいるメニュー項目や移動先を選んでいる間のバーに使う。

### Secondary
- **実の朱 Tuna**：いま対応。お通し未提供・お席の時間の卓、オフライン、トイレなどの「時間です」、消去。卓は `tuna-wash` の地・`tuna-face` の文字盤・`tuna` の弧と札に替わる。札の文字は段12（`on-tuna`）。

### Tertiary
- **実の琥珀 Amber**：もうすぐ。L.O.の時間の卓と送信待ち。卓は `amber-wash` の地・`amber-face` の文字盤・`amber-arc` の弧・`amber` の札。文字盤の 90〜120分の淡い帯（`dial-band`）も琥珀。

### Neutral
- **暖かい灰色の地 Sand Ground**：画面の地。フロア図の余白、パネルの中の入力欄の面。
- **紙の面 Sand Surface**：ふだんの卓カード、パネル、ガラスの元になる面。
- **墨 Sand Ink**：本文、卓番、ふだんの卓の段階名。
- **薄墨 Sand Muted**：補助の文字、空席の卓番、残り時間、版の表示。
- **罫 Sand Line / Line Strong**：1pxの罫と入力欄の枠 / 空席の点線と、同じ面に置くボタンの枠。
- **淡い塗り Fill**：墨の7〜8%。ガラスの上の副ボタン、チップ、閉じるボタン。

### Named Rules
**The 色は知らせ Rule.** 色が付くのは対応が要る卓だけ。新しい段階を足しても色は増やさず、段階は文字で出す。フロアを一瞥したとき、色の付いた卓へまっすぐ目が行くことがこの系の目的。

**The 4つの役割 Rule.** 押す・選ぶ・移動先を示すものは茎の緑。急ぎは朱（いま）と琥珀（もうすぐ）のどちらかに入れる。この4つ以外の色を足さない。緑を飾りに使わない。

**The 語が本体 Rule.** 警告には必ず短い語（「お席の時間」「お通し未提供」「L.O.の時間」）を付ける。色は目を引くための補助で、色だけでは伝えない。

**The 4.5:1 Rule.** 文字は置かれる地に対して 4.5:1 以上。色はスケールを直接使わず、役割を通して使う。

## Typography

**Display Font:** Zen Kaku Gothic New（400 / 500 / 700 / 900、sans-serif にフォールバック）
**Body Font:** Zen Kaku Gothic New
**Label/Mono Font:** Roboto Mono（400 / 500、monospace にフォールバック）。数字だけ

**Character:** 角の立ちすぎない日本語のゴシックに、等幅の数字を合わせる。時刻と経過は1分ごとに変わるので、桁の幅が動いて視界の端で気が散らないよう、数字は必ず等幅にする。iOS は端末の書体（ヒラギノ）に `tabular-nums` を合わせる。

### Hierarchy
- **Display**（700、28px）：最初の画面の題だけ。
- **Headline**（700、22px、1.3）：詳細パネルの題と状態名。
- **Title**（700、17px）：パネルの卓番、時刻、設定の行。
- **Body**（400、14px が基準、ボタンは 15px）：本文と、ほとんどの部品。
- **Label**（700、13px）：パネルの区切りの見出し、警告の札、卓カードの人数・コース。
- **Seat Number**（700、20px）：卓カードの卓番。カードの大きさに合わせて 17 / 14 / 11px に詰める。
- **Guest Count**（900、1.5em）：卓カードの人数の数字。太く大きく。
- **Dial Time**（Roboto Mono 700、24px）：文字盤の中の経過（時:分）。スマホの小さい文字盤では 27〜34px に上げる。

### Named Rules
**The 等幅の数字 Rule.** 時刻・経過・人数・品数など、数字を出すところは必ず `tabular-nums` を付ける。

**The 10px の床 Rule.** 10px より小さい文字は作らない（10px は `¥✓` の印だけ）。入らないなら要素を小さくせず、その姿から外して詳細パネルへ送る。

## Layout

フロア図が画面のすべて。店の席の並びを 15列×7行のマス目にそのまま置き、画面いっぱいに広げる。ツールバーはフロアの上に浮かび、フロアは縮めない。

- **マス目の隙間**：横向きは行12px・列6px（カードが横長なので行間を広く）。縦向きは行6px。スマホは4px。
- **縦向き**：配置図ごと時計回りに90°回して 7列×15行にする。カードの姿は画面の幅ではなく、割り当てられたマスの縦横比で決まる。
- **密度の4つの姿**：大きい卓（四隅の情報と真ん中の文字盤）、低い卓（左に情報、右に文字盤）、細い卓（上に情報、下に文字盤）、カウンター（円の文字盤）。スマホ（幅か高さが600px以下）は mini で、卓番・文字盤・段階だけ。減らすのは情報ではなく配置と文字の大きさ。
- **スマホ**：行の高さは 44px を下限にし、入らなければフロア図ごと縦にスクロールする。
- **パネル**：押した卓のそばに小さく出す（右に入らなければ左。スマホは真ん中）。後ろは暗くせず、フロアを見ながら操作できる。
- **余白**：2 / 4 / 6 / 8 / 12 / 16 / 22px。画面の端は 16px（スマホは 8px）。

## Elevation & Depth

基本は平ら。面の区別は 1px と 1.5px の枠、淡い地（段3）、点線で付ける。影を落とすのは、フロアの上に浮かぶガラスの層（ツールバー・詳細パネル・ポップオーバー・通知・メニュー）の下だけ。

ガラスは Liquid Glass の regular に寄せる。`surface` を 58〜84% 混ぜた面に、ぼかし 14px と彩度 1.8 倍、上側のつや、縁の光、柔らかい2段の影。文字の多いパネルほど面を濃くする（84%）。端末の「透明度を下げる」がオンなら不透明な `surface`、「コントラストを上げる」なら面を 92% にして枠を濃くする。iOS は expo-glass-effect の Liquid Glass。使えない iOS ではほぼ不透明な面にする。

### Shadow Vocabulary
- **ガラスの影**（`0 8px 28px` と `0 2px 6px`、墨の10%。ダークは黒の35%）：ツールバー・パネル・通知。
- **そばに出すパネルの影**（`0 12px 40px` と `0 2px 8px`）：卓のそばに出す詳細パネルとご案内。
- **つまみの影**（`0 1px 3px rgb(0 0 0 / 0.25)`）：スイッチのつまみと、席の配置の大きさを変える丸。

### Named Rules
**The ガラスは操作の層だけ Rule.** 卓カードは内容なのでガラスにしない。数字が読みにくくなるため。

**The 上の端は地へ消える Rule.** フロアがツールバーの下にもぐるところは、地の色へフェードさせる（scroll edge effect）。

## Shapes

角は丸く、操作はカプセル。角丸は大きさで段をつける：スマホの卓 6px、卓カードと入力欄 12px、設定のまとまりとメニュー 20px、そばに出すパネル 26px、中央のパネル 32px、アラート 36px。押すものはピルで、角丸は常に短辺の半分にする（高さ50pxなら25px）。

空席は点線の枠（テーブルは角丸の四角、カウンターは円）。カウンター席は円そのものが文字盤になる。文字盤は塗った丸、縁の12個の点（アイコンのトゲ）、5px の弧で、弧の端は丸める。

## Components

### Buttons
iOS のカプセル。大きいボタンは1画面に1つだけ。
- **Shape:** ピル（短辺の半分）。
- **Primary:** 茎の緑の塗りに白の文字、高さ50px。詳細パネルの「次にやること」は 60px・18px・700 で幅いっぱい。ご案内の「2名でご案内」は 64px・19px。
- **Secondary:** 墨の8%の淡い塗り、枠なし、高さ50px。小さいもの（「1つ戻す」など）は 40px・14px。
- **Danger:** 朱の淡い地に朱の文字（700）。消去や取り消しに使う。
- **Text button:** 緑の文字に下線。折りたたみの補助操作に使う。
- **Focus:** 墨の 3px の輪を 2px 離して描く。押している卓は茎の緑の 3px の輪。
- **Disabled:** 不透明度 40%。

### Chips
- **Style:** 選ぶボタン（コース・料理・よく来る人数）は高さ48pxのピルで、淡い塗り。選ぶと茎の緑の塗りに白の文字（700）。
- **卓のチップ（団体）:** 1px の罫で囲んだピル、高さ36px。右の × で外す。
- **ツールバーのチップ（トイレ）:** 淡い塗りのピル、高さ36px。時間が来たら朱の枠・淡い朱の地・朱の文字。

### Cards / Containers
主役は卓カード（Signature Component を参照）。設定のまとまりはガラスの面で、角丸20px・余白 16px 20px。

### Inputs / Fields
- **Style:** 高さ48〜50px、`sand-ground` の面、1px の罫（ドロップダウンは濃い罫）、角丸12px。時刻の欄は Roboto Mono 18px。
- **Focus:** ブラウザ・OS の標準の輪。
- **Error:** 欄の下に朱の文字（14px）で理由を出す。時刻の順を崩す値は保存しない。
- **人数のステッパー:** 64px の丸い −／＋ に、真ん中の数字（36px・900）。

### Navigation
- **ツールバー:** フロアの上に浮かぶガラスのカプセル（高さ48px、スマホは40px）。左にメニュー、店のタイマー、右に同期の状態・版・時刻（Roboto Mono 17px・500）・ゴミ箱。
- **店のタイマーのチップ:** 線のアイコン・名前（墨の 700）・残り時間（等幅）。幅が足りなければ名前から省き、数字は切らない。スマホ（高さ32px）は名前と「あと」を省いてアイコンと「12分」だけ。時間が来たらチップごと朱の枠・淡い朱の地・朱の文字。
- **メニュー:** ツールバーのボタンで左から出すガラスの一覧（幅280px、角丸20px）。いまの画面は淡い緑の地に緑の文字（700）。スマホは画面の幅いっぱい。
- **移動先を選んでいる間:** ツールバーの場所に、緑の枠と淡い緑の地のバーを出す。

### Toasts
iOS 26 の通知バナーのような、フロアに浮かぶガラスのカプセル（角丸ピル、最大高さ52px）。左の 12px の丸の色（朱・琥珀）で急ぎ具合、文言は 15px。「済にする」など主な操作は緑のピル。3件以上は先頭だけを出し、残りは「ほか N件」にまとめる。

### Panels
詳細パネル・ご案内は、押した卓のそばに出すガラスのポップオーバー（角丸26px、余白18px、小さな矢印つき）。中央に出すパネルは角丸32px・余白22px・幅440px、アラートは 36px・幅380px。右上に 44px の丸い ×。並びはよく使う順：状態と経過 → 次にやること → 1つ戻す・お会計 → 料理 → 「変更する」（折りたたみ）。出るときは 0.2秒で拡大しながら現れ、動きを減らす設定では出さない。

### Switch
iOS の切り替えと同じ形（52×32px）。オンは茎の緑、つまみは白の 28px の丸。

### Seat Card（Signature Component）
フロアの卓カード。文字盤が主役で、四隅に情報。
- **ふだん:** `surface` の面、墨の弧、段階名は墨の 16px・700。
- **もうすぐ:** 淡い琥珀の地、琥珀の文字盤と弧、琥珀の札。
- **いま対応:** 淡い朱の地、朱の文字盤と弧、朱の札。
- **空席:** 透明な地に濃い罫の点線、卓番は薄墨の 500。
- **退店済:** カードごと不透明度 50%。
- **編集中（ほかの端末）:** 茎の緑の 2px の点線の輪と、上の辺の真ん中に緑の小さな札。
- **四隅:** 左上に卓番と人数（人数の数字は 900 で大きく）、右上にコース・料理の進み・会計済、左下に段階か理由の札、右下に「L.O.まで55分」などの残り時間（13px、薄墨）。
- **文字盤:** 中に時:分。縁の12個の点、90〜120分の淡い琥珀の帯、12時から時計回りに伸びる経過の弧（120分で一周）。開始待ちは `--:--`。

## Do's and Don'ts

### Do:
- **Do** 色は役割（`action` `now` `soon` と地）を通して使い、スケールの段を直接使わない。
- **Do** 警告を足すときは「いま対応」か「もうすぐ」のどちらかに入れ、「時間です」くらいの短い語を用意する。
- **Do** 数字には Roboto Mono（iOS は端末の書体）と `tabular-nums` を一緒に使う。
- **Do** 押せるものは 50px を既定にし、場所がないときだけ 36px、下限は 32px。
- **Do** 浮かぶ操作の層だけをガラスにし、「透明度を下げる」がオンなら不透明にする。
- **Do** 見た目を変えるときは `apps/web/src/App.css`（と iOS の `apps/ios/src/theme.ts`）を直し、そのあと `design-system/` へ写す。

### Don't:
- **Don't** 段階ごとに色を付けない（以前の青・緑・紫・青緑・ピンクの段階色はやめた）。
- **Don't** 茎の緑を、押す・選ぶ・移動先以外に使わない。
- **Don't** 卓カードをガラスにしない。
- **Don't** 10px より小さい文字、32px より小さい押せるものを作らない。
- **Don't** 1画面に大きいボタンを2つ以上置かない。次にやることは1つ。
- **Don't** 後ろを暗くするモーダルで卓のそばの操作を覆わない（中央のパネル・アラートを除く）。
- **Don't** 絵文字をアイコンに使わない。アイコンはメニュー・ゴミ箱と同じ線（24 の枠、太さ 1.8、角は丸）で描き、色は文字と同じにする（店のタイマーは `packages/core/src/shopTimerIcons.ts` の9つから選ぶ）。
