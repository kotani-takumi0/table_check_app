import Foundation

// 店全体の設定（packages/core/src/shopSettings.ts）。全端末で共有する（Firestore の shopSettings/main）。
// 時間のルール（No.14）と店名。timeLimitOff は空いている日などに L.O.・お席の時間の通知と色を止める（No.80）
public struct ShopSettings: Equatable, Sendable {
    public var rules: Rules            // TS では ShopSettings が Rules の項目をそのまま持つ
    public var shopName: String        // 店名（ログインした店を見分ける。No.88 で使う）
    public var drinkPlans: [DrinkPlan] // 飲み放題の区分（No.90）。選ぶとコースになる。並べる順
    public var courseMenus: [CourseMenu]  // コースのメニュー（No.89）。選ぶボタンに並べる順
    public var shopTimers: [ShopTimer]    // 店のタイマー（No.91。トイレチェックなど）。ヘッダーに並べる順
    public var closingMin: Int?           // 閉店時刻（No.129。0時からの分、15分ごと）。nil は決めていない

    public init(rules: Rules = .standard, shopName: String = "", drinkPlans: [DrinkPlan] = defaultDrinkPlans,
                courseMenus: [CourseMenu] = defaultCourseMenus, shopTimers: [ShopTimer] = defaultShopTimers, closingMin: Int? = nil) {
        self.rules = rules
        self.shopName = shopName
        self.drinkPlans = drinkPlans
        self.courseMenus = courseMenus
        self.shopTimers = shopTimers
        self.closingMin = closingMin
    }

    // DEFAULT_SHOP_SETTINGS
    public static let standard = ShopSettings()
}

public let shopNameMax = 30
public let drinkPlansMax = 10
public let drinkPlanNameMax = 20

// 区分の一覧を読む。壊れた項目・同じ id は落とす。一覧そのものが無い・壊れているときは最初の一覧（空の一覧はそのまま＝コースを使わない店）
private func parseDrinkPlans(_ value: Any?) -> [DrinkPlan] {
    guard let items = value as? [Any] else { return defaultDrinkPlans }
    var plans: [DrinkPlan] = []
    for item in items.prefix(drinkPlansMax) {
        let plan = item as? [String: Any] ?? [:]
        if let id = plan["id"] as? String, isCourse(id), let name = plan["name"] as? String, !isBlank(name), jsLength(name) <= drinkPlanNameMax,
           !plans.contains(where: { $0.id == id }) {
            plans.append(DrinkPlan(id: id, name: name))
        }
    }
    return plans
}

// コースのメニュー（No.89）の決まり（firestore.rules の courseMenus と isDishesServed も同じ上限）
public enum CourseLimits {
    public static let menus = 20, name = 30, short = 12, dishes = 30, dish = 60, price = 100_000
}
// コースを保存する前に確かめる。直すべきことを、お店の人が読める言葉で返す（空なら保存できる）
public func courseProblems(_ menu: CourseMenu) -> [String] {
    var problems: [String] = []
    if isBlank(menu.name) || jsLength(menu.name) > CourseLimits.name { problems.append("名前は1〜\(CourseLimits.name)文字にしてください") }
    if isBlank(menu.short) || jsLength(menu.short) > CourseLimits.short { problems.append("ボタンの名前は1〜\(CourseLimits.short)文字にしてください") }
    if menu.price < 0 || menu.price > CourseLimits.price { problems.append("値段は 0〜100,000円 の整数にしてください") }
    if menu.dishes.isEmpty { problems.append("料理を1品以上入れてください") }
    if menu.dishes.count > CourseLimits.dishes { problems.append("料理は\(CourseLimits.dishes)品までです") }
    if menu.dishes.contains(where: { isBlank($0) || jsLength($0) > CourseLimits.dish }) {
        problems.append("料理の名前は1〜\(CourseLimits.dish)文字にしてください（空の行は消してください）")
    }
    let lo = menu.lastOrderMin, seat = menu.seatLimitMin
    if let lo, !isMinutes(lo, .lastOrderMin) { problems.append("L.O. の分が範囲の外です") }
    if let seat, !isMinutes(seat, .seatLimitMin) { problems.append("お席の時間の分が範囲の外です") }
    if let lo, let seat, lo >= seat { problems.append("L.O. はお席の時間より前にしてください") }
    return problems
}
// コースの一覧を読む。確かめて問題のあるコース・同じ id は落とす。一覧そのものが無い・壊れているときは最初の一覧
private func parseCourseMenus(_ value: Any?) -> [CourseMenu] {
    guard let items = value as? [Any] else { return defaultCourseMenus }
    var menus: [CourseMenu] = []
    for item in items.prefix(CourseLimits.menus) {
        let m = item as? [String: Any] ?? [:]
        // 値段・分が整数でないコースは、TS では確かめで落ちるので、ここでも落とす
        guard let price = integerValue(m["price"]) else { continue }
        func minutesOrNull(_ v: Any?) -> Int?? {
            if isNullOrMissing(v) { return .some(nil) }
            return integerValue(v).map { .some($0) } ?? nil
        }
        guard let lastOrderMin = minutesOrNull(m["lastOrderMin"]), let seatLimitMin = minutesOrNull(m["seatLimitMin"]) else { continue }
        let dishes = (m["dishes"] as? [Any])?.map { $0 as? String ?? "" } ?? []
        let menu = CourseMenu(id: jsString(m["id"]), name: jsString(m["name"]), price: price, short: jsString(m["short"]),
                              dishes: dishes, lastOrderMin: lastOrderMin, seatLimitMin: seatLimitMin)
        if isMenuId(menu.id) && !menus.contains(where: { $0.id == menu.id }) && courseProblems(menu).isEmpty { menus.append(menu) }
    }
    return menus
}
public func newCourseMenuId(_ menus: [CourseMenu], now: Int) -> String {
    newId(prefix: "menu_", now: now) { id in menus.contains { $0.id == id } }
}
// 新しく足す区分の id。既存の id と重ならないよう時刻から作る（英小文字・数字・_）
public func newDrinkPlanId(_ plans: [DrinkPlan], now: Int) -> String {
    newId(prefix: "plan_", now: now) { id in plans.contains { $0.id == id } }
}

