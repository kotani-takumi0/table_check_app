import MinopalCore
import SwiftUI

// 最初の画面（No.88）：ログインせずに使うか、ログインするかを選ぶ
struct FirstPageView: View {
    let connection: FirebaseConnection
    let auth: AuthService
    let onChoose: (LoginMode) -> Void
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        Form {
            Section {
                Button("ログインせずに使う") { Task { await useAsGuest() } }
                    .disabled(busy || !connection.isEmulator)
                NavigationLink("ログインする") {
                    LoginView(auth: auth) { onChoose(.account) }
                }
            } footer: {
                if !connection.isEmulator {
                    // dev・prod のいちばん上の店には営業のデータが入っているので、試しの版ではつながない
                    Text("\(connection.projectId) には店のデータが入っているので、試しの版では「ログインせずに使う」は使えません。試し用のアカウントでログインしてください")
                }
            }
            if let error {
                Text(error).foregroundStyle(.red)
            }
            Section("つないでいる先") {
                LabeledContent("Firebase", value: connection.isEmulator ? "エミュレータ（\(connection.projectId)）" : connection.projectId)
            }
        }
        .navigationTitle("Minopal（Swift 版・試し）")
    }

    private func useAsGuest() async {
        busy = true
        defer { busy = false }
        do {
            try await auth.signInAsGuest()
            error = nil
            onChoose(.guest)
        } catch {
            self.error = loginErrorMessage(code: AuthService.webErrorCode(error))
        }
    }
}
