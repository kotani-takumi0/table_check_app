import MinopalCore
import SwiftUI

// 最初の画面（Web の LoginScreen と同じ中身・順番。No.88・No.094）：ログインするか、ログインせずに今の店のデータで使うかを選ぶ。
// はじめての店はここでアカウントを作る。見た目は No.149 の ipad_login_*_lg・iphone_login_*_lg
struct LoginScreen: View {
    let connection: FirebaseConnection
    let auth: AuthService
    let onChoose: (LoginMode) -> Void
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var signingUp = false
    @State private var email = ""
    @State private var password = ""
    @State private var confirm = ""
    @State private var error = ""
    @State private var busy = false
    @FocusState private var focus: Field?

    private enum Field { case email, password, confirm }

    var body: some View {
        // 画面より高くないときは真ん中に置き、文字を大きくして入らないときは画面ごとスクロールする
        GeometryReader { proxy in
            ScrollView {
                panel.frame(maxWidth: .infinity, minHeight: proxy.size.height)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
        }
        .background(Palette.tile)
        .toolbar(.hidden, for: .navigationBar)
    }

    @ViewBuilder private var panel: some View {
        if sizeClass == .regular {
            // iPad：真ん中に幅 440pt の白い面
            content
                .padding(40)
                .frame(maxWidth: 440)
                .background(Palette.page, in: RoundedRectangle(cornerRadius: Metrics.loginPanelRadius))
                .overlay(RoundedRectangle(cornerRadius: Metrics.loginPanelRadius).strokeBorder(Palette.line, lineWidth: 1))
                .shadow(color: .black.opacity(0.06), radius: 12, y: 4)
                .padding(24)
        } else {
            // iPhone：全面に左右 24pt
            content.padding(.horizontal, 24).padding(.vertical, 32)
        }
    }

    private var content: some View {
        VStack(spacing: 24) {
            VStack(spacing: 6) {
                HStack(spacing: 12) {
                    BrandMark(cell: 13, relativeTo: .title)
                    Text("Minopal")
                        .minopalFont(28, .heavy, relativeTo: .title)
                        .foregroundStyle(Palette.ink)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
                Text("飲食店ホールの卓タイマー")
                    .minopalFont(15, relativeTo: .subheadline)
                    .foregroundStyle(Palette.ink2)
            }
            form
            divider
            guest
        }
    }

    private var form: some View {
        VStack(spacing: 16) {
            LabeledField(label: "メールアドレス", text: $email, field: Field.email, focus: $focus,
                         contentType: signingUp ? .emailAddress : .username, keyboard: .emailAddress, submitLabel: .next) {
                focus = .password
            }
            LabeledField(label: signingUp ? "パスワード（\(passwordMin)文字以上）" : "パスワード", text: $password, field: Field.password, focus: $focus,
                         secure: true, contentType: signingUp ? .newPassword : .password, submitLabel: signingUp ? .next : .go) {
                if signingUp { focus = .confirm } else { submit() }
            }
            if signingUp {
                LabeledField(label: "パスワード（確認のため、もう一度）", text: $confirm, field: Field.confirm, focus: $focus,
                             secure: true, contentType: .newPassword, submitLabel: .go) { submit() }
            }
            if !error.isEmpty {
                Text(error)
                    .minopalFont(15, .bold, relativeTo: .subheadline)
                    .foregroundStyle(Palette.nowInk)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityAddTraits(.isStaticText)
            }
            VStack(spacing: 8) {
                Button(submitTitle, action: submit)
                    .buttonStyle(PrimaryButtonStyle(height: Metrics.loginButton))
                    .disabled(busy)
                HStack(spacing: 4) {
                    Text(signingUp ? "アカウントがある店は" : "はじめての店は")
                        .minopalFont(15, relativeTo: .subheadline)
                        .foregroundStyle(Palette.ink2)
                    Button(signingUp ? "ログイン" : "アカウントを作る", action: switchMode)
                        .buttonStyle(LinkButtonStyle())
                        .disabled(busy)
                }
            }
        }
    }

    private var divider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(Palette.line).frame(height: 1)
            Text("または")
                .minopalFont(13, relativeTo: .footnote)
                .foregroundStyle(Palette.muted)
                .fixedSize()
            Rectangle().fill(Palette.line).frame(height: 1)
        }
        .accessibilityHidden(true)
    }

    private var guest: some View {
        VStack(spacing: 12) {
            Button("ログインせずに使う", action: useAsGuest)
                .buttonStyle(SecondaryButtonStyle(height: Metrics.loginButton))
                .disabled(busy || !connection.isEmulator)
            Text(connection.isEmulator
                 ? "今の店（ログインなしで使っている店）のデータで使います。"
                 // dev・prod のいちばん上の店には営業のデータが入っているので、試しの版ではつながない
                 : "\(connection.projectId) には店のデータが入っているので、試しの版では「ログインせずに使う」は使えません。試し用のアカウントでログインしてください。")
                .minopalFont(13, relativeTo: .footnote)
                .foregroundStyle(Palette.ink2)
                .multilineTextAlignment(.center)
        }
    }

    private var submitTitle: String {
        if signingUp { busy ? "アカウントを作っています…" : "アカウントを作る" } else { busy ? "ログインしています…" : "ログイン" }
    }

    private func switchMode() {
        signingUp.toggle()
        confirm = ""
        error = ""
    }

    private func submit() {
        if signingUp {
            let problem = signUpProblem(email: email, password: password, confirm: confirm)
            if !problem.isEmpty { error = problem; return }
        }
        focus = nil
        Task {
            busy = true
            defer { busy = false }
            do {
                if signingUp { try await auth.signUp(email: email, password: password) }
                else { try await auth.signIn(email: email, password: password) }
                error = ""
                onChoose(.account)
            } catch {
                let code = AuthService.webErrorCode(error)
                self.error = signingUp ? signUpErrorMessage(code: code) : loginErrorMessage(code: code)
            }
        }
    }

    private func useAsGuest() {
        Task {
            busy = true
            defer { busy = false }
            do {
                try await auth.signInAsGuest()
                error = ""
                onChoose(.guest)
            } catch {
                self.error = loginErrorMessage(code: AuthService.webErrorCode(error))
            }
        }
    }
}
