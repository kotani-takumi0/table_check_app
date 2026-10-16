import Foundation
import Testing
@testable import MinopalCore

// packages/core/src/dial.test.ts・cactusClock.test.ts・shopTemplates.test.ts・courseEditor.test.ts・undo.test.ts・sessionRecord.test.ts、
// leaveAt.test.ts の文字盤・通知の分と同じ中身。保存先（MemoryShopTimerStore）のテストは、Firestore の読み書きを移すとき（No.148 の4つ目）に移す
private let minute = 60_000

@Suite("文字盤")
struct DialTests {
    let seated = newSession(id: "s", tableId: "12", at: 0)
    var otoshi: Session { advance(seated, at: 5 * minute) }
    var loDone: Session { advance(otoshi, at: 95 * minute) }
    var exited: Session { advance(loDone, at: 100 * minute) }
    // コース：開始待ち（ファーストドリンクまで数えない）→ ファーストドリンク提供済み
    let courseWait = newSession(id: "c", tableId: "13", at: 0, guests: 3, course: "drinks")
    var firstDrink: Session { advance(courseWait, at: 10 * minute) }

    @Test("お通しから分で数え、お通し前は数えず、120分で一周する（切り捨て）")
    func counts() {
        #expect(dialOf(seated, now: 35 * minute + 59_000) == Dial(elapsedMin: nil, progress: 0, over: false, limitMin: 120))
        let start = 5 * minute
        #expect(dialOf(otoshi, now: start + 120 * minute - 1) == Dial(elapsedMin: 119, progress: 119.0 / 120, over: false, limitMin: 120))
        #expect(dialOf(otoshi, now: start + 120 * minute) == Dial(elapsedMin: 120, progress: 1, over: true, limitMin: 120))
        #expect(dialOf(otoshi, now: start + 150 * minute) == Dial(elapsedMin: 150, progress: 1, over: true, limitMin: 120))
    }

    @Test("コースはファーストドリンクから数え、開始待ちは数えない")
    func course() {
        #expect(dialOf(courseWait, now: 30 * minute) == Dial(elapsedMin: nil, progress: 0, over: false, limitMin: 120))
        #expect(dialOf(firstDrink, now: 40 * minute) == Dial(elapsedMin: 30, progress: 30.0 / 120, over: false, limitMin: 120))
    }

    @Test("退店済は退店の時刻で止め、時刻が戻っても負にしない")
    func stops() {
        #expect(dialOf(exited, now: 103 * minute).elapsedMin == 95)
        #expect(dialOf(otoshi, now: -minute).elapsedMin == 0)
    }

    @Test("L.O.確認済みまでは L.O.まで（切り上げ）。お通し前は出さない")
    func untilLastOrder() {
        #expect(remainingOf(seated, now: 35 * minute) == nil)
        #expect(remainingOf(otoshi, now: 5 * minute + 90 * minute - 30_000) == .lastOrder(minutes: 1))
    }

    @Test("L.O.の時間を過ぎるか L.O.確認済みにしたら退席まで")
    func untilSeatLimit() {
        let start = 5 * minute
        #expect(remainingOf(otoshi, now: start + 91 * minute) == .seatLimit(minutes: 29))
        #expect(remainingOf(otoshi, now: start + 90 * minute) == .seatLimit(minutes: 30))
        #expect(remainingOf(loDone, now: start + 60 * minute) == .seatLimit(minutes: 60))
        #expect(remainingOf(loDone, now: start + 118 * minute) == .seatLimit(minutes: 2))
    }

    @Test("お通しから120分を過ぎたらお席の時間を過ぎている")
    func over() {
        #expect(remainingOf(loDone, now: 5 * minute + 120 * minute) == .over)
    }

    @Test("退店済・お通し前・コースの開始待ちは出さない")
    func hidden() {
        #expect(remainingOf(exited, now: 101 * minute) == nil)
        #expect(remainingOf(seated, now: 30 * minute) == nil)
        #expect(remainingOf(courseWait, now: 30 * minute) == nil)
        #expect(remainingOf(firstDrink, now: 40 * minute) == .lastOrder(minutes: 60))
    }

    @Test("文言")
    func labels() {
        #expect(remainingLabel(.lastOrder(minutes: 55)) == "L.O.まで55分")
        #expect(remainingLabel(.seatLimit(minutes: 29)) == "退席まで29分")
        #expect(remainingLabel(.over) == "お席の時間を過ぎています")
    }

