import MinopalCore
import Observation
import SwiftUI
@preconcurrency import UserNotifications

// 端末の通知（No.151）：L.O.・店のタイマーの時間を、アプリを閉じているとき・ロック中にも音で知らせる。
// 時刻は前もって分かるので、端末の中だけで予約する（ローカル通知）。予約は、お客さん・済にした時刻・設定が変わるたびに作り直す。
// アプリを開いているときは今のバナーと通知の音・ハプティクスで知らせるので、端末の通知は重ねて出さない
@MainActor @Observable
final class LocalNotifier: NSObject, UNUserNotificationCenterDelegate {
    static let shared = LocalNotifier()

    private(set) var status = UNAuthorizationStatus.notDetermined
    @ObservationIgnored private let center = UNUserNotificationCenter.current()

    // 起動のときに呼ぶ（アプリを開いている間の通知を出さないため）
    func install() {
        center.delegate = self
        Task { await refresh() }
    }

    // iOS の設定で変えられることがあるので、画面に戻るたびに読み直す
    func refresh() async {
        status = await center.notificationSettings().authorizationStatus
    }
    var allowed: Bool { status == .authorized || status == .provisional || status == .ephemeral }

    // iOS の許可を求める（断られてもアプリはそのまま使える）
    func requestPermission() async {
        _ = try? await center.requestAuthorization(options: [.alert, .sound])
        await refresh()
    }

    // 予約を作り直す。この端末で切っている・許可が無いときは、予約を全部消す。
    // active は今画面に出ている通知の key。届いた通知のうち、もう済んだ（L.O.確認済み・済にした）ものは通知センターから消す
    func reschedule(_ scheduled: [ScheduledNotice], active: Set<String>) {
        center.removeAllPendingNotificationRequests()
        Task {
            let done = await center.deliveredNotifications().map(\.request.identifier).filter { !active.contains($0) }
            if !done.isEmpty { center.removeDeliveredNotifications(withIdentifiers: done) }
        }
        guard DeviceSettings.notifications && allowed else { return }
        for request in Self.requests(scheduled, now: nowMs(), sound: DeviceSettings.sound) {
            center.add(request)
        }
    }
    // ログアウトしたとき（店の画面を閉じたとき）
    func clear() {
        center.removeAllPendingNotificationRequests()
    }

    // 文は卓番と内容だけ（ロック画面はお客さんからも見える）。id は画面の通知と同じ key。
    // 「この端末」で通知の音を切っていれば、音なしで出す
    static func requests(_ scheduled: [ScheduledNotice], now: Int, sound: Bool) -> [UNNotificationRequest] {
        scheduled.map { notice in
            let content = UNMutableNotificationContent()
            content.body = notice.message
            content.sound = sound ? .default : nil
            content.threadIdentifier = "minopal-notices"
            let seconds = Double(min(notice.fireAt, now + debugLeadMs(now: now, fireAt: notice.fireAt)) - now) / 1000
            return UNNotificationRequest(identifier: notice.key, content: content,
                                         trigger: UNTimeIntervalNotificationTrigger(timeInterval: max(1, seconds), repeats: false))
        }
    }

    // 開発中の確かめ用：起動の引数 -MinopalNotifyWithin <秒> があれば、どの通知もその秒数のうちに出す（UI テストで届くのを待つため）
    private static func debugLeadMs(now: Int, fireAt: Int) -> Int {
        #if DEBUG
        let seconds = UserDefaults.standard.double(forKey: "MinopalNotifyWithin")
        if seconds > 0 { return Int(seconds * 1000) }
        #endif
        return fireAt - now
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        []
    }
}
