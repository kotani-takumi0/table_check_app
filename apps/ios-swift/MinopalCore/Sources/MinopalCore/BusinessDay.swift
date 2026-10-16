import Foundation

// 営業日（packages/core/src/history.ts の businessDayOf など）と閉店時刻（closing.ts、No.129）。
// 「その日」は朝4時で区切る（深夜まで営業する店で、0時をまたいだお客さんを同じ日に入れる）。時刻はその端末の時間帯で数える。
// CSV の書き出し（history.ts の sessionsCsv）は History.swift
public let dayStartHour = 4

public struct TimeRange: Equatable, Sendable {
    public var start: Int
    public var end: Int
}

// その時刻が入る営業日（"YYYY-MM-DD"）。4時より前は前の日
public func businessDayOf(_ at: Int, calendar: Calendar = .current) -> String {
    var day = date(at)
    if calendar.component(.hour, from: day) < dayStartHour {
        day = calendar.date(byAdding: .day, value: -1, to: day) ?? day
    }
    let parts = calendar.dateComponents([.year, .month, .day], from: day)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
}

// 営業日の始まり（その日の4時）と終わり（次の日の4時）。日付の形が違えば nil
public func businessDayRange(_ day: String, calendar: Calendar = .current) -> TimeRange? {
    guard day.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", options: .regularExpression) != nil else { return nil }
    let numbers = day.split(separator: "-").compactMap { Int($0) }
    let (y, m, d) = (numbers[0], numbers[1], numbers[2])
    // 2月30日などは、TS と同じく次の月に繰り上がるので、繰り上がったら形が違うとする
    guard let start = calendar.date(from: DateComponents(year: y, month: m, day: d, hour: dayStartHour)),
          calendar.dateComponents([.year, .month, .day], from: start) == DateComponents(year: y, month: m, day: d),
          let end = calendar.date(from: DateComponents(year: y, month: m, day: d + 1, hour: dayStartHour)) else { return nil }
    return TimeRange(start: ms(start), end: ms(end))
}

// 期間（No.113）：from の営業日の始まりから to の営業日の終わりまで。日付の形が違う・from が to より後なら nil
public func businessDaysRange(_ from: String, _ to: String, calendar: Calendar = .current) -> TimeRange? {
    guard let first = businessDayRange(from, calendar: calendar), let last = businessDayRange(to, calendar: calendar),
          first.start <= last.start else { return nil }
    return TimeRange(start: first.start, end: last.end)
}

// 閉店時刻（No.129）。閉店が近づくとアプリを触らなくなるので、閉店時刻を過ぎても退店していない卓は、閉店で退店にして記録を閉じる。
// 閉店時刻は 0時からの分（例 23:30 は 1410）。朝4時より前（0〜3時台）は、その営業日の深夜（次の日の日付）として扱う
public let closingStepMin = 15
public func isClosingMin(_ value: Any?) -> Bool {
    guard let minutes = integerValue(value) else { return false }
    return minutes >= 0 && minutes < 24 * 60 && minutes % closingStepMin == 0
}
// 選べる閉店時刻：朝4時から次の日の3:45まで、営業日の順に並べる
public let closingChoices: [Int] = (0..<(24 * 60 / closingStepMin)).map { (dayStartHour * 60 + $0 * closingStepMin) % (24 * 60) }
// 表示（例「23:30」「深夜1:00」）
public func closingLabel(_ closingMin: Int) -> String {
    let h = closingMin / 60, m = String(format: "%02d", closingMin % 60)
    return h < dayStartHour ? "深夜\(h):\(m)" : "\(h):\(m)"
}
// その営業日の閉店の時刻
public func closingAtOf(_ day: String, _ closingMin: Int, calendar: Calendar = .current) -> Int? {
    guard let range = businessDayRange(day, calendar: calendar) else { return nil }
    let midnight = calendar.startOfDay(for: date(range.start))
    let dayOffset = closingMin / 60 < dayStartHour ? 1 : 0
    guard let closingDay = calendar.date(byAdding: .day, value: dayOffset, to: midnight),
          let at = calendar.date(bySettingHour: closingMin / 60, minute: closingMin % 60, second: 0, of: closingDay) else { return nil }
    return ms(at)
}
// このお客さんを閉店で退店にする時刻。案内した営業日の閉店時刻。閉店時刻より後に案内したお客さんは、その営業日の終わり（朝4時）
public func closeOutAtOf(_ session: Session, _ closingMin: Int, calendar: Calendar = .current) -> Int? {
    let day = businessDayOf(session.seatedAt, calendar: calendar)
    guard let closingAt = closingAtOf(day, closingMin, calendar: calendar) else { return nil }
    return session.seatedAt < closingAt ? closingAt : businessDayRange(day, calendar: calendar)?.end
}
// 閉店で退店にするお客さん（退店していない・全卓消去していない・閉店で退店にする時刻を過ぎた）と、退店にしたあとの中身
public func closeOuts(_ sessions: [Session], now: Int, closingMin: Int?, calendar: Calendar = .current) -> [Session] {
    guard let closingMin else { return [] }
    return sessions.compactMap { session in
        guard session.status != .exited, session.clearedAt == nil,
              let at = closeOutAtOf(session, closingMin, calendar: calendar), now >= at else { return nil }
        var closed = session
        closed.status = .exited
        closed.exitedAt = at
        closed.exitedByClosing = true
        return closed
    }
}
