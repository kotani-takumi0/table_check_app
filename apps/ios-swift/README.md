# Minopal iOS（Swift 版）

今の iOS 版（`apps/ios`、Expo）を Swift（SwiftUI）で作り直したもの。ver.3.0.0 で、録音なしで App Store に申請するまでを目指す。
画面は No.150 で No.149 の画面案どおりに作った（ログイン・最初のページ・配置図・ご案内・卓の詳細・通知と元に戻す・設定・席の配置とコースの編集・お知らせとご意見）。今の iOS 版でできることとの対応表は Notion の No.162 にある。

## 中身

| 場所 | 中身 |
|---|---|
| `MinopalCore/` | 卓のルール（`packages/core` の Swift 版）。画面にも Firebase にも依存しない Swift Package。テストは `swift test` |
| `Minopal/Data/` | Firebase とのやり取り（つなぐ先の選択・ログイン・お客さんの読み書き）と、端末の通知の予約（`LocalNotifier.swift`） |
| `Minopal/Design/` | 色（ライト／ダーク）・文字（Dynamic Type）・ボタンなどの部品。値は No.149「実装用の値一覧（確定版）」。設定の「この端末」（通知・音・ハプティクス・外観）は端末だけで覚える（`DeviceSettings.swift`） |
| `Minopal/Screens/` | 画面（ログイン・店の画面（iPad はサイドバー、iPhone はタブ）・配置図・ご案内と卓の詳細（iPad はポップオーバー、iPhone はシート）・通知のバナーとベル・元に戻すの帯・設定（iPad は目次と中身の 2 列、iPhone は設定タブ）・席の配置とコースを直す画面（`Screens/Editors`。設定から奥へ進む）・最初のページ（ログインした店で配置をまだ保存していないとき）・お知らせ（今後の予定・最近の更新・ご意見を送る。`Screens/Notices`。iPad はサイドバー、iPhone はタブ）） |
| `MinopalUITests/` | 画面を押して確かめるテスト（Firebase エミュレータが要る） |
| `MinopalTests/` | Firestore の読み書き（`Minopal/Data`）を、Firebase エミュレータに対して確かめるテスト |
| `project.yml` | Xcode プロジェクトの設計図。`Minopal.xcodeproj` はここから作るので、リポジトリには入れない |

## 卓のルールは TS と Swift の両方にある

`packages/core`（TypeScript、Web と Expo 版が使う）と `MinopalCore`（Swift）は同じルールを別々に持っている。
**卓のルールや Firestore に書く形を変えるときは、両方を直し、両方のテストを足す。** Swift のテストは TS のテストと同じ名前にしてある。
料理のチェックの付け外し（No.167）は Swift 版の卓の詳細だけが品ごとで、Web は「まだ出していない最初の品を出す」「最後に出した品を戻す」のまま。読み書きは両方とも、順番を飛ばした時刻を位置のまま残す。

### TS と Swift の対応

移したものは、TS と同じ名前を Swift の書き方（小文字で始める・定数は camelCase）にしてある。TS の `null` は Swift の `nil`、時刻はどちらもミリ秒の整数。

