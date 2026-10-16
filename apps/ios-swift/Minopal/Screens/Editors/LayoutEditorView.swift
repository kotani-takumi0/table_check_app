import MinopalCore
import SwiftUI

// 席の配置を作り直す画面（No.161。今の iOS 版・Web の LayoutEditor と同じ中身。中身は MinopalCore の LayoutEditor）。
// マス目は向きを変えても横向き（15列×10行）のまま。広い横向きは左にブロック、縦向き・iPhone は上にブロックを出す。
// onClose が nil なら奥に進んだ画面として戻る。最初のページの「自分で作る」も、この画面で何もないマス目から作る
struct LayoutEditorView: View {
    let layout: ShopLayout                // いちばん新しく届いた配置
    let occupied: Set<String>             // お客さんがいる卓
    let onSave: @MainActor (ShopLayout) async throws -> Void
    var onClose: (() -> Void)?
    @State private var editor: LayoutEditor
    @State private var saving = false
    @State private var dragging = false
    @Environment(\.dismiss) private var dismiss

    init(layout: ShopLayout, occupied: Set<String>, onSave: @escaping @MainActor (ShopLayout) async throws -> Void, onClose: (() -> Void)? = nil) {
        self.layout = layout
        self.occupied = occupied
        self.onSave = onSave
        self.onClose = onClose
        _editor = State(initialValue: LayoutEditor(layout: layout))
    }

    // ブロックの面の幅（横に並べるとき）
    private static let sideWidth: CGFloat = 280

