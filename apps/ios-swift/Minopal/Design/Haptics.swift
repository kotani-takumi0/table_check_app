import UIKit

// ハプティクス（No.149「ハプティクス」）。システムの決まった意味で使う。端末が対応していなければ何も起きない。
// 設定の「この端末」で切れるようにするのは No.160（設定）で
@MainActor
enum Haptics {
    // 長押しで詳細を開いた・段階を進めた・戻した
    static func light() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    // 選んだ（人数・コース）
    static func select() { UISelectionFeedbackGenerator().selectionChanged() }
    // ご案内した・料理を出した・お会計済みにした・卓を足した
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    // 保存できなかった（時刻の順が崩れる）
    static func warning() { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
}
