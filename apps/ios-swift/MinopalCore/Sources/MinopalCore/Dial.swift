import Foundation

// 卓カードの文字盤と残り時間（packages/core/src/dial.ts）・配置図の大きさ（floorScale.ts）・ツールバーのサボテンの時計（cactusClock.ts）

private let minute = 60_000

// 卓カードの文字盤。お通し（コースはファーストドリンク、お通しを出さない店は案内）から数えた経過を、お席の時間（120分）で一周する弧にする
public struct Dial: Equatable, Sendable {
    public var elapsedMin: Int?   // 経過（分、切り捨て）。お通し前・コースの開始待ちは nil
    public var progress: Double   // 弧の長さ 0〜1（お席の時間で1。超えたら1のまま）
    public var over: Bool         // お席の時間を過ぎている
    public var limitMin: Int      // 一周の分（お席の時間）。読み上げの最大値に使う
}
// 経過は timerOf・alertOf と同じ基準（startOf から。退店済は退店の時刻で止める）
public func dialOf(_ session: Session, now: Int, rules: Rules = .standard) -> Dial {
    let limitMin = rules.seatLimitMin
    guard let start = startOf(session, rules: rules) else { return Dial(elapsedMin: nil, progress: 0, over: false, limitMin: limitMin) }
    let end = session.status == .exited ? session.exitedAt ?? now : now
    let elapsedMin = max(0, end - start) / minute
    let seatEndAt = limitsOf(session, rules: rules)?.seatEndAt ?? start + limitMin * minute
    return Dial(elapsedMin: elapsedMin, progress: min(1, Double(elapsedMin) / Double(limitMin)), over: end >= seatEndAt, limitMin: limitMin)
}
// 文字盤の縁の「L.O. から退席まで」の帯（0〜1。ふつうは 90〜120分）。退店の時刻を決めた卓は、その時刻に合わせて前にずらす
public struct DialBand: Equatable, Sendable {
    public var from: Double
    public var to: Double
}
public func bandOf(_ session: Session, rules: Rules = .standard) -> DialBand {
    guard let start = startOf(session, rules: rules), let limits = limitsOf(session, rules: rules) else {
        return DialBand(from: Double(rules.lastOrderMin) / Double(rules.seatLimitMin), to: 1)
    }
    func at(_ time: Int) -> Double { min(1, max(0, Double(time - start) / Double(minute) / Double(rules.seatLimitMin))) }
    return DialBand(from: at(limits.lastOrderAt), to: at(limits.seatEndAt))
}
public enum Remaining: Equatable, Sendable {
    case lastOrder(minutes: Int)   // L.O.まで N分
    case seatLimit(minutes: Int)   // 退席まで N分
    case over                      // お席の時間を過ぎている
    case noLimit                   // 店全体で時間制限を切っている
}
// 卓カードの右下に出す残り時間。L.O.確認済みにするまでは L.O.まで、そのあと（または L.O. の時間を過ぎたら）退席まで。
// 分は切り上げ（残り30秒なら「1分」）。退店済・お通し前・コースの開始待ちは出さない
public func remainingOf(_ session: Session, now: Int, rules: Rules = .standard) -> Remaining? {
    guard session.status != .exited, let limits = limitsOf(session, rules: rules) else { return nil }
    if rules.timeLimitOff { return .noLimit }
    if now >= limits.seatEndAt { return .over }
    let loLeft = limits.lastOrderAt - now
    if session.status != .loDone && loLeft > 0 { return .lastOrder(minutes: ceilDiv(loLeft, minute)) }
    return .seatLimit(minutes: ceilDiv(limits.seatEndAt - now, minute))
}
private func ceilDiv(_ a: Int, _ b: Int) -> Int { (a + b - 1) / b }
public func remainingLabel(_ remaining: Remaining) -> String {
    switch remaining {
    case .lastOrder(let minutes): "L.O.まで\(minutes)分"
    case .seatLimit(let minutes): "退席まで\(minutes)分"
    case .over: "お席の時間を過ぎています"
    case .noLimit: "時間制限なし"
    }
}
// 時:分（1:05、0:35）。フロアは秒を出さず1分ごとに動かす
public func formatHourMinute(_ minutes: Int) -> String {
    "\(minutes / 60):\(String(format: "%02d", minutes % 60))"
}
// 読み上げ：「経過35分、L.O.まで55分」
public func dialLabel(_ dial: Dial, _ remaining: Remaining?) -> String {
    let elapsed = dial.elapsedMin.map { "経過\($0)分" } ?? "開始前"
    return remaining.map { "\(elapsed)、\(remainingLabel($0))" } ?? elapsed
}
public struct Point: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}
// 弧・帯を描くための点。12時を0として時計回り、中心 (cx, cy)・半径 r。
// TS の arcPath（SVG の円弧の文字列）は Web の描き方なので移していない。SwiftUI では Path.addArc で描く
public func dialPoint(_ fraction: Double, cx: Double, cy: Double, r: Double) -> Point {
    let angle = 2 * Double.pi * fraction - Double.pi / 2
    return Point(x: cx + r * cos(angle), y: cy + r * sin(angle))
}

