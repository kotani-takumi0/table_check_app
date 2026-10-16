import MinopalCore
import SwiftUI

// 最初の画面で選んだ使い方（端末で覚える）とログインの状態から、どの画面を出すか決める。
// 卓の画面は今は読み書きを確かめる仮の画面（本番の画面は No.157 から作る）
struct RootView: View {
    let connection: FirebaseConnection
    @State private var auth = AuthService()
    @State private var clock = ServerClock()
    @AppStorage(loginModeKey) private var storedMode: String?

    var body: some View {
        NavigationStack {
            if !auth.ready {
                ProgressView()
            } else if let base = shopBase {
                TrialFloorView(connection: connection, base: base, account: auth.user?.email) {
                    try? auth.signOut()
                    storedMode = nil
                }
            } else {
                LoginScreen(connection: connection, auth: auth) { mode in storedMode = mode.rawValue }
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

    // 選んだ使い方とログインが合っているときだけ店を開く（エミュレータを止めてログインが消えたときなどは最初の画面に戻す）
    private var shopBase: ShopBase? {
        guard let user = auth.user, let mode = parseLoginMode(storedMode) else { return nil }
        switch mode {
        case .guest: return user.isAnonymous && connection.isEmulator ? .guest : nil
        case .account: return user.isAnonymous ? nil : .account(uid: user.uid)
        }
    }
}
