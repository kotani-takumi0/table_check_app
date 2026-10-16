import Foundation
import MinopalCore

// 卓カードに出す中身（Web の SeatCard.tsx と同じ決め方。見た目は No.149 の確定画像）。
// 画面に依存しないので、テストで確かめられる
struct SeatCardContent: Equatable {
    var number: String          // 卓番
    var groupMark: String       // 団体の他の卓（+2、+2+3、+3卓）。団体でなければ空
    var guests: Int??           // 人数。テーブル卓だけ（カウンターは .none）。未入力は .some(nil)
    var sub: String             // 2行目：区分（通常・飲み放題A など）・料理の進み・会計済
    var elapsed: String         // 経過（0:42）。お通し前・コースの開始待ちは「開始前」、退店済は「—」
    var progress: Double        // 物差しの長さ 0〜1
    var lo: Double?             // 物差しの L.O. の目盛り（0〜1）。時間制限なしは nil
    var stage: String           // 下の帯の左：段階（警告のときは理由）
    var corner: String          // 下の帯の右：残り時間を短く（L.O.48分）
    var counterMark: String?    // カウンターの急ぎの文字（お通し・L.O.・時間）。色だけで伝えないため
    var alert: AlertLevel
    var exited: Bool
    var paid: Bool
    var accessibilityLabel: String

    init(seat: Seat, session: Session, settings: ShopSettings, now time: Int, editing: Bool) {
        let rules = sessionRules(settings.rules, session, menus: settings.courseMenus)
        let alertState = alertOf(session, now: time, rules: rules)
        let dial = dialOf(session, now: time, rules: rules)
        let remaining = remainingOf(session, now: time, rules: rules)
        let display = displayOf(session.status, course: session.course, rules: rules)
        let others = session.tableIds.filter { $0 != seat.id }
        let progressOfDishes = seat.kind == .table ? dishProgress(session, menus: settings.courseMenus) : nil
        number = seat.id
        groupMark = others.isEmpty ? "" : "+" + (others.count <= 2 ? others.joined(separator: "+") : "\(others.count)卓")
        guests = seat.kind == .table ? .some(session.guests) : .none
        exited = session.status == .exited
        paid = session.paidAt != nil
        alert = alertState.level
        var subParts = [session.course.map { drinkPlanName(settings.drinkPlans, $0) } ?? "通常"]
        if let progressOfDishes { subParts.append("料理 \(progressOfDishes.served)/\(progressOfDishes.total)") }
        if paid { subParts.append("会計済") }
        sub = subParts.joined(separator: "・")
        elapsed = exited ? "—" : dial.elapsedMin.map(formatHourMinute) ?? "開始前"
        progress = dial.progress
        lo = rules.timeLimitOff ? nil : bandOf(session, rules: rules).from
        stage = Self.stageText(alertState, display: display)
        corner = exited ? "案内可" : remaining.map(Self.shortRemaining) ?? "停止中"
        counterMark = alertState.reason.map(Self.counterText)
        let guestText: String = switch guests {
        case .none: ""
        case .some(.none): " 人数未入力"
        case .some(.some(let count)): " \(count)名"
        }
        let group = others.isEmpty ? "" : "（\(session.tableIds.joined(separator: "・"))番の団体）"
        accessibilityLabel = (editing ? "ほかの端末で編集中 " : "") + "\(seat.id)番\(group)\(guestText) \(display.label) \(dialLabel(dial, remaining))"
            + (alertState.reason.map { " \($0.label)" } ?? "") + (paid ? " お会計済み" : "")
    }

    // 警告のときは理由だけ（残り時間は詳細で見せる。No.149 の HIG チェック）
    static func stageText(_ alert: AlertState, display: Display) -> String {
        alert.reason?.label ?? display.shortLabel
    }

    // 下の帯の右は「…」で切れないよう短い形にする（No.149 の HIG チェック）
    static func shortRemaining(_ remaining: Remaining) -> String {
        switch remaining {
        case .lastOrder(let minutes): "L.O.\(minutes)分"
        case .seatLimit(let minutes): "退席\(minutes)分"
        case .over: "時間超過"
        case .noLimit: "制限なし"
        }
    }

    static func counterText(_ reason: AlertReason) -> String {
        switch reason {
        case .otoshiMissing: "お通し"
        case .lastOrder: "L.O."
        case .seatLimit: "時間"
        }
    }
}
