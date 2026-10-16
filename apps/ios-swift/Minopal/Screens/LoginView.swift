import MinopalCore
import SwiftUI

// メールでログインする・アカウントを作る（No.88・No.094）
struct LoginView: View {
    let auth: AuthService
    let onSignedIn: () -> Void
    @State private var email = ""
    @State private var password = ""
    @State private var confirm = ""
    @State private var signingUp = false
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        Form {
            Section {
                TextField("メールアドレス", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("パスワード", text: $password)
                    .textContentType(signingUp ? .newPassword : .password)
                if signingUp {
                    SecureField("パスワード（確認用）", text: $confirm)
                        .textContentType(.newPassword)
                }
            }
            if let error {
                Text(error).foregroundStyle(.red)
            }
            Section {
                Button(signingUp ? "アカウントを作る" : "ログイン") { Task { await submit() } }
                    .disabled(busy)
                Button(signingUp ? "アカウントがある：ログインする" : "はじめて：アカウントを作る") {
                    signingUp.toggle()
                    error = nil
                }
            }
        }
        .navigationTitle(signingUp ? "アカウントを作る" : "ログイン")
    }

    private func submit() async {
        if signingUp {
            let problem = signUpProblem(email: email, password: password, confirm: confirm)
            if !problem.isEmpty { error = problem; return }
        }
        busy = true
        defer { busy = false }
        do {
            if signingUp { try await auth.signUp(email: email, password: password) }
            else { try await auth.signIn(email: email, password: password) }
            error = nil
            onSignedIn()
        } catch {
            let code = AuthService.webErrorCode(error)
            self.error = signingUp ? signUpErrorMessage(code: code) : loginErrorMessage(code: code)
        }
    }
}