    @Test("時:分")
    func hourMinute() {
        #expect(formatHourMinute(0) == "0:00")
        #expect(formatHourMinute(35) == "0:35")
        #expect(formatHourMinute(118) == "1:58")
    }

    @Test("経過と残りを読み上げる")
    func spoken() {
        let now = 5 * minute + 35 * minute
        #expect(dialLabel(dialOf(otoshi, now: now), remainingOf(otoshi, now: now)) == "経過35分、L.O.まで55分")
        #expect(dialLabel(dialOf(seated, now: 0), nil) == "開始前")
        #expect(dialLabel(dialOf(courseWait, now: 0), nil) == "開始前")
    }

    @Test("円弧の点は12時から時計回り")
    func points() {
        let top = dialPoint(0, cx: 50, cy: 50, r: 40)
        #expect(abs(top.x - 50) < 1e-9 && abs(top.y - 10) < 1e-9)
        let right = dialPoint(0.25, cx: 50, cy: 50, r: 40)
        #expect(abs(right.x - 90) < 1e-9 && abs(right.y - 50) < 1e-9)
    }
}

@Suite("卓ごとの退店の時刻（文字盤・通知）")
struct LeaveAtDialTests {
    let otoshi = advance(newSession(id: "s", tableId: "12", at: 0), at: 5 * minute)
    // 案内の60分後に退店してもらう卓（L.O.はその30分前）
    var early: Session { setLeaveAt(otoshi, 60 * minute)! }

    @Test("残り時間・文字盤の帯もその時刻に合わせる")
    func dial() {
        #expect(remainingOf(early, now: 20 * minute) == .lastOrder(minutes: 10))
        #expect(remainingOf(early, now: 40 * minute) == .seatLimit(minutes: 20))
        #expect(remainingOf(early, now: 60 * minute) == .over)
        #expect(dialOf(early, now: 60 * minute).over)
        #expect(bandOf(early) == DialBand(from: 25.0 / 120, to: 55.0 / 120))
        #expect(bandOf(otoshi) == DialBand(from: 90.0 / 120, to: 1))
    }

    @Test("時刻を直したら L.O.の通知を出し直す（決めていない卓は以前と同じ key）")
    func noticeKeys() {
        let plain = noticesOf([otoshi], shopTimers: ["toilet_check": 100 * minute, "toilet_clean": 100 * minute], now: 100 * minute)
        #expect(plain.first?.key == "lo:s:\(5 * minute)")
        let moved = noticesOf([early], shopTimers: ["toilet_check": 100 * minute, "toilet_clean": 100 * minute], now: 50 * minute)
        #expect(moved.first?.key == "lo:s:\(5 * minute):\(60 * minute)")
    }
}

@Suite("サボテンの時計の印")
struct CactusClockTests {
    func at(_ h: Int, _ m: Int) -> Int { tokyoMs(2026, 9, 2, h, m) }

    @Test("縁に10個の点")
    func dots() {
        let clock = cactusClock(at(12, 0), calendar: tokyo)
        #expect(clock.dots.count == 10)
        #expect(clock.dots[0] == Point(x: 12, y: 3.42))
    }

    @Test("針はいまの時刻を指す（12時は真上、3時は右、30分は真下）")
    func hands() {
        let noon = cactusClock(at(12, 0), calendar: tokyo)
        #expect(abs(noon.hour.x - 12) < 0.01 && noon.hour.y < 12)
        #expect(abs(noon.minute.x - 12) < 0.01)
        let three = cactusClock(at(15, 0), calendar: tokyo)
        #expect(three.hour.x > 12 && abs(three.hour.y - 12) < 0.01)
        let half = cactusClock(at(19, 30), calendar: tokyo)
        #expect(abs(half.minute.x - 12) < 0.01 && half.minute.y > 12)
    }
}

@Suite("最初のページのテンプレート（No.087）")
struct ShopTemplateTests {
    @Test("今は「居酒屋・21卓」の1つ。配置はこの店の21卓で、そのまま保存できる")
    func izakaya() {
        #expect(shopTemplates.map(\.name) == ["居酒屋・21卓（カウンターあり）"])
        let izakaya = shopTemplates[0]
        #expect(izakaya.layout == defaultLayout)
        #expect(izakaya.layout.seats.count == 21)
        #expect(layoutProblems(izakaya.layout) == [])
    }

