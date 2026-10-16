import Foundation

// 席の配置を作り直す画面の中身（packages/core/src/useLayoutEditor.ts。React の state を、値の型と mutating の関数にした）。
// 見た目と、ドラッグ・保存の待ち合わせは画面の側（Minopal/Screens/Editors/LayoutEditorView.swift）

// 並べるブロック（LAYOUT_BLOCKS）。選んでからマス目の空いているところを押すと置く。大きさはあとで幅・高さを変えられる
public enum LayoutBlockKind: Sendable { case table, counter, label }
public struct LayoutBlock: Sendable {
    public let key: String
    public let name: String
    public let kind: LayoutBlockKind
    public let colSpan: Int
    public let rowSpan: Int
}
public let layoutBlocks = [
    LayoutBlock(key: "big", name: "大きいテーブル", kind: .table, colSpan: 3, rowSpan: 2),
    LayoutBlock(key: "long", name: "細長いテーブル", kind: .table, colSpan: 3, rowSpan: 1),
    LayoutBlock(key: "small", name: "小さいテーブル", kind: .table, colSpan: 1, rowSpan: 1),
    LayoutBlock(key: "counter", name: "カウンター席", kind: .counter, colSpan: 1, rowSpan: 1),
    LayoutBlock(key: "label", name: "目印（入口・キッチンなど）", kind: .label, colSpan: 2, rowSpan: 1),
]

// 直すものとして選んだ卓・目印（LayoutSelected）
public struct LayoutTarget: Hashable, Sendable {
    public enum Kind: Sendable { case seat, label }
    public var kind: Kind
    public var index: Int
    public init(_ kind: Kind, _ index: Int) {
        self.kind = kind
        self.index = index
    }
}

// 下書きを直して「保存して使う」で全端末に反映する。
// お客さんがいる卓（occupied）は、案内の記録とずれないよう卓番を変えたり消したりできない
public struct LayoutEditor: Sendable {
    public private(set) var draft: ShopLayout
    // 読み込んだ配置と卓番を残し、入力途中の番号に編集制限を引きずらせない
    public private(set) var baseline: ShopLayout
    // いちばん新しく届いた配置（TS の layout）
    public private(set) var latest: ShopLayout
    private var origIds: [String?]
    public private(set) var dirty = false
    public var block: String? = "big"
    public private(set) var selected: LayoutTarget?
    public private(set) var message = ""

    public init(layout: ShopLayout) {
        draft = layout
        baseline = layout
        latest = layout
        origIds = layout.seats.map(\.id)
    }

    var layoutChanged: Bool { latest != baseline }
    public var conflict: Bool { dirty && layoutChanged }
    public var changed: Bool { draft != baseline }
    public var seat: Seat? { selected?.kind == .seat ? draft.seats[selected!.index] : nil }
    public var label: LayoutLabel? { selected?.kind == .label ? draft.labels[selected!.index] : nil }
    // 選んでいる卓・目印の場所と大きさ
    public var selectedBox: GridBox? { seat?.box ?? label?.box }

    // 配置が届いた。まだ直していなければ（初回の遅れた読み込みも）そのまま取り込む
    public mutating func receive(_ layout: ShopLayout) {
        latest = layout
        if !dirty && layoutChanged { adopt(layout) }
    }
    // 最新を読み込む（ほかの端末で配置が変わったとき）
    public mutating func reload() {
        adopt(latest)
        dirty = false
    }
    private mutating func adopt(_ layout: ShopLayout) {
        draft = layout
        baseline = layout
        origIds = layout.seats.map(\.id)
        selected = nil
        message = ""
    }

    // 読み込み後にお客さんが入った場合も、もとの卓を消したり改番していれば保存させない
    public func problems(occupied: Set<String>) -> [String] {
        let kept = occupied.sorted().filter { id in
            !draft.seats.contains { $0.id == id }
                || (baseline.seats.contains { $0.id == id } && !draft.seats.indices.contains { origIds[$0] == id && draft.seats[$0].id == id })
        }
        return layoutProblems(draft) + kept.map { "\($0)番はお客さんがいるので残してください" }
    }
    public func status(occupied: Set<String>) -> String {
        if conflict { return "ほかの端末で配置が変わりました。「最新を読み込む」を押してから直してください" }
        if !message.isEmpty { return message }
        let problems = problems(occupied: occupied)
        if !problems.isEmpty { return "直すところ：\(problems.joined(separator: "／"))" }
        return changed ? "保存すると、すべての端末の配置が変わります" : ""
    }
    // 保存できるか（保存している途中かは画面の側で見る）
    public func canSave(occupied: Set<String>) -> Bool {
        changed && problems(occupied: occupied).isEmpty && !layoutChanged
    }
    // 打ち換え途中にほかの使用中の番号になっても、もとの卓が空席なら直し続けられる
    public func locked(occupied: Set<String>) -> Bool {
        guard let selected, selected.kind == .seat, let id = origIds[selected.index] else { return false }
        return occupied.contains(id)
    }
    // お客さんがいる卓（もとの卓番で見る）。マス目で色を変える
    public func isOccupied(_ index: Int, occupied: Set<String>) -> Bool {
        origIds[index].map(occupied.contains) ?? false
    }