// 分で決める項目と、選べる範囲・1回で動かす分（firestore.rules の shopSettings も同じ範囲）
public enum MinuteSetting: String, CaseIterable, Sendable {
    case otoshiWarnMin, lastOrderMin, seatLimitMin, exitedKeepMin

    public var range: (min: Int, max: Int, step: Int) {
        switch self {
        case .otoshiWarnMin: (5, 60, 5)
        case .lastOrderMin: (10, 295, 5)
        case .seatLimitMin: (30, 300, 5)
        case .exitedKeepMin: (1, 30, 1)
        }
    }
}
extension Rules {
    public subscript(_ key: MinuteSetting) -> Int {
        get {
            switch key {
            case .otoshiWarnMin: otoshiWarnMin
            case .lastOrderMin: lastOrderMin
            case .seatLimitMin: seatLimitMin
            case .exitedKeepMin: exitedKeepMin
            }
        }
        set {
            switch key {
            case .otoshiWarnMin: otoshiWarnMin = newValue
            case .lastOrderMin: lastOrderMin = newValue
            case .seatLimitMin: seatLimitMin = newValue
            case .exitedKeepMin: exitedKeepMin = newValue
            }
        }
    }
}
private func isMinutes(_ value: Int, _ key: MinuteSetting) -> Bool {
    value >= key.range.min && value <= key.range.max
}

// 保存された値を読む。壊れた値や無い項目は既定値にする。L.O. がお席の時間より後なら、どちらも既定値にする
public func parseShopSettings(_ data: [String: Any]?) -> ShopSettings {
    let d = data ?? [:]
    let standard = ShopSettings.standard.rules
    func minutes(_ key: MinuteSetting) -> Int {
        guard let value = integerValue(d[key.rawValue]), isMinutes(value, key) else { return standard[key] }
        return value
    }
    var lastOrderMin = minutes(.lastOrderMin), seatLimitMin = minutes(.seatLimitMin)
    if lastOrderMin >= seatLimitMin { (lastOrderMin, seatLimitMin) = (standard.lastOrderMin, standard.seatLimitMin) }
    let rules = Rules(otoshiWarnMin: minutes(.otoshiWarnMin), lastOrderMin: lastOrderMin, seatLimitMin: seatLimitMin,
                      exitedKeepMin: minutes(.exitedKeepMin), otoshi: booleanValue(d["otoshi"]) != false, timeLimitOff: booleanValue(d["timeLimitOff"]) == true)
    let shopName = (d["shopName"] as? String).flatMap { jsLength($0) <= shopNameMax ? $0 : nil } ?? ""
    return ShopSettings(rules: rules, shopName: shopName, drinkPlans: parseDrinkPlans(d["drinkPlans"]), courseMenus: parseCourseMenus(d["courseMenus"]),
                        shopTimers: parseShopTimers(d["shopTimers"]), closingMin: isClosingMin(d["closingMin"]) ? integerValue(d["closingMin"]) : nil)
}

// 分の項目を step だけ増やす・減らした値。範囲の外や、L.O. がお席の時間に届く変更は nil（ボタンを押せなくする）。
// TS は変えた項目だけの Partial を返す。Swift は新しい値を返す
public func stepMinutes(_ rules: Rules, _ key: MinuteSetting, _ direction: Int) -> Int? {
    let value = rules[key] + direction * key.range.step
    guard isMinutes(value, key) else { return nil }
    var next = rules
    next[key] = value
    return next.lastOrderMin < next.seatLimitMin ? value : nil
}
