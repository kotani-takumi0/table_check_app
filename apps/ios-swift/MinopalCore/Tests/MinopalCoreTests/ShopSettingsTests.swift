import Foundation
import Testing
@testable import MinopalCore

// packages/core/src/shopSettings.test.ts・shopTimers.test.ts・shopTimerIcons.test.ts・editing.test.ts・notices.test.ts と同じ中身。
// 保存先（MemoryShopSettingsStore・NoEditingStore）のテストは、Firestore の読み書きを移すとき（No.148 の4つ目）に移す
private let minute = 60_000
private let seated = newSession(id: "s", tableId: "12", at: 0)
private let otoshi = advance(seated, at: 5 * minute)
private let off: Rules = { var r = Rules.standard; r.timeLimitOff = true; return r }()

private func with<T>(_ value: T, _ change: (inout T) -> Void) -> T {
    var result = value
    change(&result)
    return result
}

@Suite("店全体で時間制限を切る")
struct TimeLimitOffTests {
    @Test("L.O.・お席の時間の警告と L.O.の通知を出さない")
    func noAlerts() {
        #expect(alertOf(otoshi, now: 100 * minute, rules: off) == .none)
        #expect(alertOf(otoshi, now: 130 * minute, rules: off) == .none)
        #expect(lastOrderDue([otoshi], now: 100 * minute, rules: off) == [])
        #expect(noticesOf([otoshi], shopTimers: ["toilet_check": 100 * minute, "toilet_clean": 100 * minute], now: 100 * minute, rules: off) == [])
    }

    @Test("お通しの警告はそのまま出す")
    func keepsOtoshi() {
        #expect(alertOf(seated, now: 20 * minute, rules: off) == AlertState(level: .now, reason: .otoshiMissing))
    }

    @Test("残り時間の代わりに「時間制限なし」を出す（退店済・開始待ちは出さない）")
    func noLimitLabel() {
        #expect(remainingOf(otoshi, now: 30 * minute, rules: off) == .noLimit)
        #expect(remainingLabel(.noLimit) == "時間制限なし")
        #expect(remainingOf(advance(advance(otoshi, at: minute), at: minute), now: 30 * minute, rules: off) == nil)
        #expect(remainingOf(newSession(id: "c", tableId: "13", at: 0, guests: 2, course: "drinks"), now: 30 * minute, rules: off) == nil)
    }

    @Test("切っていないときは今までどおり")
    func standard() {
        #expect(alertOf(otoshi, now: 100 * minute) == AlertState(level: .soon, reason: .lastOrder))
        #expect(lastOrderDue([otoshi], now: 100 * minute) == [otoshi])
    }
}

@Suite("店の設定")
struct ShopSettingsParseTests {
    @Test("壊れた値や無い項目は既定値（時間制限あり）で読む")
    func defaults() {
        #expect(parseShopSettings(nil) == .standard)
        #expect(parseShopSettings(["timeLimitOff": "yes"]) == .standard)
        #expect(parseShopSettings(["timeLimitOff": true, "other": 1]) == with(ShopSettings.standard) { $0.rules.timeLimitOff = true })
        let parsed = parseShopSettings(["lastOrderMin": 60, "seatLimitMin": 90, "otoshiWarnMin": 10, "exitedKeepMin": 3, "otoshi": false, "shopName": "ミノパル"])
        #expect(parsed == with(ShopSettings.standard) {
            $0.rules = Rules(otoshiWarnMin: 10, lastOrderMin: 60, seatLimitMin: 90, exitedKeepMin: 3, otoshi: false, timeLimitOff: false)
            $0.shopName = "ミノパル"
        })
    }

    @Test("閉店時刻は15分ごとの分だけを読み、ほかは決めていない（No.129）")
    func closing() {
        #expect(parseShopSettings(["closingMin": 1410]).closingMin == 1410)
        for closingMin in [nil, NSNull(), 1412, 1440, "1410"] as [Any?] {
            #expect(parseShopSettings(closingMin.map { ["closingMin": $0] } ?? [:]).closingMin == nil)
        }
    }

    @Test("範囲の外の分は既定値、L.O. がお席の時間に届くなら両方とも既定値で読む")
    func outOfRange() {
        #expect(parseShopSettings(["otoshiWarnMin": 0, "exitedKeepMin": 1.5, "seatLimitMin": 999]) == .standard)
        #expect(parseShopSettings(["lastOrderMin": 120, "seatLimitMin": 120]) == .standard)
        #expect(parseShopSettings(["shopName": String(repeating: "あ", count: 31)]).shopName == "")
    }

    @Test("分は step ずつ変え、範囲の外や L.O. がお席の時間に届く変更はしない")
    func steps() {
        let rules = Rules.standard
        #expect(stepMinutes(rules, .lastOrderMin, 1) == 95)
        #expect(stepMinutes(rules, .exitedKeepMin, -1) == 4)
        #expect(stepMinutes(with(rules) { $0.lastOrderMin = 115 }, .lastOrderMin, 1) == nil)
        #expect(stepMinutes(with(rules) { $0.lastOrderMin = 115 }, .seatLimitMin, -1) == nil)
        #expect(stepMinutes(with(rules) { $0.otoshiWarnMin = 5 }, .otoshiWarnMin, -1) == nil)
    }
}

