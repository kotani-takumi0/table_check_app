import SwiftUI

// 文字（No.149「実装用の値一覧（確定版）」の文字の表）。大きさは決めた pt を基準に、Dynamic Type に合わせて大きくなる（relativeTo の文字の種類で伸び方を決める）。
// 11pt 未満は使わない。数字（タイマー・時刻・件数）は幅をそろえる
extension View {
    func minopalFont(_ size: CGFloat, _ weight: Font.Weight = .regular, relativeTo style: Font.TextStyle, digits: Bool = false) -> some View {
        modifier(ScaledFont(size: size, weight: weight, style: style, digits: digits))
    }
}

private struct ScaledFont: ViewModifier {
    @ScaledMetric private var size: CGFloat
    private let weight: Font.Weight
    private let digits: Bool

    init(size: CGFloat, weight: Font.Weight, style: Font.TextStyle, digits: Bool) {
        precondition(size >= 11, "11pt 未満の文字は使わない（No.149）")
        _size = ScaledMetric(wrappedValue: size, relativeTo: style)
        self.weight = weight
        self.digits = digits
    }

    func body(content: Content) -> some View {
        let font = Font.system(size: size, weight: weight)
        return content.font(digits ? font.monospacedDigit() : font)
    }
}
