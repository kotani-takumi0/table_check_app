import Foundation

// 卓とは別の、店全体で周期的にやる作業のタイマー（packages/core/src/shopTimers.ts・shopTimerIcons.ts）。店が設定で決める（No.91）。
// icon は線のアイコンの id（No.99 より前の版は絵文字を入れていた）。label はツールバー・読み上げ・通知に使う
public struct ShopTimer: Equatable, Sendable {
    public var id: String
    public var label: String
    public var icon: String
    public var intervalMin: Int
    public init(id: String, label: String, icon: String, intervalMin: Int) {
        self.id = id
        self.label = label
        self.icon = icon
        self.intervalMin = intervalMin
    }
}
// 最初の一覧（No.91 より前から使っている id なので変えない。前の版のアプリはこの2つだけを知っている）
public let defaultShopTimers = [
    ShopTimer(id: "toilet_check", label: "トイレチェック", icon: "patrol", intervalMin: 30),
    ShopTimer(id: "toilet_clean", label: "トイレ清掃", icon: "clean", intervalMin: 120),
]
// ヘッダーに並ぶので4つまで。間隔の範囲と1回で動かす分（firestore.rules の shopTimers・shopSettings も同じ）
public enum ShopTimerLimits {
    public static let timers = 4, label = 12, icon = 8, minInterval = 5, maxInterval = 480, step = 5
}
// タイマーごとの済にした時刻（タイマーの id → ミリ秒）
public typealias ShopTimerDone = [String: Int]
private let minute = 60_000

public struct ShopTimerState: Equatable, Sendable {
    public var due: Bool
    public var dueAt: Int
    public var remainingMs: Int
}
// 一度も済にしていなければ、すぐにやる時間として扱う
public func shopTimerState(intervalMin: Int, doneAt: Int?, now: Int) -> ShopTimerState {
    let dueAt = doneAt.map { $0 + intervalMin * minute } ?? 0
    return ShopTimerState(due: now >= dueAt, dueAt: dueAt, remainingMs: max(0, dueAt - now))
}
// id は英小文字・数字・_ の24文字まで（firestore.rules の shopTimers と同じ形）
public func isShopTimerId(_ id: String) -> Bool { isCourse(id) }
// タイマーを保存する前に確かめる。直すべきことを、お店の人が読める言葉で返す（空なら保存できる）
public func shopTimerProblems(_ timer: ShopTimer) -> [String] {
    var problems: [String] = []
    if isBlank(timer.label) || jsLength(timer.label) > ShopTimerLimits.label { problems.append("名前は1〜\(ShopTimerLimits.label)文字にしてください") }
    if isBlank(timer.icon) || jsLength(timer.icon) > ShopTimerLimits.icon { problems.append("アイコンを選んでください") }
    if timer.intervalMin < ShopTimerLimits.minInterval || timer.intervalMin > ShopTimerLimits.maxInterval { problems.append("間隔が範囲の外です") }
    return problems
}
// タイマーの一覧を読む。壊れたタイマー・同じ id は落とす。一覧そのものが無い・壊れているときは最初の一覧（空の一覧はそのまま）
public func parseShopTimers(_ value: Any?) -> [ShopTimer] {
    guard let items = value as? [Any] else { return defaultShopTimers }
    var timers: [ShopTimer] = []
    for item in items.prefix(ShopTimerLimits.timers) {
        let t = item as? [String: Any] ?? [:]
        // 間隔が整数でない・数でないものは、範囲の外として落とす
        guard let interval = integerValue(t["intervalMin"]) else { continue }
        let timer = ShopTimer(id: jsString(t["id"]), label: jsString(t["label"]), icon: jsString(t["icon"]), intervalMin: interval)
        if isShopTimerId(timer.id) && !timers.contains(where: { $0.id == timer.id }) && shopTimerProblems(timer).isEmpty { timers.append(timer) }
    }
    return timers
}
// 間隔を step ずつ変える。範囲の外は nil
public func stepInterval(_ timer: ShopTimer, _ direction: Int) -> ShopTimer? {
    let intervalMin = timer.intervalMin + direction * ShopTimerLimits.step
    guard intervalMin >= ShopTimerLimits.minInterval && intervalMin <= ShopTimerLimits.maxInterval else { return nil }
    var result = timer
    result.intervalMin = intervalMin
    return result
}
public func newShopTimerId(_ timers: [ShopTimer], now: Int) -> String {
    newId(prefix: "timer_", now: now) { id in timers.contains { $0.id == id } }
}
// タイマーごとに新しいほうの時刻を残す（別の端末の書き込みを消さない）
public func mergeShopTimerDone(_ a: ShopTimerDone, _ b: ShopTimerDone) -> ShopTimerDone {
    a.merging(b) { max($0, $1) }
}
// 端末に覚えた済の時刻を読む（TS の Number(value) と同じく、数でなければ nil）
public func parseDoneAt(_ value: String?) -> Int? {
    guard let value, !value.isEmpty, let at = Double(value.trimmingCharacters(in: .whitespaces)), at.isFinite else { return nil }
    return Int(at)
}
// スマホのツールバーに出す短い名前：どの名前にも共通する頭（「トイレチェック」「トイレ清掃」なら「トイレ」）を省く。
// 省くと空になる名前があるとき・タイマーが1つのときは、そのままの名前にする
public func shortTimerNames(_ labels: [String]) -> [String] {
    guard labels.count >= 2 else { return labels }
    var prefix = labels[0]
    for label in labels { while !label.hasPrefix(prefix) { prefix = String(prefix.dropLast()) } }
    return labels.contains { $0.count == prefix.count } ? labels : labels.map { String($0.dropFirst(prefix.count)) }
}

