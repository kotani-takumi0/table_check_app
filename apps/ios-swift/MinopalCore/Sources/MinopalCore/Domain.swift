import Foundation

// 卓の状態の進み方・タイマー・警告・卓の移動（packages/core/src/domain.ts の Swift 版）。TS と同じ中身にする

// コースは通常の「ご案内済み」「お通し提供済み」の位置に「開始待ち」「ファーストドリンク提供済み」が入る。
// 状態の値は同じものを使い、表示（名前・色）だけ変える。L.O.確認済み以降は通常と同じ
public enum Display: String, CaseIterable, Sendable {
    case seated, otoshi
    case loDone = "lo_done"
    case exited
    case courseWait = "course_wait"
    case firstDrink = "first_drink"

    // STATUS_LABEL
    public var label: String {
        switch self {
        case .seated: "ご案内済み"
        case .otoshi: "お通し提供済み"
        case .loDone: "L.O.確認済み"
        case .exited: "退店済み"
        case .courseWait: "開始待ち"
        case .firstDrink: "ファーストドリンク提供済み"
        }
    }
    // STATUS_CARD：卓カードの状態名・次へのボタン。「ファーストドリンク提供済み」はカードに入らないので縮める（詳細パネルは正式名）
    public var cardLabel: String { self == .firstDrink ? "ファースト済み" : label }
    // STATUS_SHORT
    public var shortLabel: String {
        switch self {
        case .seated: "案内済"
        case .otoshi: "お通し済"
        case .loDone: "L.O.済"
        case .exited: "退店済"
        case .courseWait: "開始待"
        case .firstDrink: "FD済"
        }
    }
}

// 飲み放題の区分。区分を選ぶとその卓はコースになる（nil は通常）。区分の一覧は店が設定で決める（No.90）。セッションには区分の id を保存する
public struct DrinkPlan: Equatable, Sendable {
    public var id: String
    public var name: String
    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}
// 最初の一覧（No.90 より前から使っている id なので変えない）
public let defaultDrinkPlans = [
    DrinkPlan(id: "no_drinks", name: "飲み放題なし"), DrinkPlan(id: "drinks", name: "飲み放題"), DrinkPlan(id: "premium_drinks", name: "プレミアム飲み放題"),
]
// 区分の名前。設定で消した区分を使っている卓は「消した区分」と出す
public func drinkPlanName(_ plans: [DrinkPlan], _ id: String) -> String {
    plans.first { $0.id == id }?.name ?? "消した区分"
}

// お通しを出さない店（rules.otoshi が false）は、2段目を「ファーストドリンク提供済み」と呼ぶ（段はそのまま残す。No.14）
public func displayOf(_ status: Status, course: String?, rules: Rules = .standard) -> Display {
    guard course != nil else {
        return !rules.otoshi && status == .otoshi ? .firstDrink : Display(rawValue: status.rawValue)!
    }
    switch status {
    case .seated: return .courseWait
    case .otoshi: return .firstDrink
    case .loDone: return .loDone
    case .exited: return .exited
    }
}

// 店ごとに決める時間のルール（No.14。設定の「時間のルール」で変え、全端末で共有する）。standard はふだんの値（RULES）
public struct Rules: Equatable, Sendable {
    public var otoshiWarnMin: Int   // お通し未提供の警告（案内から）
    public var lastOrderMin: Int    // L.O.（数え始めから）
    public var seatLimitMin: Int    // お席の時間（数え始めから）
    public var exitedKeepMin: Int   // 退店済みを卓に残す時間
    public var otoshi: Bool         // お通しを出す店か。出さない店は「お通し未提供」の警告を出さない
    public var timeLimitOff: Bool   // 店全体で時間制限を切っている（L.O.・お席の時間の警告を出さない。お通しの警告はそのまま）

