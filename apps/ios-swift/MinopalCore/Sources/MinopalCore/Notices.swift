import Foundation

// 閉じるまで画面に残す通知（packages/core/src/notices.ts）と、「編集中」の印（editing.ts）

public enum NoticeKind: String, Sendable {
    case lastOrder = "last_order"
    case shopTimer = "shop_timer"

    // NOTICE_ACTION：通知の中のボタン
    public var action: String {
        switch self {
        case .lastOrder: "L.O.確認済みにする"
        case .shopTimer: "済にする"
        }
    }
}
public enum NoticeTone: String, Sendable { case warning, danger }
// key は「閉じる」をその端末に覚えるのに使う。L.O. の通知は session、店のタイマーの通知は timerId を持つ
public struct Notice: Equatable, Sendable {
    public var key: String
    public var tone: NoticeTone
    public var message: String
    public var kind: NoticeKind
    public var session: Session?
    public var timerId: String?
}
// 店のふつうの時間のルールと違うときだけ key に足す（ふつうの卓は以前と同じ key）
private func ruleKey(_ rules: Rules) -> String {
    rules.lastOrderMin == Rules.standard.lastOrderMin && rules.seatLimitMin == Rules.standard.seatLimitMin ? "" : ":\(rules.lastOrderMin)-\(rules.seatLimitMin)"
}
// L.O. の通知（数え始めが古い順）のあとに、店のタイマーの通知を並べる。
// 数え始めの時刻・退店の時刻・店の L.O.／お席の時間を直したら、閉じた通知も別の通知として出し直す。
// 店全体で時間制限を切っているときは L.O. の通知を出さない。rulesOf は卓ごとに変えられる（コースごとの L.O.。sessionRules を渡す）
public func noticesOf(_ sessions: [Session], shopTimers: ShopTimerDone, now: Int, rulesOf: (Session) -> Rules, timers: [ShopTimer] = defaultShopTimers) -> [Notice] {
    let lastOrder = lastOrderDue(sessions, now: now, rulesOf: rulesOf).map { session -> Notice in
        Notice(key: lastOrderKey(session, rulesOf(session)), tone: .warning, message: lastOrderMessage(session), kind: .lastOrder, session: session)
    }
    let shop = timers.compactMap { timer -> Notice? in
        let state = shopTimerState(intervalMin: timer.intervalMin, doneAt: shopTimers[timer.id], now: now)
        return state.due ? Notice(key: "\(timer.id):\(state.dueAt)", tone: .danger, message: shopTimerMessage(timer), kind: .shopTimer, timerId: timer.id) : nil
    }
    return lastOrder + shop
}
private func lastOrderKey(_ session: Session, _ rules: Rules) -> String {
    let start = startOf(session, rules: rules).map(String.init) ?? "null"
    let leave = session.leaveAt.map { ":\($0)" } ?? ""
    return "lo:\(session.id):\(start)\(leave)\(ruleKey(rules))"
}
// 通知の文は卓番と内容だけ（ロック画面はお客さんからも見えるので、人数・メモ・名前は出さない。No.151）
private func lastOrderMessage(_ session: Session) -> String { "\(session.tableIds.joined(separator: "・"))卓 ラストオーダーの時間です" }
private func shopTimerMessage(_ timer: ShopTimer) -> String { "\(timer.label)の時間です" }