    var body: some View {
        GeometryReader { proxy in
            let stacked = proxy.size.width < 700 || proxy.size.width < proxy.size.height
            let content = proxy.size.width - 32
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("\(stacked ? "上" : "左")のブロックを選んでマス目を押すと置けます。置いた卓はつかんで動かせます。押すと、卓番・種類・大きさを変えられます。")
                        .minopalFont(13, relativeTo: .footnote)
                        .foregroundStyle(Palette.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                    if stacked {
                        panel(stacked: true)
                        LayoutGrid(editor: $editor, occupied: occupied, width: content - 16, dragging: $dragging)
                    } else {
                        HStack(alignment: .top, spacing: 12) {
                            panel(stacked: false).frame(width: Self.sideWidth)
                            LayoutGrid(editor: $editor, occupied: occupied, width: content - Self.sideWidth - 12 - 16, dragging: $dragging)
                        }
                    }
                    EditorStatus(text: editor.status(occupied: occupied))
                    footer
                }
                .padding(16)
            }
            // 卓をつかんでいる間は、画面のスクロールを止める（スクロールにドラッグを取られないように）
            .scrollDisabled(dragging)
            .scrollDismissesKeyboard(.interactively)
        }
        .background(Palette.tile)
        .navigationTitle(onClose == nil ? "席の配置" : "")
        .onChange(of: layout) { editor.receive(layout) }
        .modifier(EditorToolbar(changed: editor.changed, canSave: editor.canSave(occupied: occupied) && !saving, saving: saving,
                                showsBack: onClose == nil, onSave: save, onBack: close))
    }

    private var footer: some View {
        HStack(spacing: 8) {
            if editor.conflict {
                Button("最新を読み込む") {
                    Haptics.select()
                    editor.reload()
                }
                .buttonStyle(SecondaryButtonStyle(height: Metrics.minTap))
            }
            Button("最初の配置に戻す") {
                Haptics.select()
                editor.resetToDefault()
            }
            .buttonStyle(SecondaryButtonStyle(height: Metrics.minTap))
        }
        .disabled(saving)
    }

    // ブロックを選ぶ面。卓・目印を選んでいる間は、それを直す面にする
    private func panel(stacked: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if editor.selected == nil {
                heading("ブロック")
                blocks(stacked: stacked)
            } else {
                LayoutTargetForm(editor: $editor, occupied: occupied)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.page, in: RoundedRectangle(cornerRadius: Metrics.loginPanelRadius))
        .overlay(RoundedRectangle(cornerRadius: Metrics.loginPanelRadius).strokeBorder(Palette.line, lineWidth: 1))
    }

    private func blocks(stacked: Bool) -> some View {
        let columns = stacked ? [GridItem(.adaptive(minimum: 150), spacing: 6)] : [GridItem(.flexible())]
        return LazyVGrid(columns: columns, alignment: .leading, spacing: 6) {
            ForEach(layoutBlocks, id: \.key) { block in
                let checked = editor.block == block.key
                Button {
                    Haptics.select()
                    editor.block = block.key
                } label: {
                    HStack(spacing: 10) {
                        BlockShape(kind: block.kind)
                            .frame(width: CGFloat(block.colSpan) * 12, height: CGFloat(block.rowSpan) * 12)
                            .frame(width: 40)
                        Text(block.name)
                            .minopalFont(14, checked ? .bold : .regular, relativeTo: .subheadline)
                            .foregroundStyle(Palette.ink)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 10)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(checked ? Palette.keyWash : Palette.tile, in: RoundedRectangle(cornerRadius: Metrics.groupRadius))
                    .overlay(RoundedRectangle(cornerRadius: Metrics.groupRadius).strokeBorder(checked ? Palette.keyText : .clear, lineWidth: 2))
                    .contentShape(RoundedRectangle(cornerRadius: Metrics.groupRadius))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(checked ? .isSelected : [])
                .accessibilityIdentifier("layout-block-\(block.key)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("置くブロック")
    }

    private func save() {
        saving = true
        Task {
            do {
                try await onSave(editor.draft)
                Haptics.success()
                close()
            } catch {
                Haptics.warning()
                editor.saveFailed(error.localizedDescription)
            }
            saving = false
        }
    }

    private func close() {
        if let onClose { onClose() } else { dismiss() }
    }
}

@MainActor private func heading(_ text: String) -> some View {
    Text(text)
        .minopalFont(14, .bold, relativeTo: .subheadline)
        .foregroundStyle(Palette.ink2)
        .accessibilityAddTraits(.isHeader)
}

// ブロックの形：テーブルは角丸の四角、カウンター席は丸、目印は点線
private struct BlockShape: View {
    let kind: LayoutBlockKind

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: kind == .counter ? 99 : 4)
        shape.fill(kind == .label ? Color.clear : Palette.page)
            .overlay(shape.strokeBorder(Palette.edge, style: StrokeStyle(lineWidth: 1.5, dash: kind == .label ? [3, 2] : [])))
    }
}

// 選んだ卓・目印を直す：卓番・種類・名前・幅と高さ、直し終わる・消す
private struct LayoutTargetForm: View {
    @Binding var editor: LayoutEditor
    let occupied: Set<String>

    var body: some View {
        let locked = editor.locked(occupied: occupied)
        VStack(alignment: .leading, spacing: 10) {
            if let seat = editor.seat {
                heading("\(seat.id)番を直す")
                field("卓番") {
                    TextField("", text: Binding(get: { editor.seat?.id ?? "" }, set: { editor.setSeatId($0) }))
                        .keyboardType(.numberPad)
                        .disabled(locked)
                        .opacity(locked ? 0.5 : 1)
                        .accessibilityLabel("卓番")
                }
                Picker("種類", selection: Binding(get: { editor.seat?.kind ?? .table }, set: { editor.setSeatKind($0) })) {
                    Text("テーブル").tag(SeatKind.table)
                    Text("カウンター席").tag(SeatKind.counter)
                }
                .pickerStyle(.segmented)
                .frame(minHeight: Metrics.minTap)
                if locked {
                    note("お客さんがいる卓なので、卓番を変えたり消したりできません（動かす・大きさを変えるのはできます）")
                }
            }
            if let label = editor.label {
                heading("目印「\(label.text)」を直す")
                HStack(spacing: 14) {
                    fieldName("種類")
                    Picker("種類", selection: Binding(get: { editor.label?.kind ?? .custom }, set: { editor.setLabelKind($0) })) {
                        ForEach(landmarkKinds, id: \.kind) { item in Text(item.name).tag(item.kind) }
                        Text("そのほか（名前を入れる）").tag(LandmarkKind.custom)
                    }
                    .pickerStyle(.menu)
                    .tint(Palette.ink)
                    Spacer(minLength: 0)
                }
                .frame(minHeight: Metrics.minTap)
                if label.kind == .custom {
                    field("名前") {
                        TextField("例：喫煙所・階段", text: Binding(get: { editor.label?.text ?? "" },
                                                                 set: { editor.setLabelText(limitedText($0, labelMaxLength)) }))
                            .accessibilityLabel("目印の名前")
                    }
                }
            }
            if let box = editor.selectedBox {
                sizeRow("幅", box.colSpan, less: { editor.resize(dCol: -1, dRow: 0) }, more: { editor.resize(dCol: 1, dRow: 0) })
                sizeRow("高さ", box.rowSpan, less: { editor.resize(dCol: 0, dRow: -1) }, more: { editor.resize(dCol: 0, dRow: 1) })
            }
            note("動かすときは、つかんで動かすか、マス目の空いているところを押します。右下の丸をつかむと大きさを変えられます。")
            HStack(spacing: 8) {
                Button("直し終わる") {
                    Haptics.select()
                    editor.select(nil)
                }
                .buttonStyle(SecondaryButtonStyle(height: Metrics.minTap))
                Button("消す") {
                    Haptics.warning()
                    editor.remove()
                }
                .buttonStyle(DangerButtonStyle())
                .disabled(locked)
            }
        }
    }

    private func field(_ name: String, @ViewBuilder input: () -> some View) -> some View {
        HStack(spacing: 14) {
            fieldName(name)
            input()
                .minopalFont(16, relativeTo: .callout)
                .foregroundStyle(Palette.ink)
                .tint(Palette.keyText)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, minHeight: Metrics.field)
                .background(Palette.tile, in: RoundedRectangle(cornerRadius: Metrics.fieldRadius))
                .overlay(RoundedRectangle(cornerRadius: Metrics.fieldRadius).strokeBorder(Palette.edge, lineWidth: 1))
        }
    }

    private func fieldName(_ name: String) -> some View {
        Text(name)
            .minopalFont(15, .bold, relativeTo: .subheadline)
            .foregroundStyle(Palette.ink)
            .frame(width: 56, alignment: .leading)
    }

    private func note(_ text: String) -> some View {
        Text(text)
            .minopalFont(13, relativeTo: .footnote)
            .foregroundStyle(Palette.ink2)
            .fixedSize(horizontal: false, vertical: true)
    }

    // 幅・高さをマス1つずつ変える（No.75：テーブルの大きさを大きく・小さくできるように）
    private func sizeRow(_ name: String, _ value: Int, less: @escaping () -> Void, more: @escaping () -> Void) -> some View {
        HStack(spacing: 8) {
            fieldName(name)
            sizeButton("minus", "\(name)を狭く", less)
            Text("\(value)マス")
                .minopalFont(15, .bold, relativeTo: .subheadline, digits: true)
                .foregroundStyle(Palette.ink)
                .frame(maxWidth: .infinity)
                .accessibilityLabel("\(name) \(value)マス")
            sizeButton("plus", "\(name)を広く", more)
        }
    }

    private func sizeButton(_ symbol: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button {
            Haptics.select()
            action()
        } label: {
            Image(systemName: symbol).font(.body.weight(.semibold))
        }
        .buttonStyle(SecondaryButtonStyle(height: Metrics.minTap))
        .frame(width: 56)
        .accessibilityLabel(label)
    }
}