    public init(otoshiWarnMin: Int, lastOrderMin: Int, seatLimitMin: Int, exitedKeepMin: Int, otoshi: Bool, timeLimitOff: Bool) {
        self.otoshiWarnMin = otoshiWarnMin
        self.lastOrderMin = lastOrderMin
        self.seatLimitMin = seatLimitMin
        self.exitedKeepMin = exitedKeepMin
        self.otoshi = otoshi
        self.timeLimitOff = timeLimitOff
    }

    public static let standard = Rules(otoshiWarnMin: 15, lastOrderMin: 90, seatLimitMin: 120, exitedKeepMin: 5, otoshi: true, timeLimitOff: false)
}

// その卓に使う時間のルール。コースの卓で、選んだコースに L.O.・お席の時間が決めてあればそれを使う（No.89）。
// 片方だけ決めてあるときはもう片方を店の設定にし、L.O. がお席の時間に届くなら店の設定のままにする
public func sessionRules(_ rules: Rules, _ session: Session, menus: [CourseMenu] = defaultCourseMenus) -> Rules {
    guard session.course != nil, let menu = menuOf(session.menu, menus: menus),
          menu.lastOrderMin != nil || menu.seatLimitMin != nil else { return rules }
    let lastOrderMin = menu.lastOrderMin ?? rules.lastOrderMin, seatLimitMin = menu.seatLimitMin ?? rules.seatLimitMin
    guard lastOrderMin < seatLimitMin else { return rules }
    var result = rules
    result.lastOrderMin = lastOrderMin
    result.seatLimitMin = seatLimitMin
    return result
}

public enum AlertLevel: String, Sendable { case none, soon, now }
public enum AlertReason: String, Sendable {
    case otoshiMissing = "otoshi_missing"
    case lastOrder = "last_order"
    case seatLimit = "seat_limit"

    // REASON_LABEL：警告の理由の名前（卓カードの札・詳細パネルで同じものを使う）
    public var label: String {
        switch self {
        case .otoshiMissing: "お通し未提供"
        case .lastOrder: "L.O.の時間"
        case .seatLimit: "お席の時間"
        }
    }
}
public struct AlertState: Equatable, Sendable {
    public var level: AlertLevel
    public var reason: AlertReason?
    public init(level: AlertLevel, reason: AlertReason?) {
        self.level = level
        self.reason = reason
    }
    public static let none = AlertState(level: .none, reason: nil)
}

private let minute = 60_000

// ご案内の人数（No.85）：−／＋ で1人ずつ変える。未入力から ＋ で1名、1名から − で未入力（あとで）に戻る
public func stepGuests(_ guests: Int?, _ delta: Int) -> Int? {
    if delta > 0 { return min(guestsMax, (guests ?? 0) + 1) }
    guard let guests, guests > 1 else { return nil }
    return guests - 1
}
// ご案内でよく来る人数。押すとその人数になる（−／＋ を何度も押さずに済むように）
public let quickGuests = [2, 3, 4, 6]
public func setGuests(_ session: Session, _ guests: Int?) -> Session? {
    guard guests == nil || isGuestCount(guests) else { return nil }
    var result = session
    result.guests = guests
    return result
}

// 案内のあとで通常とコースを直す。時刻はそのまま（コースにするとお通しの時刻をファーストドリンクとして読む）。
// 通常に戻したら、どのコースか・料理の進みも消す
public func setCourse(_ session: Session, _ course: String?) -> Session? {
    var result = session
    guard let course else {
        result.course = nil
        result.menu = nil
        result.dishesServed = 0
        result.dishServedAt = []
        return result
    }
    guard isCourse(course) else { return nil }
    result.course = course
    return result
}

// どのコースかを選び直す。選び間違いを直すときのために、出した品数はそのまま（新しいメニューの品数までに収める）
public func setMenu(_ session: Session, _ menu: String?, menus: [CourseMenu] = defaultCourseMenus) -> Session? {
    var result = session
    guard let menu else {
        result.menu = nil
        result.dishesServed = 0
        result.dishServedAt = []
        return result
    }
    guard session.course != nil, let chosen = menuOf(menu, menus: menus) else { return nil }
    let dishesServed = min(session.dishesServed, chosen.dishes.count)
    result.menu = menu
    result.dishesServed = dishesServed
    result.dishServedAt = servedTimes(session, dishesServed)
    return result
}

