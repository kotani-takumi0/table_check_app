# Minopal iOS（Swift 版）

今の iOS 版（`apps/ios`、Expo）を Swift（SwiftUI）で作り直したもの。ver.3.0.0 で、録音なしで App Store に申請するまでを目指す。
今は土台だけで、画面は「ログインと読み書きを確かめる仮の画面」になっている（本番の画面は No.150 で作る）。

## 中身

| 場所 | 中身 |
|---|---|
| `MinopalCore/` | 卓のルール（`packages/core` の Swift 版）。画面にも Firebase にも依存しない Swift Package。テストは `swift test` |
| `Minopal/Data/` | Firebase とのやり取り（つなぐ先の選択・ログイン・お客さんの読み書き） |
| `Minopal/Screens/` | 画面（今は仮の画面） |
| `MinopalUITests/` | 画面を押して確かめるテスト（Firebase エミュレータが要る） |
| `project.yml` | Xcode プロジェクトの設計図。`Minopal.xcodeproj` はここから作るので、リポジトリには入れない |

## 卓のルールは TS と Swift の両方にある

`packages/core`（TypeScript、Web と Expo 版が使う）と `MinopalCore`（Swift）は同じルールを別々に持っている。
**卓のルールや Firestore に書く形を変えるときは、両方を直し、両方のテストを足す。** Swift のテストは TS のテストと同じ名前にしてある。

### TS と Swift の対応

移したものは、TS と同じ名前を Swift の書き方（小文字で始める・定数は camelCase）にしてある。TS の `null` は Swift の `nil`、時刻はどちらもミリ秒の整数。

| TS（`packages/core/src`） | Swift（`MinopalCore/Sources/MinopalCore`） | 違うところ |
|---|---|---|
| `domain.ts` | `Session.swift`・`Domain.swift` | `STATUS_LABEL`・`STATUS_CARD`・`STATUS_SHORT` は `Display` の `label`・`cardLabel`・`shortLabel`。`REASON_LABEL` は `AlertReason.label`。`RULES` は `Rules.standard`。`lastOrderDue` の卓ごとのルールは `rulesOf:` で渡す。`formatClock`・`clockTimeNear` は `calendar:` で時間帯を渡せる（ふだんは端末の時間帯で、TS と同じ） |
| `courseMenus.ts` | `CourseMenus.swift` | |
| `history.ts` の営業日 | `BusinessDay.swift` | CSV の書き出しは Web だけなので移していない |
| `closing.ts` | `BusinessDay.swift` | |
| `clock.ts`・`serverClock.ts` の `estimateOffset` | `Clock.swift` | 時差を Firestore で測る部分は、Firestore の読み書きと一緒に移す |
| `tapGuard.ts` の `tooSoon` | `Clock.swift` | React の `useTapGuard` は画面の側で作る |
| `firestoreMapping.ts` | `SessionDocument.swift`・`DocumentValues.swift` | |
| `auth.ts` のことば・`shopPath.ts` | `Auth.swift`・`Shop.swift` | Firebase を使う部分は `Minopal/Data/AuthService.swift` |
| `shopSettings.ts` | `ShopSettings.swift` | `DEFAULT_SHOP_SETTINGS` は `ShopSettings.standard`。時間のルールは `settings.rules` にまとめた。`stepMinutes` は変えた項目の Partial ではなく新しい値を返す。`COURSE_LIMITS` は `CourseLimits` |
| `shopTimers.ts`・`shopTimerIcons.ts` | `ShopTimers.swift` | アイコンの線は SVG の文字列のまま持つ（描き方は画面で決める） |
| `store.ts` の `worstSyncState` | `Shop.swift` | |
| `layout.ts`・`shopLayout.ts`・`layoutDrag.ts` | `Layout.swift` | 場所と大きさは `GridBox` にまとめた。`sameBox` は `GridBox` の `==`。`GRID` は `Grid`、`SEATS` は `defaultSeats` |
| `floorScale.ts`・`dial.ts`・`cactusClock.ts` | `Dial.swift` | `arcPath`（SVG の円弧の文字列）は Web の描き方なので移していない。SwiftUI では `Path.addArc` で描く |
| `notices.ts`・`editing.ts` | `Notices.swift` | |
| `courseEditor.ts`・`shopTemplates.ts` | `CourseEditor.swift` | |
| `undo.ts` | `Undo.swift` | 数秒で消す部分（React の `useUndo`）は画面の側で作る |
| `sessionRecord.ts` | `SessionRecord.swift` | TS の Partial は、項目ごとの Optional（区分・コースの名前は「null を書く」と「書かない」を分けるため二重の Optional）。`toDocument()` で書く形にする |

保存先（`Memory〜Store`・`NoEditingStore`）と Firestore の読み書き（`firestore〜.ts`）は、No.148 の4つ目で移す。

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

- 卓のルール：`cd apps/ios-swift/MinopalCore && swift test`
- 画面：エミュレータを起動してから、Xcode で ⌘U（またはテストの一覧から `MinopalUITests`）
- PR を出すと、GitHub Actions で卓のルールのテストとシミュレータ向けのビルドが回る（`.github/workflows/ios-swift.yml`）。CI ではアプリを起動しての確かめ（UI テスト）はしない

## 入れないもの（ver.3.0.0）

マイクの許可（`NSMicrophoneUsageDescription`）、`UIBackgroundModes` の `audio`、録音のコード。録音なしで申請するため。
