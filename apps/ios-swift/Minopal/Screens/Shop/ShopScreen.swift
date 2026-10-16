import MinopalCore
import SwiftUI

// ログインしたあとの店の画面。iPad（幅が広い）はサイドバー、iPhone（幅が狭い）はタブ。
// 経過・残り時間は1秒ごとに作り直す（フロアの表示は1分ごとに変わるが、店のタイマーの「時間です」に遅れないため）
struct ShopScreen: View {
    let account: String?
    let demoSeed: Bool
    let onLeave: () -> Void
    @State private var services: ShopServices
    @Environment(\.horizontalSizeClass) private var sizeClass

    init(base: ShopBase, account: String?, demoSeed: Bool = false, onLeave: @escaping () -> Void) {
        self.account = account
        self.demoSeed = demoSeed
        self.onLeave = onLeave
        _services = State(initialValue: ShopServices(base: base))
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            let state = ShopState(services: services, now: nowMs(), account: account)
            if sizeClass == .regular {
                PadShopView(state: state, onLeave: onLeave)
            } else {
                PhoneShopView(state: state, onLeave: onLeave)
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
