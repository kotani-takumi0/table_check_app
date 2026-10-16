import Foundation

// ログイン（packages/core/src/auth.ts の Swift 版）
// 端末でどちらを使うか（No.88）。guest は今の店（ログインなし）、account はログインした店
public enum LoginMode: String, Sendable {
    case guest, account
}
public let loginModeKey = "minopal:loginMode"
public func parseLoginMode(_ value: String?) -> LoginMode? {
    value.flatMap(LoginMode.init(rawValue:))
}
// 店を切り替える前に送信待ちを送り終えられなかったとき（PENDING_WRITES_MESSAGE。送り終える部分は Minopal/Data/AuthService.swift）
public let pendingWritesMessage = "送信待ちの記録があります。インターネットにつながってから、もう一度押してください"

// 新規登録（No.094）
public let passwordMin = 6
// 登録の前に手元で確かめる。直すことがあればお店の人が読める言葉で返す（無ければ空）
public func signUpProblem(email: String, password: String, confirm: String) -> String {
    if email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "メールアドレスを入れてください" }
    if password.count < passwordMin { return "パスワードは\(passwordMin)文字以上にしてください" }
    if password != confirm { return "パスワードが確認用と違います" }
    return ""
}

// ログインできなかった理由を、お店の人が読める言葉にする。code は Firebase のエラーコード（Web と同じ "auth/〜" の形）
public func loginErrorMessage(code: String?) -> String {
    switch code {
    case "auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email":
        "メールアドレスかパスワードが違います"
    case "auth/missing-password": "パスワードを入れてください"
    case "auth/too-many-requests": "何度も失敗したので、少し待ってからもう一度ためしてください"
    case "auth/network-request-failed": "インターネットにつながっていません。つながってからもう一度ためしてください"
    case "auth/user-disabled": "このアカウントは使えなくなっています"
    case "auth/operation-not-allowed": "メールでのログインがまだ使えません（Firebase の設定でオンにしてください）"
    default: "ログインできませんでした。もう一度ためしてください"
    }
}

// アカウントを作れなかった理由（No.094）。ログインと同じ理由はログインの言葉を使う
public func signUpErrorMessage(code: String?) -> String {
    switch code {
    case "auth/email-already-in-use": "このメールアドレスのアカウントはもうあります。ログインしてください"
    case "auth/invalid-email": "メールアドレスの形が違います"
    case "auth/weak-password": "パスワードは\(passwordMin)文字以上にしてください"
    case "auth/too-many-requests", "auth/network-request-failed", "auth/operation-not-allowed": loginErrorMessage(code: code)
    default: "アカウントを作れませんでした。もう一度ためしてください"
    }
}