// ツールバーのサボテンの時計の印（24×24）。茎色の楕円の縁に10個の点、針はいまの時刻を指す
public struct CactusClock: Equatable, Sendable {
    public var dots: [Point]
    public var hour: Point
    public var minute: Point
}
// 楕円の上の点。fraction は12時を0とした時計回りの割合
private func onEllipse(_ fraction: Double, _ scale: Double) -> Point {
    let angle = 2 * Double.pi * fraction - Double.pi / 2
    func round2(_ n: Double) -> Double { jsRound(n * 100) / 100 }
    return Point(x: round2(12 + 10 * scale * cos(angle)), y: round2(12 + 11 * scale * sin(angle)))
}
private let cactusDots = (0..<10).map { onEllipse(Double($0) / 10, 0.78) }
public func cactusClock(_ time: Int, calendar: Calendar = .current) -> CactusClock {
    let parts = calendar.dateComponents([.hour, .minute, .second], from: date(time))
    let minutes = Double(parts.minute ?? 0) + Double(parts.second ?? 0) / 60
    let hours = Double((parts.hour ?? 0) % 12) + minutes / 60
    return CactusClock(dots: cactusDots, hour: onEllipse(hours / 12, 0.42), minute: onEllipse(minutes / 60, 0.6))
}
// TS の Math.round（ちょうど半分のときは大きいほう）
func jsRound(_ value: Double) -> Double { (value + 0.5).rounded(.down) }

// 配置図のマスを、指で押せる大きさより小さくしない（No.146。floorScale.ts）。
// 画面の縦横に入る正方形まで縮めるが、下限で止め、はみ出した分は配置図だけをスクロールする
public let minTapPx = 44.0   // 1マスの卓も、押せる範囲はこの一辺以上
public let minLabelPx = 11.0  // 卓番・段階など、卓に出す文字の下限
public let minTimePx = 14.0   // 経過時間（時:分）の文字の下限
// 枠の余白・マスの間・下限。Web の配置図（通常とスマホ）と同じ値
public struct FloorChrome: Equatable, Sendable {
    public var gap: Double
    public var padX: Double
    public var padY: Double
    public var minCell: Double
    public static let regular = FloorChrome(gap: 6, padX: 16, padY: 14, minCell: 56)
    public static let mini = FloorChrome(gap: 4, padX: 8, padY: 8, minCell: minTapPx)
}
public struct FloorFrame: Equatable, Sendable {
    public var width: Double   // 配置図の枠の内側（スクロールする領域）
    public var height: Double
    public var cols: Int
    public var rows: Int
    public var chrome: FloorChrome
    public init(width: Double, height: Double, cols: Int, rows: Int, chrome: FloorChrome) {
        self.width = width
        self.height = height
        self.cols = cols
        self.rows = rows
        self.chrome = chrome
    }
}
// 余白を除いた長さに、count 個のマスと間の隙間を入れるときの1マス
private func fitPx(_ inner: Double, _ count: Int, _ gap: Double) -> Double {
    (inner - Double(count - 1) * gap) / Double(count)
}
// 1マスの一辺。画面に収まる大きさか、収まりきらないときの下限の、大きい方
public func floorCellPx(_ frame: FloorFrame) -> Double {
    let c = frame.chrome
    guard frame.cols >= 1 && frame.rows >= 1 && frame.width > 0 && frame.height > 0 else { return c.minCell }
    let fitW = fitPx(frame.width - 2 * c.padX, frame.cols, c.gap)
    let fitH = fitPx(frame.height - 2 * c.padY, frame.rows, c.gap)
    return max(c.minCell, min(fitW, fitH))
}
// 下限で止めたために、枠より配置図がはみ出す方向（その方向だけスクロールする）
public func floorOverflows(_ frame: FloorFrame, cell: Double? = nil) -> (x: Bool, y: Bool) {
    let c = frame.chrome, cell = cell ?? floorCellPx(frame)
    let width = Double(frame.cols) * cell + Double(max(0, frame.cols - 1)) * c.gap + 2 * c.padX
    let height = Double(frame.rows) * cell + Double(max(0, frame.rows - 1)) * c.gap + 2 * c.padY
    // 小数の端数だけでスクロールさせない
    return (width > frame.width + 0.5, height > frame.height + 0.5)
}
// 卓の押せる範囲。1マスの卓はマスそのもの、複数マスは隙間を足す
public func seatTapPx(cell: Double, span: Int, gap: Double) -> Double {
    Double(span) * cell + Double(max(0, span - 1)) * gap
}
