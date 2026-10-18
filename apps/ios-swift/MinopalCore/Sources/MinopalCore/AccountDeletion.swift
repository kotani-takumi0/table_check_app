import Foundation
import Observation

// 設定からアカウントを消す（No.172）。画面の進み方と、失敗したときの言葉。Firebase には依存しない
public enum AccountDeletionStep: Equatable, Sendable {
    case password
    case confirm
}

public enum AccountDeletionError: Error, Equatable, Sendable {
    case wrongPassword
    case recentLoginRequired
    case notSignedIn
    case failed
}

// Cloud Functions が details.reason に入れる（deleteAccount.ts の RECENT_LOGIN_REQUIRED と同じ）
public let recentLoginRequiredReason = "recent-login-required"

public func accountDeletionMessage(_ error: AccountDeletionError, isAnonymous: Bool) -> String {
    switch error {
    case .wrongPassword:
        "パスワードが違います"
    case .recentLoginRequired:
        isAnonymous
            ? "ログインしてから時間が経ちました。一度ログアウトして入り直し、もう一度消してください"
            : "パスワードを入れ直してください"
    case .notSignedIn:
        "ログインしていません。入り直してからもう一度ためしてください"
    case .failed:
        "アカウントを消せませんでした。もう一度ためしてください"
    }
}

// ログインのエラーコード（Web と同じ "auth/〜"）と、Functions のコードから、画面の失敗に分ける
public func accountDeletionError(authCode: String?, functionsCode: String?, reason: String?) -> AccountDeletionError {
    if let functionsCode {
        if functionsCode == "unauthenticated" { return .notSignedIn }
        if functionsCode == "failed-precondition", reason == recentLoginRequiredReason { return .recentLoginRequired }
        return .failed
    }
    switch authCode {
    case "auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email", "auth/missing-password":
        return .wrongPassword
    default:
        return .failed
    }
}

@MainActor
public protocol AccountDeletionClient: AnyObject {
    func reauthenticate(password: String) async throws
    func deleteAccount() async throws
    func signOut() throws
}

// メールの店はパスワードの入れ直し → 確認。匿名（ログインせずに使う）は確認だけ
@MainActor
@Observable
public final class AccountDeletionModel {
    public let isAnonymous: Bool
    public private(set) var step: AccountDeletionStep
    public var password = ""
    public private(set) var message = ""
    public private(set) var busy = false
    public private(set) var finished = false
    private let client: any AccountDeletionClient

    public init(isAnonymous: Bool, client: any AccountDeletionClient) {
        self.isAnonymous = isAnonymous
        self.client = client
        self.step = isAnonymous ? .confirm : .password
    }

    public func submitPassword() async {
        guard !busy, step == .password else { return }
        if password.isEmpty {
            message = "パスワードを入れてください"
            return
        }
        message = ""
        busy = true
        defer { busy = false }
        do {
            try await client.reauthenticate(password: password)
            step = .confirm
        } catch let error as AccountDeletionError {
            message = accountDeletionMessage(error, isAnonymous: isAnonymous)
        } catch {
            message = accountDeletionMessage(.failed, isAnonymous: isAnonymous)
        }
    }

    public func confirmDelete() async {
        guard !busy, step == .confirm else { return }
        message = ""
        busy = true
        defer { busy = false }
        do {
            try await client.deleteAccount()
            try client.signOut()
            finished = true
        } catch let error as AccountDeletionError {
            message = accountDeletionMessage(error, isAnonymous: isAnonymous)
            if error == .recentLoginRequired, !isAnonymous {
                step = .password
                password = ""
            }
        } catch {
            message = accountDeletionMessage(.failed, isAnonymous: isAnonymous)
        }
    }
}