// 赤い文字の操作のボタン（消す）
struct DangerButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .minopalFont(17, .bold, relativeTo: .headline)
            .foregroundStyle(Palette.nowInk)
            .frame(maxWidth: .infinity, minHeight: Metrics.minTap)
            .padding(.horizontal, 16)
            .background(configuration.isPressed ? Palette.nowWash : Palette.page, in: RoundedRectangle(cornerRadius: Metrics.groupRadius))
            .overlay(RoundedRectangle(cornerRadius: Metrics.groupRadius).strokeBorder(Palette.nowLine, lineWidth: 1))
            .opacity(enabled ? 1 : 0.4)
            .contentShape(RoundedRectangle(cornerRadius: Metrics.groupRadius))
    }
}

// マス目（15列×10行）と、置いた卓・目印。卓・目印はつかんで動かし、選んでいるものは右下のつまみで大きさを変える（No.93）。
// 指を離すまでは下書きを変えず、行き先を影で見せる（置けない場所は赤）。少ししか動かさなければ、押して選ぶ
private struct LayoutGrid: View {
    @Binding var editor: LayoutEditor
    let occupied: Set<String>
    let width: CGFloat
    @Binding var dragging: Bool
    @GestureState private var live: LiveDrag?

    private static let gap: CGFloat = 4
    // 大きさを変えるつまみの、指で押せる大きさ
    private static let handle: CGFloat = 36
    private static let space = "layout-grid"
    private var cell: CGFloat { max(1, (width - Self.gap * CGFloat(Grid.cols - 1)) / CGFloat(Grid.cols)) }
    private var height: CGFloat { CGFloat(Grid.rows) * cell + CGFloat(Grid.rows - 1) * Self.gap }

