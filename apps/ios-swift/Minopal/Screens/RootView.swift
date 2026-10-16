import MinopalCore
import SwiftUI

// 最初の画面で選んだ使い方（端末で覚える）とログインの状態から、どの画面を出すか決める。
// 本番の画面は「Swift版の画面を作る」（No.150）で作る。今はログインと読み書きを確かめる仮の画面
struct RootView: View {
    let connection: FirebaseConnection
    @State private var auth = AuthService()
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
                FirstPageView(connection: connection, auth: auth) { mode in storedMode = mode.rawValue }
            }
        }
        // 店が変わったら（ログイン・ログアウト）画面の重なりを作り直す。作り直さないと、ログインの画面が卓の画面の上に残る
        .id(shopBase.map { $0.path("") } ?? "first-page")
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
