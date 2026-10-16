import Foundation
import Testing
@testable import MinopalCore

// packages/core/src/domain.test.ts と同じ中身（テスト名も TS に合わせる）
private let seated = newSession(id: "session", tableId: "31", at: 10_000)
private let otoshi = advance(seated, at: 20_000)
private let loDone = advance(otoshi, at: 30_000)
private let exited = advance(loDone, at: 40_000)
private let minute = 60_000

private func with(_ session: Session, _ change: (inout Session) -> Void) -> Session {
    var result = session
    change(&result)
    return result
}

@Suite("状態遷移")
struct StatusTransitionTests {
    @Test("初期状態と各状態の時刻を記録し、引数を変更しない")
    func records() {
        #expect(seated == Session(id: "session", tableIds: ["31"], status: .seated, seatedAt: 10_000))
        #expect(otoshi == with(seated) { $0.status = .otoshi; $0.otoshiAt = 20_000 })
        #expect(loDone == with(otoshi) { $0.status = .loDone; $0.loDoneAt = 30_000 })
        #expect(exited == with(loDone) { $0.status = .exited; $0.exitedAt = 40_000 })
        #expect(advance(exited, at: 50_000) == exited)
        #expect(Status.allCases.map(nextStatus) == [.otoshi, .loDone, .exited, nil])
    }

    @Test("戻した状態の時刻だけ取り消す")
    func reverts() {
        #expect(revert(exited) == loDone)
        #expect(revert(loDone) == otoshi)
        #expect(revert(otoshi) == seated)
        #expect(revert(seated) == nil)
        #expect(exited.exitedAt == 40_000)
    }
}

@Test("警告の境界")
func alertBoundaries() {
    let cases: [(Session, Int, AlertLevel, AlertReason?)] = [
        (seated, seated.seatedAt + 15 * minute - 1000, .none, nil),
        (seated, seated.seatedAt + 15 * minute, .now, .otoshiMissing),
        // お通し前は席時間を数えない。120分たっても「お席の時間」ではなく「お通し未提供」
        (seated, seated.seatedAt + 120 * minute, .now, .otoshiMissing),
        (otoshi, otoshi.otoshiAt! + 90 * minute - 1000, .none, nil),
        (otoshi, otoshi.otoshiAt! + 90 * minute, .soon, .lastOrder),
        (otoshi, otoshi.otoshiAt! + 120 * minute - 1000, .soon, .lastOrder),
        (otoshi, otoshi.otoshiAt! + 120 * minute, .now, .seatLimit),
        (loDone, otoshi.otoshiAt! + 120 * minute - 1000, .none, nil),
        (loDone, otoshi.otoshiAt! + 120 * minute, .now, .seatLimit),
        (exited, 40_000, .none, nil),
        (exited, 40_000 + 1000 * minute, .none, nil),
    ]
    for (session, time, level, reason) in cases {
        #expect(alertOf(session, now: time) == AlertState(level: level, reason: reason), "\(session.status) at \(time)")
    }
}

