import MinopalCore
import SwiftUI

// 通知のバナー（No.149「改善 v5」・No.159）：iPad は右上に新しい順で 2 枚まで、iPhone は上に 1 枚。入らない分は「ほか N件」。
// 卓に重なってよい。下の線が 10 秒で縮みきったらヘッダーのベルにしまう（NoticeBoard）。
// ボタンは「卓を見る」（L.O.の通知だけ）と、L.O.確認済みにする・済にする（Web と同じ言葉）。「閉じる」はしまうだけ（Web と同じ）
struct NoticeBanners: View {
    let state: ShopState
    let limit: Int
    let compact: Bool                 // iPhone：ボタンを文の下に並べる
    let onSeat: (String) -> Void      // 卓を見る

    var body: some View {
        let window = state.noticeWindow(limit: limit)
        VStack(alignment: compact ? .center : .trailing, spacing: 8) {
            ForEach(window.shown, id: \.key) { notice in
                card(notice)
            }
            if window.rest > 0, let next = window.nextKey {
                Button { state.noticeBoard.show(next) } label: {
                    Text("ほか\(window.rest)件")
                        .minopalFont(14, .bold, relativeTo: .subheadline, digits: true)
                        .foregroundStyle(Palette.ink)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 36)
                        .floatingGlass(cornerRadius: 18)
                        .frame(minHeight: Metrics.minTap)
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("ほか\(window.rest)件")
                .accessibilityHint("押すと次の通知")
                .accessibilityIdentifier("notice-more")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("通知")
    }

    private func card(_ notice: Notice) -> some View {
        let radius: CGFloat = compact ? 26 : 22
        return Group {
            if compact {
                VStack(spacing: 12) {
                    HStack(spacing: 12) { icon(notice); message(notice); closeButton }
                    HStack(spacing: 10) { buttons(notice) }
                }
                .padding(.leading, 16)
                .padding(.trailing, 6)
                .padding(.top, 8)
                .padding(.bottom, 16)
            } else {
                HStack(spacing: 12) {
                    icon(notice)
                    message(notice)
                    buttons(notice)
                    closeButton
                }
                .padding(.leading, 16)
                .padding(.trailing, 6)
                .padding(.vertical, 12)
            }
        }
        .overlay(alignment: .bottom) {
            DrainLine(color: notice.tone == .danger ? Palette.now : Palette.soonEdge, run: state.noticeBoard.run, duration: 10)
                .padding(.horizontal, radius)
                .padding(.bottom, 4)
        }
        .floatingGlass(cornerRadius: radius)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("notice-card")
    }

    // L.O.は時計、店のタイマーはタイマーの印（No.149 の SF Symbols）。いま対応は赤、もうすぐは橙の淡い丸
    private func icon(_ notice: Notice) -> some View {
        let danger = notice.tone == .danger
        return Image(systemName: notice.kind == .lastOrder ? "clock" : "timer")
            .font(.body.weight(.semibold))
            .foregroundStyle(danger ? Palette.nowInk : Palette.soonInk)
            .frame(width: 36, height: 36)
            .background(danger ? Palette.nowWash : Palette.soonWash, in: Circle())
            .accessibilityHidden(true)
    }

    private func message(_ notice: Notice) -> some View {
        Text(notice.message)
            .minopalFont(15, .bold, relativeTo: .subheadline, digits: true)
            .foregroundStyle(Palette.ink)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func buttons(_ notice: Notice) -> some View {
        if let seatId = notice.session?.tableIds.first {
            Button("卓を見る") { onSeat(seatId) }
                .buttonStyle(DetailButtonStyle(kind: .secondary, height: Metrics.minTap, radius: 18))
                .fixedSize(horizontal: !compact, vertical: false)
                .accessibilityIdentifier("notice-seat")
        }
        Button(notice.kind.action) { state.act(notice) }
            .buttonStyle(DetailButtonStyle(kind: .primary, height: Metrics.minTap, radius: 18))
            .fixedSize(horizontal: !compact, vertical: false)
            .accessibilityIdentifier("notice-action")
    }

    private var closeButton: some View {
        Button { state.noticeBoard.tuck() } label: {
            Image(systemName: "xmark")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Palette.ink2)
                .frame(width: Metrics.minTap, height: Metrics.minTap)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("閉じる")
        .accessibilityHint("通知はベルにしまう")
        .accessibilityIdentifier("notice-close")
    }
}

// ヘッダーのベル：しまった通知の数。押すとバナーを開き直す（Web の .notice-bell と同じく、バナーを出している間は隠す）。
// iPad は「通知」の文字つき、iPhone は印と数だけ
struct NoticeBell: View {
    let count: Int
    var showsLabel = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "bell").font(.body.weight(.semibold))
                if showsLabel {
                    Text("通知").minopalFont(15, .bold, relativeTo: .subheadline)
                }
                Text("\(count)")
                    .minopalFont(13, .bold, relativeTo: .footnote, digits: true)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .frame(minWidth: 22, minHeight: 22)
                    .background(Palette.now, in: Capsule())
            }
            .foregroundStyle(Palette.nowInk)
            .padding(.horizontal, 12)
            .frame(minHeight: 40)
            .overlay(Capsule().strokeBorder(Palette.now, lineWidth: 1.5))
            .frame(minHeight: Metrics.minTap)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .fixedSize()
        .accessibilityLabel("通知 \(count)件")
        .accessibilityHint("押すと開く")
        .accessibilityIdentifier("notice-bell")
    }
}

