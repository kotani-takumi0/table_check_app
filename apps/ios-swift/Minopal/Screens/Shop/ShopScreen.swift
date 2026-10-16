import MinopalCore
import SwiftUI

// ログインしたあとの店の画面。iPad（幅が広い）はサイドバー、iPhone（幅が狭い）はタブ。
// 経過・残り時間は1秒ごとに作り直す（フロアの表示は1分ごとに変わるが、店のタイマーの「時間です」に遅れないため）
struct ShopScreen: View {
    let account: String?
    let demoSeed: Bool
    let onLeave: () -> Void
    @State private var services: ShopServices
    @State private var noticeBoard = NoticeBoard()
    @State private var undo = UndoBoard()
    @State private var news = NewsBoard()
    @Environment(\.horizontalSizeClass) private var sizeClass

    init(base: ShopBase, account: String?, demoSeed: Bool = false, onLeave: @escaping () -> Void) {
        self.account = account
        self.demoSeed = demoSeed
        self.onLeave = onLeave
        _services = State(initialValue: ShopServices(base: base))
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            let state = ShopState(services: services, now: nowMs(), account: account, noticeBoard: noticeBoard, undo: undo, news: news)
            Group {
                if sizeClass == .regular {
                    PadShopView(state: state, onLeave: onLeave)
                } else {
                    PhoneShopView(state: state, onLeave: onLeave)
                }
            }
            // 新しい通知が来たらバナーを開く（No.159）
            .onChange(of: state.notices.map(\.key), initial: true) { noticeBoard.sync(state.notices) }
            // 閉店時刻（No.129）：過ぎても退店していない卓を、閉店で退店にする。1分ごと（とお客さんが変わったとき）に確かめ、退店にしたら下の帯で知らせる
            .onChange(of: CloseOutCheck(minute: state.now / 60_000, sessions: state.sessions, closingMin: state.settings.closingMin), initial: true) {
                let count = state.closeOut()
                if count > 0 { undo.tell("閉店時刻を過ぎたので、\(count)組を退店にしました") }
            }
        }
        .onAppear { services.start() }
        .onDisappear { services.stop() }
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

private struct CloseOutCheck: Equatable {
    let minute: Int
    let sessions: [Session]
    let closingMin: Int?
}
