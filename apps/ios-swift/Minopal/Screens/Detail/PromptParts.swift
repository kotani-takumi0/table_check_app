import MinopalCore
import SwiftUI

// ご案内・卓の詳細で共通に使う部品（No.149 の確定画像 ipad_detail_*_lg・iphone_detail_*_lg）

// 詳細のボタン：primary は緑の塗りに白い太字、secondary は面の色に枠、outline は緑の枠と緑の文字（お会計・卓の追加）。
// 角丸は外の面と同心にする（iPad の詳細：大事なボタン 20・ふつう 16、iPhone のシート：22・16）
struct DetailButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, outline }
    let kind: Kind
    var height: CGFloat = Metrics.field
    var radius: CGFloat = 16
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius)
        return configuration.label
            .minopalFont(height >= 56 ? 18 : 15, .bold, relativeTo: height >= 56 ? .headline : .subheadline)
            .multilineTextAlignment(.center)
            .foregroundStyle(foreground)
            .padding(.horizontal, 16)
            .frame(maxWidth: kind == .outline ? nil : .infinity, minHeight: height)
            .background(background(pressed: configuration.isPressed), in: shape)
            .overlay {
                switch kind {
                case .primary: EmptyView()
                case .secondary: shape.strokeBorder(Palette.edge, lineWidth: 1)
                case .outline: shape.strokeBorder(Palette.keyText, lineWidth: 1.5)
                }
            }
            .opacity(enabled ? (kind == .primary && configuration.isPressed ? 0.85 : 1) : 0.45)
            .contentShape(shape)
    }

    private var foreground: Color {
        switch kind {
        case .primary: .white
        case .secondary: Palette.ink
        case .outline: Palette.keyText
        }
    }
    private func background(pressed: Bool) -> Color {
        switch kind {
        case .primary: Palette.key
        case .secondary, .outline: pressed ? Palette.cellbg : Palette.page
        }
    }
}

// 下線の付いた文字のボタン（1つ戻す・ふつうに戻す）。押せる高さは 44pt
struct UnderlineButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .underline()
                .minopalFont(15, relativeTo: .subheadline)
                .foregroundStyle(Palette.keyText)
                .frame(minHeight: Metrics.minTap)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// 閉じる：丸い 44pt
struct PromptCloseButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.body.weight(.semibold))
                .foregroundStyle(Palette.ink2)
                .frame(width: Metrics.minTap, height: Metrics.minTap)
                .background(Palette.track.opacity(0.6), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("閉じる")
        .accessibilityIdentifier("detail-close")
    }
}

// ご案内・詳細の入れ物。iPad はポップオーバー（幅 420pt、内側 20pt）で、入りきらなければ中だけスクロール。
// iPhone は下からのシート（中・大の 2 段、引き手あり）。footer はシートの下に止めておくボタン（ご案内）
struct PromptContainer<Content: View, Footer: View>: View {
    let sheet: Bool
    var maxHeight: CGFloat = .infinity   // ポップオーバーの高さの上限（配置図の高さ）。これより高い中身はスクロールする
    @ViewBuilder let content: Content
    @ViewBuilder let footer: Footer
    // ポップオーバーの中身の高さ。ポップオーバーはこの高さで開き、画面に入らなければ中だけスクロールする
    @State private var height: CGFloat = 480

    var body: some View {
        Group {
            if sheet {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) { content }
                        .padding(20)
                }
                .scrollBounceBehavior(.basedOnSize)
                .bottomBar {
                    footer
                        .padding(.horizontal, 20)
                        .padding(.top, 8)
                        .padding(.bottom, 8)
                }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        content
                        footer
                    }
                    .padding(20)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
                }
                .scrollBounceBehavior(.basedOnSize)
                .frame(width: 420, height: min(height, maxHeight))
            }
        }
        .tint(Palette.keyText)
        .panelBackground()
    }
}

extension PromptContainer where Footer == EmptyView {
    init(sheet: Bool, maxHeight: CGFloat, @ViewBuilder content: () -> Content) {
        self.init(sheet: sheet, maxHeight: maxHeight, content: content, footer: { EmptyView() })
    }
}

private extension View {
    // 下に止めておくボタン。iOS 26 は標準の帯（下を流れる中身をぼかすスクロールの端の効果）、それより前は上に重ねる面の色を敷く
    @ViewBuilder func bottomBar<Bar: View>(@ViewBuilder _ bar: () -> Bar) -> some View {
        if #available(iOS 26, *) {
            safeAreaBar(edge: .bottom, spacing: 0, content: bar)
        } else {
            safeAreaInset(edge: .bottom, spacing: 0) { bar().background(Palette.panel) }
        }
    }

    // iOS 26 からはポップオーバー・シートそのものが Liquid Glass（厚め）なので、独自の背景を足さない。それより前は上に重ねる面の色
    @ViewBuilder func panelBackground() -> some View {
        if #available(iOS 26, *) {
            self
        } else {
            presentationBackground(Palette.panel)
        }
    }
}

// 選び肢（Web の CoursePicker・MenuPicker・GuestPicker と同じ並び。apps/ios/src/sheets/pickers.ts）
struct SelectOption<Value: Hashable>: Hashable {
    var value: Value
    var label: String
}

// 飲み放題の区分は店が設定で決める（No.90）。設定で消した区分を使っている卓は、その区分も残して出す
func courseOptions(_ plans: [DrinkPlan], current: String?) -> [SelectOption<String?>] {
    var ids = plans.map(\.id)
    if let current, !ids.contains(current) { ids.append(current) }
    return [SelectOption(value: nil, label: "通常")] + ids.map { SelectOption(value: $0, label: "コース（\(drinkPlanName(plans, $0))）") }
}

// コースは店が設定で作る（No.89）。設定で消したコースを選んでいる卓は、そのコースも残して出す
func menuOptions(_ menus: [CourseMenu], current: String?) -> [SelectOption<String?>] {
    var options = [SelectOption<String?>(value: nil, label: "未定")] + menus.map { SelectOption(value: $0.id, label: "\(priceLabel($0)) \($0.short)") }
    if let current, !menus.contains(where: { $0.id == current }) { options.append(SelectOption(value: current, label: "消したコース")) }
    return options
}

// 詳細で人数を直すときの選び肢（No.71）。今の人数が30名より多ければそこまで並べる
let guestsPick = 30
func guestOptions(emptyLabel: String, current: Int?) -> [SelectOption<Int?>] {
    [SelectOption(value: nil, label: emptyLabel)] + (1...max(guestsPick, current ?? 0)).map { SelectOption(value: $0, label: "\($0)名") }
}

// ミリ秒と Date（時刻を選ぶ欄で使う）
extension Date {
    init(ms: Int) { self.init(timeIntervalSince1970: Double(ms) / 1000) }
    var ms: Int { Int((timeIntervalSince1970 * 1000).rounded()) }
}