// 「〜しました［元に戻す］」の帯（Web の UndoBar）。画面の下に数秒だけ出し、下の線が縮みきったら消える。
// 戻せなかったときは、ボタンを出さずに理由だけを出す
struct UndoBar: View {
    let board: UndoBoard
    let onUndo: () -> Void

    var body: some View {
        ZStack {
            if let message = board.message {
                HStack(spacing: 12) {
                    Text(message)
                        .minopalFont(15, .bold, relativeTo: .subheadline)
                        .foregroundStyle(Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if board.undo != nil {
                        Button("元に戻す", action: onUndo)
                            .minopalFont(15, .bold, relativeTo: .subheadline)
                            .foregroundStyle(Palette.keyText)
                            .padding(.horizontal, 14)
                            .frame(minHeight: Metrics.minTap)
                            .contentShape(Rectangle())
                            .accessibilityIdentifier("undo-button")
                    }
                }
                .padding(.leading, 18)
                .padding(.trailing, 6)
                .padding(.vertical, 6)
                .frame(minHeight: 56)
                .overlay(alignment: .bottom) {
                    DrainLine(color: Palette.keyText, run: board.run, duration: Double(undoMs) / 1000)
                        .padding(.horizontal, 24)
                        .padding(.bottom, 4)
                }
                .floatingGlass(cornerRadius: 28)
                .frame(maxWidth: 480)
                .padding(.horizontal, 16)
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("undo-bar")
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy, value: board.message)
    }
}

// 下の細い線：run が変わるたびに満たしてから duration 秒で縮める
private struct DrainLine: View {
    let color: Color
    let run: Int
    let duration: Double
    @State private var left: CGFloat = 1

    var body: some View {
        GeometryReader { proxy in
            Capsule().fill(color).frame(width: proxy.size.width * left)
        }
        .frame(height: 3)
        .accessibilityHidden(true)
        .task(id: run) {
            var reset = Transaction()
            reset.disablesAnimations = true
            withTransaction(reset) { left = 1 }
            try? await Task.sleep(for: .milliseconds(30))
            withAnimation(.linear(duration: duration)) { left = 0 }
        }
    }
}

extension View {
    // 浮かせる部品（通知のバナー・元に戻すの帯）：iOS 26 からは Liquid Glass（透明度を下げる・コントラストを上げるはシステムが合わせる）、
    // それより前は上に重ねる面の色と影
    @ViewBuilder func floatingGlass(cornerRadius: CGFloat) -> some View {
        if #available(iOS 26, *) {
            glassEffect(.regular, in: RoundedRectangle(cornerRadius: cornerRadius))
        } else {
            background(Palette.panel, in: RoundedRectangle(cornerRadius: cornerRadius))
                .shadow(color: .black.opacity(0.14), radius: 12, y: 4)
        }
    }
}
