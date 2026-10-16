import SwiftUI

// どの画面でも使う部品：ロゴの印・ボタン・入力欄

// ロゴの印（Web の .brand-mark と同じ）：2×2 の角丸の四角。右上だけ淡い緑の丸、右下は赤
struct BrandMark: View {
    @ScaledMetric private var cell: CGFloat
    @ScaledMetric private var gap: CGFloat

    init(cell: CGFloat, relativeTo style: Font.TextStyle) {
        _cell = ScaledMetric(wrappedValue: cell, relativeTo: style)
        _gap = ScaledMetric(wrappedValue: cell / 5, relativeTo: style)
    }

    var body: some View {
        Grid(horizontalSpacing: gap, verticalSpacing: gap) {
            GridRow { square(Palette.key); Circle().fill(Palette.brandLeaf).frame(width: cell, height: cell) }
            GridRow { square(Palette.key); square(Palette.now) }
        }
        .accessibilityHidden(true)
    }

    private func square(_ color: Color) -> some View {
        RoundedRectangle(cornerRadius: cell * 0.28).fill(color).frame(width: cell, height: cell)
    }
}

// いちばん大事な操作：緑の塗りに白い太字
struct PrimaryButtonStyle: ButtonStyle {
    var height: CGFloat = Metrics.field
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .minopalFont(17, .bold, relativeTo: .headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: height)
            .padding(.horizontal, 16)
            .background(Palette.key, in: RoundedRectangle(cornerRadius: Metrics.groupRadius))
            .opacity(enabled ? (configuration.isPressed ? 0.85 : 1) : 0.5)
            .contentShape(RoundedRectangle(cornerRadius: Metrics.groupRadius))
    }
}

// ふつうの操作：面の色に枠と本文の色の太字
struct SecondaryButtonStyle: ButtonStyle {
    var height: CGFloat = Metrics.field
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .minopalFont(17, .bold, relativeTo: .headline)
            .foregroundStyle(Palette.ink)
            .frame(maxWidth: .infinity, minHeight: height)
            .padding(.horizontal, 16)
            .background(configuration.isPressed ? Palette.cellbg : Palette.page, in: RoundedRectangle(cornerRadius: Metrics.groupRadius))
            .overlay(RoundedRectangle(cornerRadius: Metrics.groupRadius).strokeBorder(Palette.edge, lineWidth: 1))
            .opacity(enabled ? 1 : 0.5)
            .contentShape(RoundedRectangle(cornerRadius: Metrics.groupRadius))
    }
}

// 文字だけのボタン（「アカウントを作る」など）：緑の太字。押せる高さは 44pt
struct LinkButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .minopalFont(15, .bold, relativeTo: .subheadline)
            .foregroundStyle(Palette.keyText)
            .frame(minHeight: Metrics.minTap)
            .contentShape(Rectangle())
            .opacity(enabled ? (configuration.isPressed ? 0.6 : 1) : 0.5)
    }
}

// 入力欄：上にラベル、高さ 48pt・角丸 8pt。入力中は緑の 2pt の枠。パスワードは右に表示の切り替え（44pt）
struct LabeledField<Field: Hashable>: View {
    let label: String
    @Binding var text: String
    let field: Field
    var focus: FocusState<Field?>.Binding
    var secure = false
    var contentType: UITextContentType?
    var keyboard: UIKeyboardType = .default
    var submitLabel: SubmitLabel = .next
    var onSubmit: () -> Void = {}
    @State private var revealed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .minopalFont(15, .semibold, relativeTo: .subheadline)
                .foregroundStyle(Palette.ink)
            HStack(spacing: 0) {
                input
                    .minopalFont(17, relativeTo: .body)
                    .foregroundStyle(Palette.ink)
                    .tint(Palette.keyText)
                    .textContentType(contentType)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(submitLabel)
                    .onSubmit(onSubmit)
                    .focused(focus, equals: field)
                    .accessibilityLabel(label)
                    .padding(.leading, 14)
                    .padding(.trailing, secure ? 0 : 14)
                    .frame(maxWidth: .infinity, minHeight: Metrics.field)
                if secure {
                    Button { revealed.toggle() } label: {
                        Image(systemName: revealed ? "eye.slash" : "eye")
                            .font(.body.weight(.medium))
                            .foregroundStyle(Palette.ink2)
                            .frame(width: Metrics.minTap, height: Metrics.minTap)
                    }
                    .accessibilityLabel(revealed ? "パスワードを隠す" : "パスワードを見せる")
                    .padding(.trailing, 2)
                }
            }
            .background(Palette.page, in: RoundedRectangle(cornerRadius: Metrics.fieldRadius))
            .overlay {
                let focused = focus.wrappedValue == field
                RoundedRectangle(cornerRadius: Metrics.fieldRadius)
                    .strokeBorder(focused ? Palette.keyText : Palette.edge, lineWidth: focused ? 2 : 1)
            }
        }
    }

    @ViewBuilder private var input: some View {
        if secure && !revealed {
            SecureField("", text: $text)
        } else {
            TextField("", text: $text)
        }
    }
}
