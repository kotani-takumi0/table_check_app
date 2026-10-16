import Foundation

// 席の配置（packages/core/src/layout.ts・shopLayout.ts・layoutDrag.ts）

// マス目の上の場所と大きさ（列・行は1から）
public struct GridBox: Equatable, Hashable, Sendable {
    public var col: Int
    public var colSpan: Int
    public var row: Int
    public var rowSpan: Int
    public init(col: Int, colSpan: Int, row: Int, rowSpan: Int) {
        self.col = col
        self.colSpan = colSpan
        self.row = row
        self.rowSpan = rowSpan
    }
}

public enum SeatKind: String, Sendable { case table, counter }
public struct Seat: Equatable, Sendable {
    public var id: String
    public var kind: SeatKind
    public var box: GridBox
    public init(id: String, kind: SeatKind, col: Int, colSpan: Int, row: Int, rowSpan: Int) {
        self.id = id
        self.kind = kind
        self.box = GridBox(col: col, colSpan: colSpan, row: row, rowSpan: rowSpan)
    }
}

// フロアのマス目（横向き）。No.108 で 15×7 から 15×10 に広げ、横向きのタブレットで1マスが正方形になるようにした
public enum Grid {
    public static let cols = 15, rows = 10
}
// 最初の配置（No.112 でマス目いっぱいに広げた）。席の配置を保存していない店と「最初の配置に戻す」で使う
public let defaultSeats = [
    Seat(id: "31", kind: .table, col: 1, colSpan: 3, row: 1, rowSpan: 2),
    Seat(id: "33", kind: .table, col: 4, colSpan: 3, row: 1, rowSpan: 2),
    Seat(id: "34", kind: .table, col: 7, colSpan: 3, row: 1, rowSpan: 2),
    Seat(id: "36", kind: .table, col: 10, colSpan: 3, row: 1, rowSpan: 2),
    Seat(id: "38", kind: .table, col: 13, colSpan: 3, row: 1, rowSpan: 2),
    Seat(id: "10", kind: .counter, col: 1, colSpan: 1, row: 4, rowSpan: 1),
    Seat(id: "9", kind: .counter, col: 2, colSpan: 1, row: 4, rowSpan: 1),
    Seat(id: "8", kind: .counter, col: 3, colSpan: 1, row: 4, rowSpan: 1),
    Seat(id: "7", kind: .counter, col: 4, colSpan: 1, row: 5, rowSpan: 1),
    Seat(id: "6", kind: .counter, col: 4, colSpan: 1, row: 6, rowSpan: 1),
    Seat(id: "5", kind: .counter, col: 4, colSpan: 1, row: 7, rowSpan: 1),
    Seat(id: "4", kind: .counter, col: 4, colSpan: 1, row: 8, rowSpan: 1),
    Seat(id: "1", kind: .counter, col: 1, colSpan: 1, row: 9, rowSpan: 1),
    Seat(id: "2", kind: .counter, col: 2, colSpan: 1, row: 9, rowSpan: 1),
    Seat(id: "3", kind: .counter, col: 3, colSpan: 1, row: 9, rowSpan: 1),
    Seat(id: "12", kind: .table, col: 6, colSpan: 3, row: 4, rowSpan: 2),
    Seat(id: "14", kind: .table, col: 9, colSpan: 3, row: 4, rowSpan: 2),
    Seat(id: "22", kind: .table, col: 12, colSpan: 4, row: 4, rowSpan: 3),
    Seat(id: "11", kind: .table, col: 6, colSpan: 3, row: 7, rowSpan: 2),
    Seat(id: "13", kind: .table, col: 9, colSpan: 3, row: 7, rowSpan: 2),
    Seat(id: "21", kind: .table, col: 12, colSpan: 4, row: 7, rowSpan: 3),
]
// 縦向きの画面では、手描きの配置図と同じ向き（今の配置を時計回りに90°）で並べる。卓と目印に使う。
// rows は回す前（横向き）の行の数で、回したあとの列の数になる（portraitOf が、置いてある行までに絞って渡す）
public func rotateClockwise(_ box: GridBox, rows: Int) -> GridBox {
    GridBox(col: rows + 2 - box.row - box.rowSpan, colSpan: box.rowSpan, row: box.col, rowSpan: box.colSpan)
}

