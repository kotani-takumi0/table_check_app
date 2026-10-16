import MinopalCore
import SwiftUI

// 店の画面で使う、今の時刻でのデータのまとめ（1秒ごとに作り直す）
@MainActor
struct ShopState {
    let services: ShopServices
    let now: Int
    let account: String?        // ログインした店はメールアドレス。今の店（ログインせずに使う）は nil
    let summary: FloorSummary
    let editingIds: Set<String>
    let noticeBoard: NoticeBoard
    let undo: UndoBoard
    // 通知（L.O.と店のタイマー。No.109）。「L.O.確認済みにする」「済にする」を押すまで残る
    let notices: [Notice]

    init(services: ShopServices, now: Int, account: String?, noticeBoard: NoticeBoard, undo: UndoBoard) {
        self.services = services
        self.now = now
        self.account = account
        self.noticeBoard = noticeBoard
        self.undo = undo
        let settings = services.settings.settings
        summary = FloorSummary(layout: services.layout.layout, sessions: services.sessions.sessions, settings: settings, now: now)
        editingIds = editingSessionIds(services.editing.marks, now: now)
        notices = noticesOf(services.sessions.sessions, shopTimers: services.timers.done, now: now,
                            rulesOf: { sessionRules(settings.rules, $0, menus: settings.courseMenus) }, timers: settings.shopTimers)
    }

    var settings: ShopSettings { services.settings.settings }
    var layout: ShopLayout { services.layout.layout }
    var sessions: [Session] { services.sessions.sessions }
    var shopName: String {
        let name = settings.shopName.trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? (account == nil ? "今の店" : "ログインした店") : name
    }

    func timerState(_ timer: ShopTimer) -> ShopTimerState {
        shopTimerState(intervalMin: timer.intervalMin, doneAt: services.timers.done[timer.id], now: now)
    }
    // 残り時間（画面の時刻は1秒ごとなので、済にした直後に周期を超えて見えないよう上限をかける。Web と同じ）
    func timerRest(_ timer: ShopTimer) -> String {
        let state = timerState(timer)
        if state.due { return "時間です" }
        return "あと\(min(timer.intervalMin, (state.remainingMs + 59_999) / 60_000))分"
    }
    // 印に残す緑の割合（0〜1）
    func timerLeft(_ timer: ShopTimer) -> Double {
        let state = timerState(timer)
        return state.due ? 0 : min(1, Double(state.remainingMs) / Double(timer.intervalMin * 60_000))
    }
    // 済にする（数秒は元に戻せる）
    func markTimerDone(_ timer: ShopTimer) {
        let at = nowMs()
        let before = services.timers.done[timer.id]
        services.timers.markDone(timer.id, at: at)
        undo.offer(shopTimerUndo(id: timer.id, label: timer.label, before: before, after: at))
    }

    // バナーに出す通知（iPad は 2 枚、iPhone は 1 枚）と、配置図で赤い輪で光らせる卓（出している L.O. の通知の卓と「卓を見る」の卓）
    func noticeWindow(limit: Int) -> NoticeWindow {
        MinopalCore.noticeWindow(notices, shownKey: noticeBoard.shownKey, limit: limit)
    }
    func ringedSeats(limit: Int) -> Set<String> {
        var seats = Set(noticeBoard.open ? noticeWindow(limit: limit).shown.flatMap { $0.session?.tableIds ?? [] } : [])
        if let flash = noticeBoard.flashSeat { seats.insert(flash) }
        return seats
    }
    // 通知のボタン：L.O.は確認済みに進め、店のタイマーは済にする（どちらも数秒は元に戻せる）
    func act(_ notice: Notice) {
        Haptics.success()
        switch notice.kind {
        case .lastOrder: if let session = notice.session { next(session) }
        case .shopTimer: if let timer = settings.shopTimers.first(where: { $0.id == notice.timerId }) { markTimerDone(timer) }
        }
        noticeBoard.restart()
    }
    // ベル：バナーを開き直し、通知の卓まで配置図を動かして光らせる（No.146）
    func openNotices() {
        noticeBoard.show(noticeBoard.shownKey)
        if let seatId = bellSeatId(notices, shownKey: noticeBoard.shownKey) { noticeBoard.reveal(seatId) }
    }

    // その卓に使う時間のルール（コースごとの L.O.・お席の時間。No.89）
    func rules(_ session: Session) -> Rules { sessionRules(settings.rules, session, menus: settings.courseMenus) }
    // 卓に出ているお客さん（無ければ空席）
    func occupant(_ tableId: String) -> Session? { occupantOf(sessions, tableId: tableId, now: now, rules: settings.rules) }
    // 今も卓に出ているお客さん（退店して時間がたった・全卓消去したお客さんは nil）
    func visibleSession(_ id: String) -> Session? { sessions.first { $0.id == id && isVisible($0, now: now, rules: settings.rules) } }

