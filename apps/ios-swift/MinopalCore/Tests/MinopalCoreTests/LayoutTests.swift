import Foundation
import Testing
@testable import MinopalCore

// packages/core/src/layout.test.ts・shopLayout.test.ts・layoutDrag.test.ts・floorScale.test.ts と同じ中身。
// 保存先（MemoryShopLayoutStore）のテストは、Firestore の読み書きを移すとき（No.148 の4つ目）に移す
private func table(_ id: String, _ col: Int, _ row: Int, _ colSpan: Int = 3, _ rowSpan: Int = 2) -> Seat {
    Seat(id: id, kind: .table, col: col, colSpan: colSpan, row: row, rowSpan: rowSpan)
}
// 保存する形（Firestore の shopLayout/main）
private func document(_ layout: ShopLayout) -> [String: Any] {
    func box(_ b: GridBox) -> [String: Any] { ["col": b.col, "colSpan": b.colSpan, "row": b.row, "rowSpan": b.rowSpan] }
    return [
        "seats": layout.seats.map { box($0.box).merging(["id": $0.id, "kind": $0.kind.rawValue]) { $1 } },
        "labels": layout.labels.map { box($0.box).merging(["kind": $0.kind.rawValue, "text": $0.text]) { $1 } },
    ]
}
private func fitsWithoutOverlap(_ seats: [Seat], cols: Int, rows: Int) {
    var occupied = Set<String>()
    for seat in seats {
        let b = seat.box
        #expect(b.col >= 1 && b.row >= 1 && b.colSpan >= 1 && b.rowSpan >= 1)
        #expect(b.col + b.colSpan - 1 <= cols && b.row + b.rowSpan - 1 <= rows)
        for col in b.col..<(b.col + b.colSpan) {
            for row in b.row..<(b.row + b.rowSpan) {
                #expect(occupied.insert("\(col),\(row)").inserted, "\(seat.id) が重なっている")
            }
        }
    }
}

@Suite("最初の配置")
struct DefaultLayoutTests {
    @Test("21席、IDは一意で32/35/37は存在しない")
    func seats() {
        #expect(defaultSeats.count == 21)
        #expect(Set(defaultSeats.map(\.id)).count == 21)
        for id in ["32", "35", "37"] { #expect(!defaultSeats.contains { $0.id == id }) }
    }

    @Test("すべての席はグリッド内に収まり、互いに重ならない")
    func fits() {
        fitsWithoutOverlap(defaultSeats, cols: Grid.cols, rows: Grid.rows)
    }

    @Test("縦向き（時計回りに90°）でもグリッド内に収まり、互いに重ならない")
    func portraitFits() {
        let portrait = portraitOf(defaultLayout)
        fitsWithoutOverlap(portrait.seats, cols: portrait.cols, rows: portrait.rows)
    }

    @Test("縦向きは、最初の配置（9行）を時計回りに90°回した並びになる")
    func portraitPositions() {
        let portrait = portraitOf(defaultLayout)
        func at(_ id: String) -> [Int] { let b = portrait.seats.first { $0.id == id }!.box; return [b.col, b.colSpan, b.row, b.rowSpan] }
        #expect(portrait.cols == 9 && portrait.rows == 15)
        #expect(at("31") == [8, 2, 1, 3])   // 右の列の一番上
        #expect(at("38") == [8, 2, 13, 3])  // 右の列の一番下
        #expect(at("10") == [6, 1, 1, 1])   // カウンターの右側の上
        #expect(at("7") == [5, 1, 4, 1])    // カウンターの下辺
        #expect(at("4") == [2, 1, 4, 1])
        #expect(at("1") == [1, 1, 1, 1])    // 左の列
        #expect(at("3") == [1, 1, 3, 1])
        #expect(at("11") == [2, 2, 6, 3])   // 11 の右に 12
        #expect(at("12") == [5, 2, 6, 3])
        #expect(at("21") == [1, 3, 12, 4])  // 21 の右に 22
        #expect(at("22") == [4, 3, 12, 4])
    }
}

@Suite("お客さんがいる卓")
struct OccupiedSeatTests {
    @Test("表示中のお客さんの卓を団体の卓も含めて返す")
    func groups() {
        var group = newSession(id: "団体", tableId: "11", at: 0)
        group.tableIds = ["11", "12"]
        #expect(occupiedSeatIds(tables: ["11": "団体", "12": "団体", "13": "別の客"], sessions: [group, newSession(id: "別の客", tableId: "13", at: 0)], now: 600_000)
            == ["11", "12", "13"])
    }

