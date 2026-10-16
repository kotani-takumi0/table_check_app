import Foundation

// 店の設定・席の配置を Firestore に書く形（packages/core/src/firestoreShopSettings.ts・firestoreShopLayout.ts が書いている形）。
// 読むのは parseShopSettings・parseShopLayout。TS と同じ形で書き、同じ形を読む

// 店の設定の項目。TS の update(change: Partial<ShopSettings>) と同じく、変えた項目だけを書く（ほかの端末の変更を消さない）
public enum ShopSettingsField: String, CaseIterable, Sendable {
    case timeLimitOff, otoshiWarnMin, lastOrderMin, seatLimitMin, exitedKeepMin, otoshi
    case shopName, drinkPlans, courseMenus, shopTimers, closingMin
}

// settings のうち fields の項目だけを書く形にする（updatedAt は書くときに足す）
public func shopSettingsDocument(_ settings: ShopSettings, fields: Set<ShopSettingsField> = Set(ShopSettingsField.allCases)) -> [String: Any] {
    var document: [String: Any] = [:]
    for field in fields {
        switch field {
        case .timeLimitOff: document[field.rawValue] = settings.rules.timeLimitOff
        case .otoshiWarnMin: document[field.rawValue] = settings.rules.otoshiWarnMin
        case .lastOrderMin: document[field.rawValue] = settings.rules.lastOrderMin
        case .seatLimitMin: document[field.rawValue] = settings.rules.seatLimitMin
        case .exitedKeepMin: document[field.rawValue] = settings.rules.exitedKeepMin
        case .otoshi: document[field.rawValue] = settings.rules.otoshi
        case .shopName: document[field.rawValue] = settings.shopName
        case .drinkPlans: document[field.rawValue] = settings.drinkPlans.map { ["id": $0.id, "name": $0.name] }
        case .courseMenus: document[field.rawValue] = settings.courseMenus.map(courseMenuDocument)
        case .shopTimers: document[field.rawValue] = settings.shopTimers.map { ["id": $0.id, "label": $0.label, "icon": $0.icon, "intervalMin": $0.intervalMin] }
        case .closingMin: document[field.rawValue] = settings.closingMin.map { $0 as Any } ?? NSNull()
        }
    }
    return document
}

private func courseMenuDocument(_ menu: CourseMenu) -> [String: Any] {
    ["id": menu.id, "name": menu.name, "price": menu.price, "short": menu.short, "dishes": menu.dishes,
     "lastOrderMin": menu.lastOrderMin.map { $0 as Any } ?? NSNull(), "seatLimitMin": menu.seatLimitMin.map { $0 as Any } ?? NSNull()]
}

private func boxDocument(_ box: GridBox) -> [String: Any] {
    ["col": box.col, "colSpan": box.colSpan, "row": box.row, "rowSpan": box.rowSpan]
}
private func seatsDocument(_ layout: ShopLayout) -> [[String: Any]] {
    layout.seats.map { boxDocument($0.box).merging(["id": $0.id, "kind": $0.kind.rawValue]) { $1 } }
}
private func labelsDocument(_ layout: ShopLayout) -> [[String: Any]] {
    layout.labels.map { boxDocument($0.box).merging(["kind": $0.kind.rawValue, "text": $0.text]) { $1 } }
}

// shopLayout/main に書く形。seatIds はルールが「案内できる卓か」を確かめるのに使う（updatedAt は書くときに足す）
public func shopLayoutDocument(_ layout: ShopLayout) -> [String: Any] {
    ["seats": seatsDocument(layout), "labels": labelsDocument(layout), "seatIds": seatIdsOf(layout)]
}
// 配置の移り変わり（No.113）：保存するたびに、その時点の配置と保存した端末を layoutHistory に足す（savedAt は書くときに足す）
public func layoutHistoryDocument(_ layout: ShopLayout, app: AppInfo?) -> [String: Any] {
    ["seats": seatsDocument(layout), "labels": labelsDocument(layout),
     "platform": app.map { $0.platform.rawValue as Any } ?? NSNull(), "appVersion": app.map { $0.version as Any } ?? NSNull()]
}

// 席の配置を保存する前に、お客さんがいる卓を消していないか確かめる。消していればお店の人が読める言葉で返す（無ければ nil）
public func removedOccupiedSeatsProblem(_ layout: ShopLayout, occupied: Set<String>) -> String? {
    let ids = Set(layout.seats.map(\.id))
    let missing = occupied.filter { !ids.contains($0) }.sorted { (Int($0) ?? 0) < (Int($1) ?? 0) }
    return missing.isEmpty ? nil : "\(missing.joined(separator: "・"))番にお客さんがいます"
}

// 店のタイマーの済の時刻を読む（shopTimers/{id} の doneAt）。形の違う id・数でない時刻は読まない
public func shopTimerDone(_ documents: [(id: String, data: [String: Any])]) -> ShopTimerDone {
    var done: ShopTimerDone = [:]
    for document in documents {
        if isShopTimerId(document.id), let at = timestampValue(document.data["doneAt"]) { done[document.id] = at }
    }
    return done
}

// 端末ID（editing/{端末ID}）：アプリを開くたびに作る。時刻と乱数で十分（ほかの端末とぶつからなければよい）
public func newDeviceId(now: Int = nowMs()) -> String {
    let random = String(UInt64.random(in: 0..<(1 << 40)), radix: 36)
    return "\(String(now, radix: 36))-\(random)"
}