| TS（`packages/core/src`） | Swift（`MinopalCore/Sources/MinopalCore`） | 違うところ |
|---|---|---|
| `domain.ts` | `Session.swift`・`Domain.swift` | `STATUS_LABEL`・`STATUS_CARD`・`STATUS_SHORT` は `Display` の `label`・`cardLabel`・`shortLabel`。`REASON_LABEL` は `AlertReason.label`。`RULES` は `Rules.standard`。`lastOrderDue` の卓ごとのルールは `rulesOf:` で渡す。`formatClock`・`clockTimeNear` は `calendar:` で時間帯を渡せる（ふだんは端末の時間帯で、TS と同じ） |
| `courseMenus.ts` | `CourseMenus.swift` | |
| `history.ts` | `BusinessDay.swift`（営業日）・`History.swift`（CSV） | `sessionsCsv` は記録と一緒に読んだ `RecordedSession` を受け取り、区分・コースだけを渡す。iOS はファイルを共有のシートで渡す |
| `closing.ts` | `BusinessDay.swift` | |
| `clock.ts`・`serverClock.ts` の `estimateOffset` | `Clock.swift` | 時差を Firestore で測る部分は、Firestore の読み書きと一緒に移す |
| `tapGuard.ts` の `tooSoon` | `Clock.swift` | React の `useTapGuard` は画面の側で作る |
| `firestoreMapping.ts` | `SessionDocument.swift`・`DocumentValues.swift` | |
| `auth.ts` のことば・`shopPath.ts` | `Auth.swift`・`Shop.swift` | Firebase を使う部分（`flushPendingWrites` も）は `Minopal/Data/AuthService.swift` |
| `shopSettings.ts` | `ShopSettings.swift` | `DEFAULT_SHOP_SETTINGS` は `ShopSettings.standard`。時間のルールは `settings.rules` にまとめた。`stepMinutes` は変えた項目の Partial ではなく新しい値を返す。`COURSE_LIMITS` は `CourseLimits` |
| `shopTimers.ts`・`shopTimerIcons.ts` | `ShopTimers.swift` | アイコンの線は SVG の文字列のまま持つ（描き方は画面で決める） |
| `store.ts` の `worstSyncState` | `Shop.swift` | |
| `layout.ts`・`shopLayout.ts`・`layoutDrag.ts` | `Layout.swift` | 場所と大きさは `GridBox` にまとめた。`sameBox` は `GridBox` の `==`。`GRID` は `Grid`、`SEATS` は `defaultSeats` |
| `floorScale.ts`・`dial.ts`・`cactusClock.ts` | `Dial.swift` | `arcPath`（SVG の円弧の文字列）は Web の描き方なので移していない。SwiftUI では `Path.addArc` で描く |
| `notices.ts`・`editing.ts` | `Notices.swift` | バナーに何枚出すか（iPad 2 枚・iPhone 1 枚と「ほか N件」）は `noticeWindow`。Web は 1 枚ずつなので TS には無い。端末の通知に予約する分（`scheduledNotices`）も iOS だけ |
| `courseEditor.ts`・`shopTemplates.ts` | `CourseEditor.swift` | |
| `useLayoutEditor.ts` | `LayoutEditor.swift` | React の state を値の型（`LayoutEditor`）と mutating の関数にした。お客さんがいる卓は呼ぶたびに渡す。ドラッグと保存の待ち合わせは画面の側（`Minopal/Screens/Editors/LayoutEditorView.swift`） |
| `undo.ts` | `Undo.swift` | 数秒で消す部分（React の `useUndo`）は画面の側（`Minopal/Screens/Shop/ShopBoards.swift` の `UndoBoard`） |
| `sessionRecord.ts` | `SessionRecord.swift` | TS の Partial は、項目ごとの Optional（区分・コースの名前は「null を書く」と「書かない」を分けるため二重の Optional）。`toDocument()` で書く形にする |

| `releaseNotes.ts`・`roadmap.ts` | `ReleaseNotes.swift` | **文章は TS だけで持つ。** `npm run ios-swift:content`（`scripts/export-ios-content.mjs`）が `MinopalCore/Sources/MinopalCore/Resources/content.json` に書き出し、Swift はそれを読む。書き出し忘れは `npm test` と CI で落ちる |
| `feedback.ts` | `Feedback.swift` | 送る部分は `Minopal/Data/FeedbackSender.swift`。下書き・待ち・見た印（Web の `FeedbackForm`・`useReleaseAnnounce`）は画面の側（`Minopal/Screens/Notices/NewsBoard.swift`） |
| `appUpdate.ts` | なし | Web の version.json を読み直す仕組みなので移さない（iOS は App Store で更新する） |

Firestore の読み書き（`firestore〜.ts`）は `Minopal/Data` にある。