    @Test("退店から5分未満は含み、5分ちょうどと過ぎた卓は含まない")
    func exited() {
        var exited = newSession(id: "退店した客", tableId: "11", at: 0)
        exited.status = .exited; exited.otoshiAt = 1; exited.loDoneAt = 2; exited.exitedAt = 60_000
        #expect(occupiedSeatIds(tables: ["11": exited.id], sessions: [exited], now: 359_999) == ["11"])
        #expect(occupiedSeatIds(tables: ["11": exited.id], sessions: [exited], now: 360_000) == [])
        #expect(occupiedSeatIds(tables: ["11": exited.id], sessions: [exited], now: 360_001) == [])
    }

    @Test("別のセッションを指す卓・参照のない卓・空席は含まない")
    func others() {
        var group = newSession(id: "前の客", tableId: "11", at: 0)
        group.tableIds = ["11", "12", "13", "14"]
        #expect(occupiedSeatIds(tables: ["11": "前の客", "12": "次の客", "13": nil], sessions: [group], now: 100) == ["11"])
    }

    @Test("セッション側に卓番がない参照や、セッションが見つからない参照は含まない")
    func missing() {
        #expect(occupiedSeatIds(tables: ["11": "客", "12": "客", "13": "不明"], sessions: [newSession(id: "客", tableId: "11", at: 0)], now: 100) == ["11"])
        #expect(occupiedSeatIds(tables: [:], sessions: [], now: 100) == [])
    }
}

@Suite("席の配置")
struct ShopLayoutTests {
    @Test("今までの配置はそのまま使える")
    func defaultIsValid() {
        #expect(layoutProblems(defaultLayout) == [])
    }

    @Test("重なり・はみ出し・卓番の重複を見つける")
    func problems() {
        let problems = layoutProblems(ShopLayout(seats: [table("11", 1, 1), table("11", 2, 2), table("12", 14, 6)], labels: []))
        for expected in ["11番が2つあります", "12番がマス目からはみ出しています", "11番と11番が重なっています"] { #expect(problems.contains(expected)) }
    }

    @Test("通知はポップアップにしたので、前の通知の場所（2行目の右・6列目）にも置ける（No.109）")
    func formerNoticeArea() {
        #expect(layoutProblems(ShopLayout(seats: [table("13", 7, 2, 1, 1), table("14", 6, 4, 1, 1)], labels: [])) == [])
    }

    @Test("卓番は1〜999の数字だけ")
    func seatIds() {
        #expect(layoutProblems(ShopLayout(seats: [table("A1", 1, 1)], labels: [])).contains("卓番「A1」は 1〜999 の数字にしてください"))
        #expect(layoutProblems(ShopLayout(seats: [table("0", 1, 1)], labels: [])).count == 1)
    }

    @Test("保存された配置を読み、壊れていれば nil")
    func parses() {
        #expect(parseShopLayout(document(defaultLayout)) == defaultLayout)
        #expect(parseShopLayout(document(ShopLayout(seats: [table("11", 1, 1), table("12", 1, 1)], labels: []))) == nil)
        #expect(parseShopLayout(nil) == nil)
    }

    @Test("目印（No.128）：種類を読み、種類の無い前の「ことば」は店が足した目印として読む")
    func landmarks() {
        let seats = document(ShopLayout(seats: [table("11", 1, 1)], labels: []))["seats"]!
        let labels: [[String: Any]] = [
            ["text": "カウンター", "col": 1, "colSpan": 2, "row": 9, "rowSpan": 1],
            ["kind": "entrance", "text": "入口", "col": 5, "colSpan": 2, "row": 10, "rowSpan": 1],
            ["kind": "warp", "text": "階段", "col": 8, "colSpan": 1, "row": 10, "rowSpan": 1],
        ]
        let layout = parseShopLayout(["seats": seats, "labels": labels])
        #expect(layout?.labels.map(\.kind) == [.custom, .entrance, .custom])
        #expect(layout?.labels.map(\.text) == ["カウンター", "入口", "階段"])
        #expect(defaultLayout.labels[0].kind == .custom)
    }

    @Test("目印の種類は入口・キッチン・ドリンク場・トイレ・レジと、店が足すもの")
    func landmarkKinds() {
        #expect(MinopalCore.landmarkKinds.map(\.name) == ["入口", "キッチン", "ドリンク場", "トイレ", "レジ"])
        #expect(landmarkName(.kitchen) == "キッチン")
        #expect(landmarkName(.custom) == nil)
        #expect(isLandmarkKind("custom"))
        #expect(!isLandmarkKind("stairs"))
    }

    @Test("店が足す目印は名前が要る")
    func labelNames() {
        let layout = ShopLayout(seats: [table("11", 1, 1)], labels: [LayoutLabel(kind: .custom, text: " ", col: 5, colSpan: 1, row: 5, rowSpan: 1)])
        #expect(layoutProblems(layout).contains("目印の名前は1〜12文字にしてください"))
    }

    @Test("新しい卓の番号は、使っていないいちばん小さい番号（カウンター1〜、テーブル11〜）")
    func nextIds() {
        #expect(nextSeatId(defaultLayout, .counter) == "15")
        #expect(nextSeatId(ShopLayout(seats: [], labels: []), .counter) == "1")
        #expect(nextSeatId(defaultLayout, .table) == "15")
        #expect(seatIdsOf(ShopLayout(seats: [table("12", 1, 3), table("3", 7, 3)], labels: [])) == ["3", "12"])
    }

    @Test("目印も卓と同じく縦向きに回す")
    func rotatesLabels() {
        #expect(portraitOf(defaultLayout).labels[0].box == rotateClockwise(defaultLayout.labels[0].box, rows: usedRows(defaultLayout)))
    }

    @Test("マス目は15×10。8〜10行目にも置ける（No.108）")
    func grid() {
        #expect(layoutProblems(ShopLayout(seats: [table("11", 1, 9)], labels: [])) == [])
        #expect(layoutProblems(ShopLayout(seats: [table("11", 1, 10)], labels: [])) == ["11番がマス目からはみ出しています"])
    }

    @Test("縦向きは置いてある行までを回す。最初の配置は9行なので、縦向きは9列（No.112）")
    func usedRowsOnly() {
        #expect(usedRows(defaultLayout) == 9)
        let portrait = portraitOf(defaultLayout)
        #expect(portrait.cols == 9 && portrait.rows == 15)
        let deeper = ShopLayout(seats: defaultLayout.seats + [table("15", 6, 9)], labels: defaultLayout.labels)
        #expect(usedRows(deeper) == 10)
        #expect(portraitOf(deeper).cols == 10)
        let shallow = ShopLayout(seats: [table("11", 1, 1)], labels: [])
        #expect(usedRows(shallow) == 2)
        #expect(portraitOf(shallow).cols == 2 && portraitOf(shallow).rows == 15)
    }
}

// 15列×10行。マス 60px・間 4px なら、幅 15*60+14*4=956、高さ 10*60+9*4=636
@Suite("指の位置からマスを求める")
struct CellAtTests {
    let w = 956.0, h = 636.0, gap = 4.0