@Suite("店ごとの時間のルール（No.14）")
struct ShopRulesTests {
    let rules = Rules(otoshiWarnMin: 10, lastOrderMin: 60, seatLimitMin: 90, exitedKeepMin: 2, otoshi: true, timeLimitOff: false)

    @Test("L.O.・お席の時間・お通しの警告をその分で出す")
    func alerts() {
        #expect(limitsOf(otoshi, rules: rules) == Limits(lastOrderAt: 65 * minute, seatEndAt: 95 * minute))
        #expect(alertOf(otoshi, now: 65 * minute, rules: rules) == AlertState(level: .soon, reason: .lastOrder))
        #expect(alertOf(otoshi, now: 95 * minute, rules: rules) == AlertState(level: .now, reason: .seatLimit))
        #expect(alertOf(seated, now: 10 * minute, rules: rules) == AlertState(level: .now, reason: .otoshiMissing))
        #expect(lastOrderDue([otoshi], now: 65 * minute, rules: rules) == [otoshi])
    }

    @Test("L.O.・お席の時間を変えたら、閉じた L.O. の通知も別の通知として出し直す（ふつうの値なら key は今までどおり）")
    func noticeKeys() {
        func key(_ r: Rules) -> String { noticesOf([otoshi], shopTimers: ["toilet_check": 200 * minute, "toilet_clean": 200 * minute], now: 130 * minute, rules: r)[0].key }
        #expect(key(.standard) == "lo:s:\(5 * minute)")
        #expect(key(rules) != key(with(rules) { $0.lastOrderMin = 65 }))
    }

    @Test("退店の時刻を決めた卓は、その「お席の時間 − L.O.」前を L.O. にする")
    func leaveAt() {
        #expect(limitsOf(with(otoshi) { $0.leaveAt = 80 * minute }, rules: rules) == Limits(lastOrderAt: 50 * minute, seatEndAt: 80 * minute))
    }

    @Test("文字盤はお席の時間で一周し、帯は L.O. からお席の時間まで")
    func dial() {
        #expect(dialOf(otoshi, now: 50 * minute, rules: rules) == Dial(elapsedMin: 45, progress: 0.5, over: false, limitMin: 90))
        #expect(bandOf(otoshi, rules: rules) == DialBand(from: 60.0 / 90, to: 1))
    }

    @Test("退店済みはその分だけ残す")
    func keepsExited() {
        let exited = with(otoshi) { $0.status = .exited; $0.exitedAt = 50 * minute }
        #expect(isVisible(exited, now: 51 * minute, rules: rules))
        #expect(!isVisible(exited, now: 52 * minute, rules: rules))
    }

    @Test("お通しを出さない店は、お通し未提供の警告を出さず、2段目をファーストドリンク提供済みと呼ぶ")
    func noOtoshi() {
        let noOtoshi = with(Rules.standard) { $0.otoshi = false }
        #expect(alertOf(seated, now: 30 * minute, rules: noOtoshi) == .none)
        #expect(displayOf(.otoshi, course: nil, rules: noOtoshi) == .firstDrink)
        #expect(displayOf(.seated, course: nil, rules: noOtoshi) == .seated)
        #expect(displayOf(.otoshi, course: nil) == .otoshi)
    }
}

