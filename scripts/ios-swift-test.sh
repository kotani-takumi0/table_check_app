#!/bin/bash
# Swift 版（apps/ios-swift）のテストを、手元のシミュレータ（iPad と iPhone）で流す。
#   全部（PR を出す前に1回）：        npm run ios-swift:test
#   直した画面のテストだけ（ふだん）： npm run ios-swift:test -- FloorUITests SettingsUITests
# 名前は MinopalUITests・MinopalTests のファイル名（＝クラス名）、「クラス/テスト」、ターゲット名、または「ターゲット/クラス/テスト」。
# 環境変数：MINOPAL_TEST_DEVICES=pad|phone で片方の端末だけ、MINOPAL_TEST_PARALLEL=0 で並べずに流す、
#   MINOPAL_TEST_PAD・MINOPAL_TEST_PHONE でシミュレータの名前を変える（別の Mac や Xcode の版で名前が違うとき）
# 結果（xcresult）とログは一時フォルダに残す（落ちたテストをあとで見るため。macOS が古いものを消す）
#
# 長く止まらないよう、流す前と流し方で次のことをする：
# - エミュレータ（npm run ios-swift:emulators）が動いていなければ流さない
# - GoogleService-Info.plist があると dev につながってログインするテストが全部落ちるので、流す間だけどける
# - 足したテストのファイルが入るよう、毎回 xcodegen generate する（Info.plist のコメントが消えるので戻す）
# - テストごとに時間の上限を置き、落ちても診断を集めない（集めると1件ごとに10分ほど待たされる）
# - 1件も流れなかったら失敗にする
# - 流している間は Mac をスリープさせない（caffeinate）。ただしバッテリーで蓋を閉じると止められないので、蓋は開けたままにする
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/ios-swift"
WORK="$(mktemp -d -t minopal-test)"
PLIST=Minopal/GoogleService-Info.plist
started=$SECONDS

restore_plist() {
  if [ -f "$WORK/GoogleService-Info.plist" ]; then
    mv "$WORK/GoogleService-Info.plist" "$PLIST"
    echo "GoogleService-Info.plist を戻した"
  fi
}
trap restore_plist EXIT
trap 'exit 130' INT TERM

for port in 9099 8080; do
  if ! curl -s -o /dev/null --max-time 3 "http://127.0.0.1:$port/"; then
    echo "エミュレータが動いていない（127.0.0.1:${port}）。先に npm run ios-swift:emulators を起動する" >&2
    exit 1
  fi
done

if [ -f "$PLIST" ]; then
  mv "$PLIST" "$WORK/GoogleService-Info.plist"
  echo "GoogleService-Info.plist を流す間だけどけた（終わったら戻す。止まったときは $WORK にある）"
fi

cp Minopal/Info.plist "$WORK/Info.plist"
xcodegen generate --quiet
cp "$WORK/Info.plist" Minopal/Info.plist

only=()
for name in "$@"; do
  class="${name%%/*}"
  if [[ "$name" == Minopal*Tests || "$name" == Minopal*Tests/* ]]; then
    only+=("-only-testing:$name")
  elif [ -f "MinopalUITests/$class.swift" ]; then
    only+=("-only-testing:MinopalUITests/$name")
  elif [ -f "MinopalTests/$class.swift" ]; then
    only+=("-only-testing:MinopalTests/$name")
  else
    echo "$name というテストが見つからない（MinopalUITests・MinopalTests のファイル名で書く）" >&2
    exit 1
  fi
done

PAD="${MINOPAL_TEST_PAD:-iPad Pro 11-inch (M5)}"
PHONE="${MINOPAL_TEST_PHONE:-iPhone 18 Pro}"
destinations=()
case "${MINOPAL_TEST_DEVICES:-both}" in
  pad) destinations+=(-destination "platform=iOS Simulator,name=$PAD,OS=latest") ;;
  phone) destinations+=(-destination "platform=iOS Simulator,name=$PHONE,OS=latest") ;;
  *) destinations+=(-destination "platform=iOS Simulator,name=$PAD,OS=latest"
                    -destination "platform=iOS Simulator,name=$PHONE,OS=latest") ;;
esac

parallel=(-parallel-testing-enabled YES -parallel-testing-worker-count 2)
if [ "${MINOPAL_TEST_PARALLEL:-1}" = 0 ]; then
  parallel=(-parallel-testing-enabled NO)
fi

RESULT="$WORK/result.xcresult"
LOG="$WORK/xcodebuild.log"
echo "テストを流す（${*:-全部}）。Mac の蓋は開けたままにする（閉じるとスリープしてテストが止まる）。全部の出力：$LOG"
status=0
caffeinate -dims xcodebuild test -project Minopal.xcodeproj -scheme Minopal "${destinations[@]}" ${only[@]+"${only[@]}"} \
  "${parallel[@]}" \
  -test-timeouts-enabled YES -default-test-execution-time-allowance 180 -maximum-test-execution-time-allowance 300 \
  -collect-test-diagnostics never -skipPackagePluginValidation -skipMacroValidation \
  -resultBundlePath "$RESULT" >"$LOG" 2>&1 || status=$?

if [ ! -d "$RESULT" ]; then
  grep -E "error: |\*\* BUILD FAILED \*\*" "$LOG" | sort -u || true
  echo "結果が無い（ビルドで止まった）。$LOG を見る" >&2
  exit 1
fi
summary="$(xcrun xcresulttool get test-results summary --path "$RESULT")"
node -e '
  const s = JSON.parse(process.argv[1]);
  console.log(`件数 ${s.totalTestCount}（通った ${s.passedTests}・落ちた ${s.failedTests}・飛ばした ${s.skippedTests}）`);
  for (const f of s.testFailures ?? []) console.log(`落ちた：${f.testIdentifierString ?? f.testName}\n  ${f.failureText.split("\n")[0]}`);
  if (s.totalTestCount === 0) { console.error("1件も流れていない。名前が合っているか確かめる"); process.exit(1); }
' "$summary" || status=1
echo "かかった時間 $(( (SECONDS - started) / 60 ))分$(( (SECONDS - started) % 60 ))秒。結果：$RESULT"
exit $status
