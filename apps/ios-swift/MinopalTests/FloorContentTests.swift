import Foundation
import MinopalCore
import Testing
@testable import Minopal

// 卓カードに出す中身と、サイドバー・帯の数（画面に依存しない部分。エミュレータは使わない）
@Suite("卓カードの中身と店のまとめ")
struct FloorContentTests {
    private let minute = 60_000
    private let now = 1_800_000_000_000
    private let table = Seat(id: "1", kind: .table, col: 1, colSpan: 2, row: 1, rowSpan: 2)
    private let counter = Seat(id: "16", kind: .counter, col: 1, colSpan: 1, row: 10, rowSpan: 1)

    // お通しを出して minutes 分たったお客さん
    private func served(_ minutes: Int, on seat: Seat, guests: Int? = 4) -> Session {
        advance(newSession(id: "s\(seat.id)", tableId: seat.id, at: now - (minutes + 2) * minute, guests: guests), at: now - minutes * minute)
    }

    @Test("ふだんの卓：経過・区分・短い残り時間。警告なし")
    func normal() {
        let content = SeatCardContent(seat: table, session: served(42, on: table), settings: .standard, now: now, editing: false)
        #expect(content.elapsed == "0:42")
        #expect(content.sub == "通常")
        #expect(content.guests == .some(4))
        #expect(content.stage == Display.otoshi.shortLabel)
        #expect(content.corner == "L.O.48分")
        #expect(content.alert == .none)
        #expect(content.lo == 0.75)   // L.O. 90分 ÷ お席の時間 120分
    }

    @Test("お通しを出さずに15分：いま対応で、帯は理由。経過は開始前")
    func otoshiMissing() {
        let session = newSession(id: "s", tableId: "1", at: now - 16 * minute, guests: 2)
        let content = SeatCardContent(seat: table, session: session, settings: .standard, now: now, editing: false)
        #expect(content.alert == .now)
        #expect(content.stage == "お通し未提供")
        #expect(content.elapsed == "開始前")
    }

    @Test("L.O. の時間を過ぎた：もうすぐ。カウンターは「L.O.」の文字も出す")
    func lastOrder() {
        let content = SeatCardContent(seat: counter, session: served(95, on: counter, guests: nil), settings: .standard, now: now, editing: false)
        #expect(content.alert == .soon)
        #expect(content.stage == "L.O.の時間")
        #expect(content.counterMark == "L.O.")
        #expect(content.guests == .none)   // カウンターは人数を出さない
    }

    @Test("退店済：経過は「—」、右は「案内可」")
    func exited() {
        let session = advance(advance(served(60, on: table), at: now - 15 * minute), at: now - 10 * minute)
        let content = SeatCardContent(seat: table, session: session, settings: .standard, now: now, editing: false)
        #expect(content.exited)
        #expect(content.elapsed == "—")
        #expect(content.corner == "案内可")
    }

    @Test("団体の印と、会計済み・人数未入力の読み上げ")
    func groupAndPaid() {
        var session = served(20, on: table, guests: nil)
        session.tableIds = ["1", "2", "3"]
        session.paidAt = now
        let content = SeatCardContent(seat: table, session: session, settings: .standard, now: now, editing: true)
        #expect(content.groupMark == "+2+3")
        #expect(content.sub == "通常・会計済")
        #expect(content.accessibilityLabel.hasPrefix("ほかの端末で編集中 1番（1・2・3番の団体） 人数未入力"))
        #expect(content.accessibilityLabel.hasSuffix(" お会計済み"))
    }

    @Test("店のまとめ：空席には退店済みの卓も入れる")
    func summary() {
        let layout = ShopLayout(seats: [table, counter, Seat(id: "2", kind: .table, col: 4, colSpan: 2, row: 1, rowSpan: 2)], labels: [])
        let gone = advance(advance(served(60, on: counter, guests: nil), at: now - 15 * minute), at: now - 10 * minute)
        let missing = newSession(id: "m", tableId: "1", at: now - 16 * minute, guests: 2)
        let summary = FloorSummary(layout: layout, sessions: [missing, gone], settings: .standard, now: now)
        #expect(summary.total == 3)
        #expect(summary.now == ["1"])
        #expect(summary.empty == ["16", "2"])
        #expect(summary.seated == 1)
    }

    @Test("店名の下の日付は営業日（4時より前は前の日）")
    @MainActor
    func businessDay() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Tokyo")!
        let at = calendar.date(from: DateComponents(year: 2026, month: 10, day: 17, hour: 2))!
        #expect(businessDayLabel(Int(at.timeIntervalSince1970 * 1000), calendar: calendar) == "10月16日（金）")
    }
}