@Suite("飲み放題の区分（No.90）")
struct DrinkPlanTests {
    @Test("無い・壊れた一覧は最初の一覧、壊れた項目と同じ id は落とし、空の一覧はそのまま読む")
    func parses() {
        #expect(parseShopSettings([:]).drinkPlans == defaultDrinkPlans)
        #expect(parseShopSettings(["drinkPlans": "x"]).drinkPlans == defaultDrinkPlans)
        #expect(parseShopSettings(["drinkPlans": [Any]()]).drinkPlans == [])
        let items: [Any] = [["id": "plan_a", "name": "2時間"], ["id": "plan_a", "name": "重複"], ["id": "Bad-id", "name": "x"], ["id": "plan_b", "name": ""], NSNull()]
        #expect(parseShopSettings(["drinkPlans": items]).drinkPlans == [DrinkPlan(id: "plan_a", name: "2時間")])
    }

    @Test("新しい区分の id は既存と重ならない")
    func newIds() {
        let id = newDrinkPlanId([], now: 1000)
        #expect(id.range(of: "^plan_[a-z0-9]+$", options: .regularExpression) != nil)
        #expect(newDrinkPlanId([DrinkPlan(id: id, name: "a")], now: 1000) != id)
    }
}

@Test("L.O. の通知は卓ごとのルールで出す（No.89）")
func lastOrderByCourse() {
    var shortMenu = defaultCourseMenus[0]
    shortMenu.id = "short"; shortMenu.lastOrderMin = 60; shortMenu.seatLimitMin = 90
    let short = advance(newSession(id: "c", tableId: "12", at: 0, guests: 4, course: "drinks", menu: "short"), at: 0)
    #expect(lastOrderDue([short, otoshi], now: 60 * minute, rulesOf: { sessionRules(.standard, $0, menus: [shortMenu]) }) == [short])
}

@Suite("店全体のタイマー")
struct ShopTimerStateTests {
    @Test("済にしてから周期が経つと時間になる（境界は >=）")
    func boundary() {
        #expect(shopTimerState(intervalMin: 30, doneAt: 0, now: 30 * minute - 1000) == ShopTimerState(due: false, dueAt: 30 * minute, remainingMs: 1000))
        #expect(shopTimerState(intervalMin: 30, doneAt: 0, now: 30 * minute) == ShopTimerState(due: true, dueAt: 30 * minute, remainingMs: 0))
    }

    @Test("一度も済にしていなければすぐに時間")
    func neverDone() {
        #expect(shopTimerState(intervalMin: 120, doneAt: nil, now: 5).due)
    }

    @Test("読み終わる前は残りを出さない。読み終わったら前に済にした時刻から出す")
    func hiddenUntilLoaded() {
        let doneAt = 1_000_000
        #expect(shownShopTimerState(intervalMin: 30, doneAt: nil, now: doneAt, loaded: false) == nil)
        #expect(shownShopTimerState(intervalMin: 30, doneAt: doneAt, now: doneAt, loaded: false) == nil)
        let shown = shownShopTimerState(intervalMin: 30, doneAt: doneAt, now: doneAt + 10 * minute, loaded: true)
        #expect(shown == ShopTimerState(due: false, dueAt: doneAt + 30 * minute, remainingMs: 20 * minute))
        #expect(shownShopTimerState(intervalMin: 30, doneAt: nil, now: doneAt, loaded: true)?.due == true)
    }

    @Test("空のキャッシュは読み終わりではない。文書があるキャッシュと、サーバーの返事は読み終わり")
    func snapshotLoaded() {
        let waiting = ShopTimerRead(done: ["toilet_check": 50], loaded: false)
        #expect(applyShopTimerSnapshot(waiting, fromCache: true, documentCount: 0, parsed: [:]) == waiting)
        let cached = applyShopTimerSnapshot(waiting, fromCache: true, documentCount: 1, parsed: ["toilet_check": 80])
        #expect(cached == ShopTimerRead(done: ["toilet_check": 80], loaded: true))
        #expect(applyShopTimerSnapshot(ShopTimerRead(), fromCache: false, documentCount: 0, parsed: [:]) == ShopTimerRead(done: [:], loaded: true))
        #expect(applyShopTimerSnapshot(cached, fromCache: true, documentCount: 0, parsed: [:]) == cached)
        #expect(shopTimersLoaded(fromCache: false, documentCount: 2))
    }

