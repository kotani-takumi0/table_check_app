import MinopalCore
import SwiftUI

// 配置図のマスの大きさ（No.149「余白とマス」）。15列×10行、縦向きでも回さない
struct FloorMetrics: Equatable {
    var cell: CGFloat
    var gap: CGFloat
    var padding: CGFloat
    var compact: Bool

    var width: CGFloat { CGFloat(Grid.cols) * cell + CGFloat(Grid.cols - 1) * gap }
    var height: CGFloat { CGFloat(Grid.rows) * cell + CGFloat(Grid.rows - 1) * gap }

    // iPhone：1マス 48pt・間 4pt・外側 16pt。横に入りきらない分は横スクロール
    static let phone = FloorMetrics(cell: 48, gap: 4, padding: 16, compact: true)

    // iPad：サイドバーを閉じると 56pt、開くと 48pt（間 8pt・外側 24pt）。
    // 縦向きや Split View で入らないときはマスを小さくし（44pt は切らない）、それでも入らなければスクロール
    static func pad(sidebarOpen: Bool, available: CGSize) -> FloorMetrics {
        let gap: CGFloat = 8, padding: CGFloat = 24
        let fitWidth = (available.width - padding * 2 - CGFloat(Grid.cols - 1) * gap) / CGFloat(Grid.cols)
        let fitHeight = (available.height - padding * 2 - CGFloat(Grid.rows - 1) * gap) / CGFloat(Grid.rows)
        let cell = max(Metrics.minTap, min(sidebarOpen ? 48 : 56, fitWidth, fitHeight)).rounded(.down)
        return FloorMetrics(cell: cell, gap: gap, padding: padding, compact: false)
    }
}

// 配置図：空きマスを薄い面で見せ、その上に目印（カウンターなど）と卓を置く。
// 卓を押すとご案内・詳細を、iPad は押した卓のそばのポップオーバー、iPhone（幅が狭いとき）は下からのシートで出す
struct FloorView: View {
    let state: ShopState
    let interaction: FloorInteraction
    let focus: Set<String>?      // 目立たせる卓（nil はすべてふつう）
    let metrics: FloorMetrics
    var promptMaxHeight: CGFloat = .infinity   // iPad のポップオーバーの高さの上限（配置図の見えている高さ）
    var ringed: Set<String> = []               // 通知で知らせた卓（赤い 3pt の輪で光らせる。No.159）
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var pressed: String?

