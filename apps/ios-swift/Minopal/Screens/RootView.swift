import MinopalCore
import SwiftUI

// 最初の画面で選んだ使い方（端末で覚える）とログインの状態から、どの画面を出すか決める
struct RootView: View {
    let connection: FirebaseConnection
    @State private var auth = AuthService()
    @State private var clock = ServerClock()
    @AppStorage(loginModeKey) private var storedMode: String?

    var body: some View {
        Group {
            if !auth.ready {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Palette.tile)
            } else if let base = shopBase {
                ShopScreen(base: base, account: auth.user?.email, demoSeed: demoSeedRequested) {
                    try? auth.signOut()
                    storedMode = nil
                }
            } else {
                NavigationStack {
                    LoginScreen(connection: connection, auth: auth) { mode in storedMode = mode.rawValue }
                }
            }
        }
        // 店が変わったら（ログイン・ログアウト）画面の重なりを作り直す。作り直さないと、ログインの画面が卓の画面の上に残る
        .id(shopBase.map { $0.path("") } ?? "first-page")
        // ログインしている間は、サーバーとの時差を測る（利用者が変わったら測り直す）
        .task(id: auth.user?.uid) {
            clock.stop()
            if let uid = auth.user?.uid { clock.start(uid: uid) }
        }
    }

    private var demoSeedRequested: Bool {
        #if DEBUG
        connection.isEmulator && DemoSeed.requested
        #else
        false
        #endif
    }

    // 選んだ使い方とログインが合っているときだけ店を開く（エミュレータを止めてログインが消えたときなどは最初の画面に戻す）
    private var shopBase: ShopBase? {
        guard let user = auth.user, let mode = parseLoginMode(storedMode) else { return nil }
        switch mode {
        case .guest: return user.isAnonymous && connection.isEmulator ? .guest : nil
        case .account: return user.isAnonymous ? nil : .account(uid: user.uid)
        }
    }
}
