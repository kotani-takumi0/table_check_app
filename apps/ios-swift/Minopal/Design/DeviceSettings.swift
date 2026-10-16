import AudioToolbox
import SwiftUI

// 設定の「この端末」（No.149。iOS だけ）：音・ハプティクス・外観。店全体の設定と違い、この端末だけで覚える（UserDefaults）
enum DeviceSettings {
    static let soundKey = "minopal.device.sound"
    static let hapticsKey = "minopal.device.haptics"
    static let appearanceKey = "minopal.device.appearance"

    // どちらも最初はオン
    static var sound: Bool { UserDefaults.standard.object(forKey: soundKey) as? Bool ?? true }
    static var haptics: Bool { UserDefaults.standard.object(forKey: hapticsKey) as? Bool ?? true }
}

// 外観：iOS の設定に合わせる・いつもライト・いつもダーク
enum Appearance: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
    var label: String {
        switch self {
        case .system: "端末に合わせる"
        case .light: "ライト"
        case .dark: "ダーク"
        }
    }
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

// 通知が来たときの音（No.149「ハプティクス」：音と一緒に notification warning を 1 回）。
// システムの通知音を使い、消音スイッチがオンなら鳴らない。この端末で音を切っていれば鳴らさない
@MainActor
enum NoticeSound {
    private static let received: SystemSoundID = 1007
    static func play() {
        guard DeviceSettings.sound else { return }
        AudioServicesPlaySystemSound(received)
    }
}