// 端末の通知（No.151。iOS だけなので TS には無い）：画面の通知（noticesOf）と同じ知らせを、これから時間が来る分だけ前もって予約する。
// アプリを閉じていても、ロック中でも鳴らすため。key・文は画面の通知と同じ。時間の来た分（画面に出ている分）は入れない。
// 予約したあとにほかの端末で時刻を変えたときは、この端末でアプリを開くまで古いまま（ローカル通知で作ると決めた。No.151）
public struct ScheduledNotice: Equatable, Sendable {
    public var key: String
    public var fireAt: Int
    public var message: String
}
// iOS が1つのアプリに予約させる通知は 64 件まで。早い順にここまで
public let scheduledNoticeMax = 60
public func scheduledNotices(_ sessions: [Session], shopTimers: ShopTimerDone, now: Int, rulesOf: (Session) -> Rules,
                             timers: [ShopTimer] = defaultShopTimers) -> [ScheduledNotice] {
    // L.O.：lastOrderDue と同じ卓（お通し・ファーストドリンクのあと、L.O.確認の前。全卓消去していない。時間制限なしでない）
    let lastOrder = sessions.compactMap { session -> ScheduledNotice? in
        let rules = rulesOf(session)
        guard !rules.timeLimitOff, session.status == .otoshi, session.clearedAt == nil,
              let limits = limitsOf(session, rules: rules), limits.lastOrderAt > now else { return nil }
        return ScheduledNotice(key: lastOrderKey(session, rules), fireAt: limits.lastOrderAt, message: lastOrderMessage(session))
    }
    // 店のタイマー：済にした時刻から間隔がたつと時間になる（一度も済にしていなければ、もう時間が来ている）
    let shop = timers.compactMap { timer -> ScheduledNotice? in
        let state = shopTimerState(intervalMin: timer.intervalMin, doneAt: shopTimers[timer.id], now: now)
        return state.due ? nil : ScheduledNotice(key: "\(timer.id):\(state.dueAt)", fireAt: state.dueAt, message: shopTimerMessage(timer))
    }
    return Array((lastOrder + shop).enumerated()
        .sorted { $0.element.fireAt != $1.element.fireAt ? $0.element.fireAt < $1.element.fireAt : $0.offset < $1.offset }
        .map(\.element)
        .prefix(scheduledNoticeMax))
}
public func noticesOf(_ sessions: [Session], shopTimers: ShopTimerDone, now: Int, rules: Rules = .standard, timers: [ShopTimer] = defaultShopTimers) -> [Notice] {
    noticesOf(sessions, shopTimers: shopTimers, now: now, rulesOf: { _ in rules }, timers: timers)
}
// 通知のベルで配置図を動かす卓（No.146）。いま開く通知が卓ならその卓。
// 店のタイマーなど卓が無い通知のときは、並んでいる卓の通知の先頭。卓の通知が無ければ nil
public func bellSeatId(_ notices: [Notice], shownKey: String?) -> String? {
    func tableOf(_ notice: Notice?) -> String? { notice?.kind == .lastOrder ? notice?.session?.tableIds.first : nil }
    if let shown = tableOf(notices.first { $0.key == shownKey }) { return shown }
    return notices.lazy.compactMap(tableOf).first
}

// 通知のバナーに出す分（No.159。iPad は 2 枚、iPhone は 1 枚）。shownKey の通知から順に limit 件（見つからなければ先頭から）。
// 入らない分は「ほか N件」にし、押すと出している分の次の通知から出し直す（最後まで行ったら先頭に戻る。Web の Toasts と同じ）
public struct NoticeWindow: Equatable, Sendable {
    public var shown: [Notice]
    public var rest: Int
    public var nextKey: String?
}
public func noticeWindow(_ notices: [Notice], shownKey: String?, limit: Int) -> NoticeWindow {
    guard !notices.isEmpty, limit > 0 else { return NoticeWindow(shown: [], rest: notices.count, nextKey: notices.first?.key) }
    let start = notices.firstIndex { $0.key == shownKey } ?? 0
    let count = min(limit, notices.count)
    let rest = notices.count - count
    return NoticeWindow(shown: (0..<count).map { notices[(start + $0) % notices.count] }, rest: rest,
                        nextKey: rest > 0 ? notices[(start + count) % notices.count].key : nil)
}

// 「編集中」の印（No.72）：複数人で使うとき、誰かが詳細を開いている卓を、ほかの端末に知らせる。
// 詳細を開いている端末は、開いているお客さんを editingHeartbeatMs ごとに書き直し、閉じたら消す。端末が落ちて消せなかった印は、editingFreshMs を過ぎたら出さない
public let editingHeartbeatMs = 20_000
public let editingFreshMs = 60_000
// これより古い印は、見た端末が消す（閉じずにアプリを落とした端末の印が溜まり続けないように）
public let editingStaleMs = 10 * 60_000
public struct EditingMark: Equatable, Sendable {
    public var sessionId: String
    public var at: Int
    public init(sessionId: String, at: Int) {
        self.sessionId = sessionId
        self.at = at
    }
}
// 新しい印だけを、お客さんの ID の集まりにする
public func editingSessionIds(_ marks: [EditingMark], now: Int) -> Set<String> {
    Set(marks.filter { now - $0.at < editingFreshMs }.map(\.sessionId))
}