| TS | Swift（`Minopal/Data`） | 違うところ |
|---|---|---|
| `firestoreStore.ts` | `SessionRepository.swift` | |
| `firestoreShopSettings.ts`・`firestoreShopTimers.ts`・`firestoreShopLayout.ts`・`firestoreEditing.ts` | `ShopRepositories.swift` | 設定は「変えた項目」を `ShopSettingsField` で渡す。書く形は MinopalCore の `ShopDocuments.swift` |
| `firestoreFeedback.ts` | `FeedbackSender.swift` | 届いたかの確認は `onConfirmed` で受け取る |
| `serverClock.ts` | `ServerClock.swift` | |
| `firestoreServices.ts` | `ShopServices.swift` | |

`Memory〜Store`・`NoEditingStore`・`NoFeedbackStore`（Firebase につながずに試す保存先）は移さない。Swift 版はふだんから Firebase エミュレータにつないで試すため。

テストは TS のテストと同じ名前・同じ中身（`MinopalCore/Tests`）。日付を使うテストは日本時間に決めて計算するので、どの時間帯の CI でも同じ結果になる。

## はじめて動かすとき

1. Xcode を入れる（App Store から）。初回の起動で iOS のシミュレータも入れる
2. XcodeGen と Java を入れる：`brew install xcodegen openjdk@21`
   （Java は Firebase エミュレータに要る。`java -version` で出なければ `export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"`）
3. Firebase エミュレータを起動したままにする：`npm run ios-swift:emulators`
4. 別のターミナルで `npm run ios-swift:open`（Xcode プロジェクトを作って Xcode で開く）
5. Xcode の上で iPad か iPhone のシミュレータを選び、▶ で動かす

`project.yml` を変えたとき・`git pull` のあとは、もう一度 `npm run ios-swift:open` で作り直す。

## つなぐ先

| つなぐ先 | どうするか | 使えるもの |
|---|---|---|
| Firebase エミュレータ（`demo-minopal`、本物のデータは無い） | 何もしない（ふだんはこれ） | 「ログインせずに使う」・ログインのどちらも |
| table-check-dev / table-check-prod | Firebase のコンソールで iOS アプリを登録し、`GoogleService-Info.plist` を `Minopal/` に置いて `npm run ios-swift:open` | ログインだけ（試し用のアカウントで）。どちらにも店のデータが入っているので、いちばん上の店（ログインせずに使う）は開かない |

`GoogleService-Info.plist` はリポジトリに入れない（`.gitignore` 済み）。

## テスト

- 卓のルール：`cd apps/ios-swift/MinopalCore && swift test`（数秒）
- Firestore の読み書きと画面：エミュレータ（`npm run ios-swift:emulators`）を起動してから、`npm run ios-swift:test` で流す。
  iPad と iPhone で同時に流れ、最後に件数・落ちたテスト・かかった時間が出る。
  - **ふだんは直した画面のテストだけ**流す：`npm run ios-swift:test -- FloorUITests SettingsUITests`（名前は `MinopalUITests`・`MinopalTests` のファイル名）。
    `MINOPAL_TEST_DEVICES=pad` で iPad だけにもできる

    | 直したところ | 流すテスト |
    |---|---|
    | 最初の画面（ログイン・アカウントを作る） | `LoginScreenUITests` |
    | 配置図・ご案内・卓の詳細・団体 | `FloorUITests` |
    | 最初のページ・席の配置・コース | `EditorUITests` |
    | 設定 | `SettingsUITests` |
    | 通知のバナー・ベル・元に戻す | `NoticeUITests` |
    | 端末の通知 | `NotificationUITests` |
    | お知らせ（予定・更新・ご意見） | `NewsUITests` |
    | Firestore の読み書き（`Minopal/Data`）・画面の部品の計算 | `MinopalTests` |
    | 店の画面の枠（サイドバー・タブ）・`UITestHelpers.swift` | 全部 |
  - **全部は PR を出す前に1回**：`npm run ios-swift:test`。UI テストは1本 20〜80 秒あり、全部だと10分ほどかかる
  - 流している間は **Mac の蓋を開けたまま**にする。バッテリーで蓋を閉じるとスリープしてテストが止まり、何時間もかかったうえに落ちる（10/18 に2回あった）
  - スクリプト（`scripts/ios-swift-test.sh`）は、`GoogleService-Info.plist` を流す間だけどける・毎回 `xcodegen generate` する・
    テストごとに時間の上限（3分）を置く・落ちても診断を集めない・1件も流れなければ失敗にする。手で `xcodebuild test` を打つときも、
    plist をどけて `-collect-test-diagnostics never` を付ける（付けないと、落ちたテストがあるたびに10分ほど待たされる）
  - ログインした店で始める UI テストは、画面ではログインせず、起動の引数 `-MinopalTestLogin <メール>` でアプリにログインさせる
    （`Minopal/Data/TestLogin.swift`。開発中のビルドでエミュレータのときだけ）。画面でログインすると iOS の「パスワードを保存しますか？」が出て、
    閉じるのに数秒〜2分かかるため。ログインの画面そのものは `LoginScreenUITests` で確かめる
