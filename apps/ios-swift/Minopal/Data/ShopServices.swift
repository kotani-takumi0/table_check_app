import Foundation
import MinopalCore

// この端末のアプリの種類と版（記録・配置の移り変わり・ご意見に写す）
enum AppVersion {
    static var info: AppInfo {
        AppInfo(platform: .ios, version: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")
    }
    // 画面とご意見に出す形（v3.0.0）
    static var label: String { "v\(info.version)" }
}

// 1つの店のデータの読み書き（packages/core/src/firestoreServices.ts の firestoreStores）。
// base の店（今の店はいちばん上、ログインした店は shops/{uid}/）を Firestore で読み書きする（No.88）
@MainActor
final class ShopServices {
    let base: ShopBase
    let settings: ShopSettingsRepository
    let sessions: SessionRepository
    let timers: ShopTimerRepository
    let layout: ShopLayoutRepository
    let editing: EditingRepository
    let feedback: FeedbackSender

    init(base: ShopBase, app: AppInfo = AppVersion.info) {
        let settings = ShopSettingsRepository(base: base)
        self.base = base
        self.settings = settings
        sessions = SessionRepository(base: base, recordSource: (settings: { settings.settings }, app: app))
        timers = ShopTimerRepository(base: base)
        layout = ShopLayoutRepository(base: base, app: app)
        editing = EditingRepository(base: base)
        feedback = FeedbackSender(base: base)
    }

    func start() {
        settings.start()
        sessions.start()
        timers.start()
        layout.start()
        editing.start()
    }
    func stop() {
        settings.stop()
        sessions.stop()
        timers.stop()
        layout.stop()
        editing.stop()
    }
    // 同期の状態は、いちばん悪いものを出す
    var syncState: SyncState { worstSyncState([settings.syncState, sessions.syncState, timers.syncState]) }
}
