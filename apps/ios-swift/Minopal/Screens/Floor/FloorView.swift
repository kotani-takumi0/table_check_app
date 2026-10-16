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

// 配置図：空きマスを薄い面で見せ、その上に目印（カウンターなど）と卓を置く
struct FloorView: View {
    let layout: ShopLayout
    let sessions: [Session]
    let settings: ShopSettings
    let now: Int
    let editingIds: Set<String>
    let focus: Set<String>?      // 目立たせる卓（nil はすべてふつう）
    let metrics: FloorMetrics
    let onTap: (Seat, Session?) -> Void

    var body: some View {
        ZStack(alignment: .topLeading) {
            ForEach(emptyCells, id: \.key) { cell in
                RoundedRectangle(cornerRadius: 8)
                    .fill(Palette.cellbg)
                    .frame(width: metrics.cell, height: metrics.cell)
                    .offset(x: x(cell.col), y: y(cell.row))
            }
            ForEach(Array(layout.labels.enumerated()), id: \.offset) { _, label in
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
            ForEach(layout.seats, id: \.id) { seat in
                seatButton(seat)
                    .frame(width: width(seat.box), height: height(seat.box))
                    .offset(x: x(seat.box.col), y: y(seat.box.row))
            }
        }
        .frame(width: metrics.width, height: metrics.height, alignment: .topLeading)
    }

    private func seatButton(_ seat: Seat) -> some View {
        let session = occupantOf(sessions, tableId: seat.id, now: now, rules: settings.rules)
        let content = session.map { SeatCardContent(seat: seat, session: $0, settings: settings, now: now, editing: editingIds.contains($0.id)) }
        let dimmed = focus.map { !$0.contains(seat.id) } ?? false
        return Button { onTap(seat, session) } label: {
            SeatCardView(seat: seat, content: content, editing: session.map { editingIds.contains($0.id) } ?? false, compact: metrics.compact, cell: metrics.cell)
                .contentShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(SeatButtonStyle())
        .opacity(dimmed ? 0.3 : 1)
        .accessibilityIdentifier("table-\(seat.id)")
        .accessibilityLabel(content?.accessibilityLabel ?? "\(seat.id)番 ご案内")
        .accessibilityValue(session.map { displayOf($0.status, course: $0.course).label } ?? "空席")
    }

    // 卓・目印に重なっていないマス
    private var emptyCells: [Cell] {
        let boxes = layout.seats.map(\.box) + layout.labels.map(\.box)
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

// 押している間は少し縮めて、押したことが分かるようにする
private struct SeatButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
