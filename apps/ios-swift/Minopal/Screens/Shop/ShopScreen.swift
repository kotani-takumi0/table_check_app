import MinopalCore
import SwiftUI

// ログインしたあとの店の画面。iPad（幅が広い）はサイドバー、iPhone（幅が狭い）はタブ。
// 経過・残り時間は1秒ごとに作り直す（フロアの表示は1分ごとに変わるが、店のタイマーの「時間です」に遅れないため）
struct ShopScreen: View {
    let account: String?
    let demoSeed: Bool
    let onLeave: () -> Void
    let onDeleted: () -> Void
    @State private var services: ShopServices
    @State private var noticeBoard = NoticeBoard()
    @State private var undo = UndoBoard()
    @State private var news = NewsBoard()
    @State private var notifier = LocalNotifier.shared
    @AppStorage(DeviceSettings.notificationsKey) private var notificationsOn = true
    @AppStorage(DeviceSettings.soundKey) private var soundOn = true
    @AppStorage(DeviceSettings.notificationsAskedKey) private var notificationsAsked = false
    @State private var askingNotifications = false
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.horizontalSizeClass) private var sizeClass

    init(base: ShopBase, account: String?, demoSeed: Bool = false, onLeave: @escaping () -> Void, onDeleted: @escaping () -> Void) {
        self.account = account
        self.demoSeed = demoSeed
        self.onLeave = onLeave
        self.onDeleted = onDeleted
        _services = State(initialValue: ShopServices(base: base))
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            let state = ShopState(services: services, now: nowMs(), account: account, noticeBoard: noticeBoard, undo: undo, news: news)
            Group {
                if sizeClass == .regular {
                    PadShopView(state: state, onLeave: onLeave, onDeleted: onDeleted)
                } else {
                    PhoneShopView(state: state, onLeave: onLeave, onDeleted: onDeleted)
                }
            }
            // 新しい通知が来たらバナーを開く（No.159）
            .onChange(of: state.notices.map(\.key), initial: true) { noticeBoard.sync(state.notices) }
            // 閉店時刻（No.129）：過ぎても退店していない卓を、閉店で退店にする。1分ごと（とお客さんが変わったとき）に確かめ、退店にしたら下の帯で知らせる
            .onChange(of: CloseOutCheck(minute: state.now / 60_000, sessions: state.sessions, closingMin: state.settings.closingMin), initial: true) {
                let count = state.closeOut()
                if count > 0 { undo.tell("閉店時刻を過ぎたので、\(count)組を退店にしました") }
            }
            // 端末の通知（No.151）：お客さん・済にした時刻・設定・許可が変わったら、予約を作り直す
            .onChange(of: NotificationPlan(scheduled: state.scheduledNotices, active: Set(state.notices.map(\.key)), on: notificationsOn, sound: soundOn,
                                           allowed: notifier.allowed), initial: true) { _, plan in
                notifier.reschedule(plan.scheduled, active: plan.active)
            }
        }
        // 営業中に画面が暗くならないようにする（今の iOS 版の useKeepAwake と同じ。店の画面を出している間だけ）
        .onAppear {
            services.start()
            KeepAwake.hold()
        }
        .onDisappear {
            services.stop()
            KeepAwake.release()
            notifier.clear()
        }
        // 初めて店の画面を開いたときに一度だけ、通知のことを説明してから iOS の許可を求める（断ってもそのまま使える。あとから設定で変えられる）
        .task {
            await notifier.refresh()
            if notifier.status == .notDetermined && notificationsOn && !notificationsAsked { askingNotifications = true }
        }
        .onChange(of: scenePhase) {
            if scenePhase == .active { Task { await notifier.refresh() } }
        }
        .alert("通知を出してもよいですか？", isPresented: $askingNotifications) {
            Button("あとで", role: .cancel) { notificationsAsked = true }
            Button("通知を許可する") {
                notificationsAsked = true
                Task { await notifier.requestPermission() }
            }
        } message: {
            Text(notificationMessage)
        }
        #if DEBUG
        // 画面の確かめ用のテストデータ（エミュレータで、起動の引数に -MinopalDemoSeed があるときだけ）。配置を読み終えてから入れる
        .task {
            guard demoSeed else { return }
            try? await Task.sleep(for: .seconds(2))
            DemoSeed.seed(services)
        }
        #endif
    }
}

// 画面を暗くしないのは、店の画面が1つでも出ている間。店を切り替えると新しい画面の onAppear が古い画面の onDisappear より先に来ることがあるので、数えて決める
@MainActor
private enum KeepAwake {
    private static var count = 0
    static func hold() {
        count += 1
        UIApplication.shared.isIdleTimerDisabled = true
    }
    static func release() {
        count = max(0, count - 1)
        UIApplication.shared.isIdleTimerDisabled = count > 0
    }
}

let notificationMessage = "L.O.・店のタイマーの時間を、アプリを閉じているときやロック中にも、音で知らせます。通知に出すのは卓番と内容だけです。"

private struct NotificationPlan: Equatable {
    let scheduled: [ScheduledNotice]
    let active: Set<String>
    let on: Bool
    let sound: Bool
    let allowed: Bool
}

private struct CloseOutCheck: Equatable {
    let minute: Int
    let sessions: [Session]
    let closingMin: Int?
}
