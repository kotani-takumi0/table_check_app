import SwiftUI
import UIKit

// 色（No.149「実装用の値一覧（確定版）」の色の表）。ライトは今の Web と同じ値、ダークは iOS だけ。
// 端末の外観（ライト・ダーク）に合わせて自動で切り替わる。画面では Color(hex:) を直に使わず、ここの名前を使う
enum Palette {
    // 面
    static let tile = dynamic(light: 0xF3F6F4, dark: 0x111613)      // 画面の地
    static let page = dynamic(light: 0xFFFFFF, dark: 0x1B221E)      // 面（卓カード・リスト・入力欄）
    static let panel = dynamic(light: 0xFFFFFF, dark: 0x252E29)     // 上に重ねる面（ガラスが使えないとき）
    static let cellbg = dynamic(light: 0xE9EEEB, dark: 0x18201B)    // 空きマス
    static let area = dynamic(light: 0xE2E9E4, dark: 0x26302A)      // カウンターなどの目印の面
    static let track = dynamic(light: 0xE5EBE7, dark: 0x2E3933)     // 物差しの地
    // 文字
    static let ink = dynamic(light: 0x16211B, dark: 0xE6EDE8)       // 本文
    static let ink2 = dynamic(light: 0x4B5A51, dark: 0xB3C0B8)      // 補助の文字
    static let muted = dynamic(light: 0x627168, dark: 0x93A299)     // いちばん弱い文字
    // 線（飾り。押せる印には使わない）
    static let line = dynamic(light: 0xE2E9E4, dark: 0x2A342E)      // 罫線
    static let edge = dynamic(light: 0xBCC6C0, dark: 0x46534B)      // 枠
    static let dash = dynamic(light: 0x828F87, dark: 0x6B7A71)      // 空席の点線
    // 操作の緑
    static let key = dynamic(light: 0x1B7A3E, dark: 0x24804A)       // 塗り（上の文字は白）
    static let keyText = dynamic(light: 0x1B7A3E, dark: 0x7FD39B)   // 緑の文字・枠
    static let keyWash = dynamic(light: 0xE7F3EB, dark: 0x16291D)   // 緑の淡い面
    // いま対応
    static let now = dynamic(light: 0xD93036, dark: 0xD0343A)       // 塗り・枠（上の文字は白）
    static let nowInk = dynamic(light: 0xB3242A, dark: 0xFF9A9D)    // 文字
    static let nowWash = dynamic(light: 0xFDF0F0, dark: 0x361719)   // 淡い面
    static let nowLine = dynamic(light: 0xF2B8BA, dark: 0x7A2A2E)   // 淡い枠
    // もうすぐ
    static let soon = dynamic(light: 0xFFB020, dark: 0xFFB020)      // 塗り（上の文字は黒 soonOnFill）
    static let soonOnFill = Color(hex: 0x16211B)
    static let soonEdge = dynamic(light: 0xC96F00, dark: 0xE08A1A)  // 枠
    static let soonInk = dynamic(light: 0x7A4300, dark: 0xFFC766)   // 文字
    static let soonWash = dynamic(light: 0xFFF5E3, dark: 0x33240C)  // 淡い面
    // 退店済みの物差し
    static let exitfill = dynamic(light: 0x9DB3A5, dark: 0x4F6157)
    // ロゴの印の淡い緑（Web の .brand-mark の 2 つ目。ライト・ダークとも同じ）
    static let brandLeaf = Color(hex: 0x8FCFA3)

    private static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
}

extension Color {
    init(hex: UInt32) { self.init(UIColor(hex: hex)) }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
}