// 卓とセッションの参照が一致し、退店後の表示時間も含めてお客さんが見えている卓。rules：退店済みを残す時間（No.14）を店の設定に合わせる
public func occupiedSeatIds(tables: [String: String?], sessions: [Session], now: Int, rules: Rules = .standard) -> Set<String> {
    Set(resolveSessions(tables: tables, sessions: sessions).filter { isVisible($0, now: now, rules: rules) }.flatMap(\.tableIds))
}

// 目印（No.128）：入口・キッチンなど、卓のほかに配置に置くもの。分析で「入口から何マス」などを数えるために、種類と場所を持つ。
// 用意した種類のほかは店が名前を入れて足す（custom）。同じ名前は同じ種類として数える。No.128 より前の「ことば」は custom として読む
public enum LandmarkKind: String, CaseIterable, Sendable {
    case entrance, kitchen, drinks, toilet, register, custom
}
// 用意した種類と名前（LANDMARK_KINDS）
public let landmarkKinds: [(kind: LandmarkKind, name: String)] = [
    (.entrance, "入口"), (.kitchen, "キッチン"), (.drinks, "ドリンク場"), (.toilet, "トイレ"), (.register, "レジ"),
]
public func isLandmarkKind(_ value: Any?) -> Bool {
    (value as? String).flatMap(LandmarkKind.init(rawValue:)) != nil
}
// 用意した種類の名前（店が足した目印は nil）。text には用意した種類でも名前を入れておく（前の版のアプリは text だけを出す）
public func landmarkName(_ kind: LandmarkKind) -> String? {
    landmarkKinds.first { $0.kind == kind }?.name
}
public struct LayoutLabel: Equatable, Sendable {
    public var kind: LandmarkKind
    public var text: String
    public var box: GridBox
    public init(kind: LandmarkKind, text: String, col: Int, colSpan: Int, row: Int, rowSpan: Int) {
        self.kind = kind
        self.text = text
        self.box = GridBox(col: col, colSpan: colSpan, row: row, rowSpan: rowSpan)
    }
}
// 席の配置（No.75）。お店の人が「設定 → 席の配置」でマス目にブロックを置いて作り、全端末で共有する（Firestore の shopLayout/main）
public struct ShopLayout: Equatable, Sendable {
    public var seats: [Seat]
    public var labels: [LayoutLabel]
    public init(seats: [Seat], labels: [LayoutLabel]) {
        self.seats = seats
        self.labels = labels
    }
}
public let defaultLayout = ShopLayout(seats: defaultSeats, labels: [LayoutLabel(kind: .custom, text: "カウンター", col: 1, colSpan: 3, row: 5, rowSpan: 4)])
public let maxSeats = 60
public let maxLabels = 20
public let labelMaxLength = 12