// コースの料理の進み。served 品目まで出していて、next が次に出す料理（全部出したら nil）
public struct DishProgress: Equatable, Sendable {
    public var served: Int
    public var total: Int
    public var next: String?
}
// menus：店が作ったコース（No.89）。設定で消したコースを選んでいる卓は nil（料理の進みを出さない）
public func dishProgress(_ session: Session, menus: [CourseMenu] = defaultCourseMenus) -> DishProgress? {
    guard session.course != nil, let menu = menuOf(session.menu, menus: menus) else { return nil }
    let served = min(session.dishesServed, menu.dishes.count)
    return DishProgress(served: served, total: menu.dishes.count, next: served < menu.dishes.count ? menu.dishes[served] : nil)
}
// 1品目から served 品目までの出した時刻。時刻が無い品（前の版で出した）は nil で埋め、それより後の時刻は落とす
public func servedTimes(_ session: Session, _ served: Int) -> [Int?] {
    (0..<max(served, 0)).map { $0 < session.dishServedAt.count ? session.dishServedAt[$0] : nil }
}
// 料理はメニューの順に1品ずつ進める・戻す。進めたときは押した時刻を残し（No.131）、戻したときはその品の時刻を外す
public func serveDish(_ session: Session, at: Int, menus: [CourseMenu] = defaultCourseMenus) -> Session? {
    guard let progress = dishProgress(session, menus: menus), progress.next != nil else { return nil }
    var result = session
    result.dishesServed = progress.served + 1
    result.dishServedAt = servedTimes(session, progress.served) + [at]
    return result
}
public func unserveDish(_ session: Session, menus: [CourseMenu] = defaultCourseMenus) -> Session? {
    guard let progress = dishProgress(session, menus: menus), progress.served > 0 else { return nil }
    var result = session
    result.dishesServed = progress.served - 1
    result.dishServedAt = servedTimes(session, progress.served - 1)
    return result
}

public func nextStatus(_ status: Status) -> Status? {
    switch status {
    case .seated: .otoshi
    case .otoshi: .loDone
    case .loDone: .exited
    case .exited: nil
    }
}
// 詳細の大きいボタンの言葉（No.123）。押すと何が起きるかが分かる「〜にする」にする。退店済みは次のお客さんを案内する。
// from はパネルを開いた卓（団体のときはその卓に案内する）
public func nextActionLabel(_ session: Session, from: String, rules: Rules = .standard) -> String {
    if let next = nextStatus(session.status) { return "\(displayOf(next, course: session.course, rules: rules).label)にする" }
    return session.tableIds.count > 1 ? "\(from)番にご案内する" : "ご案内する"
}
public func advance(_ session: Session, at: Int) -> Session {
    var result = session
    switch session.status {
    case .seated: result.status = .otoshi; result.otoshiAt = at
    case .otoshi: result.status = .loDone; result.loDoneAt = at
    case .loDone: result.status = .exited; result.exitedAt = at
    case .exited: break
    }
    return result
}
public func revert(_ session: Session) -> Session? {
    var result = session
    switch session.status {
    case .seated: return nil
    case .otoshi: result.status = .seated; result.otoshiAt = nil
    case .loDone: result.status = .otoshi; result.loDoneAt = nil
    case .exited:
        // 閉店で退店にした卓（No.129）は、閉店の前の本当の状態に戻す
        if session.exitedByClosing {
            result.status = session.loDoneAt != nil ? .loDone : session.otoshiAt != nil ? .otoshi : .seated
            result.exitedByClosing = false
        } else {
            result.status = .loDone
        }
        result.exitedAt = nil
    }
    return result
}

