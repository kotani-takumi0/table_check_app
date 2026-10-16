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