    // つかんでいる間の行き先（指を離すか、ほかに取られたら消える）
    private struct LiveDrag: Equatable {
        var target: LayoutTarget
        var box: GridBox
        var moved: Bool
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            ForEach(1...Grid.rows, id: \.self) { row in
                ForEach(1...Grid.cols, id: \.self) { col in cellButton(col: col, row: row) }
            }
            ForEach(Array(editor.draft.labels.enumerated()), id: \.offset) { i, label in labelView(i, label) }
            ForEach(Array(editor.draft.seats.enumerated()), id: \.offset) { i, seat in seatView(i, seat) }
            handle
            ghost
        }
        .frame(width: max(0, width), height: height, alignment: .topLeading)
        .coordinateSpace(.named(Self.space))
        .padding(8)
        .background(Palette.page, in: RoundedRectangle(cornerRadius: Metrics.loginPanelRadius))
        .overlay(RoundedRectangle(cornerRadius: Metrics.loginPanelRadius).strokeBorder(Palette.line, lineWidth: 1))
        .onChange(of: live != nil) { dragging = live != nil }
    }

    private func rect(_ box: GridBox) -> CGRect {
        CGRect(x: CGFloat(box.col - 1) * (cell + Self.gap), y: CGFloat(box.row - 1) * (cell + Self.gap),
               width: CGFloat(box.colSpan) * cell + CGFloat(box.colSpan - 1) * Self.gap,
               height: CGFloat(box.rowSpan) * cell + CGFloat(box.rowSpan - 1) * Self.gap)
    }

    private func cellButton(col: Int, row: Int) -> some View {
        let frame = rect(GridBox(col: col, colSpan: 1, row: row, rowSpan: 1))
        return Button {
            Haptics.select()
            editor.pressCell(col: col, row: row)
        } label: {
            Color.clear
        }
        .buttonStyle(CellStyle())
        .frame(width: frame.width, height: frame.height)
        .offset(x: frame.minX, y: frame.minY)
        .accessibilityLabel("\(row)行\(col)列（\(editor.selected == nil ? "ここに置く" : "ここへ動かす")）")
        .accessibilityIdentifier("layout-cell-\(col)-\(row)")
    }

    private func seatView(_ i: Int, _ seat: Seat) -> some View {
        let target = LayoutTarget(.seat, i)
        let frame = rect(seat.box)
        let shape = RoundedRectangle(cornerRadius: seat.kind == .counter ? min(frame.width, frame.height) / 2 : 8)
        let current = editor.selected == target
        return Text(seat.id)
            .minopalFont(cell < 30 ? 11 : 17, .bold, relativeTo: .body, digits: true)
            .foregroundStyle(Palette.ink)
            .lineLimit(1)
            .fixedSize()
            .frame(width: frame.width, height: frame.height)
            .background(editor.isOccupied(i, occupied: occupied) ? Palette.keyWash : Palette.page, in: shape)
            .overlay(shape.strokeBorder(current ? Palette.keyText : Palette.edge, lineWidth: current ? 3 : 1.5))
            .opacity(live?.target == target && live?.moved == true ? 0.35 : 1)
            .contentShape(shape)
            .gesture(drag(target, seat.box, .move))
            .offset(x: frame.minX, y: frame.minY)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(seat.id)番 \(seat.kind == .table ? "テーブル" : "カウンター席")（押すと直す）")
            .accessibilityAddTraits(current ? [.isButton, .isSelected] : .isButton)
            .accessibilityAction { select(target) }
            .accessibilityIdentifier("layout-seat-\(seat.id)")
    }

    private func labelView(_ i: Int, _ label: LayoutLabel) -> some View {
        let target = LayoutTarget(.label, i)
        let frame = rect(label.box)
        let shape = RoundedRectangle(cornerRadius: 8)
        let current = editor.selected == target
        return Text(label.text)
            .minopalFont(cell < 30 ? 11 : 14, relativeTo: .footnote)
            .foregroundStyle(Palette.ink2)
            .lineLimit(1)
            .padding(.horizontal, 2)
            .frame(width: frame.width, height: frame.height)
            .background(Palette.area.opacity(0.5), in: shape)
            .overlay(shape.strokeBorder(current ? Palette.keyText : Palette.dash, style: StrokeStyle(lineWidth: current ? 3 : 1.5, dash: current ? [] : [4, 3])))
            .opacity(live?.target == target && live?.moved == true ? 0.35 : 1)
            .contentShape(shape)
            .gesture(drag(target, label.box, .move))
            .offset(x: frame.minX, y: frame.minY)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("目印「\(label.text)」（押すと直す）")
            .accessibilityAddTraits(current ? [.isButton, .isSelected] : .isButton)
            .accessibilityAction { select(target) }
            .accessibilityIdentifier("layout-label-\(i)")
    }

    // 大きさを変えるつまみ：選んでいる卓・目印の右下の角（読み上げでは幅・高さの −／＋ を使う）。つかんでいる間も消さずに透明にする
    @ViewBuilder private var handle: some View {
        if let selected = editor.selected, let box = editor.selectedBox {
            let frame = rect(box)
            Circle()
                .fill(Palette.keyText)
                .overlay(Circle().strokeBorder(Palette.page, lineWidth: 3))
                .frame(width: 22, height: 22)
                .frame(width: Self.handle, height: Self.handle)
                .contentShape(Rectangle())
                .opacity(live?.moved == true ? 0 : 1)
                .gesture(drag(selected, box, .resize))
                .offset(x: frame.maxX - Self.handle / 2, y: frame.maxY - Self.handle / 2)
                .accessibilityHidden(true)
        }
    }

    // ドラッグ中の行き先の影（置けない場所は赤）
    @ViewBuilder private var ghost: some View {
        if let live, live.moved {
            let frame = rect(live.box)
            let ok = editor.canPlace(live.target, live.box)
            let shape = RoundedRectangle(cornerRadius: 8)
            shape.fill((ok ? Palette.keyText : Palette.now).opacity(0.18))
                .overlay(shape.strokeBorder(ok ? Palette.keyText : Palette.now, style: StrokeStyle(lineWidth: 2, dash: [5, 3])))
                .frame(width: frame.width, height: frame.height)
                .offset(x: frame.minX, y: frame.minY)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }

    private func cellOf(_ point: CGPoint) -> Cell {
        cellAt(x: point.x, y: point.y, width: width, height: height, gap: Self.gap)
    }

    private func drag(_ target: LayoutTarget, _ item: GridBox, _ kind: DragKind) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.space))
            .updating($live) { value, state, _ in
                let moved = hypot(value.translation.width, value.translation.height) >= dragThreshold
                state = LiveDrag(target: target, box: dragBox(kind, item, start: cellOf(value.startLocation), current: cellOf(value.location)), moved: moved)
            }
            .onEnded { value in
                // 少ししか動かさなければ、押して選んだことにする
                guard hypot(value.translation.width, value.translation.height) >= dragThreshold else {
                    if kind == .move { select(target) }
                    return
                }
                let box = dragBox(kind, item, start: cellOf(value.startLocation), current: cellOf(value.location))
                if box == item {
                    editor.select(target)
                    return
                }
                if editor.canPlace(target, box) { Haptics.success() } else { Haptics.warning() }
                editor.placeAt(target, box)
            }
    }

    private func select(_ target: LayoutTarget) {
        Haptics.select()
        editor.select(target)
    }
}

// 空いているマス：点線の角丸。押している間は淡い緑
private struct CellStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: 6)
        shape.fill(configuration.isPressed ? Palette.keyWash : Palette.cellbg.opacity(0.4))
            .overlay(shape.strokeBorder(Palette.line, style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
            .contentShape(shape)
    }
}