    @Test("保存データから有限の数値だけ取り出す")
    func parsesDoneAt() {
        #expect(parseDoneAt("10") == 10)
        for bad in [nil, "", "x", "Infinity", "NaN"] { #expect(parseDoneAt(bad) == nil) }
    }
}

@Test("同期状態はいちばん悪いものを出す")
func worstSync() {
    #expect(worstSyncState([.synced, .synced]) == .synced)
    #expect(worstSyncState([.synced, .pending]) == .pending)
    #expect(worstSyncState([.pending, .offline]) == .offline)
}

@Test("別タブの済を消さずに、タイマーごとに新しい時刻を残す")
func mergesDone() {
    #expect(mergeShopTimerDone(["toilet_check": 5], ["toilet_clean": 3]) == ["toilet_check": 5, "toilet_clean": 3])
    #expect(mergeShopTimerDone(["toilet_check": 5], ["toilet_check": 2]) == ["toilet_check": 5])
    #expect(mergeShopTimerDone(["toilet_check": 2], ["toilet_check": 5]) == ["toilet_check": 5])
}

@Suite("店が決めるタイマー（No.91）")
struct CustomTimerTests {
    let timer = ShopTimer(id: "timer_a", label: "ゴミ出し", icon: "🗑️", intervalMin: 60)
    var raw: [String: Any] { ["id": timer.id, "label": timer.label, "icon": timer.icon, "intervalMin": timer.intervalMin] }

    @Test("無い・壊れた一覧は最初の一覧、壊れたタイマーと同じ id は落とし、空の一覧はそのまま読む")
    func parses() {
        #expect(parseShopTimers(nil) == defaultShopTimers)
        #expect(parseShopTimers([Any]()) == [])
        let items: [Any] = [raw, raw.merging(["label": "重複"]) { $1 }, raw.merging(["id": "Bad"]) { $1 },
                            raw.merging(["id": "b", "intervalMin": 3]) { $1 }, raw.merging(["id": "c", "icon": ""]) { $1 }]
        #expect(parseShopTimers(items) == [timer])
        #expect(parseShopTimers((0..<6).map { raw.merging(["id": "t\($0)"]) { $1 } }).count == 4)
    }

    @Test("間隔は5分ずつ、5〜480分の中で変える")
    func steps() {
        #expect(stepInterval(timer, 1)?.intervalMin == 65)
        #expect(stepInterval(with(timer) { $0.intervalMin = 5 }, -1) == nil)
        #expect(stepInterval(with(timer) { $0.intervalMin = 480 }, 1) == nil)
    }

    @Test("新しいタイマーの id は形が正しく、既存と重ならない")
    func newIds() {
        let id = newShopTimerId([], now: 1000)
        #expect(isShopTimerId(id))
        #expect(newShopTimerId([with(timer) { $0.id = id }], now: 1000) != id)
    }

    @Test("通知は店のタイマーで出す")
    func notices() {
        #expect(noticesOf([], shopTimers: [:], now: 0, timers: [timer]).map(\.message) == ["ゴミ出しの時間です"])
    }