    // お客さんの書き換え（packages/core/src/useSessions.ts と同じ）。順番が崩れるなどで書けないものは書かない。時刻は押したときのもの
    func seat(_ tableId: String, guests: Int?, course: String?, menu: String?) {
        services.sessions.put(newSession(id: UUID().uuidString.lowercased(), tableId: tableId, at: nowMs(), guests: guests, course: course, menu: menu))
    }
    // 次の段階へ（詳細の大きいボタン・通知の「L.O.確認済みにする」。数秒は元に戻せる。No.122）
    func next(_ session: Session) {
        let after = advance(session, at: nowMs())
        services.sessions.put(after)
        undo.offer(nextUndo(before: session, after: after, rules: settings.rules))
    }
    // 1つ戻す。ご案内済みの卓は案内を取り消し、記録ごと消す（押し間違いなので。数秒は元に戻せる）
    func back(_ session: Session) {
        let previous = revert(session)
        if let previous { write(previous) } else { services.sessions.remove(id: session.id) }
        undo.offer(backUndo(before: session, after: previous, rules: settings.rules))
    }
    func retime(_ session: Session, _ field: EditableTime, at: Int) -> Bool { write(editTime(session, field, at: at, now: nowMs())) }
    func pay(_ session: Session) { write(togglePaid(session, at: nowMs())) }
    func changeGuests(_ session: Session, _ guests: Int?) { write(setGuests(session, guests)) }
    // 退店の時刻を決める（nil でふつうに戻す）。案内より前なら false
    func changeLeaveAt(_ session: Session, _ at: Int?) -> Bool { write(setLeaveAt(session, at)) }
    func changeCourse(_ session: Session, _ course: String?) { write(setCourse(session, course)) }
    func changeMenu(_ session: Session, _ menu: String?) { write(setMenu(session, menu, menus: settings.courseMenus)) }
    func serve(_ session: Session) { write(serveDish(session, at: nowMs(), menus: settings.courseMenus)) }
    func unserve(_ session: Session) { write(unserveDish(session, menus: settings.courseMenus)) }
    func moveTo(_ session: Session, from: String, to: String) { write(moveTable(session, from: from, to: to, at: nowMs())) }
    func addTo(_ session: Session, _ tableId: String) { write(addTable(session, tableId: tableId, at: nowMs())) }
    func release(_ session: Session, _ tableId: String) { write(removeTable(session, tableId: tableId, at: nowMs())) }

    // 全卓消去：今卓に出ているお客さんを全端末の画面から消す。記録は消さずに、消した時刻を付けて残す（No.113）
    func clearAll() {
        let at = nowMs()
        for session in sessions where isVisible(session, now: at, rules: settings.rules) {
            services.sessions.put(clearSession(session, at: at))
        }
    }
    // 全卓消去の確認に出す、まだお店にいて会計していない卓の数
    var unpaidTables: Int { unpaidTableCount(sessions, now: now, rules: settings.rules) }
    // 閉店で退店にする（No.129）。そのとき開いている端末が書く（何台が同時に書いても、退店の時刻は閉店時刻で同じ）。退店にした組の数を返す
    func closeOut() -> Int {
        let closed = closeOuts(sessions, now: nowMs(), closingMin: settings.closingMin)
        closed.forEach(services.sessions.put)
        return closed.count
    }

    // 店の設定を変える（変えた項目だけを書く。すべての端末にすぐ反映される）
    func updateSettings(_ fields: Set<ShopSettingsField>, _ change: (inout ShopSettings) -> Void) {
        var next = settings
        change(&next)
        services.settings.update(next, fields: fields)
    }

    @discardableResult
    private func write(_ session: Session?) -> Bool {
        guard let session else { return false }
        services.sessions.put(session)
        return true
    }
}

// 画面の切り替え（iPad はサイドバー、iPhone はお店タブから）
enum ShopPage: Hashable {
    case floor, layout, course, settings
}

// 店のタイマーの印：残り時間のぶんだけ淡い緑が残る丸。時間が来たら赤い角丸の四角（Web の .shop-timer-mark と同じ）
struct ShopTimerMark: View {
    let left: Double
    let due: Bool

    var body: some View {
        Group {
            if due {
                RoundedRectangle(cornerRadius: 5).fill(Palette.now)
            } else {
                ZStack {
                    Circle().fill(Palette.track)
                    Pie(fraction: left).fill(Palette.brandLeaf)
                }
            }
        }
        .frame(width: 16, height: 16)
        .accessibilityHidden(true)
    }
}

private struct Pie: Shape {
    var fraction: Double
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        path.move(to: center)
        path.addArc(center: center, radius: rect.width / 2, startAngle: .degrees(-90), endAngle: .degrees(-90 + 360 * fraction), clockwise: false)
        path.closeSubpath()
        return path
    }
}

// 同期の状態：同期済み（印と文字）・送信待ち・オフライン。onlyIcon は iPad でサイドバーを開いているとき
struct SyncStatusView: View {
    let state: SyncState
    var onlyIcon = false

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: symbol).font(.footnote.weight(.semibold))
            if !onlyIcon || state != .synced {
                Text(label).minopalFont(14, relativeTo: .footnote)
            }
        }
        .foregroundStyle(color)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityIdentifier("sync-state")
    }

    private var label: String {
        switch state {
        case .synced: "同期済み"
        case .pending: "送信待ち"
        case .offline: "オフライン"
        }
    }
    private var symbol: String {
        switch state {
        case .synced: "checkmark"
        case .pending: "arrow.triangle.2.circlepath"
        case .offline: "wifi.slash"
        }
    }
    private var color: Color {
        switch state {
        case .synced: Palette.ink2
        case .pending: Palette.soonInk
        case .offline: Palette.nowInk
        }
    }
}

// これから作る画面（席の配置・コース・お知らせ）の仮の中身
struct ComingLaterView: View {
    let title: String

    var body: some View {
        ContentUnavailableView(title, systemImage: "hammer", description: Text("この画面はこのあと作ります"))
            .background(Palette.tile)
            .navigationTitle(title)
    }
}