    @Test("左上・右下・マスの間の真ん中で区切る")
    func edges() {
        #expect(cellAt(x: 0, y: 0, width: w, height: h, gap: gap) == Cell(col: 1, row: 1))
        #expect(cellAt(x: 61, y: 61, width: w, height: h, gap: gap) == Cell(col: 1, row: 1))
        #expect(cellAt(x: 63, y: 63, width: w, height: h, gap: gap) == Cell(col: 2, row: 2))
        #expect(cellAt(x: w - 1, y: h - 1, width: w, height: h, gap: gap) == Cell(col: 15, row: 10))
    }

    @Test("マス目の外は、いちばん近い端のマス")
    func outside() {
        #expect(cellAt(x: -50, y: -50, width: w, height: h, gap: gap) == Cell(col: 1, row: 1))
        #expect(cellAt(x: w + 50, y: h + 50, width: w, height: h, gap: gap) == Cell(col: 15, row: 10))
    }
}

@Suite("ドラッグ中の行き先")
struct DragBoxTests {
    let table = GridBox(col: 7, colSpan: 3, row: 3, rowSpan: 2)
    func with(_ change: (inout GridBox) -> Void) -> GridBox { var b = table; change(&b); return b }

    @Test("動かすときは、つかんだマスとの差だけずらす")
    func moves() {
        #expect(dragBox(.move, table, start: Cell(col: 8, row: 3), current: Cell(col: 10, row: 5)) == with { $0.col = 9; $0.row = 5 })
    }

    @Test("動かしても、マス目からはみ出さない")
    func clamps() {
        #expect(dragBox(.move, table, start: Cell(col: 8, row: 3), current: Cell(col: 15, row: 10)) == with { $0.col = 13; $0.row = 9 })
        #expect(dragBox(.move, table, start: Cell(col: 8, row: 3), current: Cell(col: 1, row: 1)) == with { $0.col = 1; $0.row = 1 })
    }