    var body: some View {
        ZStack(alignment: .topLeading) {
            ForEach(emptyCells, id: \.key) { cell in
                RoundedRectangle(cornerRadius: 8)
                    .fill(Palette.cellbg)
                    .frame(width: metrics.cell, height: metrics.cell)
                    .offset(x: x(cell.col), y: y(cell.row))
            }
            ForEach(Array(state.layout.labels.enumerated()), id: \.offset) { _, label in
                RoundedRectangle(cornerRadius: 10)
                    .fill(Palette.area)
                    .overlay {
                        Text(label.text)
                            .minopalFont(metrics.compact ? 12 : 13, .bold, relativeTo: .footnote)
                            .foregroundStyle(Palette.ink2)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .padding(.horizontal, 4)
                    }
                    .frame(width: width(label.box), height: height(label.box))
                    .offset(x: x(label.box.col), y: y(label.box.row))
                    .accessibilityHidden(true)
            }
            // 「卓を見る」でスクロールする先（卓と同じ場所・大きさの見えない枠）
            ForEach(state.layout.seats, id: \.id) { seat in
                Color.clear
                    .frame(width: width(seat.box), height: height(seat.box))
                    .id(Self.anchor(seat.id))
                    .padding(.leading, x(seat.box.col))
                    .padding(.top, y(seat.box.row))
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
            ForEach(state.layout.seats, id: \.id) { seat in
                seatButton(seat)
                    .frame(width: width(seat.box), height: height(seat.box))
                    .offset(x: x(seat.box.col), y: y(seat.box.row))
            }
        }
        .frame(width: metrics.width, height: metrics.height, alignment: .topLeading)
        // ほかの端末で案内された・お客さんが消えたら、出していたものを閉じる。選んでいるお客さんが消えたら、選ぶのをやめる
        .onChange(of: promptLive) { if !promptLive { interaction.prompt = nil } }
        .onChange(of: pickLive) { if !pickLive { interaction.pick = nil } }
        // 詳細を開いているお客さんを、ほかの端末に知らせる（No.72）
        .onChange(of: interaction.openedSessionId(state: state), initial: true) { _, id in state.services.editing.setEditing(id) }
        .onDisappear {
            interaction.prompt = nil
            interaction.pick = nil
            state.services.editing.setEditing(nil)
        }
    }

    static func anchor(_ seatId: String) -> String { "seat-anchor-\(seatId)" }

    private var promptLive: Bool { interaction.prompt.map { interaction.isLive($0, state: state) } ?? true }
    private var pickLive: Bool { interaction.pick.map { state.visibleSession($0.sessionId) != nil } ?? true }

    // 卓：押すとご案内か詳細、長押しで詳細（退店済みの卓は、押すと次のお客さんのご案内）。
    // 卓の移動先・追加先を選んでいる間は、空席と退店済みの卓だけ押せる
    private func seatButton(_ seat: Seat) -> some View {
        let session = state.occupant(seat.id)
        let content = session.map { SeatCardContent(seat: seat, session: $0, settings: state.settings, now: state.now, editing: state.editingIds.contains($0.id)) }
        let disabled = interaction.pick != nil && !isPickable(session)
        let dimmed = disabled || (focus.map { !$0.contains(seat.id) } ?? false)
        let opened = interaction.prompt.map { $0.anchor == seat.id && interaction.isLive($0, state: state) } ?? false
        return SeatCardView(seat: seat, content: content, editing: session.map { state.editingIds.contains($0.id) } ?? false, compact: metrics.compact, cell: metrics.cell)
            .contentShape(RoundedRectangle(cornerRadius: 10))
            .scaleEffect(pressed == seat.id ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: pressed == seat.id)
            // 開いている卓は緑の 3pt の枠で囲む（ポップオーバーの矢印の代わり。No.149）
            .overlay {
                if opened {
                    RoundedRectangle(cornerRadius: 13).strokeBorder(Palette.keyText, lineWidth: 3).padding(-3).allowsHitTesting(false)
                } else if ringed.contains(seat.id) {
                    // 通知で知らせた卓：赤い 3pt の輪と外側のにじみ（Web の seat-flash と同じ色）
                    RoundedRectangle(cornerRadius: 13).strokeBorder(Palette.now, lineWidth: 3).padding(-3)
                        .shadow(color: Palette.now.opacity(0.45), radius: 8)
                        .allowsHitTesting(false)
                }
            }
            .animation(.easeOut(duration: 0.2), value: ringed.contains(seat.id))
            .onTapGesture { interaction.tap(seat, session, state: state) }
            .onLongPressGesture(minimumDuration: 0.6) {
                interaction.longPress(seat, session)
            } onPressingChanged: { pressing in
                pressed = pressing ? seat.id : nil
            }
            .allowsHitTesting(!disabled)
            .opacity(dimmed ? 0.3 : 1)
            .popover(isPresented: presented(seat.id)) {
                if let prompt = interaction.prompt {
                    FloorPromptView(state: state, interaction: interaction, prompt: prompt, sheet: sizeClass != .regular, maxHeight: promptMaxHeight)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityAddTraits(.isButton)
            .accessibilityIdentifier("table-\(seat.id)")
            .accessibilityLabel(content?.accessibilityLabel ?? "\(seat.id)番 ご案内")
            .accessibilityValue(session.map { displayOf($0.status, course: $0.course).label } ?? "空席")
            .accessibilityHint(session == nil ? "押すとご案内" : session?.status == .exited ? "押すとご案内、長押しで詳細" : "押すと詳細")
            .accessibilityAction { interaction.tap(seat, session, state: state) }
            .accessibilityActions {
                if session?.status == .exited {
                    Button("詳細を開く") { interaction.longPress(seat, session) }
                }
            }
            .disabled(disabled)
    }

    // この卓のそばに出しているか。閉じたら（外を押す・下に引く）出していたものを消す
    private func presented(_ seatId: String) -> Binding<Bool> {
        Binding {
            interaction.prompt.map { $0.anchor == seatId && interaction.isLive($0, state: state) } ?? false
        } set: { shown in
            if !shown, interaction.prompt?.anchor == seatId { interaction.prompt = nil }
        }
    }

    // 卓・目印に重なっていないマス
    private var emptyCells: [Cell] {
        let boxes = state.layout.seats.map(\.box) + state.layout.labels.map(\.box)
        return (1...Grid.rows).flatMap { row in
            (1...Grid.cols).compactMap { col in
                boxes.contains { col >= $0.col && col < $0.col + $0.colSpan && row >= $0.row && row < $0.row + $0.rowSpan } ? nil : Cell(col: col, row: row)
            }
        }
    }

    private func x(_ col: Int) -> CGFloat { CGFloat(col - 1) * (metrics.cell + metrics.gap) }
    private func y(_ row: Int) -> CGFloat { CGFloat(row - 1) * (metrics.cell + metrics.gap) }
    private func width(_ box: GridBox) -> CGFloat { CGFloat(box.colSpan) * metrics.cell + CGFloat(box.colSpan - 1) * metrics.gap }
    private func height(_ box: GridBox) -> CGFloat { CGFloat(box.rowSpan) * metrics.cell + CGFloat(box.rowSpan - 1) * metrics.gap }
}

private extension Cell {
    var key: String { "\(col)-\(row)" }
}

// ご案内か詳細。出しているお客さんが消えたら何も出さない（すぐに閉じる）
private struct FloorPromptView: View {
    let state: ShopState
    let interaction: FloorInteraction
    let prompt: FloorPrompt
    let sheet: Bool
    let maxHeight: CGFloat

    var body: some View {
        switch prompt {
        case .seating(let tableId):
            SeatingView(state: state, tableId: tableId, sheet: sheet, maxHeight: maxHeight) { interaction.prompt = nil }
                .id(prompt)
        case .detail(let sessionId, let from):
            if let session = state.visibleSession(sessionId) {
                SeatDetailView(state: state, session: session, from: session.tableIds.contains(from) ? from : session.tableIds[0],
                               sheet: sheet, maxHeight: maxHeight, interaction: interaction) { interaction.prompt = nil }
                    .id(prompt)
            }
        }
    }
}
