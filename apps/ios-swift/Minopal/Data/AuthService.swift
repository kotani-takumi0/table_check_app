@preconcurrency import FirebaseAuth
@preconcurrency import FirebaseFirestore
import MinopalCore
import Observation

// ログインしている利用者（匿名ならログインせずに使っている）
struct AppUser: Equatable {
    let uid: String
    let email: String?
    let isAnonymous: Bool
}

// ログイン（packages/core/src/auth.ts の waitForUser・signInAsGuest・signInWithEmail など）
@MainActor @Observable
final class AuthService {
    private(set) var user: AppUser?
    // 端末に残っているログインを読み終えたか（読み終わるまでは最初の画面を出さない）
    private(set) var ready = false
    @ObservationIgnored private var handle: AuthStateDidChangeListenerHandle?

    init() {
        // Firebase はこの知らせをメインスレッドで呼ぶ
        handle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            MainActor.assumeIsolated {
                self?.user = user.map { AppUser(uid: $0.uid, email: $0.email, isAnonymous: $0.isAnonymous) }
                self?.ready = true
            }
        }
    }

    // ログインせずに使う：匿名でログインする（メールでログインしていたらログアウトしてから）
    func signInAsGuest() async throws {
        let auth = Auth.auth()
        if auth.currentUser?.isAnonymous == true { return }
        if auth.currentUser != nil { try auth.signOut() }
        _ = try await auth.signInAnonymously()
    }

    func signIn(email: String, password: String) async throws {
        _ = try await Auth.auth().signIn(withEmail: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
    }

    // 新規登録（No.094）：メールとパスワードでアカウントを作り、そのままログインする
    func signUp(email: String, password: String) async throws {
        _ = try await Auth.auth().createUser(withEmail: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
    }

    func signOut() throws {
        try Auth.auth().signOut()
    }

    // 店を切り替える前に、送信待ちの書き込みを送り終える（packages/core/src/auth.ts の flushPendingWrites。No.88）。
    // 送信待ちはログイン中の利用者ごとに持たれるので、送り終わる前にログイン・ログアウトすると記録が届かなくなる。
    // 少し待っても終わらなければ false（切り替えない）
    func flushPendingWrites(waitSeconds: Double = 3) async -> Bool {
        await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            let once = Once()
            Firestore.firestore().waitForPendingWrites { error in
                MainActor.assumeIsolated { if once.claim() { continuation.resume(returning: error == nil) } }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + waitSeconds) {
                MainActor.assumeIsolated { if once.claim() { continuation.resume(returning: false) } }
            }
        }
    }

    // iOS の Firebase のエラーを、Web と同じ "auth/〜" の形にする（言葉は MinopalCore の loginErrorMessage で決める）
    static func webErrorCode(_ error: Error) -> String? {
        let nsError = error as NSError
        guard nsError.domain == AuthErrorDomain, let code = AuthErrorCode(rawValue: nsError.code) else { return nil }
        switch code {
        case .invalidCredential: return "auth/invalid-credential"
        case .wrongPassword: return "auth/wrong-password"
        case .userNotFound: return "auth/user-not-found"
        case .invalidEmail: return "auth/invalid-email"
        case .tooManyRequests: return "auth/too-many-requests"
        case .networkError: return "auth/network-request-failed"
        case .userDisabled: return "auth/user-disabled"
        case .operationNotAllowed: return "auth/operation-not-allowed"
        case .emailAlreadyInUse: return "auth/email-already-in-use"
        case .weakPassword: return "auth/weak-password"
        default: return nil
        }
    }
}
