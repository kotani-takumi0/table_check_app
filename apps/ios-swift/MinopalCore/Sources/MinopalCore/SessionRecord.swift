import Foundation

// 店の毎日の記録（No.113。packages/core/src/sessionRecord.ts）。1組＝1文書の sessions を記録の本体にして溜め、あとで分析する。
// 分析で困らないよう、書くたびにそのときの名前・時間のルール・書いた端末を文書に写す（設定をあとで変えても、その日の値が残る）
public enum Platform: String, Sendable { case web, ios }
public struct AppInfo: Equatable, Sendable {
    public var platform: Platform
    public var version: String
    public init(platform: Platform, version: String) {
        self.platform = platform
        self.version = version
    }
}
public struct TimeRules: Equatable, Sendable {
    public var lastOrderMin: Int
    public var seatLimitMin: Int
    public var timeLimitOff: Bool
}
// TS の Partial<SessionRecord>。nil の項目は書かない（前に写した値を残す）。
// 区分・コースの名前は「通常なので null を書く」と「名前が分からないので書かない」を分けるため、二重の Optional にする
public struct SessionRecord: Equatable, Sendable {
    public var businessDay: String?          // 営業日（朝4時で区切る。例 2026-10-10）
    public var drinkPlanName: String??       // そのときの飲み放題の区分の名前（通常は .some(nil)）
    public var courseName: String??          // そのときのコースの名前（値段は写さない。コースを選んでいなければ .some(nil)）
    public var timeRules: TimeRules?         // その組に使った L.O.・お席の時間（分）と、時間制限なしか
    public var platform: Platform?           // 最後に書いた端末の種類と版
    public var appVersion: String?

    public init(businessDay: String? = nil, drinkPlanName: String?? = nil, courseName: String?? = nil, timeRules: TimeRules? = nil,
                platform: Platform? = nil, appVersion: String? = nil) {
        self.businessDay = businessDay
        self.drinkPlanName = drinkPlanName
        self.courseName = courseName
        self.timeRules = timeRules
        self.platform = platform
        self.appVersion = appVersion
    }

    // Firestore に merge で書く項目
    public func toDocument() -> [String: Any] {
        var document: [String: Any] = [:]
        if let businessDay { document["businessDay"] = businessDay }
        if let drinkPlanName { document["drinkPlanName"] = drinkPlanName ?? NSNull() }
        if let courseName { document["courseName"] = courseName ?? NSNull() }
        if let timeRules {
            document["timeRules"] = ["lastOrderMin": timeRules.lastOrderMin, "seatLimitMin": timeRules.seatLimitMin, "timeLimitOff": timeRules.timeLimitOff]
        }
        if let platform { document["platform"] = platform.rawValue }
        if let appVersion { document["appVersion"] = appVersion }
        return document
    }
}
// 書く中身。区分・コースを設定で消したあとは名前が分からないので、その項目を書かずに前に写した名前を残す
public func sessionRecord(_ session: Session, settings: ShopSettings, app: AppInfo, calendar: Calendar = .current) -> SessionRecord {
    let rules = sessionRules(settings.rules, session, menus: settings.courseMenus)
    var record = SessionRecord(businessDay: businessDayOf(session.seatedAt, calendar: calendar),
                               timeRules: TimeRules(lastOrderMin: rules.lastOrderMin, seatLimitMin: rules.seatLimitMin, timeLimitOff: rules.timeLimitOff),
                               platform: app.platform, appVersion: app.version)
    if let course = session.course {
        if let plan = settings.drinkPlans.first(where: { $0.id == course }) { record.drinkPlanName = .some(plan.name) }
    } else {
        record.drinkPlanName = .some(nil)
    }
    if session.course == nil || session.menu == nil {
        record.courseName = .some(nil)
    } else if let menu = menuOf(session.menu, menus: settings.courseMenus) {
        record.courseName = .some(menu.name)
    }
    return record
}
// 保存した記録を読む（書き出しで使う）。無い・壊れた項目は入れない
public func recordFromDocument(_ data: [String: Any]?) -> SessionRecord {
    let d = data ?? [:]
    var record = SessionRecord()
    if let day = d["businessDay"] as? String { record.businessDay = day }
    if let name = d["drinkPlanName"] as? String { record.drinkPlanName = .some(name) } else if d["drinkPlanName"] is NSNull { record.drinkPlanName = .some(nil) }
    if let name = d["courseName"] as? String { record.courseName = .some(name) } else if d["courseName"] is NSNull { record.courseName = .some(nil) }
    if let r = d["timeRules"] as? [String: Any], let lastOrderMin = timestampValue(r["lastOrderMin"]), let seatLimitMin = timestampValue(r["seatLimitMin"]),
       let timeLimitOff = booleanValue(r["timeLimitOff"]) {
        record.timeRules = TimeRules(lastOrderMin: lastOrderMin, seatLimitMin: seatLimitMin, timeLimitOff: timeLimitOff)
    }
    if let platform = (d["platform"] as? String).flatMap(Platform.init(rawValue:)) { record.platform = platform }
    if let version = d["appVersion"] as? String { record.appVersion = version }
    return record
}