    @Test("設定一式（コース・区分・店のタイマー・時間のルール）を入れ、店名は入れない")
    func settings() {
        #expect(shopTemplates[0].settings == .standard)
        #expect(shopTemplates[0].settings.shopName == "")
    }

    @Test("自分で作る：コース・区分・店のタイマーは空、時間のルールはふつうの値。配置は空なので卓を置くまで保存できない")
    func blank() {
        #expect(blankSettings.drinkPlans.isEmpty && blankSettings.courseMenus.isEmpty && blankSettings.shopTimers.isEmpty)
        #expect(blankSettings.rules.lastOrderMin == 90 && blankSettings.rules.seatLimitMin == 120)
        #expect(layoutProblems(blankLayout).contains("卓が1つもありません"))
    }
}

@Suite("コースを作る・直す（No.89）")
struct CourseEditorTests {
    let rules = Rules.standard
    let casual = defaultCourseMenus[1]
    func with(_ menu: CourseMenu, _ change: (inout CourseMenu) -> Void) -> CourseMenu { var m = menu; change(&m); return m }
    // 保存する形（Firestore の shopSettings/main の courseMenus）
    func document(_ menu: CourseMenu) -> [String: Any] {
        ["id": menu.id, "name": menu.name, "price": menu.price, "short": menu.short, "dishes": menu.dishes,
         "lastOrderMin": menu.lastOrderMin.map { $0 as Any } ?? NSNull(), "seatLimitMin": menu.seatLimitMin.map { $0 as Any } ?? NSNull()]
    }

    @Test("新しいコースは空の下書きで、そのままでは保存できない")
    func draft() {
        let draft = newCourse(defaultCourseMenus, now: 1000)
        #expect(draft.id.range(of: "^menu_[a-z0-9]+$", options: .regularExpression) != nil)
        #expect(!courseProblems(draft).isEmpty)
        #expect(courseProblems(with(draft) { $0.name = "カジュアル"; $0.short = "カジュアル"; $0.price = 3000; $0.dishes = ["サラダ"] }) == [])
    }

    @Test("このコースだけの時間は店の設定から始め、step ずつ動かし、L.O. はお席の時間に届かない")
    func minutes() {
        let own = setOwnMinutes(casual, rules, own: true)
        #expect(courseMinutes(own, rules) == (90, 120))
        let stepped = stepCourseMinutes(own, rules, .lastOrderMin, -1)
        #expect(stepped?.lastOrderMin == 85 && stepped?.seatLimitMin == 120)
        #expect(stepCourseMinutes(with(own) { $0.lastOrderMin = 115 }, rules, .lastOrderMin, 1) == nil)
        let back = setOwnMinutes(own, rules, own: false)
        #expect(back.lastOrderMin == nil && back.seatLimitMin == nil)
        #expect(courseProblems(with(casual) { $0.lastOrderMin = 120; $0.seatLimitMin = 120 }).contains("L.O. はお席の時間より前にしてください"))
    }

    @Test("料理を上下に動かし、端では動かさない")
    func moves() {
        #expect(moveDish(["a", "b", "c"], index: 1, -1) == ["b", "a", "c"])
        #expect(moveDish(["a", "b", "c"], index: 2, 1) == ["a", "b", "c"])
    }

    @Test("保存は同じ id を置き換え、無ければ最後に足す（前後の空白は落とす）")
    func puts() {
        #expect(putCourse(defaultCourseMenus, with(casual) { $0.name = " 新カジュアル " })?[1].name == "新カジュアル")
        let added = putCourse(defaultCourseMenus, with(casual) { $0.id = "menu_x"; $0.dishes = [" 前菜 "] })
        #expect(added?.count == defaultCourseMenus.count + 1)
        #expect(added?.last?.dishes == ["前菜"])
        let full = (0..<20).map { i in with(casual) { $0.id = "menu_\(i)" } }
        #expect(putCourse(full, with(casual) { $0.id = "menu_new" }) == nil)
        #expect(putCourse(full, with(casual) { $0.id = "menu_3"; $0.name = "直した" })?[3].name == "直した")
    }

    @Test("案内中の卓が使っているコースと卓番を返す（通常の卓・未選択は数えない）")
    func inUse() {
        let sessions = [advance(newSession(id: "a", tableId: "12", at: 0, guests: 4, course: "drinks", menu: "casual"), at: 0),
                        newSession(id: "b", tableId: "14", at: 0, guests: 2, course: "drinks"), newSession(id: "c", tableId: "21", at: 0)]
        #expect(coursesInUse(sessions, now: 0, rules: rules) == ["casual": ["12"]])
    }

