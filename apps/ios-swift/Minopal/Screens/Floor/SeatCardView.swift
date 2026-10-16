import MinopalCore
import SwiftUI

// 卓カード（No.149 の確定画像 ipad_floor_*_lg・iphone_floor_*_lg）。
// テーブル卓：上に卓番と人数、2行目に区分（iPad だけ）、真ん中に大きな経過、物差し、下の帯に段階と残り時間（iPad だけ）。
// カウンター：卓番・経過・細い物差し。急ぎのときは「お通し」「L.O.」の文字と下の色の線（色だけで伝えない）
struct SeatCardView: View {
    let seat: Seat
    let content: SeatCardContent?   // nil は空席
    let editing: Bool
    let compact: Bool               // iPhone の大きさ
    let cell: CGFloat               // 1マスの大きさ（48pt のときはカウンターの物差しを隠して文字を優先する）
    @Environment(\.dynamicTypeSize) private var typeSize

    // いちばん大きい文字サイズのときは、卓番・経過・段階だけ残す
    private var essentialsOnly: Bool { typeSize.isAccessibilitySize }

    var body: some View {
        Group {
            if let content {
                if seat.kind == .counter || seat.box.rowSpan == 1 || seat.box.colSpan == 1 {
                    small(content)
                } else {
                    table(content)
                }
            } else {
                empty
            }
        }
        .overlay { if editing { editingFrame } }
    }

    // 空席：点線の枠に卓番だけ
    private var empty: some View {
        RoundedRectangle(cornerRadius: 10)
            .strokeBorder(Palette.dash, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            .overlay {
                Text(seat.id)
                    .minopalFont(compact || seat.kind == .counter ? 16 : 20, .medium, relativeTo: .headline, digits: true)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
    }

    private func table(_ content: SeatCardContent) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: compact ? .center : .leading, spacing: compact ? 0 : 2) {
                header(content)
                if !compact && !essentialsOnly {
                    Text(content.sub)
                        .minopalFont(12, relativeTo: .caption)
                        .foregroundStyle(Palette.ink2)
                        .lineLimit(1)
                }
                Text(content.elapsed)
                    .minopalFont(compact ? 22 : 26, .semibold, relativeTo: compact ? .title2 : .title, digits: true)
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(maxWidth: compact ? nil : .infinity, alignment: .leading)
                ruler(content, height: compact ? 4 : 6)
                    .padding(.top, compact ? 4 : 6)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .frame(maxHeight: .infinity)
            band(content)
        }
        .opacity(content.exited ? 0.5 : 1)
        .background(Palette.page)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(border(content))
    }

