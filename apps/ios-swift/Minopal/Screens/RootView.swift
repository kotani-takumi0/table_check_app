import MinopalCore
import SwiftUI

// 最初の画面で選んだ使い方（端末で覚える）とログインの状態から、どの画面を出すか決める
struct RootView: View {
    let connection: FirebaseConnection
    @State private var auth = AuthService()
    @State private var clock = ServerClock()
    @AppStorage(loginModeKey) private var storedMode: String?
    @AppStorage(DeviceSettings.appearanceKey) private var appearance = Appearance.system
    // 最初のページを出すかを確かめた店と、その答え
    @State private var checkedBase: ShopBase?
    @State private var needsFirstPage = false
    // ログアウト（今の店は「ログインする」）で、送信待ちを送り終えられなかったとき
    @State private var leaveError: String?
    // 送信待ちを待っている間（最大3秒）に続けて押されても、2回は動かさない
    @State private var leaving = false
    // UI テストで、画面を通さずにログインし終えるまで（TestLogin）。前のテストの店が一瞬出ないよう、起動したときから待つ
    @State private var testLoginPending: Bool = {
        #if DEBUG
        TestLogin.email != nil
        #else
        false
        #endif
    }()

    var body: some View {
        Group {
            if !auth.ready || testLoginPending {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Palette.tile)
            } else if let base = shopBase {
                if base != .guest && checkedBase != base {
                    // ログインした店：席の配置をまだ保存していなければ最初のページを出す（No.087）。確かめられない（オフラインなど）ときはそのまま使う
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Palette.tile)
                        .task(id: base.path("")) {
                            let saved = await ShopLayoutRepository(base: base, app: nil).isSaved()
                            needsFirstPage = saved == false
                            checkedBase = base
                        }
                } else if base != .guest && needsFirstPage {
                    FirstPageView(base: base, account: auth.user?.email, onStarted: { needsFirstPage = false }, onLeave: leave)
                } else {
                    ShopScreen(base: base, account: auth.user?.email, demoSeed: demoSeedRequested, onLeave: leave, onDeleted: { storedMode = nil })
                }
            } else {
                NavigationStack {
                    LoginScreen(connection: connection, auth: auth) { mode in storedMode = mode.rawValue }
                }
            }
        }
        // 店が変わったら（ログイン・ログアウト）画面の重なりを作り直す。作り直さないと、ログインの画面が卓の画面の上に残る
        .id(shopBase.map { $0.path("") } ?? "first-page")
        .alert("まだ切り替えられません", isPresented: Binding(get: { leaveError != nil }, set: { if !$0 { leaveError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(leaveError ?? "")
        }
        .task { await logInForTest() }
        // 設定の「この端末」で選んだ外観（端末に合わせる・ライト・ダーク）
        .preferredColorScheme(appearance.colorScheme)
        // ログインしている間は、サーバーとの時差を測る（利用者が変わったら測り直す）
        .task(id: auth.user?.uid) {
            clock.stop()
            if let uid = auth.user?.uid { clock.start(uid: uid) }
        }
    }

    // ログアウト・ログインし直す：送信待ちを送り終えてから、覚えた使い方を消して最初の画面に戻る（今の iOS 版の leave と同じ）
    private func leave() {
        guard !leaving else { return }
        leaving = true
        Task {
            defer { leaving = false }
            guard await auth.flushPendingWrites() else {
                leaveError = pendingWritesMessage
                return
            }
            try? auth.signOut()
            storedMode = nil
        }
    }

    // UI テスト用（TestLogin）：前のテストのログインを外し、引数のアカウントでログインして、その店を開く
    private func logInForTest() async {
        #if DEBUG
        guard let email = TestLogin.email else { return }
        guard connection.isEmulator else { testLoginPending = false; return }
        try? auth.signOut()
        do {
            try await auth.signIn(email: email, password: TestLogin.password)
        } catch {
            // 失敗するとログインの画面に戻り、テストは「卓が出ない」で落ちる。原因が分かるよう残す
            print("TestLogin:", error.localizedDescription)
        }
        storedMode = LoginMode.account.rawValue
        testLoginPending = false
        #endif
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