    // ほかの卓・目印と重ならず、マス目に収まるか（動かす・大きさを変えるものは自分を除いて調べる）
    private func free(_ box: GridBox, except: LayoutTarget? = nil) -> Bool {
        box.col >= 1 && box.row >= 1 && box.col + box.colSpan - 1 <= Grid.cols && box.row + box.rowSpan - 1 <= Grid.rows
            && draft.seats.indices.allSatisfy { i in except == LayoutTarget(.seat, i) || !overlaps(box, draft.seats[i].box) }
            && draft.labels.indices.allSatisfy { i in except == LayoutTarget(.label, i) || !overlaps(box, draft.labels[i].box) }
    }
    private mutating func setBox(_ target: LayoutTarget, _ box: GridBox) {
        dirty = true
        switch target.kind {
        case .seat: draft.seats[target.index].box = box
        case .label: draft.labels[target.index].box = box
        }
    }

    // 空いているマスを押した：選んでいる卓・目印があればそこへ動かし、無ければ選んでいるブロックを置く
    public mutating func pressCell(col: Int, row: Int) {
        message = ""
        if let selected, var box = selectedBox {
            box.col = col
            box.row = row
            guard free(box, except: selected) else {
                message = "そこには入りません（ほかの卓に重なるか、はみ出します）"
                return
            }
            setBox(selected, box)
            return
        }
        guard let chosen = layoutBlocks.first(where: { $0.key == block }) else { return }
        let box = GridBox(col: col, colSpan: chosen.colSpan, row: row, rowSpan: chosen.rowSpan)
        guard free(box) else {
            message = "そこには入りません。空いているところを押すか、小さいブロックを選んでください"
            return
        }
        dirty = true
        switch chosen.kind {
        case .label:
            // 目印（No.128）はまず入口として置き、種類はあとで選ぶ
            draft.labels.append(LayoutLabel(kind: .entrance, text: landmarkName(.entrance)!, col: col, colSpan: box.colSpan, row: row, rowSpan: box.rowSpan))
            selected = LayoutTarget(.label, draft.labels.count - 1)
        case .table, .counter:
            let kind: SeatKind = chosen.kind == .counter ? .counter : .table
            draft.seats.append(Seat(id: nextSeatId(draft, kind), kind: kind, col: col, colSpan: box.colSpan, row: row, rowSpan: box.rowSpan))
            origIds.append(nil)
            selected = LayoutTarget(.seat, draft.seats.count - 1)
        }
    }
    // 置いた卓・目印を押した：直すものとして選ぶ（nil で直し終わる）
    public mutating func select(_ target: LayoutTarget?) {
        message = ""
        selected = target
    }
    // 大きさを変える（幅・高さをマス1つずつ）。入らなければ変えない
    public mutating func resize(dCol: Int, dRow: Int) {
        guard let selected, var box = selectedBox else { return }
        box.colSpan += dCol
        box.rowSpan += dRow
        guard box.colSpan >= 1 && box.rowSpan >= 1 else { return }
        guard free(box, except: selected) else {
            message = "その大きさにすると、ほかの卓に重なるか、はみ出します"
            return
        }
        message = ""
        setBox(selected, box)
    }
    // ドラッグ（No.93）：つかんだ卓・目印を、その場所・大きさに置けるか（ドラッグ中の影の色に使う）
    public func canPlace(_ target: LayoutTarget, _ box: GridBox) -> Bool { free(box, except: target) }
    // 指を離したところに置き、直すものとして選ぶ。置けなければ動かさず、理由を出す
    public mutating func placeAt(_ target: LayoutTarget, _ box: GridBox) {
        selected = target
        guard free(box, except: target) else {
            message = "そこには入りません（ほかの卓に重なるか、はみ出します）"
            return
        }
        message = ""
        setBox(target, box)
    }
    public mutating func remove() {
        guard let selected else { return }
        dirty = true
        switch selected.kind {
        case .seat:
            draft.seats.remove(at: selected.index)
            origIds.remove(at: selected.index)
        case .label:
            draft.labels.remove(at: selected.index)
        }
        self.selected = nil
    }
    // 卓番は数字だけ・3けたまで
    public mutating func setSeatId(_ text: String) {
        guard let selected, selected.kind == .seat else { return }
        dirty = true
        draft.seats[selected.index].id = String(text.filter { ("0"..."9").contains($0) }.prefix(3))
    }
    public mutating func setSeatKind(_ kind: SeatKind) {
        guard let selected, selected.kind == .seat else { return }
        dirty = true
        draft.seats[selected.index].kind = kind
    }
    public mutating func setLabelText(_ text: String) {
        guard let selected, selected.kind == .label else { return }
        dirty = true
        draft.labels[selected.index].text = text
    }
    // 目印の種類（No.128）。用意した種類は名前もその種類の名前にし、店が足す目印（custom）は名前を入れてもらう（用意した種類から変えたら空にする）
    public mutating func setLabelKind(_ kind: LandmarkKind) {
        guard let selected, selected.kind == .label, let label else { return }
        dirty = true
        draft.labels[selected.index].kind = kind
        draft.labels[selected.index].text = landmarkName(kind) ?? (label.kind == .custom ? label.text : "")
    }
    public mutating func resetToDefault() {
        draft = defaultLayout
        // 最初の配置に戻す操作も編集。読み込み時に存在した卓だけ、もとの卓番を引き継ぐ
        origIds = defaultLayout.seats.map { seat in baseline.seats.contains { $0.id == seat.id } ? seat.id : nil }
        dirty = true
        selected = nil
    }
    // 保存できなかった。下書きを残して、理由を出す
    public mutating func saveFailed(_ reason: String) {
        message = "保存できませんでした。もう一度押してください（\(reason)）"
    }
}
