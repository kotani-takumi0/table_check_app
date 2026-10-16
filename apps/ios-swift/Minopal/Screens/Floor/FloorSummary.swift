import Foundation
import MinopalCore

// サイドバー（iPad）・お店タブと帯（iPhone）に出す今の数：テーブル状況・いま対応・もうすぐ L.O.・空席
struct FloorSummary: Equatable {
    var total = 0           // 配置にある卓の数
    var now: Set<String> = []     // いま対応の卓
    var soon: Set<String> = []    // もうすぐ（L.O.）の卓
    var empty: Set<String> = []   // 空席（退店済みで案内できる卓も入れる）
    var seated: Int { total - empty.count }

    init() {}
    init(layout: ShopLayout, sessions: [Session], settings: ShopSettings, now time: Int) {
        total = layout.seats.count
        for seat in layout.seats {
            let occupant = occupantOf(sessions, tableId: seat.id, now: time, rules: settings.rules)
            if isPickable(occupant) { empty.insert(seat.id); continue }
            guard let occupant else { continue }
            switch alertOf(occupant, now: time, rules: sessionRules(settings.rules, occupant, menus: settings.courseMenus)).level {
            case .now: now.insert(seat.id)
            case .soon: soon.insert(seat.id)
            case .none: break
            }
        }
    }

    func seats(_ focus: FloorFocus) -> Set<String> {
        switch focus {
        case .now: now
        case .soon: soon
        case .empty: empty
        }
    }
}

// サイドバー・帯の「いま対応」などを押したとき、その卓だけ配置図で目立たせる（ほかの卓を薄くする）
enum FloorFocus: Hashable, CaseIterable {
    case now, soon, empty

    var title: String {
        switch self {
        case .now: "いま対応"
        case .soon: "もうすぐ L.O."
        case .empty: "空席"
        }
    }
    // iPhone の帯のチップは短く
    var chip: String {
        switch self {
        case .now: "いま対応"
        case .soon: "L.O."
        case .empty: "空席"
        }
    }
    var symbol: String {
        switch self {
        case .now: "exclamationmark.triangle"
        case .soon: "clock"
        case .empty: "rectangle"
        }
    }
}

// 店名の下の日付（営業日。4時より前は前の日）：「10月16日（金）」。
// 画面は1秒ごとに作り直すので、書式は時間帯ごとに1つ作って使い回す
@MainActor
func businessDayLabel(_ time: Int, calendar: Calendar = .current) -> String {
    let parts = businessDayOf(time, calendar: calendar).split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3, let day = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) else { return "" }
    return dayFormatter(calendar).string(from: day)
}

@MainActor private var dayFormatters: [TimeZone: DateFormatter] = [:]
@MainActor private func dayFormatter(_ calendar: Calendar) -> DateFormatter {
    if let formatter = dayFormatters[calendar.timeZone] { return formatter }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "ja_JP")
    formatter.calendar = calendar
    formatter.timeZone = calendar.timeZone
    formatter.dateFormat = "M月d日（E）"
    dayFormatters[calendar.timeZone] = formatter
    return formatter
}