- PR を出すと、GitHub Actions で卓のルールのテストとシミュレータ向けのビルドが回る（`.github/workflows/ios-swift.yml`）。CI ではアプリを起動しての確かめ（UI テスト）はしない
- PR に添えるスクショ：テストデータ（いろいろな状態の卓）を入れた「ログインせずに使う」の店で撮る。ふだんのテストでは飛ばす
  ```sh
  xcrun simctl ui <端末> appearance dark   # ライトは light
  TEST_RUNNER_MINOPAL_SCREENSHOTS=1 xcodebuild test -project Minopal.xcodeproj -scheme Minopal \
    -destination 'platform=iOS Simulator,id=<端末>' -only-testing:MinopalUITests/ScreenshotUITests
  ```
  撮った画像は結果（.xcresult）の添付に入る。テストデータは開発中のビルドで、エミュレータにつないでいて、起動の引数に `-MinopalDemoSeed` があるときだけ入る（`Minopal/Data/DemoSeed.swift`）

## コースの料理（No.167）

卓の詳細では、コースの料理を1品ずつチェックで付け外しする。出す順が前後しても、どの料理からでも付けられる。もう一度押すと外れる。進みは「2/8品」のように出した数で出す。
保存は Web と同じ項目で、`dishServedAt` の i 番目がその料理を出した時刻（出していない料理は null）、`dishesServed` は出した数。Firestore のルールは変えていない（`dishServedAt` は 30 個までのリストで、中の null も今のルールで書ける）。
Web と Expo 版も同じ位置で読み書きする。順番を飛ばして付けた卓を、お会計などで書き直しても別の料理には移さない。Swift の設定の「記録」（CSV）は、付けた料理だけを品目の番号で出す。時刻を残す前の記録は、今までどおり上から N 品を「時刻なし」として出す。Web の振り返りも同じ。
通知（L.O.・店のタイマー）は料理の進みを見ていない。

## 端末の通知（No.151）

L.O.・店のタイマーの時間は前もって分かるので、端末の中だけで通知を予約する（ローカル通知。サーバーは使わない）。
お客さん・済にした時刻・設定が変わるたびに予約を作り直す。ほかの端末で時刻を変えたときは、この端末でアプリを開くまで古いまま。
アプリを開いているときは画面のバナーと通知の音で知らせ、端末の通知は重ねて出さない。通知の文は卓番と内容だけ（「21卓 ラストオーダーの時間です」）。

- 初めて店の画面を開いたときに一度だけ説明を出してから iOS の許可を求める。断っても使える。設定の「この端末」で切れる
- UI テストでは、通知のテスト（`NotificationUITests`）のほかは説明を出さない（`minopalApp()` が起動の引数で「もう聞いた」にする）。
  通知のテストは開発中のビルドの起動の引数 `-MinopalNotifyWithin <秒>` で、予約した通知を数秒のうちに出して確かめる

## 入れないもの（ver.3.0.0）

マイクの許可（`NSMicrophoneUsageDescription`）、`UIBackgroundModes` の `audio`、録音のコード。録音なしで申請するため。