// L.O.・お席の時間を数え始める時刻（No.132）。
// お通しを出す店の通常卓はお通し、コースはファーストドリンク。出すまでは nil でタイマーを止める。
// お通しを出さない店の通常卓は、出す段が無く未提供の警告も無いので、案内から数える
public func startOf(_ session: Session, rules: Rules = .standard) -> Int? {
    session.course != nil || rules.otoshi ? session.otoshiAt : session.seatedAt
}
// 数え始めの呼び方。詳細の「お通しから」などに出す
private func countLabel(_ session: Session, _ rules: Rules) -> String {
    if session.course != nil { return "ファーストドリンクから" }
    return rules.otoshi ? "お通しから" : "案内から"
}
public struct TimerState: Equatable, Sendable {
    public var label: String
    public var elapsedMs: Int?
}
// 退店までは startOf から通しで数える。お通し前・コースの開始待ちは nil（タイマーを進めない）
public func timerOf(_ session: Session, now: Int, rules: Rules = .standard) -> TimerState {
    if session.status == .exited { return TimerState(label: "退店から", elapsedMs: max(0, now - (session.exitedAt ?? now))) }
    return TimerState(label: countLabel(session, rules), elapsedMs: startOf(session, rules: rules).map { max(0, now - $0) })
}
public struct Limits: Equatable, Sendable {
    public var lastOrderAt: Int
    public var seatEndAt: Int
}
// お席の終わり（退店の時刻）と L.O. の時刻。ふつうは数え始めからお席の時間（120分）・L.O.（90分）。
// 退店の時刻を決めた卓（leaveAt）はその時刻と、その「お席の時間 − L.O.」（30分）前。お通し前・開始待ちは数えないので nil
public func limitsOf(_ session: Session, rules: Rules = .standard) -> Limits? {
    guard let start = startOf(session, rules: rules) else { return nil }
    let seatEndAt = session.leaveAt ?? start + rules.seatLimitMin * minute
    return Limits(lastOrderAt: seatEndAt - (rules.seatLimitMin - rules.lastOrderMin) * minute, seatEndAt: seatEndAt)
}
public func alertOf(_ session: Session, now: Int, rules: Rules = .standard) -> AlertState {
    // お通し未提供は案内から数える。タイマーはお通しまで止まっていても、押し忘れはここで気づける（No.132）。コース・お通しを出さない店は出さない
    if rules.otoshi && session.status == .seated && session.course == nil && now - session.seatedAt >= rules.otoshiWarnMin * minute {
        return AlertState(level: .now, reason: .otoshiMissing)
    }
    guard session.status != .exited, let limits = limitsOf(session, rules: rules) else { return .none }
    if !rules.timeLimitOff && now >= limits.seatEndAt { return AlertState(level: .now, reason: .seatLimit) }
    if !rules.timeLimitOff && session.status == .otoshi && now >= limits.lastOrderAt { return AlertState(level: .soon, reason: .lastOrder) }
    return .none
}
// この卓だけ退店の時刻を決める・ふつうに戻す（nil）。案内より前の時刻は nil
public func setLeaveAt(_ session: Session, _ at: Int?) -> Session? {
    guard at == nil || at! > session.seatedAt else { return nil }
    var result = session
    result.leaveAt = at
    return result
}
// L.O. の時間を過ぎても L.O.確認済みにしていないセッション（数え始めが古い順）。
// お通し前の卓・店全体で時間制限を切っているとき・全卓消去したお客さん（No.113）は出さない。
// rulesOf は卓ごとに変えられる（コースごとの L.O.。sessionRules を渡す）
public func lastOrderDue(_ sessions: [Session], now: Int, rulesOf: (Session) -> Rules) -> [Session] {
    sessions
        .compactMap { session -> (Session, Int)? in
            let rules = rulesOf(session)
            guard !rules.timeLimitOff, session.status == .otoshi, session.clearedAt == nil,
                  let start = startOf(session, rules: rules), let limits = limitsOf(session, rules: rules),
                  now >= limits.lastOrderAt else { return nil }
            return (session, start)
        }
        .enumerated()
        // 同じ時刻なら元の順（TS の sort と同じく安定にする）
        .sorted { $0.element.1 != $1.element.1 ? $0.element.1 < $1.element.1 : $0.offset < $1.offset }
        .map(\.element.0)
}
public func lastOrderDue(_ sessions: [Session], now: Int, rules: Rules = .standard) -> [Session] {
    lastOrderDue(sessions, now: now, rulesOf: { _ in rules })
}

