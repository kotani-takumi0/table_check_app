import Foundation

// 1組のお客さん（packages/core/src/domain.ts の Session）。時刻はすべてミリ秒の整数（firestore.rules の isTime と同じ）
public enum Status: String, CaseIterable, Sendable {
    case seated
    case otoshi
    case loDone = "lo_done"
    case exited

    public var label: String {
        switch self {
        case .seated: "ご案内済み"
        case .otoshi: "お通し提供済み"
        case .loDone: "L.O.確認済み"
        case .exited: "退店済み"
        }
    }
}

// 卓の動き（No.113）。move は from → to、add は to を足した、remove は from を外した
public struct TableMove: Equatable, Sendable {
    public enum Kind: String, Sendable { case move, add, remove }
    public var at: Int
    public var kind: Kind
    public var from: String?
    public var to: String?

    public init(at: Int, kind: Kind, from: String?, to: String?) {
        self.at = at
        self.kind = kind
        self.from = from
        self.to = to
    }
}

public struct Session: Equatable, Identifiable, Sendable {
    public var id: String
    public var tableIds: [String]
    public var status: Status
    public var seatedAt: Int
    public var otoshiAt: Int?
    public var loDoneAt: Int?
    public var exitedAt: Int?
    public var paidAt: Int?
    public var guests: Int?
    public var course: String?
    public var menu: String?
    public var dishesServed: Int
    public var dishServedAt: [Int?]
    public var leaveAt: Int?
    public var clearedAt: Int?
    public var tableLog: [TableMove]
    public var exitedByClosing: Bool

    public init(
        id: String, tableIds: [String], status: Status, seatedAt: Int,
        otoshiAt: Int? = nil, loDoneAt: Int? = nil, exitedAt: Int? = nil, paidAt: Int? = nil,
        guests: Int? = nil, course: String? = nil, menu: String? = nil,
        dishesServed: Int = 0, dishServedAt: [Int?] = [], leaveAt: Int? = nil, clearedAt: Int? = nil,
        tableLog: [TableMove] = [], exitedByClosing: Bool = false
    ) {
        self.id = id
        self.tableIds = tableIds
        self.status = status
        self.seatedAt = seatedAt
        self.otoshiAt = otoshiAt
        self.loDoneAt = loDoneAt
        self.exitedAt = exitedAt
        self.paidAt = paidAt
        self.guests = guests
        self.course = course
        self.menu = menu
        self.dishesServed = dishesServed
        self.dishServedAt = dishServedAt
        self.leaveAt = leaveAt
        self.clearedAt = clearedAt
        self.tableLog = tableLog
        self.exitedByClosing = exitedByClosing
    }
}

public let guestsMax = 99
public let tableLogMax = 200

// 前の版のアプリが知っている飲み放題の区分とコース（domain.ts の DEFAULT_DRINK_PLANS、courseMenus.ts の DEFAULT_COURSE_MENUS の id）。
// firestore.rules の isCourseOrNull・isMenuOrNull も同じ一覧
public let legacyDrinkPlanIds = ["no_drinks", "drinks", "premium_drinks"]
public let legacyMenuIds = ["nijikai", "casual", "meat_share", "cheese", "premium"]

// 区分・コースの id は英小文字・数字・_ の24文字まで（domain.ts の isCourse、courseMenus.ts の isMenuId と同じ）
public func isCourse(_ value: Any?) -> Bool {
    guard let text = value as? String else { return false }
    return text.range(of: "^[a-z0-9_]{1,24}$", options: .regularExpression) != nil
}
public func isMenuId(_ value: Any?) -> Bool { isCourse(value) }

public func isGuestCount(_ value: Any?) -> Bool {
    guard let count = integerValue(value) else { return false }
    return count >= 1 && count <= guestsMax
}

public func newSession(id: String, tableId: String, at: Int, guests: Int? = nil, course: String? = nil, menu: String? = nil) -> Session {
    Session(id: id, tableIds: [tableId], status: .seated, seatedAt: at, guests: guests, course: course,
            menu: course != nil && isMenuId(menu) ? menu : nil)
}

// 今の時刻（ミリ秒）。サーバーとのずれ（clock.ts の setServerOffset）は卓の計算を移すとき（No.148）に足す
public func nowMs() -> Int { Int(Date().timeIntervalSince1970 * 1000) }