    @Test("大きさは右下の角を指のマスに合わせ、1マスより小さく・はみ出すほど大きくしない")
    func resizes() {
        #expect(dragBox(.resize, table, start: Cell(col: 9, row: 4), current: Cell(col: 11, row: 6)) == with { $0.colSpan = 5; $0.rowSpan = 4 })
        #expect(dragBox(.resize, table, start: Cell(col: 9, row: 4), current: Cell(col: 2, row: 1)) == with { $0.colSpan = 1; $0.rowSpan = 1 })
        #expect(dragBox(.resize, table, start: Cell(col: 9, row: 4), current: Cell(col: 15, row: 7)) == with { $0.colSpan = 9; $0.rowSpan = 5 })
    }

    @Test("同じ場所・大きさか（TS の sameBox は GridBox の == で比べる）")
    func same() {
        #expect(table == with { _ in })
        #expect(table != with { $0.col = 8 })
    }
}

@Suite("配置図の大きさ（No.146）")
struct FloorScaleTests {
    // 以前の計算：幅には必ず合わせ、高さだけ下限で止めて縦にスクロールしていた
    func legacyCellPx(_ f: FloorFrame) -> Double {
        let c = f.chrome
        let fitW = (f.width - 2 * c.padX - Double(f.cols - 1) * c.gap) / Double(f.cols)
        let fitH = (f.height - 2 * c.padY - Double(f.rows - 1) * c.gap) / Double(f.rows)
        return min(fitW, max(fitH, c.minCell))
    }

    @Test("文字と押せる範囲の下限")
    func minimums() {
        #expect(minTapPx == 44 && minLabelPx == 11 && minTimePx == 14)
        #expect(FloorChrome.mini.minCell == minTapPx)
        #expect(FloorChrome.regular.minCell >= minTapPx)
    }

    @Test("幅が下限以上の画面は、今までと同じマスの大きさ")
    func tablets() {
        // 横向きタブレット（1080×810、帯56、15列×10行）と、縦向きの iPad（768×1024、帯56、回した9列×15行）
        let tablets = [
            FloorFrame(width: 1080, height: 810 - 56, cols: 15, rows: 10, chrome: .regular),
            FloorFrame(width: 768, height: 1024 - 56, cols: 9, rows: 15, chrome: .regular),
        ]
        for item in tablets {
            #expect(legacyCellPx(item) > item.chrome.minCell)
            #expect(floorCellPx(item) == legacyCellPx(item))
            #expect(floorOverflows(item) == (false, false))
        }
        // 大きいスマホの横向き（高さ側だけ下限に当たる。幅は足りているので、今までと同じく縦だけスクロール）
        let landscape = FloorFrame(width: 926, height: 428 - 48, cols: 15, rows: 9, chrome: .mini)
        #expect(legacyCellPx(landscape) >= landscape.chrome.minCell)
        #expect(floorCellPx(landscape) == legacyCellPx(landscape))
        #expect(floorOverflows(landscape) == (false, true))
    }

    @Test("幅375px・320pxの縦向きは1マスを44pxで止め、配置図だけがはみ出す")
    func phones() {
        for width in [375.0, 320.0] {
            for cols in [9, 10] {
                let phone = FloorFrame(width: width, height: (width == 375 ? 667 : 568) - 48, cols: cols, rows: 15, chrome: .mini)
                #expect(legacyCellPx(phone) < minTapPx)
                #expect(floorCellPx(phone) == minTapPx)
                #expect(seatTapPx(cell: floorCellPx(phone), span: 1, gap: phone.chrome.gap) >= minTapPx)
                #expect(seatTapPx(cell: floorCellPx(phone), span: 2, gap: phone.chrome.gap) > minTapPx)
                let over = floorOverflows(phone)
                #expect(over.x || over.y)
            }
        }
    }

    @Test("幅だけ足りないときは横にはみ出し、高さだけ足りないときは縦にはみ出す")
    func oneDirection() {
        let chrome = FloorChrome(gap: 4, padX: 8, padY: 8, minCell: 44)
        let narrow = FloorFrame(width: 200, height: 900, cols: 4, rows: 2, chrome: chrome)
        #expect(floorCellPx(narrow) == 44)
        #expect(floorOverflows(narrow) == (true, false))
        let short = FloorFrame(width: 900, height: 80, cols: 4, rows: 6, chrome: chrome)
        #expect(floorOverflows(short) == (false, true))
    }
}