// 卓の付け替え・追加・外す。卓番は数値順に並べる（どの端末でも同じ表示にする）。した時刻と卓を tableLog に足す（No.113）
private func byNumber(_ ids: [String]) -> [String] {
    var seen = Set<String>()
    return ids.filter { seen.insert($0).inserted }
        .enumerated()
        .sorted { a, b in
            // 数でない卓番や同じ数は、元の順のまま（TS の Number(a) - Number(b) が NaN・0 のときと同じ）
            guard let x = Double(a.element), let y = Double(b.element), x != y else { return a.offset < b.offset }
            return x < y
        }
        .map(\.element)
}
private func logged(_ session: Session, _ move: TableMove) -> [TableMove] {
    Array((session.tableLog + [move]).suffix(tableLogMax))
}
public func moveTable(_ session: Session, from: String, to: String, at: Int) -> Session? {
    guard session.tableIds.contains(from), !session.tableIds.contains(to) else { return nil }
    var result = session
    result.tableIds = byNumber(session.tableIds.map { $0 == from ? to : $0 })
    result.tableLog = logged(session, TableMove(at: at, kind: .move, from: from, to: to))
    return result
}
public func addTable(_ session: Session, tableId: String, at: Int) -> Session? {
    guard !session.tableIds.contains(tableId) else { return nil }
    var result = session
    result.tableIds = byNumber(session.tableIds + [tableId])
    result.tableLog = logged(session, TableMove(at: at, kind: .add, from: nil, to: tableId))
    return result
}
public func removeTable(_ session: Session, tableId: String, at: Int) -> Session? {
    guard session.tableIds.contains(tableId), session.tableIds.count > 1 else { return nil }
    var result = session
    result.tableIds = session.tableIds.filter { $0 != tableId }
    result.tableLog = logged(session, TableMove(at: at, kind: .remove, from: tableId, to: nil))
    return result
}
// 全卓消去（No.113）：記録を消さずに、消した時刻を付ける
public func clearSession(_ session: Session, at: Int) -> Session {
    guard session.clearedAt == nil else { return session }
    var result = session
    result.clearedAt = at
    return result
}
public func togglePaid(_ session: Session, at: Int) -> Session {
    var result = session
    result.paidAt = session.paidAt == nil ? at : nil
    return result
}
// 全卓消去したお客さんは出さない（記録は残す。No.113）
public func isVisible(_ session: Session, now: Int, rules: Rules = .standard) -> Bool {
    if session.clearedAt != nil { return false }
    guard session.status == .exited else { return true }
    guard let exitedAt = session.exitedAt else { return false }
    return now - exitedAt < rules.exitedKeepMin * minute
}
// 卓に出すお客さん：その卓を含む表示中のセッションのうち、最後に案内したもの。
// まだお店にいるお客さんを退店済みより先に出す（退店済みの卓に移した・足した団体は、退店した組より前に案内していることが多い。No.133）
public func occupantOf(_ sessions: [Session], tableId: String, now: Int, rules: Rules = .standard) -> Session? {
    let here = sessions.filter { $0.tableIds.contains(tableId) && isVisible($0, now: now, rules: rules) }
    let staying = here.filter { $0.status != .exited }
    // 同じ案内時刻なら先にあるもの（TS の reduce と同じ）
    return (staying.isEmpty ? here : staying).reduce(nil as Session?) { latest, s in
        guard let latest else { return s }
        return s.seatedAt > latest.seatedAt ? s : latest
    }
}
// 移動先・追加先に選べる卓（No.133）：空席と、退店済みのお客さんだけが出ている卓
public func isPickable(_ occupant: Session?) -> Bool {
    occupant == nil || occupant?.status == .exited
}
public enum PickMode: Sendable { case move, add }
// 選んでいる間の案内帯（No.133）。iOS は1行で切れるので短くし、どこをタップするかを先に出す
public func pickGuideLabel(_ mode: PickMode, from: String, tableIds: [String]) -> String {
    let seats = "空席か退店済み"
    switch mode {
    case .move: return "\(from)番の移動先をタップ（\(seats)）"
    case .add: return "\(tableIds.joined(separator: "・"))番の追加先をタップ（\(seats)）"
    }
}
// 全卓消去の警告用：まだお店にいて会計していない客の卓数（退店済は数えない）
public func unpaidTableCount(_ sessions: [Session], now: Int, rules: Rules = .standard) -> Int {
    sessions.filter { isVisible($0, now: now, rules: rules) && $0.status != .exited && $0.paidAt == nil }
        .reduce(0) { $0 + $1.tableIds.count }
}

