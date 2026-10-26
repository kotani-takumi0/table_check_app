@preconcurrency import FirebaseAuth
@preconcurrency import FirebaseFunctions
import MinopalCore

// アカウント削除の呼び出し（No.172）。消す店はサーバーがログイン中の uid から決めるので、引数は渡さない
@MainActor
final class FirebaseAccountDeletion: AccountDeletionClient {
    private let email: String
    private let onDeleted: @MainActor () -> Void

    init(email: String, onDeleted: @escaping @MainActor () -> Void) {
        self.email = email
        self.onDeleted = onDeleted
    }

    func reauthenticate(password: String) async throws {
        guard let user = Auth.auth().currentUser else { throw AccountDeletionError.notSignedIn }
        let address = email.isEmpty ? (user.email ?? "") : email
        guard !address.isEmpty else { throw AccountDeletionError.notSignedIn }
        let credential = EmailAuthProvider.credential(withEmail: address, password: password)
        do {
            try await user.reauthenticate(with: credential)
        } catch let error as AccountDeletionError {
            throw error
        } catch {
            throw accountDeletionError(authCode: AuthService.webErrorCode(error), functionsCode: nil, reason: nil)
        }
    }

    func deleteAccount() async throws {
        guard Auth.auth().currentUser != nil else { throw AccountDeletionError.notSignedIn }
        // オフラインでたまった書き込みが、サーバーで消したあとに届くと、持ち主のいないデータが残る。
        // ログアウト（leave）と同じく、送り切ってから関数を呼ぶ。送り切れなければ止め、理由を出す
        try await flushThenDeleteAccount(flush: { await AuthService.flushPendingWrites() }) {
            guard let user = Auth.auth().currentUser else { throw AccountDeletionError.notSignedIn }
            // パスワードの入れ直しで更新した auth_time を、関数に渡すトークンへ載せる
            _ = try await user.getIDToken(forcingRefresh: true)
            do {
                _ = try await Functions.functions(region: FirebaseSetup.functionsRegion).httpsCallable("deleteAccount").call()
            } catch let error as AccountDeletionError {
                throw error
            } catch {
                throw Self.functionsError(error)
            }
        }
    }

    func signOut() throws {
        let notify = onDeleted
        try Auth.auth().signOut()
        notify()
    }

    private static func functionsError(_ error: Error) -> AccountDeletionError {
        let nsError = error as NSError
        guard nsError.domain == FunctionsErrorDomain, let code = FunctionsErrorCode(rawValue: nsError.code) else {
            return .failed
        }
        let functionsCode: String
        switch code {
        case .unauthenticated: functionsCode = "unauthenticated"
        case .failedPrecondition: functionsCode = "failed-precondition"
        default: functionsCode = "other"
        }
        let details = (nsError.userInfo[FunctionsErrorDetailsKey] as? [String: Any]) ?? (nsError.userInfo["details"] as? [String: Any])
        return accountDeletionError(authCode: nil, functionsCode: functionsCode, reason: details?["reason"] as? String)
    }
}