// 卓番は 1〜999 の数字（団体の卓番を数の順に並べ、Firestore のルールでも確かめる）
public func isSeatId(_ id: String) -> Bool {
    id.range(of: "^[1-9][0-9]{0,2}$", options: .regularExpression) != nil
}
private func inGrid(_ box: GridBox) -> Bool {
    box.col >= 1 && box.row >= 1 && box.colSpan >= 1 && box.rowSpan >= 1
        && box.col + box.colSpan - 1 <= Grid.cols && box.row + box.rowSpan - 1 <= Grid.rows
}
public func overlaps(_ a: GridBox, _ b: GridBox) -> Bool {
    a.col < b.col + b.colSpan && b.col < a.col + a.colSpan && a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan
}
// 保存する前に確かめる。直すべきことを、お店の人が読める言葉で返す（空なら保存できる）
public func layoutProblems(_ layout: ShopLayout) -> [String] {
    var problems: [String] = []
    if layout.seats.isEmpty { problems.append("卓が1つもありません") }
    if layout.seats.count > maxSeats { problems.append("卓は\(maxSeats)までです") }
    if layout.labels.count > maxLabels { problems.append("目印は\(maxLabels)までです") }
    var ids = Set<String>()
    for seat in layout.seats {
        if !isSeatId(seat.id) { problems.append("卓番「\(seat.id)」は 1〜999 の数字にしてください") }
        else if ids.contains(seat.id) { problems.append("\(seat.id)番が2つあります") }
        ids.insert(seat.id)
        if !inGrid(seat.box) { problems.append("\(seat.id)番がマス目からはみ出しています") }
    }
    for label in layout.labels {
        if isBlank(label.text) || jsLength(label.text) > labelMaxLength { problems.append("目印の名前は1〜\(labelMaxLength)文字にしてください") }
        if !inGrid(label.box) { problems.append("「\(label.text)」がマス目からはみ出しています") }
    }
    let boxes = layout.seats.map { ("\($0.id)番", $0.box) } + layout.labels.map { ("「\($0.text)」", $0.box) }
    for (i, a) in boxes.enumerated() {
        for b in boxes.dropFirst(i + 1) where overlaps(a.1, b.1) { problems.append("\(a.0)と\(b.0)が重なっています") }
    }
    // 同じ言葉は1つにする（並びは最初に出た順）
    var seen = Set<String>()
    return problems.filter { seen.insert($0).inserted }
}
// 保存された配置を読む。壊れていたり、確かめて問題があったりすれば nil（呼ぶ側は今までの配置を使う）
public func parseShopLayout(_ data: [String: Any]?) -> ShopLayout? {
    guard let d = data, let rawSeats = d["seats"] as? [Any], let rawLabels = d["labels"] as? [Any] else { return nil }
    // 場所が整数でなければ、TS では確かめで落ちるので、配置ごと読まない
    func box(_ item: [String: Any]) -> GridBox? {
        guard let col = integerValue(item["col"]), let colSpan = integerValue(item["colSpan"]),
              let row = integerValue(item["row"]), let rowSpan = integerValue(item["rowSpan"]) else { return nil }
        return GridBox(col: col, colSpan: colSpan, row: row, rowSpan: rowSpan)
    }
    var seats: [Seat] = [], labels: [LayoutLabel] = []
    for raw in rawSeats {
        let s = raw as? [String: Any] ?? [:]
        guard let b = box(s) else { return nil }
        seats.append(Seat(id: jsString(s["id"]), kind: s["kind"] as? String == "counter" ? .counter : .table,
                          col: b.col, colSpan: b.colSpan, row: b.row, rowSpan: b.rowSpan))
    }
    for raw in rawLabels {
        let l = raw as? [String: Any] ?? [:]
        guard let b = box(l) else { return nil }
        labels.append(LayoutLabel(kind: (l["kind"] as? String).flatMap(LandmarkKind.init(rawValue:)) ?? .custom, text: jsString(l["text"]),
                                  col: b.col, colSpan: b.colSpan, row: b.row, rowSpan: b.rowSpan))
    }
    let layout = ShopLayout(seats: seats, labels: labels)
    return layoutProblems(layout).isEmpty ? layout : nil
}
// 卓・目印を置いている、いちばん下の行（No.108）。縦向きはここまでを回して出し、何も置いていない下の行は出さない
public func usedRows(_ layout: ShopLayout) -> Int {
    max(1, (layout.seats.map(\.box) + layout.labels.map(\.box)).map { $0.row + $0.rowSpan - 1 }.max() ?? 1)
}
// 縦向きの並び：置いてある行までを時計回りに90°回す
public struct PortraitLayout: Equatable, Sendable {
    public var cols: Int
    public var rows: Int
    public var seats: [Seat]
    public var labels: [LayoutLabel]
}
public func portraitOf(_ layout: ShopLayout) -> PortraitLayout {
    let rows = usedRows(layout)
    func rotated(_ seat: Seat) -> Seat { var s = seat; s.box = rotateClockwise(seat.box, rows: rows); return s }
    func rotated(_ label: LayoutLabel) -> LayoutLabel { var l = label; l.box = rotateClockwise(label.box, rows: rows); return l }
    return PortraitLayout(cols: rows, rows: Grid.cols, seats: layout.seats.map(rotated), labels: layout.labels.map(rotated))
}
// 卓番を数の順に並べた一覧（Firestore のルールが、案内できる卓かを確かめるのに使う）
public func seatIdsOf(_ layout: ShopLayout) -> [String] {
    layout.seats.map(\.id).enumerated()
        .sorted { a, b in
            guard let x = Double(a.element), let y = Double(b.element), x != y else { return a.offset < b.offset }
            return x < y
        }
        .map(\.element)
}
// 新しく置く卓の番号：その種類で使っていないいちばん小さい番号（カウンターは1から、テーブルは11から）
public func nextSeatId(_ layout: ShopLayout, _ kind: SeatKind) -> String {
    let used = Set(layout.seats.map(\.id))
    for n in (kind == .counter ? 1 : 11)...999 where !used.contains(String(n)) { return String(n) }
    return ""
}