// 店のタイマーのアイコン（No.99）。24 の枠に太さ 1.8 の線、角は丸。色は持たず、文字と同じ色で描く。Web と iOS で同じ線を使う。
// paths は SVG の path の d（描き方は画面の側で決める）。ShopTimer の icon には id を保存する。前の版が保存した絵文字は、近いアイコンに読み替える
public struct ShopTimerIcon: Equatable, Sendable {
    public var id: String
    public var name: String
    public var paths: [String]
}
public let shopTimerIcons = [
    ShopTimerIcon(id: "patrol", name: "見回り", paths: ["M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z", "M9.2 12a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0"]),
    ShopTimerIcon(id: "toilet", name: "トイレ", paths: ["M6.5 3.5h5v6.5h-5z", "M4 10h16c0 3.3-3.6 6-8 6s-8-2.7-8-6z", "M9.5 16l-1 4.5h7l-1-4.5"]),
    ShopTimerIcon(id: "clean", name: "清掃", paths: ["M16 3.5l-3.2 8", "M7.5 11.5h9l1 9h-11z", "M10 15.5v5M14 15.5v5"]),
    ShopTimerIcon(id: "spray", name: "消毒", paths: ["M8.5 10.5h6a1 1 0 0 1 1 1V20h-8v-8.5a1 1 0 0 1 1-1z", "M9.5 10.5V6.5h4.5l2 1.5", "M19 5.5h.01M20.5 8h.01M19 10.5h.01"]),
    ShopTimerIcon(id: "drop", name: "手洗い", paths: ["M12 3.5s-6 6.6-6 10.6a6 6 0 0 0 12 0c0-4-6-10.6-6-10.6z", "M9.2 14.5a2.8 2.8 0 0 0 2.8 2.8"]),
    ShopTimerIcon(id: "bag", name: "ゴミ出し", paths: ["M6.5 9h11l1 11h-13z", "M9.5 9l2.5-4 2.5 4"]),
    ShopTimerIcon(id: "wind", name: "換気", paths: ["M3.5 9h10a2.5 2.5 0 1 0-2.5-2.5", "M3.5 13h14a2.5 2.5 0 1 1-2.5 2.5", "M3.5 17h6"]),
    ShopTimerIcon(id: "box", name: "補充", paths: ["M4 7.8l8-4 8 4v8.4l-8 4-8-4z", "M4 7.8l8 4 8-4", "M12 11.8v8.4"]),
    ShopTimerIcon(id: "clock", name: "時計", paths: ["M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0", "M12 7.5V12l3 2"]),
]
// 新しく足したタイマーのアイコン。知らない値（壊れた値・前の版の見知らぬ絵文字）もこれで描く
public let fallbackShopTimerIcon = "clock"
// 前の版で入れられた絵文字（最初の一覧と、設定の例に出していたもの）
private let legacyEmoji = ["👀": "patrol", "🧽": "clean", "🧹": "clean", "⏰": "clock", "🗑️": "bag", "🗑": "bag", "🚽": "toilet"]
public func shopTimerIcon(_ icon: String) -> ShopTimerIcon {
    let id = legacyEmoji[icon] ?? icon
    return shopTimerIcons.first { $0.id == id } ?? shopTimerIcons.first { $0.id == fallbackShopTimerIcon }!
}

// 時刻から、ほかと重ならない id を作る（TS の `${prefix}${n.toString(36)}`）
func newId(prefix: String, now: Int, taken: (String) -> Bool) -> String {
    var n = now
    while true {
        let id = prefix + String(n, radix: 36)
        if !taken(id) { return id }
        n += 1
    }
}
// TS の String(v ?? '')。文字・数以外は空にする（店の設定を読むときだけに使う）
func jsString(_ value: Any?) -> String {
    if let text = value as? String { return text }
    if let number = numberValue(value) { return number.rounded() == number ? String(Int(number)) : String(number) }
    return ""
}
// TS の text.trim() === ''
func isBlank(_ text: String) -> Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
// TS の text.length（UTF-16 の数。絵文字は2つと数える）。文字数の上限を TS と同じ数え方で確かめる
func jsLength(_ text: String) -> Int { text.utf16.count }
