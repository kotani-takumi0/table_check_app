import UIKit

// ハプティクス（No.149「ハプティクス」）。システムの決まった意味で使う。端末が対応していなければ何も起きない。
// 設定の「この端末」でハプティクスを切っていれば鳴らさない
@MainActor
enum Haptics {
    // 長押しで詳細を開いた・段階を進めた・戻した
    static func light() { if DeviceSettings.haptics { UIImpactFeedbackGenerator(style: .light).impactOccurred() } }
    // 選んだ（人数・コース）
    static func select() { if DeviceSettings.haptics { UISelectionFeedbackGenerator().selectionChanged() } }
    // ご案内した・料理を出した・お会計済みにした・卓を足した
    static func success() { notify(.success) }
    // 保存できなかった（時刻の順が崩れる）・全卓消去を確定した・通知が来た
    static func warning() { notify(.warning) }

    private static func notify(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        if DeviceSettings.haptics { UINotificationFeedbackGenerator().notificationOccurred(type) }
    }
}