// 席の配置で、卓・目印を指でつかんで動かす・角をつまんで大きさを変える（No.93。layoutDrag.ts）。
// 指の位置からマスを求める計算と、ドラッグ中の行き先の計算
public struct Cell: Equatable, Sendable {
    public var col: Int
    public var row: Int
    public init(col: Int, row: Int) {
        self.col = col
        self.row = row
    }
}
public enum DragKind: Sendable { case move, resize }
// これより短い動きは、ドラッグではなく「押した」として扱う（押して選ぶ操作を残す）
public let dragThreshold = 8.0
private func clamp(_ value: Int, _ low: Int, _ high: Int) -> Int { min(max(value, low), high) }
// マス目の左上からの位置（x, y）が、どのマスか。width・height はマス目の中の大きさ（外の余白は除く）、gap はマスの間。
// マス目の外に出ても、いちばん近い端のマスにする
public func cellAt(x: Double, y: Double, width: Double, height: Double, gap: Double) -> Cell {
    let colSize = (width - gap * Double(Grid.cols - 1)) / Double(Grid.cols) + gap
    let rowSize = (height - gap * Double(Grid.rows - 1)) / Double(Grid.rows) + gap
    return Cell(col: clamp(Int(((x + gap / 2) / colSize).rounded(.down)) + 1, 1, Grid.cols),
                row: clamp(Int(((y + gap / 2) / rowSize).rounded(.down)) + 1, 1, Grid.rows))
}
// ドラッグ中の行き先。動かすときはつかんだマスとの差だけずらし、大きさを変えるときは右下の角を指のマスに合わせる。
// どちらもマス目からはみ出さないように止める（ほかの卓との重なりは、置くときに確かめる）
public func dragBox(_ kind: DragKind, _ item: GridBox, start: Cell, current: Cell) -> GridBox {
    var box = item
    switch kind {
    case .move:
        box.col = clamp(item.col + current.col - start.col, 1, Grid.cols - item.colSpan + 1)
        box.row = clamp(item.row + current.row - start.row, 1, Grid.rows - item.rowSpan + 1)
    case .resize:
        box.colSpan = clamp(current.col - item.col + 1, 1, Grid.cols - item.col + 1)
        box.rowSpan = clamp(current.row - item.row + 1, 1, Grid.rows - item.row + 1)
    }
    return box
}
