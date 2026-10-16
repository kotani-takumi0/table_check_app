import Foundation
@testable import MinopalCore

// TS のテストは端末の時間帯（店の端末は日本時間）で日付を作る。Swift のテストは日本時間に決めて、どの時間帯の CI でも同じ結果にする
let tokyo: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Tokyo")!
    return calendar
}()

// TS の new Date(year, monthIndex, day, hour, minute).getTime() と同じ（月は 0 始まり）
func tokyoMs(_ year: Int, _ monthIndex: Int, _ day: Int, _ hour: Int = 0, _ minute: Int = 0) -> Int {
    ms(tokyo.date(from: DateComponents(year: year, month: monthIndex + 1, day: day, hour: hour, minute: minute))!)
}