    @Test("保存されたコースの一覧は確かめて読み、壊れたコースは落とす")
    func parses() {
        #expect(parseShopSettings([:]).courseMenus == defaultCourseMenus)
        let items = [document(with(casual) { $0.id = "menu_a" }), document(with(casual) { $0.id = "menu_b"; $0.dishes = [] }), document(with(casual) { $0.id = "menu_a" })]
        #expect(parseShopSettings(["courseMenus": items]).courseMenus.map(\.id) == ["menu_a"])
    }
}

@Suite("元に戻す（No.102・No.121）")
struct UndoTests {
    let seated = newSession(id: "a", tableId: "5", at: 0, guests: 3)

    @Test("案内を取り消したあと、卓が空いていれば戻せる。別のお客さんを案内していたら戻さない")
    func cancelSeat() {
        let undo = backUndo(before: seated, after: nil)
        #expect(undo.message == "5番の案内を取り消しました")
        #expect(checkUndo(undo, sessions: [], done: [:]) == .ok)
        #expect(checkUndo(undo, sessions: [newSession(id: "b", tableId: "5", at: minute)], done: [:]) == .taken)
        // 退店済みの表示だけなら置き換えてよい
        let exited = advance(advance(advance(newSession(id: "c", tableId: "5", at: 0), at: minute), at: 2 * minute), at: 3 * minute)
        #expect(checkUndo(undo, sessions: [exited], done: [:]) == .ok)
        // 別の卓のお客さんは関係ない
        #expect(checkUndo(undo, sessions: [newSession(id: "d", tableId: "6", at: minute)], done: [:]) == .ok)
    }

    @Test("1つ戻したあと、ほかの端末で進めていたら戻さない")
    func back() {
        let otoshi = advance(seated, at: 10 * minute)
        let reverted = revert(otoshi)!
        let undo = backUndo(before: otoshi, after: reverted)
        #expect(undo.message == "5番を「ご案内済み」に戻しました")
        #expect(checkUndo(undo, sessions: [reverted], done: [:]) == .ok)
        #expect(checkUndo(undo, sessions: [advance(reverted, at: 12 * minute)], done: [:]) == .changed)
        #expect(checkUndo(undo, sessions: [], done: [:]) == .changed)
    }

    @Test("通知で L.O.確認済みにしたのを戻せる。コースの卓でも段階名は同じ")
    func lastOrder() {
        let otoshi = advance(seated, at: 10 * minute)
        let done = advance(otoshi, at: 90 * minute)
        let undo = nextUndo(before: otoshi, after: done)
        #expect(undo.message == "5番を「L.O.確認済み」にしました")
        #expect(checkUndo(undo, sessions: [done], done: [:]) == .ok)
    }

    @Test("タイマーの済は、そのあとほかの端末で済にしていなければ戻せる")
    func timer() {
        let undo = shopTimerUndo(id: "toilet_check", label: "トイレチェック", before: 10 * minute, after: 40 * minute)
        #expect(undo.message == "トイレチェックを済にしました")
        #expect(checkUndo(undo, sessions: [], done: ["toilet_check": 40 * minute]) == .ok)
        #expect(checkUndo(undo, sessions: [], done: ["toilet_check": 45 * minute]) == .changed)
    }

    @Test("詳細の大きいボタンで退店済みにしたのも戻せる（No.122）")
    func exited() {
        let lo = advance(advance(seated, at: 10 * minute), at: 60 * minute)
        let exited = advance(lo, at: 90 * minute)
        let undo = nextUndo(before: lo, after: exited)
        #expect(undo.message == "5番を「退店済み」にしました")
        #expect(checkUndo(undo, sessions: [exited], done: [:]) == .ok)
    }

    @Test("全卓消去したあとは戻さない。消したお客さんは卓を取っていないとみなす（No.113）")
    func cleared() {
        let next = advance(seated, at: minute)
        #expect(checkUndo(nextUndo(before: seated, after: next), sessions: [clearSession(next, at: 2 * minute)], done: [:]) == .changed)
        #expect(checkUndo(backUndo(before: seated, after: nil), sessions: [clearSession(newSession(id: "b", tableId: "5", at: minute), at: 2 * minute)], done: [:]) == .ok)
    }