// 経過時間（例 05:09、1:01:01）
public func formatElapsed(_ ms: Int) -> String {
    let seconds = max(0, ms) / 1000
    let minutes = seconds / 60
    let tail = String(format: "%02d:%02d", minutes % 60, seconds % 60)
    return minutes < 60 ? tail : "\(minutes / 60):\(tail)"
}
// 時刻（HH:MM）。時間帯は端末のもの（TS の new Date と同じ）。テストでは時間帯を決めた calendar を渡す
public func formatClock(_ ms: Int, calendar: Calendar = .current) -> String {
    let parts = calendar.dateComponents([.hour, .minute], from: date(ms))
    return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
}
// "HH:MM" を near に最も近い日付の時刻にする（日付をまたぐ営業に対応）
public func clockTimeNear(_ hhmm: String, near: Int, calendar: Calendar = .current) -> Int? {
    guard hhmm.range(of: "^[0-9]{2}:[0-9]{2}$", options: .regularExpression) != nil,
          let hour = Int(hhmm.prefix(2)), let minuteOfHour = Int(hhmm.suffix(2)), hour <= 23, minuteOfHour <= 59 else { return nil }
    let candidates = [-1, 0, 1].compactMap { offset -> Int? in
        guard let day = calendar.date(byAdding: .day, value: offset, to: date(near)),
              let at = calendar.date(bySettingHour: hour, minute: minuteOfHour, second: 0, of: day) else { return nil }
        return ms(at)
    }
    return candidates.reduce(nil as Int?) { best, c in
        guard let best else { return c }
        return abs(c - near) < abs(best - near) ? c : best
    }
}

public enum EditableTime: Sendable { case seatedAt, otoshiAt }
// 案内 ≤ お通し ≤ L.O.確認・退店・現在 の順を崩す修正は nil
public func editTime(_ session: Session, _ field: EditableTime, at: Int, now: Int) -> Session? {
    if field == .otoshiAt && session.otoshiAt == nil { return nil }
    var edited = session
    switch field {
    case .seatedAt: edited.seatedAt = at
    case .otoshiAt: edited.otoshiAt = at
    }
    let upper = min(now, edited.loDoneAt ?? .max, edited.exitedAt ?? .max)
    let otoshiAt = edited.otoshiAt ?? edited.seatedAt
    return edited.seatedAt <= otoshiAt && otoshiAt <= upper ? edited : nil
}

// ミリ秒と Date の変換
func date(_ ms: Int) -> Date { Date(timeIntervalSince1970: Double(ms) / 1000) }
func ms(_ date: Date) -> Int { Int((date.timeIntervalSince1970 * 1000).rounded()) }
