import Testing
@testable import MinopalCore

// packages/core/src/auth.test.ts と同じ中身
@Suite("ログイン（No.88）")
struct LoginTests {
    @Test("端末で覚えた使い方を読む（壊れた値は未選択）")
    func parsesLoginMode() {
        #expect(parseLoginMode("guest") == .guest)
        #expect(parseLoginMode("account") == .account)
        for bad in [nil, "", "admin"] { #expect(parseLoginMode(bad) == nil) }
    }

    @Test("ログインできなかった理由をお店の人の言葉にする")
    func loginMessages() {
        #expect(loginErrorMessage(code: "auth/invalid-credential") == "メールアドレスかパスワードが違います")
        #expect(loginErrorMessage(code: "auth/network-request-failed").contains("インターネット"))
        #expect(loginErrorMessage(code: nil) == "ログインできませんでした。もう一度ためしてください")
    }

    @Test("今の店はいちばん上、ログインした店は shops/{uid}/ の下に置く")
    func shopPaths() {
        #expect(ShopBase.guest.path("sessions") == "sessions")
        #expect(ShopBase.account(uid: "abc").path("sessions") == "shops/abc/sessions")
    }

    @Test("エミュレータのプロジェクトだけを、本物のデータが無いものとして扱う")
    func emulatorProject() {
        #expect(isEmulatorProject("demo-minopal"))
        #expect(!isEmulatorProject("table-check-dev"))
        #expect(!isEmulatorProject("table-check-prod"))
    }
}

@Suite("新規登録（No.094）")
struct SignUpTests {
    @Test("登録の前に、メール・パスワードの長さ・確認用を確かめる")
    func checksBeforeSignUp() {
        #expect(signUpProblem(email: " ", password: "abcdef", confirm: "abcdef") == "メールアドレスを入れてください")
        #expect(signUpProblem(email: "a@b.jp", password: "abcde", confirm: "abcde") == "パスワードは6文字以上にしてください")
        #expect(signUpProblem(email: "a@b.jp", password: "abcdef", confirm: "abcdeg") == "パスワードが確認用と違います")
        #expect(signUpProblem(email: "a@b.jp", password: "abcdef", confirm: "abcdef") == "")
    }

    @Test("作れなかった理由を、お店の人が読める言葉にする")
    func signUpMessages() {
        #expect(signUpErrorMessage(code: "auth/email-already-in-use").contains("ログインしてください"))
        #expect(signUpErrorMessage(code: "auth/invalid-email") == "メールアドレスの形が違います")
        #expect(signUpErrorMessage(code: "auth/network-request-failed").contains("インターネット"))
        #expect(signUpErrorMessage(code: nil) == "アカウントを作れませんでした。もう一度ためしてください")
    }
}
