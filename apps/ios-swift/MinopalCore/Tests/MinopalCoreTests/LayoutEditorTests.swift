import Foundation
import Testing
@testable import MinopalCore

// 席の配置を作り直す画面の中身（LayoutEditor.swift。TS の useLayoutEditor.ts は React の hook なのでテストが無い）
private let two = ShopLayout(seats: [Seat(id: "11", kind: .table, col: 1, colSpan: 3, row: 1, rowSpan: 2),
                                     Seat(id: "1", kind: .counter, col: 1, colSpan: 1, row: 4, rowSpan: 1)], labels: [])

@Suite("席の配置を作り直す")
struct LayoutEditorTests {
    @Test("選んだブロックを空いているマスに置き、置いた卓を選ぶ（テーブルは11から、カウンターは1から番号を振る）")
    func place() {
        var editor = LayoutEditor(layout: blankLayout)
        editor.pressCell(col: 5, row: 5)
        #expect(editor.draft.seats == [Seat(id: "11", kind: .table, col: 5, colSpan: 3, row: 5, rowSpan: 2)])
        #expect(editor.selected == LayoutTarget(.seat, 0))
        editor.select(nil)
        editor.block = "counter"
        editor.pressCell(col: 1, row: 1)
        #expect(editor.draft.seats.last == Seat(id: "1", kind: .counter, col: 1, colSpan: 1, row: 1, rowSpan: 1))
        #expect(editor.changed && editor.canSave(occupied: []))
        #expect(editor.status(occupied: []) == "保存すると、すべての端末の配置が変わります")
    }

    @Test("重なる・はみ出すところには置かず、理由を出す")
    func blocked() {
        var editor = LayoutEditor(layout: two)
        editor.pressCell(col: 2, row: 2)
        #expect(editor.draft == two)
        #expect(editor.message == "そこには入りません。空いているところを押すか、小さいブロックを選んでください")
        editor.pressCell(col: 14, row: 1)
        #expect(editor.draft == two)
    }

    @Test("目印はまず入口として置く。種類を変えると名前も変わり、そのほかにすると名前を空にする")
    func landmark() {
        var editor = LayoutEditor(layout: blankLayout)
        editor.block = "label"
        editor.pressCell(col: 1, row: 1)
        #expect(editor.label?.kind == .entrance && editor.label?.text == "入口")
        editor.setLabelKind(.kitchen)
        #expect(editor.label?.text == "キッチン")
        editor.setLabelKind(.custom)
        #expect(editor.label?.text == "")
        editor.setLabelText("喫煙所")
        editor.setLabelKind(.custom)
        #expect(editor.label?.text == "喫煙所")
    }

    @Test("選んでいる卓は、空いているマスを押すとそこへ動き、幅・高さを1マスずつ変えられる")
    func moveAndResize() {
        var editor = LayoutEditor(layout: two)
        editor.select(LayoutTarget(.seat, 0))
        editor.pressCell(col: 10, row: 1)
        #expect(editor.seat?.box == GridBox(col: 10, colSpan: 3, row: 1, rowSpan: 2))
        editor.resize(dCol: 1, dRow: 0)
        #expect(editor.seat?.box.colSpan == 4)
        editor.resize(dCol: 3, dRow: 0)
        #expect(editor.seat?.box.colSpan == 4)
        #expect(editor.message == "その大きさにすると、ほかの卓に重なるか、はみ出します")
        editor.resize(dCol: 0, dRow: -2)
        #expect(editor.seat?.box.rowSpan == 2)
    }

    @Test("ドラッグで置く：置けなければ動かさず、置けるかは canPlace で分かる")
    func drag() {
        var editor = LayoutEditor(layout: two)
        let onCounter = GridBox(col: 1, colSpan: 3, row: 3, rowSpan: 2)
        #expect(!editor.canPlace(LayoutTarget(.seat, 0), onCounter))
        editor.placeAt(LayoutTarget(.seat, 0), onCounter)
        #expect(editor.draft == two)
        #expect(editor.selected == LayoutTarget(.seat, 0))
        let free = GridBox(col: 5, colSpan: 3, row: 3, rowSpan: 2)
        editor.placeAt(LayoutTarget(.seat, 0), free)
        #expect(editor.seat?.box == free)
    }

    @Test("お客さんがいる卓は、卓番を変えたり消したりすると保存できない（動かすのはできる）")
    func occupied() {
        var editor = LayoutEditor(layout: two)
        editor.select(LayoutTarget(.seat, 0))
        #expect(editor.locked(occupied: ["11"]))
        #expect(editor.isOccupied(0, occupied: ["11"]) && !editor.isOccupied(1, occupied: ["11"]))
        editor.pressCell(col: 10, row: 5)
        #expect(editor.canSave(occupied: ["11"]))
        editor.setSeatId("12")
        #expect(editor.problems(occupied: ["11"]) == ["11番はお客さんがいるので残してください"])
        editor.setSeatId("11")
        editor.remove()
        #expect(!editor.canSave(occupied: ["11"]))
        #expect(editor.status(occupied: ["11"]) == "直すところ：11番はお客さんがいるので残してください")
    }

    @Test("卓番は数字だけ・3けたまで")
    func seatId() {
        var editor = LayoutEditor(layout: two)
        editor.select(LayoutTarget(.seat, 1))
        editor.setSeatId("a12345")
        #expect(editor.seat?.id == "123")
    }

    @Test("まだ直していなければ届いた配置を取り込み、直していればほかの端末で変わったと知らせる")
    func receive() {
        var editor = LayoutEditor(layout: defaultLayout)
        editor.receive(two)
        #expect(editor.draft == two && !editor.conflict)
        editor.select(LayoutTarget(.seat, 1))
        editor.remove()
        editor.receive(defaultLayout)
        #expect(editor.conflict && !editor.canSave(occupied: []))
        #expect(editor.status(occupied: []) == "ほかの端末で配置が変わりました。「最新を読み込む」を押してから直してください")
        editor.reload()
        #expect(editor.draft == defaultLayout && !editor.conflict && !editor.changed)
    }

    @Test("最初の配置に戻すと、読み込み時にあった卓だけもとの卓番を引き継ぐ")
    func resetToDefault() {
        var editor = LayoutEditor(layout: two)
        editor.resetToDefault()
        #expect(editor.draft == defaultLayout)
        let index = defaultLayout.seats.firstIndex { $0.id == "1" }!
        #expect(editor.isOccupied(index, occupied: ["1"]))
        let other = defaultLayout.seats.firstIndex { $0.id == "2" }!
        #expect(!editor.isOccupied(other, occupied: ["2"]))
    }
}