    @Test("戻せない理由の言葉")
    func refused() {
        #expect(UndoCheck.ok.refusedMessage == nil)
        #expect(UndoCheck.changed.refusedMessage == "ほかの端末で変わったので、元に戻せませんでした")
        #expect(UndoCheck.taken.refusedMessage == "その卓にはもう次のお客さんがいるので、元に戻せませんでした")
    }
}

@Suite("記録に写すもの（No.113）")
struct SessionRecordTests {
    let app = AppInfo(platform: .web, version: "2.4.0")
    let at = tokyoMs(2026, 9, 11, 1, 30)   // 10/11 の 1:30 は 10/10 の営業日
    let menu = defaultCourseMenus[1]

    @Test("通常の組：営業日・店の時間のルール・書いた端末を写し、区分とコースは null")
    func plain() {
        let record = sessionRecord(newSession(id: "a", tableId: "12", at: at), settings: .standard, app: app, calendar: tokyo)
        #expect(record == SessionRecord(businessDay: "2026-10-10", drinkPlanName: .some(nil), courseName: .some(nil),
                                        timeRules: TimeRules(lastOrderMin: 90, seatLimitMin: 120, timeLimitOff: false), platform: .web, appVersion: "2.4.0"))
        let document = record.toDocument()
        #expect(document["drinkPlanName"] is NSNull && document["courseName"] is NSNull)
    }

    @Test("コースの組：そのときの区分・コースの名前と、コースの時間のルールを写す")
    func course() {
        var settings = ShopSettings.standard
        settings.rules.timeLimitOff = true
        var timed = menu
        timed.lastOrderMin = 100; timed.seatLimitMin = 150
        settings.courseMenus = [timed]
        let record = sessionRecord(newSession(id: "a", tableId: "12", at: at, guests: 4, course: "drinks", menu: menu.id), settings: settings, app: app, calendar: tokyo)
        #expect(record.drinkPlanName == .some("飲み放題") && record.courseName == .some(menu.name))
        #expect(record.timeRules == TimeRules(lastOrderMin: 100, seatLimitMin: 150, timeLimitOff: true))
    }

    @Test("設定で消した区分・コースは名前を書かない（前に写した名前を残す）")
    func deleted() {
        var settings = ShopSettings.standard
        settings.drinkPlans = []; settings.courseMenus = []
        let record = sessionRecord(newSession(id: "a", tableId: "12", at: at, course: "drinks", menu: menu.id), settings: settings, app: app, calendar: tokyo)
        #expect(record.drinkPlanName == nil && record.courseName == nil)
        #expect(record.toDocument()["drinkPlanName"] == nil && record.toDocument()["courseName"] == nil)
    }

    @Test("コースを選んでいなければコースの名前は null")
    func noMenu() {
        #expect(sessionRecord(newSession(id: "a", tableId: "12", at: at, course: "drinks"), settings: .standard, app: app, calendar: tokyo).courseName == .some(nil))
    }

    @Test("保存した記録を読み戻す。壊れた項目は入れない")
    func roundTrip() {
        let record = sessionRecord(newSession(id: "a", tableId: "12", at: at, guests: 4, course: "drinks", menu: menu.id), settings: .standard, app: app, calendar: tokyo)
        #expect(recordFromDocument(record.toDocument().merging(["updatedAt": 1]) { $1 }) == record)
        #expect(recordFromDocument(["businessDay": 1, "platform": "android", "timeRules": ["lastOrderMin": 90]]) == SessionRecord())
    }
}

@Suite("通知のバナーに出す分（No.159）")
struct NoticeWindowTests {
    // 3つとも時間が来た店のタイマー（一度も済にしていない）
    let notices = noticesOf([], shopTimers: [:], now: 0, timers: ["a", "b", "c"].map { ShopTimer(id: $0, label: $0, icon: "patrol", intervalMin: 30) })

    func keys(_ window: NoticeWindow) -> [String] { window.shown.map(\.key) }

    @Test("iPad は 2 枚、入らない分は「ほか N件」で、押すと次から出す")
    func pad() {
        let window = noticeWindow(notices, shownKey: nil, limit: 2)
        #expect(keys(window) == ["a:0", "b:0"])
        #expect(window.rest == 1)
        #expect(window.nextKey == "c:0")
        // 最後まで行ったら先頭に戻る
        let next = noticeWindow(notices, shownKey: "c:0", limit: 2)
        #expect(keys(next) == ["c:0", "a:0"])
        #expect(next.nextKey == "b:0")
    }