@Test("退店から5分で非表示にする")
func hidesExited() {
    #expect(isVisible(exited, now: 40_000 + 5 * minute - 1000))
    #expect(!isVisible(exited, now: 40_000 + 5 * minute))
    for session in [seated, otoshi, loDone] { #expect(isVisible(session, now: 1_000_000_000_000)) }
}

@Test("会計前の卓数は、店にいて未払いの客の卓を数え、退店済・会計済み・見えない客は数えない")
func unpaidCount() {
    let group = with(otoshi) { $0.id = "group"; $0.tableIds = ["11", "12"] }
    let paid = togglePaid(with(seated) { $0.id = "paid"; $0.tableIds = ["13"] }, at: 50_000)
    #expect(unpaidTableCount([seated, group, paid, exited], now: 50_000) == 3)
    #expect(unpaidTableCount([], now: 50_000) == 0)
}

@Test("タイマーはお通しから数え、お通し前は止め、退店後は退店から計算し、負にならない")
func timers() {
    #expect(timerOf(seated, now: 50_000) == TimerState(label: "お通しから", elapsedMs: nil))
    for session in [otoshi, loDone] { #expect(timerOf(session, now: 50_000) == TimerState(label: "お通しから", elapsedMs: 30_000)) }
    #expect(timerOf(exited, now: 50_000) == TimerState(label: "退店から", elapsedMs: 10_000))
    #expect(timerOf(seated, now: 0).elapsedMs == nil)
    for session in [otoshi, loDone, exited] { #expect(timerOf(session, now: 0).elapsedMs == 0) }
}

@Test("formatElapsed")
func formatsElapsed() {
    for (ms, expected) in [(0, "00:00"), (3_599_000, "59:59"), (3_600_000, "1:00:00"), (3_661_000, "1:01:01"), (-1000, "00:00")] {
        #expect(formatElapsed(ms) == expected)
    }
}

@Suite("時刻の修正")
struct EditTimeTests {
    // TS は端末の時間帯で数える。ここでは日本時間に決めて、どの時間帯の CI でも同じ結果にする
    let at = { (h: Int, m: Int, day: Int) in tokyoMs(2026, 9, day, h, m) }
    var s: Session {
        with(newSession(id: "s", tableId: "11", at: at(19, 0, 26))) { $0.status = .loDone; $0.otoshiAt = at(19, 20, 26); $0.loDoneAt = at(20, 50, 26) }
    }
    var current: Int { at(21, 0, 26) }

    @Test("formatClock は HH:MM")
    func formatsClock() {
        #expect(formatClock(at(9, 5, 26), calendar: tokyo) == "09:05")
    }

    @Test("clockTimeNear は基準に最も近い日付の時刻を返す")
    func nearestClock() {
        #expect(clockTimeNear("19:20", near: at(19, 10, 26), calendar: tokyo) == at(19, 20, 26))
        #expect(clockTimeNear("23:50", near: at(0, 10, 27), calendar: tokyo) == at(23, 50, 26))
        #expect(clockTimeNear("00:10", near: at(23, 50, 26), calendar: tokyo) == at(0, 10, 27))
        for bad in ["24:00", "12:60", "1:00", ""] { #expect(clockTimeNear(bad, near: at(12, 0, 26), calendar: tokyo) == nil) }
    }

    @Test("案内・お通しを前後関係を保つ範囲で修正できる")
    func editsInOrder() {
        #expect(editTime(s, .otoshiAt, at: at(19, 10, 26), now: current) == with(s) { $0.otoshiAt = at(19, 10, 26) })
        #expect(editTime(s, .seatedAt, at: at(19, 20, 26), now: current) == with(s) { $0.seatedAt = at(19, 20, 26) })
        #expect(editTime(s, .otoshiAt, at: at(18, 59, 26), now: current) == nil)
        #expect(editTime(s, .otoshiAt, at: at(20, 51, 26), now: current) == nil)
        #expect(editTime(s, .seatedAt, at: at(19, 21, 26), now: current) == nil)
    }

    @Test("未提供のお通しは修正できず、案内は現在時刻より後にできない")
    func editLimits() {
        #expect(editTime(seated, .otoshiAt, at: 10_000, now: 20_000) == nil)
        #expect(editTime(seated, .seatedAt, at: 15_000, now: 20_000) == with(seated) { $0.seatedAt = 15_000 })
        #expect(editTime(seated, .seatedAt, at: 20_001, now: 20_000) == nil)
    }
}

@Test("お通しから L.O. の時間を過ぎて未確認のお通し済セッションを、お通しが古い順に返す")
func lastOrderDueOrder() {
    let late = advance(newSession(id: "late", tableId: "12", at: 5 * minute), at: 30 * minute)
    let early = advance(newSession(id: "early", tableId: "11", at: 1 * minute), at: 10 * minute)
    #expect(lastOrderDue([late, early], now: 10 * minute + 90 * minute - 1000).map(\.id) == [])
    #expect(lastOrderDue([late, early], now: 10 * minute + 90 * minute).map(\.id) == ["early"])
    #expect(lastOrderDue([late, early], now: 30 * minute + 90 * minute).map(\.id) == ["early", "late"])
    #expect(lastOrderDue([advance(early, at: 50 * minute), newSession(id: "seated", tableId: "13", at: 0)], now: 200 * minute) == [])
}

@Test("お会計は状態とは独立に切り替えられ、進める・戻すでは変わらない")
func paidIsIndependent() {
    let paid = togglePaid(otoshi, at: 70_000)
    #expect(paid == with(otoshi) { $0.paidAt = 70_000 })
    #expect(togglePaid(paid, at: 80_000) == otoshi)
    #expect(advance(paid, at: 90_000).paidAt == 70_000)
    #expect(revert(paid)?.paidAt == 70_000)
}

@Suite("卓の移動・団体")
struct TableMoveTests {
    let group = with(otoshi) { $0.tableIds = ["11", "12"] }
    let t = 100_000

    @Test("移動は指定した卓だけ付け替え、状態・時刻・会計は引き継ぐ")
    func moves() {
        #expect(moveTable(otoshi, from: "31", to: "15", at: t) == with(otoshi) { $0.tableIds = ["15"]; $0.tableLog = [TableMove(at: t, kind: .move, from: "31", to: "15")] })
        #expect(moveTable(group, from: "12", to: "21", at: t)?.tableIds == ["11", "21"])
        #expect(moveTable(group, from: "11", to: "3", at: t)?.tableIds == ["3", "12"])
    }

    @Test("持っていない卓からの移動・すでに持っている卓への移動はしない")
    func rejectsMoves() {
        #expect(moveTable(group, from: "13", to: "14", at: t) == nil)
        #expect(moveTable(group, from: "11", to: "12", at: t) == nil)
    }

    @Test("追加は数値順に並べ、重複は追加しない")
    func adds() {
        #expect(addTable(otoshi, tableId: "5", at: t) == with(otoshi) { $0.tableIds = ["5", "31"]; $0.tableLog = [TableMove(at: t, kind: .add, from: nil, to: "5")] })
        #expect(addTable(group, tableId: "12", at: t) == nil)
    }

    @Test("外すのは2卓以上のときだけ")
    func removes() {
        #expect(removeTable(group, tableId: "11", at: t) == with(group) { $0.tableIds = ["12"]; $0.tableLog = [TableMove(at: t, kind: .remove, from: "11", to: nil)] })
        #expect(removeTable(otoshi, tableId: "31", at: t) == nil)
        #expect(removeTable(group, tableId: "13", at: t) == nil)
    }

    @Test("卓の動きは、した順にすべて残す（No.113）")
    func logsMoves() {
        let moved = moveTable(otoshi, from: "31", to: "15", at: t)!
        let added = addTable(moved, tableId: "16", at: t + 1)!
        let removed = removeTable(added, tableId: "15", at: t + 2)!
        #expect(removed.tableLog.map(\.kind) == [.move, .add, .remove])
        #expect(removed.tableIds == ["16"])
    }
}

@Suite("全卓消去（No.113）")
struct ClearTests {
    @Test("記録は残して消した時刻を付け、卓には出さない")
    func clears() {
        let cleared = clearSession(otoshi, at: 200_000)
        #expect(cleared == with(otoshi) { $0.clearedAt = 200_000 })
        #expect(isVisible(otoshi, now: 200_000))
        #expect(!isVisible(cleared, now: 200_000))
        #expect(occupantOf([cleared], tableId: "31", now: 200_000) == nil)
    }

    @Test("2回消しても最初の時刻のまま")
    func keepsFirst() {
        #expect(clearSession(clearSession(otoshi, at: 200_000), at: 300_000).clearedAt == 200_000)
    }

    @Test("消したお客さんには L.O. を知らせない")
    func noLastOrder() {
        let late = 200 * minute
        #expect(lastOrderDue([otoshi], now: late) == [otoshi])
        #expect(lastOrderDue([clearSession(otoshi, at: late)], now: late) == [])
    }

    @Test("消したお客さんは未払いの卓に数えない")
    func notUnpaid() {
        #expect(unpaidTableCount([clearSession(otoshi, at: 200_000)], now: 200_000) == 0)
    }
}

@Suite("人数")
struct GuestsTests {
    @Test("案内時に人数を入れられ、入れなければ未入力")
    func onSeat() {
        #expect(newSession(id: "s", tableId: "12", at: 0, guests: 4).guests == 4)
        #expect(newSession(id: "s", tableId: "12", at: 0).guests == nil)
    }

    @Test("1〜99名の整数と未入力に変えられ、それ以外は変えない")
    func setsGuests() {
        #expect(setGuests(otoshi, 8) == with(otoshi) { $0.guests = 8 })
        #expect(setGuests(with(otoshi) { $0.guests = 8 }, nil) == otoshi)
        for bad in [0, 100, -1] { #expect(setGuests(otoshi, bad) == nil) }
        #expect([1, 99].allSatisfy { isGuestCount($0) })
        #expect(!(["3", nil, 2.5, Double.nan] as [Any?]).contains { isGuestCount($0) })
    }

    @Test("ご案内の −／＋ は1人ずつ変わり、1名から − で未入力、99名で止まる")
    func steps() {
        #expect(stepGuests(nil, 1) == 1)
        #expect(stepGuests(3, 1) == 4)
        #expect(stepGuests(99, 1) == 99)
        #expect(stepGuests(3, -1) == 2)
        #expect(stepGuests(1, -1) == nil)
        #expect(stepGuests(nil, -1) == nil)
    }

    @Test("人数は状態の進み・戻し・卓の移動・追加で変わらない（団体は全員の人数のまま）")
    func keepsGuests() {
        let four = with(otoshi) { $0.guests = 4 }
        #expect(advance(four, at: 90_000).guests == 4)
        #expect(revert(four)?.guests == 4)
        #expect(moveTable(four, from: "31", to: "12", at: 1)?.guests == 4)
        #expect(addTable(four, tableId: "12", at: 1)?.guests == 4)
    }
}

@Suite("コースの料理")
struct DishTests {
    let casual = newSession(id: "m", tableId: "12", at: 0, guests: 4, course: "drinks", menu: "casual")

    @Test("メニューは id が重ならず、どのコースにも料理がある")
    func menusAreValid() {
        #expect(Set(defaultCourseMenus.map(\.id)).count == defaultCourseMenus.count)
        #expect(defaultCourseMenus.allSatisfy { !$0.dishes.isEmpty && isMenuId($0.id) })
        for bad in ["", "X", "a-b", nil, 1] as [Any?] { #expect(!isMenuId(bad)) }
    }

    @Test("選ぶボタンは値段の安い順に並び、値段は桁区切りで出す")
    func prices() {
        let prices = defaultCourseMenus.map(\.price)
        #expect(prices == prices.sorted())
        #expect(priceLabel(menuOf("meat_share")!) == "4,000円")
        #expect(priceLabel(menuOf("nijikai")!) == "1,500円")
    }

    @Test("案内時にどのコースかを入れられる。通常の卓や知らない id は未選択にする")
    func menuOnSeat() {
        #expect(casual.menu == "casual" && casual.dishesServed == 0)
        #expect(newSession(id: "s", tableId: "12", at: 0, guests: 4, course: nil, menu: "casual").menu == nil)
        #expect(newSession(id: "s", tableId: "12", at: 0, guests: 4, course: "drinks", menu: "X!").menu == nil)
        #expect(newSession(id: "s", tableId: "12", at: 0, guests: 4, course: "drinks").menu == nil)
    }

    @Test("メニューの順に1品ずつ進め、全部出したらそれ以上進めない")
    func servesInOrder() {
        let dishes = menuOf("casual")!.dishes
        #expect(dishProgress(casual) == DishProgress(served: 0, total: dishes.count, next: dishes[0]))
        var session = casual
        for i in 0..<dishes.count { session = serveDish(session, at: i)! }
        #expect(dishProgress(session) == DishProgress(served: dishes.count, total: dishes.count, next: nil))
        #expect(serveDish(session, at: dishes.count) == nil)
    }

    @Test("1品戻せる。まだ出していなければ戻せない")
    func unserves() {
        #expect(unserveDish(casual) == nil)
        #expect(unserveDish(serveDish(casual, at: 1)!) == casual)
    }

    @Test("コースが未選択・通常の卓は料理を進めない")
    func noMenu() {
        let noMenu = newSession(id: "s", tableId: "12", at: 0, guests: 4, course: "drinks")
        #expect(dishProgress(noMenu) == nil)
        #expect(serveDish(noMenu, at: 1) == nil)
        #expect(dishProgress(newSession(id: "s", tableId: "12", at: 0)) == nil)
    }

    @Test("コースを選び直しても出した品数は残し、新しいメニューの品数までに収める")
    func reselects() {
        let cheese = with(casual) { $0.menu = "cheese"; $0.dishesServed = 7 }
        #expect(setMenu(cheese, "casual").map { ($0.menu, $0.dishesServed) } ?? (nil, -1) == ("casual", 7))
        #expect(setMenu(cheese, "nijikai").map { ($0.menu, $0.dishesServed) } ?? (nil, -1) == ("nijikai", menuOf("nijikai")!.dishes.count))
        #expect(setMenu(cheese, nil).map { ($0.menu, $0.dishesServed) } ?? ("x", -1) == (nil, 0))
        #expect(setMenu(cheese, "x") == nil)
        #expect(setMenu(newSession(id: "s", tableId: "12", at: 0), "casual") == nil)
    }

    @Test("料理の進みは状態の進み・戻し・卓の移動で変わらない")
    func keepsProgress() {
        let served = serveDish(casual, at: 1)!
        #expect(advance(served, at: 10 * 60_000).dishesServed == 1)
        #expect(moveTable(served, from: "12", to: "13", at: 1)?.dishesServed == 1)
    }

    @Test("出した時刻を1品ごとに残し、1品戻すとその品の時刻を外す（No.131）")
    func recordsTimes() {
        let two = serveDish(serveDish(casual, at: 5 * minute)!, at: 12 * minute)!
        #expect(two.dishesServed == 2 && two.dishServedAt == [5 * minute, 12 * minute])
        let one = unserveDish(two)!
        #expect(one.dishesServed == 1 && one.dishServedAt == [5 * minute])
        #expect(serveDish(one, at: 15 * minute)?.dishServedAt == [5 * minute, 15 * minute])
    }

    @Test("時刻を残す前の版で出した品は時刻を nil にし、品の順はずらさない（No.131）")
    func legacyTimes() {
        let legacy = with(casual) { $0.dishesServed = 2 }
        #expect(serveDish(legacy, at: 20 * minute)?.dishServedAt == [nil, nil, 20 * minute])
        // 前の版で1品戻されて、品数より多く残っている時刻は落とす
        #expect(serveDish(with(casual) { $0.dishesServed = 1; $0.dishServedAt = [5 * minute, 12 * minute] }, at: 20 * minute)?.dishServedAt == [5 * minute, 20 * minute])
    }

    @Test("コースを選び直すと品数に合わせて時刻も切り詰め、通常・未選択に戻すと消す（No.131）")
    func trimsTimes() {
        let cheese = with(casual) { $0.menu = "cheese"; $0.dishesServed = 7; $0.dishServedAt = [1, 2, 3, 4, 5, 6, 7] }
        #expect(setMenu(cheese, "nijikai")?.dishServedAt == Array([1, 2, 3, 4, 5].prefix(menuOf("nijikai")!.dishes.count)))
        #expect(setMenu(cheese, nil)?.dishServedAt == [])
        #expect(setCourse(cheese, nil)?.dishServedAt == [])
    }
}

@Suite("コース")
struct CourseTests {
    // 19:00 に案内、全員が揃って 19:20 にファーストドリンク
    let waiting = newSession(id: "c", tableId: "12", at: 0, guests: 6, course: "drinks")
    var started: Session { advance(waiting, at: 20 * minute) }

    @Test("案内時にコースを入れられ、入れなければ通常")
    func courseOnSeat() {
        #expect(waiting.course == "drinks")
        #expect(newSession(id: "s", tableId: "12", at: 0).course == nil)
        #expect(defaultDrinkPlans.map(\.id).allSatisfy { isCourse($0) })
        for bad in ["", "Drinks", "a-b", String(repeating: "x", count: 25), nil, 1] as [Any?] { #expect(!isCourse(bad)) }
    }

    @Test("区分の名前は店の一覧から引き、消した区分は「消した区分」と出す（No.90）")
    func planNames() {
        #expect(drinkPlanName(defaultDrinkPlans, "premium_drinks") == "プレミアム飲み放題")
        #expect(drinkPlanName([DrinkPlan(id: "plan_a", name: "2時間飲み放題")], "plan_a") == "2時間飲み放題")
        #expect(drinkPlanName([], "drinks") == "消した区分")
    }

    @Test("表示は開始待ち → ファーストドリンク提供済み → 以降は通常と同じ")
    func displays() {
        #expect(Status.allCases.map { displayOf($0, course: "no_drinks") } == [.courseWait, .firstDrink, .loDone, .exited])
        #expect(Status.allCases.map { displayOf($0, course: nil) } == [.seated, .otoshi, .loDone, .exited])
    }

    @Test("開始待ちの間はタイマーを進めず、ファーストドリンクから数える")
    func timers() {
        #expect(startOf(waiting) == nil)
        #expect(timerOf(waiting, now: 60 * minute) == TimerState(label: "ファーストドリンクから", elapsedMs: nil))
        #expect(startOf(started) == 20 * minute)
        #expect(timerOf(started, now: 50 * minute) == TimerState(label: "ファーストドリンクから", elapsedMs: 30 * minute))
        let exitedCourse = advance(advance(started, at: 100 * minute), at: 130 * minute)
        #expect(timerOf(exitedCourse, now: 131 * minute) == TimerState(label: "退店から", elapsedMs: minute))
    }

    @Test("開始待ちは何分たっても警告しない（お通し未提供も出さない）")
    func noAlertWhileWaiting() {
        #expect(alertOf(waiting, now: 15 * minute) == .none)
        #expect(alertOf(waiting, now: 500 * minute) == .none)
    }

    @Test("L.O.・お席の時間はファーストドリンクから数える")
    func alertsFromFirstDrink() {
        let cases: [(Int, AlertLevel, AlertReason?)] = [
            (20 * minute + 90 * minute - 1000, .none, nil),
            (20 * minute + 90 * minute, .soon, .lastOrder),
            (20 * minute + 120 * minute - 1000, .soon, .lastOrder),
            (20 * minute + 120 * minute, .now, .seatLimit),
        ]
        for (time, level, reason) in cases { #expect(alertOf(started, now: time) == AlertState(level: level, reason: reason)) }
    }

    @Test("L.O. の通知はお通し・ファーストドリンクから数え、数え始めが古い順に並べる")
    func lastOrderNotices() {
        let normal = advance(newSession(id: "normal", tableId: "11", at: 10 * minute), at: 15 * minute)
        #expect(lastOrderDue([started, normal, waiting], now: 15 * minute + 90 * minute).map(\.id) == ["normal"])
        #expect(lastOrderDue([started, normal, waiting], now: 20 * minute + 90 * minute).map(\.id) == ["normal", "c"])
        #expect(lastOrderDue([waiting], now: 1000 * minute) == [])
    }

    @Test("あとから通常とコースを直せて、状態・時刻・人数は変わらない")
    func changesCourse() {
        #expect(setCourse(started, nil) == with(started) { $0.course = nil })
        #expect(setCourse(otoshi, "premium_drinks") == with(otoshi) { $0.course = "premium_drinks" })
        #expect(setCourse(otoshi, "X-1") == nil)
    }

    @Test("通常に戻すと、どのコースか・料理の進みも消す")
    func clearsMenu() {
        let served = with(started) { $0.menu = "cheese"; $0.dishesServed = 3 }
        #expect(setCourse(served, nil) == with(started) { $0.course = nil; $0.menu = nil; $0.dishesServed = 0; $0.dishServedAt = [] })
        #expect(setCourse(served, "premium_drinks") == with(served) { $0.course = "premium_drinks" })
    }

    @Test("コースは状態の進み・戻し・卓の移動で変わらない")
    func keepsCourse() {
        #expect(revert(started) == waiting)
        #expect(moveTable(started, from: "12", to: "13", at: 1)?.course == "drinks")
        #expect(togglePaid(started, at: 30 * minute).course == "drinks")
    }
}

@Test("卓には、その卓を含む表示中のお客さんのうち最後に案内したものを出す")
func occupant() {
    let early = newSession(id: "a", tableId: "11", at: 0)
    let late = newSession(id: "b", tableId: "11", at: 10 * minute)
    let other = newSession(id: "c", tableId: "12", at: 20 * minute)
    #expect(occupantOf([late, early, other], tableId: "11", now: 30 * minute)?.id == "b")
    #expect(occupantOf([early, other], tableId: "13", now: 30 * minute) == nil)
    // 退店から5分を過ぎたお客さんは出さない
    let gone = advance(advance(advance(late, at: 11 * minute), at: 12 * minute), at: 13 * minute)
    #expect(gone.status == .exited)
    #expect(occupantOf([early, gone], tableId: "11", now: 13 * minute + 5 * minute)?.id == "a")
}

@Suite("退店済みの卓への移動・追加（No.133）")
struct PickTests {
    // 12番の団体（先に案内）と、11番で退店したばかりの組（あとに案内）
    let group = newSession(id: "group", tableId: "12", at: 0)
    let left = advance(advance(advance(newSession(id: "left", tableId: "11", at: 10 * minute), at: 11 * minute), at: 12 * minute), at: 13 * minute)

    @Test("退店済みだけが出ている卓は選べ、まだいるお客さんの卓は選べない")
    func pickable() {
        #expect(isPickable(nil))
        #expect(isPickable(left))
        #expect(!isPickable(group))
    }

    @Test("選んでいる間の案内は短く、どこをタップするかを先に出す")
    func guide() {
        #expect(pickGuideLabel(.move, from: "12", tableIds: ["12"]) == "12番の移動先をタップ（空席か退店済み）")
        #expect(pickGuideLabel(.add, from: "5", tableIds: ["5"]) == "5番の追加先をタップ（空席か退店済み）")
        #expect(pickGuideLabel(.add, from: "11", tableIds: ["11", "12", "13"]) == "11・12・13番の追加先をタップ（空席か退店済み）")
    }

    @Test("退店済みの卓に足した・移した組を、退店した組より先に出す")
    func stayingFirst() {
        let added = addTable(group, tableId: "11", at: 14 * minute)!
        #expect(occupantOf([added, left], tableId: "11", now: 15 * minute)?.id == "group")
        let moved = moveTable(group, from: "12", to: "11", at: 14 * minute)!
        #expect(occupantOf([moved, left], tableId: "11", now: 15 * minute)?.id == "group")
        // 誰も来なければ、退店済みのまま5分出す
        #expect(occupantOf([group, left], tableId: "11", now: 15 * minute)?.id == "left")
    }
}

@Suite("通常の卓のタイマー（No.132）")
struct PlainTimerTests {
    @Test("お通しを出すまでは止め、出した時刻から L.O.・お席の時間を数える")
    func startsAtOtoshi() {
        #expect(startOf(seated) == nil)
        #expect(limitsOf(seated) == nil)
        #expect(timerOf(seated, now: seated.seatedAt + 30 * minute) == TimerState(label: "お通しから", elapsedMs: nil))
        #expect(alertOf(seated, now: seated.seatedAt + 120 * minute).reason == .otoshiMissing)
        #expect(startOf(otoshi) == otoshi.otoshiAt)
        #expect(limitsOf(otoshi) == Limits(lastOrderAt: otoshi.otoshiAt! + 90 * minute, seatEndAt: otoshi.otoshiAt! + 120 * minute))
    }

    @Test("お通しの時刻を直すと、数え始めもずれる")
    func followsEdit() {
        let later = editTime(otoshi, .otoshiAt, at: 40_000, now: 50_000)
        #expect(later.flatMap { startOf($0) } == 40_000)
        #expect(later.map { timerOf($0, now: 50_000) } == TimerState(label: "お通しから", elapsedMs: 10_000))
    }

    @Test("お通しを出さない店の通常卓は案内から数え、未提供の警告は出さない")
    func noOtoshiShop() {
        var noOtoshi = Rules.standard
        noOtoshi.otoshi = false
        #expect(startOf(seated, rules: noOtoshi) == seated.seatedAt)
        #expect(alertOf(seated, now: seated.seatedAt + 30 * minute, rules: noOtoshi) == .none)
        #expect(alertOf(seated, now: seated.seatedAt + 120 * minute, rules: noOtoshi) == AlertState(level: .now, reason: .seatLimit))
        #expect(timerOf(seated, now: seated.seatedAt + 30 * minute, rules: noOtoshi) == TimerState(label: "案内から", elapsedMs: 30 * minute))
        #expect(timerOf(otoshi, now: 50_000, rules: noOtoshi) == TimerState(label: "案内から", elapsedMs: 40_000))
    }
}

@Test("詳細の大きいボタンは、押すと何になるかを「〜にする」で出す（No.123）")
func nextActionLabels() {
    let seated = newSession(id: "a", tableId: "5", at: 0)
    #expect(nextActionLabel(seated, from: "5") == "お通し提供済みにする")
    let otoshi = advance(seated, at: 1)
    #expect(nextActionLabel(otoshi, from: "5") == "L.O.確認済みにする")
    let lo = advance(otoshi, at: 2)
    #expect(nextActionLabel(lo, from: "5") == "退店済みにする")
    let exited = advance(lo, at: 3)
    #expect(nextActionLabel(exited, from: "5") == "ご案内する")
    #expect(nextActionLabel(with(exited) { $0.tableIds = ["11", "12"] }, from: "12") == "12番にご案内する")
    // コースは開始待ちのあとファーストドリンク
    #expect(nextActionLabel(setCourse(seated, "drinks")!, from: "5") == "ファーストドリンク提供済みにする")
}

// packages/core/src/leaveAt.test.ts のうち domain の分（文字盤・通知は No.148 の2つ目で移す）
@Suite("卓ごとの退店の時刻")
struct LeaveAtTests {
    let otoshi = advance(newSession(id: "s", tableId: "12", at: 0), at: 5 * minute)
    // 案内の60分後に退店してもらう卓（L.O.はその30分前）。お通しは案内の5分後
    var early: Session { setLeaveAt(otoshi, 60 * minute)! }

    @Test("ふつうはお通しから120分・L.O.は90分")
    func standard() {
        #expect(limitsOf(otoshi) == Limits(lastOrderAt: 95 * minute, seatEndAt: 125 * minute))
    }

    @Test("決めた卓は、その時刻とその30分前に L.O.・お席の時間の警告を出す")
    func earlyLeave() {
        #expect(limitsOf(self.early) == Limits(lastOrderAt: 30 * minute, seatEndAt: 60 * minute))
        #expect(alertOf(self.early, now: 30 * minute - 1) == .none)
        #expect(alertOf(self.early, now: 30 * minute) == AlertState(level: .soon, reason: .lastOrder))
        #expect(alertOf(self.early, now: 60 * minute) == AlertState(level: .now, reason: .seatLimit))
        #expect(lastOrderDue([self.early, otoshi], now: 31 * minute) == [self.early])
    }

    @Test("案内より前の時刻は決められず、nil でふつうに戻せる")
    func limits() {
        #expect(setLeaveAt(otoshi, 0) == nil)
        let reset = setLeaveAt(self.early, nil)
        #expect(reset != nil && reset?.leaveAt == nil)
    }

    @Test("Firestore に保存して読み戻せる")
    func roundTrip() {
        #expect(sessionFromDocument(id: "s", data: toSessionDocument(self.early))?.leaveAt == 60 * minute)
    }
}

// packages/core/src/shopSettings.test.ts のうち sessionRules（domain.ts）の分
@Suite("コースごとの L.O.・お席の時間（No.89）")
struct SessionRulesTests {
    let menus: [CourseMenu] = {
        var short = defaultCourseMenus[0], loOnly = defaultCourseMenus[1], bad = defaultCourseMenus[2]
        short.id = "short"; short.lastOrderMin = 60; short.seatLimitMin = 90
        loOnly.id = "lo_only"; loOnly.lastOrderMin = 100; loOnly.seatLimitMin = nil
        bad.id = "bad"; bad.lastOrderMin = 130; bad.seatLimitMin = nil
        return [short, loOnly, bad]
    }()
    func course(_ menu: String?) -> Session { advance(newSession(id: "c", tableId: "12", at: 0, guests: 4, course: "drinks", menu: menu), at: 0) }

    @Test("コースに決めてあればその分、片方だけならもう片方は店の設定")
    func usesMenu() {
        let short = sessionRules(.standard, course("short"), menus: menus)
        #expect(short.lastOrderMin == 60 && short.seatLimitMin == 90)
        let loOnly = sessionRules(.standard, course("lo_only"), menus: menus)
        #expect(loOnly.lastOrderMin == 100 && loOnly.seatLimitMin == 120)
    }

    @Test("決めていない・未選択・通常の卓・L.O. がお席の時間に届くときは店の設定")
    func fallsBack() {
        #expect(sessionRules(.standard, course("bad"), menus: menus) == .standard)
        #expect(sessionRules(.standard, course(nil), menus: menus) == .standard)
        #expect(sessionRules(.standard, otoshi, menus: menus) == .standard)
    }
}
