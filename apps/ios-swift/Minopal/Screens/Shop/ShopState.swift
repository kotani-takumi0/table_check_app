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

    init(services: ShopServices, now: Int, account: String?) {
        self.services = services
        self.now = now
        self.account = account
        summary = FloorSummary(layout: services.layout.layout, sessions: services.sessions.sessions, settings: services.settings.settings, now: now)
        editingIds = editingSessionIds(services.editing.marks, now: now)
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
    func markTimerDone(_ timer: ShopTimer) {
        services.timers.markDone(timer.id, at: nowMs())
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
    func next(_ session: Session) { write(advance(session, at: nowMs())) }
    // 1つ戻す。ご案内済みの卓は案内を取り消し、記録ごと消す（押し間違いなので）
    func back(_ session: Session) {
        if let previous = revert(session) { write(previous) } else { services.sessions.remove(id: session.id) }
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