    @Test("iPhone は 1 枚。出していた通知が消えたら先頭から")
    func phone() {
        #expect(keys(noticeWindow(notices, shownKey: "b:0", limit: 1)) == ["b:0"])
        #expect(keys(noticeWindow(notices, shownKey: "gone", limit: 1)) == ["a:0"])
        #expect(noticeWindow(notices, shownKey: nil, limit: 1).rest == 2)
    }

    @Test("全部入れば「ほか」は出さない。通知が無ければ何も出さない")
    func fits() {
        let window = noticeWindow(Array(notices.prefix(2)), shownKey: nil, limit: 2)
        #expect(window.rest == 0 && window.nextKey == nil)
        #expect(noticeWindow([], shownKey: nil, limit: 2) == NoticeWindow(shown: [], rest: 0, nextKey: nil))
    }
}

@Suite("端末の通知（No.151）")
struct ScheduledNoticeTests {
    let rules = Rules.standard
    // 0 分に案内、5 分にお通し
    let otoshi = advance(newSession(id: "s", tableId: "21", at: 0), at: 5 * minute)
    let timer = ShopTimer(id: "toilet_check", label: "トイレチェック", icon: "patrol", intervalMin: 30)

    func schedule(_ sessions: [Session], done: ShopTimerDone = [:], now: Int, rules: Rules = .standard) -> [ScheduledNotice] {
        scheduledNotices(sessions, shopTimers: done, now: now, rulesOf: { _ in rules }, timers: [timer])
    }

    @Test("L.O. の時刻に、画面の通知と同じ key・文で予約する")
    func lastOrder() {
        let limits = limitsOf(otoshi, rules: rules)!
        let scheduled = schedule([otoshi], done: ["toilet_check": 0], now: 10 * minute).filter { $0.key.hasPrefix("lo:") }
        #expect(scheduled == [ScheduledNotice(key: "lo:s:\(5 * minute)", fireAt: limits.lastOrderAt, message: "21卓 ラストオーダーの時間です")])
        // 時間が来たら、画面の通知と同じ key・文
        let shown = noticesOf([otoshi], shopTimers: ["toilet_check": limits.lastOrderAt], now: limits.lastOrderAt, rules: rules, timers: [timer])
        #expect(shown.map(\.key) == scheduled.map(\.key))
        #expect(shown.map(\.message) == scheduled.map(\.message))
    }

    @Test("時間の来た通知・L.O.確認済み・お通し前・全卓消去・時間制限なしは予約しない")
    func skips() {
        let lastOrderAt = limitsOf(otoshi, rules: rules)!.lastOrderAt
        let done: ShopTimerDone = ["toilet_check": lastOrderAt]
        #expect(schedule([otoshi], done: done, now: lastOrderAt).map(\.key) == ["toilet_check:\(lastOrderAt + 30 * minute)"])
        #expect(schedule([advance(otoshi, at: 10 * minute)], done: done, now: 20 * minute).count == 1)
        #expect(schedule([newSession(id: "a", tableId: "1", at: 0)], done: done, now: minute).count == 1)
        var cleared = otoshi
        cleared.clearedAt = 10 * minute
        #expect(schedule([cleared], done: done, now: 20 * minute).count == 1)
        var off = rules
        off.timeLimitOff = true
        #expect(schedule([otoshi], done: done, now: 20 * minute, rules: off).count == 1)
    }

    @Test("店のタイマーは済にした時刻から間隔のあと。一度も済にしていなければ予約しない（もう画面に出ている）")
    func shopTimer() {
        #expect(schedule([], done: ["toilet_check": 10 * minute], now: 20 * minute)
                == [ScheduledNotice(key: "toilet_check:\(40 * minute)", fireAt: 40 * minute, message: "トイレチェックの時間です")])
        #expect(schedule([], now: 0) == [])
    }

    @Test("早い順に並べ、iOS の上限より多ければ早いほうだけ")
    func order() {
        let sessions = (0..<70).map { advance(newSession(id: "s\($0)", tableId: "\($0)", at: $0 * minute), at: $0 * minute) }
        let scheduled = schedule(sessions.reversed(), done: ["toilet_check": 0], now: 0)
        #expect(scheduled.count == scheduledNoticeMax)
        #expect(scheduled.map(\.fireAt) == scheduled.map(\.fireAt).sorted())
        #expect(scheduled.first?.key == "toilet_check:\(30 * minute)")
    }
}