    @Test("スマホの短い名前は、共通する頭を省く")
    func shortNames() {
        #expect(shortTimerNames(["トイレチェック", "トイレ清掃"]) == ["チェック", "清掃"])
        #expect(shortTimerNames(["トイレ清掃", "ゴミ出し"]) == ["トイレ清掃", "ゴミ出し"])
        // 省くと空になる名前があれば省かない。1つだけならそのまま
        #expect(shortTimerNames(["トイレ", "トイレ清掃"]) == ["トイレ", "トイレ清掃"])
        #expect(shortTimerNames(["トイレチェック"]) == ["トイレチェック"])
        #expect(shortTimerNames([]) == [])
    }
}

@Suite("店のタイマーのアイコン（No.99）")
struct ShopTimerIconTests {
    @Test("id で引ける。id は保存できる長さ（8文字まで）で重ならない")
    func lookup() {
        #expect(shopTimerIcon("patrol").name == "見回り")
        for icon in shopTimerIcons { #expect(icon.id.count <= ShopTimerLimits.icon) }
        #expect(Set(shopTimerIcons.map(\.id)).count == shopTimerIcons.count)
    }

    @Test("最初の一覧はアイコンの id を持つ")
    func defaultsHaveIcons() {
        for timer in defaultShopTimers { #expect(shopTimerIcons.contains { $0.id == timer.icon }) }
    }

    @Test("前の版の絵文字は近いアイコンに、知らない値は時計に読み替える")
    func legacy() {
        #expect(shopTimerIcon("👀").id == "patrol")
        #expect(shopTimerIcon("🧽").id == "clean")
        #expect(shopTimerIcon("🗑️").id == "bag")
        #expect(shopTimerIcon("🍺").id == fallbackShopTimerIcon)
        #expect(shopTimerIcon("").id == fallbackShopTimerIcon)
    }
}

@Test("編集中の印は、新しい印だけを出す（端末が落ちて消せなかった古い印は出さない）")
func editingMarks() {
    let marks = [EditingMark(sessionId: "a", at: 1000), EditingMark(sessionId: "b", at: 1000 - editingFreshMs), EditingMark(sessionId: "a", at: 500)]
    #expect(editingSessionIds(marks, now: 1000 + editingFreshMs - 1) == ["a"])
    #expect(editingSessionIds(marks, now: 1000 + editingFreshMs) == [])
}

@Suite("通知")
struct NoticeTests {
    @Test("L.O. の時間が来た卓と、時間になったトイレを通知する")
    func notices() {
        let otoshi = advance(newSession(id: "a", tableId: "11", at: 0), at: minute)
        let notices = noticesOf([otoshi], shopTimers: ["toilet_check": 100 * minute, "toilet_clean": 0], now: 120 * minute)
        #expect(notices.map(\.kind) == [.lastOrder, .shopTimer])
        #expect(notices.map(\.message) == ["11卓 ラストオーダーの時間です", "トイレ清掃の時間です"])
    }

    @Test("数え始めを直すと、L.O. の通知は別の key になる（閉じても出し直す）")
    func retimed() {
        let otoshi = advance(newSession(id: "a", tableId: "11", at: 0), at: 10 * minute)
        let before = noticesOf([otoshi], shopTimers: ["toilet_check": 0, "toilet_clean": 0], now: 100 * minute)[0]
        let retimed = editTime(otoshi, .otoshiAt, at: 5 * minute, now: 100 * minute)
        #expect(retimed != nil)
        let after = noticesOf([retimed!], shopTimers: ["toilet_check": 0, "toilet_clean": 0], now: 100 * minute)[0]
        #expect(before.key != after.key)
    }

    @Test("ベルは、いま開く通知の卓へ動かす。卓が無ければ並びの先頭の卓、卓の通知が無ければ動かさない")
    func bell() {
        let first = advance(newSession(id: "a", tableId: "21", at: 0), at: minute)
        let second = advance(newSession(id: "b", tableId: "7", at: minute), at: 2 * minute)
        let notices = noticesOf([second, first], shopTimers: ["toilet_check": 0, "toilet_clean": 100 * minute], now: 120 * minute)
        let lo = notices.filter { $0.kind == .lastOrder }
        #expect(lo.map { $0.session?.tableIds[0] } == ["21", "7"])
        #expect(bellSeatId(notices, shownKey: lo[1].key) == "7")
        #expect(bellSeatId(notices, shownKey: notices.first { $0.kind == .shopTimer }!.key) == "21")
        #expect(bellSeatId(notices, shownKey: nil) == "21")
        let onlyShop = noticesOf([], shopTimers: ["toilet_check": 0, "toilet_clean": 0], now: 31 * minute)
        #expect(bellSeatId(onlyShop, shownKey: onlyShop.first?.key) == nil)
        #expect(bellSeatId([], shownKey: nil) == nil)
    }

    @Test("トイレの通知の key は次の時刻ごとに変わる（済にしたら次の周期で出し直す）")
    func timerKeys() {
        let first = noticesOf([], shopTimers: ["toilet_check": 0], now: 31 * minute).first { $0.kind == .shopTimer && $0.timerId == "toilet_check" }
        let second = noticesOf([], shopTimers: ["toilet_check": 31 * minute], now: 62 * minute).first { $0.kind == .shopTimer && $0.timerId == "toilet_check" }
        #expect(first?.key == "toilet_check:1800000")
        #expect(second?.key == "toilet_check:\(61 * minute)")
    }
}
