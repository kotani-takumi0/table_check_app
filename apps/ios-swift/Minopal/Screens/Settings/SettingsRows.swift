import MinopalCore
import SwiftUI

// 設定の行の部品（No.149「設定」）：iOS のグループのリストに置く。行は 44pt 以上、下に説明 13pt。
// 文字は iPad（幅が広い）がリストの行 16pt・右の値 15pt、iPhone が 17pt・16pt

// まとまりの見出し・下の説明
struct SettingsHeading: View {
    let text: String
    var body: some View {
        Text(text)
            .minopalFont(13, .semibold, relativeTo: .footnote)
            .foregroundStyle(Palette.ink2)
            .textCase(nil)
    }
}
struct SettingsFootnote: View {
    let text: String
    var body: some View {
        Text(text)
            .minopalFont(13, relativeTo: .footnote)
            .foregroundStyle(Palette.ink2)
    }
}

// 行の名前（上）と説明（下）
struct SettingsLabel: View {
    let title: String
    var help: String?
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .minopalFont(sizeClass == .regular ? 16 : 17, relativeTo: sizeClass == .regular ? .callout : .body)
                .foregroundStyle(Palette.ink)
            if let help {
                Text(help)
                    .minopalFont(13, relativeTo: .footnote)
                    .foregroundStyle(Palette.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, help == nil ? 0 : 6)
    }
}

// 押すと奥の画面へ進む行：左に SF Symbols、右に今の値と ›。selected は iPad の目次で選んでいる行（緑の塗りに白い文字）
struct SettingsNavRow: View {
    let title: String
    let symbol: String
    var value: String?
    var selected = false
    let action: () -> Void
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        let regular = sizeClass == .regular
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.body)
                    .foregroundStyle(selected ? .white : Palette.keyText)
                    .frame(width: 24)
                    .accessibilityHidden(true)
                Text(title)
                    .minopalFont(regular ? 16 : 17, relativeTo: regular ? .callout : .body)
                    .foregroundStyle(selected ? .white : Palette.ink)
                Spacer(minLength: 8)
                if let value {
                    Text(value)
                        .minopalFont(regular ? 15 : 16, relativeTo: regular ? .subheadline : .callout, digits: true)
                        .foregroundStyle(selected ? .white : Palette.ink2)
                        .lineLimit(1)
                }
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(selected ? .white : Palette.muted)
            }
            .frame(minHeight: regular ? Metrics.minTap : 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
        .listRowBackground(selected ? Palette.key : Palette.page)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

// 切り替え（スイッチ）の行
struct SettingsSwitchRow: View {
    let title: String
    var help: String?
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) { SettingsLabel(title: title, help: help) }
            .tint(Palette.key)
            .frame(minHeight: Metrics.minTap)
            .accessibilityIdentifier(title)
    }
}

// 分を −／＋ で変える行（各 44×36pt、押せる範囲 44pt。Web と同じく 1 回で 5 分、退店済みは 1 分）。変えられない向きのボタンは押せない
struct SettingsStepperRow: View {
    let title: String
    var help: String?
    let value: String
    let onLess: (() -> Void)?
    let onMore: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 12) {
                SettingsLabel(title: title)
                Spacer(minLength: 8)
                StepButton(symbol: "minus", label: "\(title)を短く", action: onLess)
                Text(value)
                    .minopalFont(16, .semibold, relativeTo: .callout, digits: true)
                    .foregroundStyle(Palette.ink)
                    .frame(minWidth: 64)
                    .accessibilityLabel("\(title) \(value)")
                StepButton(symbol: "plus", label: "\(title)を長く", action: onMore)
            }
            .frame(minHeight: Metrics.minTap)
            if let help { SettingsFootnote(text: help).fixedSize(horizontal: false, vertical: true) }
        }
        .padding(.vertical, help == nil ? 0 : 6)
    }
}

private struct StepButton: View {
    let symbol: String
    let label: String
    let action: (() -> Void)?

    var body: some View {
        Button { action?() } label: {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(Palette.ink)
                .frame(width: 44, height: 36)
                .background(Palette.page, in: RoundedRectangle(cornerRadius: Metrics.fieldRadius))
                .overlay(RoundedRectangle(cornerRadius: Metrics.fieldRadius).strokeBorder(Palette.edge, lineWidth: 1))
                .frame(height: Metrics.minTap)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
        .disabled(action == nil)
        .opacity(action == nil ? 0.4 : 1)
        .accessibilityLabel(label)
    }
}

// 文字の設定：入力を終えたら（ほかを押す・完了）保存する。打っている途中では保存しない（Web の SavedInput と同じ）。
// 前後の空白は落とす。文字数の上限は Web と同じ数え方（UTF-16）。
// allowsEmpty が false の欄（区分・タイマーの名前）は、空にして確定したら保存せずに今の名前へ戻す
struct SettingsTextField: View {
    let label: String
    let value: String
    let maxLength: Int
    let placeholder: String
    var allowsEmpty = true
    let onSave: (String) -> Void
    @State private var draft = ""
    @FocusState private var focused: Bool
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        TextField(placeholder, text: $draft)
            .minopalFont(sizeClass == .regular ? 16 : 17, relativeTo: sizeClass == .regular ? .callout : .body)
            .foregroundStyle(Palette.ink)
            .tint(Palette.keyText)
            .submitLabel(.done)
            .focused($focused)
            .frame(minHeight: Metrics.minTap)
            .accessibilityLabel(label)
            .onAppear { draft = value }
            .onChange(of: value) { if !focused { draft = value } }
            .onChange(of: draft) {
                let cut = limitedText(draft, maxLength)
                if cut != draft { draft = cut }
            }
            .onChange(of: focused) { if !focused { save() } }
            .onSubmit { focused = false }
    }

    private func save() {
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard allowsEmpty || !trimmed.isEmpty else {
            draft = value
            return
        }
        if trimmed != value { onSave(trimmed) }
        draft = trimmed
    }
}

// UTF-16 で maxLength 文字に収まるところまで切る（絵文字は2つと数える。firestore.rules の size() と同じ）
func limitedText(_ text: String, _ maxLength: Int) -> String {
    var result = text
    while result.utf16.count > maxLength { result.removeLast() }
    return result
}

// 赤い文字の操作の行（全卓を消去・ログアウト・消す）
struct SettingsDangerRow: View {
    let title: String
    var symbol: String?
    var centered = false
    let action: () -> Void
    @Environment(\.isEnabled) private var enabled

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                if let symbol {
                    Image(systemName: symbol).font(.body.weight(.semibold)).frame(width: 24).accessibilityHidden(true)
                }
                Text(title).minopalFont(17, .bold, relativeTo: .body)
            }
            .foregroundStyle(Palette.nowInk)
            .frame(maxWidth: .infinity, minHeight: 48, alignment: centered ? .center : .leading)
            .contentShape(Rectangle())
            .opacity(enabled ? 1 : 0.4)
        }
        .buttonStyle(.borderless)
    }
}

// 「＋ 区分を足す」など、足す行（緑の文字）
struct SettingsAddRow: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: "plus")
                .minopalFont(17, .semibold, relativeTo: .body)
                .foregroundStyle(Palette.keyText)
                .frame(maxWidth: .infinity, minHeight: Metrics.minTap, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
    }
}