    private func header(_ content: SeatCardContent) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            (Text(content.number) + Text(content.groupMark.isEmpty ? "" : " \(content.groupMark)").font(.caption.weight(.bold)))
                .minopalFont(compact ? 16 : 18, .bold, relativeTo: .headline, digits: true)
                .foregroundStyle(Palette.ink)
                .lineLimit(1)
            if !compact { Spacer(minLength: 4) }
            guestsText(content)
        }
    }

    @ViewBuilder private func guestsText(_ content: SeatCardContent) -> some View {
        if case .some(let guests) = content.guests {
            HStack(alignment: .firstTextBaseline, spacing: 1) {
                Text(guests.map(String.init) ?? "?")
                    .minopalFont(compact ? 12 : 15, .bold, relativeTo: compact ? .caption : .subheadline, digits: true)
                    .foregroundStyle(guests == nil ? Palette.muted : Palette.ink)
                Text("名")
                    .minopalFont(12, .bold, relativeTo: .caption)
                    .foregroundStyle(Palette.ink2)
            }
            .lineLimit(1)
        }
    }

    // 下の帯：ふだんは面の色に罫線、警告の卓は赤・橙で塗る
    private func band(_ content: SeatCardContent) -> some View {
        HStack(spacing: 4) {
            Text(content.stage)
                .minopalFont(compact ? 12 : 13, .bold, relativeTo: compact ? .caption : .footnote)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            if !compact && !essentialsOnly && content.alert == .none {
                Spacer(minLength: 4)
                Text(content.corner)
                    .minopalFont(12, relativeTo: .caption, digits: true)
                    .foregroundStyle(Palette.ink2)
                    .lineLimit(1)
            }
        }
        .foregroundStyle(bandText(content))
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, alignment: compact || content.alert != .none ? .center : .leading)
        .frame(height: compact ? 24 : 26)
        .background(bandFill(content))
        .overlay(alignment: .top) {
            if content.alert == .none { Rectangle().fill(Palette.line).frame(height: 1) }
        }
    }

    // カウンター・低い卓・細い卓：卓番・経過・物差し（48pt のマスでは物差しを隠す）
    private func small(_ content: SeatCardContent) -> some View {
        VStack(spacing: 0) {
            (Text(content.number) + Text(content.groupMark.isEmpty ? "" : content.groupMark).font(.caption2.weight(.bold)))
                .minopalFont(compact ? 12 : 14, .bold, relativeTo: .caption, digits: true)
                .foregroundStyle(Palette.ink)
            // 1マスの卓は「開始前」が入らないので「—」にする
            Text(content.elapsed == "開始前" ? "—" : content.elapsed)
                .minopalFont(compact ? 13 : 16, .semibold, relativeTo: .footnote, digits: true)
                .foregroundStyle(Palette.ink)
            if let mark = content.counterMark {
                Text(mark)
                    .minopalFont(11, .bold, relativeTo: .caption2)
                    .foregroundStyle(content.alert == .soon ? Palette.soonInk : Palette.nowInk)
            } else if cell > 48 {
                ruler(content, height: 3).padding(.horizontal, 6).padding(.top, 2)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .padding(.horizontal, 2)
        .padding(.bottom, content.alert == .none ? 0 : 4)   // 下の色の線に文字が重ならないように
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .opacity(content.exited ? 0.5 : 1)
        .background(Palette.page)
        .overlay(alignment: .bottom) {
            if content.alert != .none { Rectangle().fill(alertColor(content)).frame(height: 5) }
        }
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(border(content))
    }

    // 物差し：経過の棒。お席の時間で右端に届き、太い目盛りが L.O.
    private func ruler(_ content: SeatCardContent, height: CGFloat) -> some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Palette.track)
                Capsule().fill(rulerFill(content)).frame(width: proxy.size.width * content.progress)
                if let lo = content.lo {
                    Rectangle().fill(Palette.ink)
                        .frame(width: 2, height: height + 6)
                        .offset(x: proxy.size.width * lo - 1)
                }
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }

    private func border(_ content: SeatCardContent) -> some View {
        RoundedRectangle(cornerRadius: 10)
            .strokeBorder(editing ? .clear : content.alert == .none ? Palette.edge : alertColor(content), lineWidth: content.alert == .none ? 1 : 2)
    }

    // 編集中の印：緑の点線の枠と、上のまん中に「編集中」の札
    private var editingFrame: some View {
        RoundedRectangle(cornerRadius: 10)
            .strokeBorder(Palette.keyText, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
            .overlay(alignment: .top) {
                Text("編集中")
                    .minopalFont(11, .bold, relativeTo: .caption2)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 1)
                    .background(Palette.key, in: Capsule())
                    .offset(y: -6)
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    private func alertColor(_ content: SeatCardContent) -> Color {
        content.alert == .soon ? Palette.soonEdge : Palette.now
    }
    private func rulerFill(_ content: SeatCardContent) -> Color {
        if content.exited { return Palette.exitfill }
        switch content.alert {
        case .now: return Palette.now
        case .soon: return Palette.soonEdge
        case .none: return Palette.key
        }
    }
    private func bandFill(_ content: SeatCardContent) -> Color {
        switch content.alert {
        case .now: Palette.now
        case .soon: Palette.soon
        case .none: Palette.page
        }
    }
    private func bandText(_ content: SeatCardContent) -> Color {
        switch content.alert {
        case .now: .white
        case .soon: Palette.soonOnFill
        case .none: Palette.ink
        }
    }
}
