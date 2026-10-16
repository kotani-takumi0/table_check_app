import Foundation

// コースを作る・直す画面（No.89。packages/core/src/courseEditor.ts）と、最初のページのテンプレート（No.087。shopTemplates.ts）

public func newCourse(_ menus: [CourseMenu], now: Int) -> CourseMenu {
    CourseMenu(id: newCourseMenuId(menus, now: now), name: "", price: 0, short: "", dishes: [""])
}
// このコースの L.O.・お席の時間（決めていなければ店の設定）
public func courseMinutes(_ menu: CourseMenu, _ rules: Rules) -> (lastOrderMin: Int, seatLimitMin: Int) {
    (menu.lastOrderMin ?? rules.lastOrderMin, menu.seatLimitMin ?? rules.seatLimitMin)
}
// このコースだけ時間を変える・店の設定に戻す
public func setOwnMinutes(_ menu: CourseMenu, _ rules: Rules, own: Bool) -> CourseMenu {
    var result = menu
    if own {
        let minutes = courseMinutes(menu, rules)
        result.lastOrderMin = minutes.lastOrderMin
        result.seatLimitMin = minutes.seatLimitMin
    } else {
        result.lastOrderMin = nil
        result.seatLimitMin = nil
    }
    return result
}
// 設定の画面と同じく step ずつ動かす。範囲の外や、L.O. がお席の時間に届く変更は nil
public func stepCourseMinutes(_ menu: CourseMenu, _ rules: Rules, _ key: MinuteSetting, _ direction: Int) -> CourseMenu? {
    precondition(key == .lastOrderMin || key == .seatLimitMin, "コースで変えられるのは L.O. とお席の時間だけ")
    let minutes = courseMinutes(menu, rules)
    var courseRules = rules
    courseRules.lastOrderMin = minutes.lastOrderMin
    courseRules.seatLimitMin = minutes.seatLimitMin
    guard let value = stepMinutes(courseRules, key, direction) else { return nil }
    var result = setOwnMinutes(menu, rules, own: true)
    if key == .lastOrderMin { result.lastOrderMin = value } else { result.seatLimitMin = value }
    return result
}
// 料理を1つ上・下へ動かす（端では動かさない）
public func moveDish(_ dishes: [String], index: Int, _ direction: Int) -> [String] {
    let to = index + direction
    guard to >= 0 && to < dishes.count else { return dishes }
    var next = dishes
    next.swapAt(index, to)
    return next
}
// 保存する形に整える（前後の空白を落とす）。同じ id があれば置き換え、無ければ最後に足す。
// 足すときにほかの端末で上限まで増えていたら nil（下書きを残して知らせる）
public func putCourse(_ menus: [CourseMenu], _ menu: CourseMenu) -> [CourseMenu]? {
    var tidy = menu
    tidy.name = jsTrim(menu.name)
    tidy.short = jsTrim(menu.short)
    tidy.dishes = menu.dishes.map(jsTrim)
    if menus.contains(where: { $0.id == menu.id }) { return menus.map { $0.id == menu.id ? tidy : $0 } }
    return menus.count < CourseLimits.menus ? menus + [tidy] : nil
}
// 案内中の卓が使っているコース（コースの id → 卓番）。使っている間は消せない（No.89 ユーザー決定）
public func coursesInUse(_ sessions: [Session], now: Int, rules: Rules) -> [String: [String]] {
    var use: [String: [String]] = [:]
    for session in sessions {
        guard session.course != nil, let menu = session.menu, isVisible(session, now: now, rules: rules) else { continue }
        use[menu, default: []] += session.tableIds
    }
    return use
}
// TS の text.trim()
func jsTrim(_ text: String) -> String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

// 最初のページ（No.087）：ログインした店で、席の配置をまだ保存していなければテンプレートを選んでもらう。
// テンプレートは席の配置と設定一式（コース・飲み放題の区分・店のタイマー・時間のルール）をまとめて入れる。店名は入れない（店が設定で入れる）
public struct ShopTemplate: Equatable, Sendable {
    public var id: String
    public var name: String
    public var help: String
    public var layout: ShopLayout
    public var settings: ShopSettings  // shopName は使わない
}
public let shopTemplates = [
    ShopTemplate(id: "izakaya_21", name: "居酒屋・21卓（カウンターあり）", help: "テーブル11卓とカウンター10席。飲み放題3区分・コース5つ・トイレのタイマー入り。",
                 layout: defaultLayout, settings: .standard),
]
// 何もない状態から自分で作る：配置・コース・区分・店のタイマーは空。時間のルールは空にできないので、ふつうの値
public let blankSettings = ShopSettings(drinkPlans: [], courseMenus: [], shopTimers: [], closingMin: nil)
public let blankLayout = ShopLayout(seats: [], labels: [])
