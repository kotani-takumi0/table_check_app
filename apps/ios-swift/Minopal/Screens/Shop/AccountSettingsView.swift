import SwiftUI

// 設定（今はアカウントのまとまりだけ。ほかの設定は No.160 で足す）。
// ログアウトは赤い文字の行を真ん中ぞろえで置き、押したら確認を出す（No.149 で決まったこと）
struct AccountSettingsView: View {
    let account: String?
    let onLeave: () -> Void
    @State private var confirming = false

    var body: some View {
        List {
            Section {
                Button { confirming = true } label: {
                    Text(account == nil ? "ログインする" : "ログアウト")
                        .minopalFont(17, .bold, relativeTo: .body)
                        .foregroundStyle(account == nil ? Palette.keyText : Palette.nowInk)
                        .frame(maxWidth: .infinity, minHeight: Metrics.minTap)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } header: {
                Text("アカウント")
                    .minopalFont(13, .semibold, relativeTo: .footnote)
                    .foregroundStyle(Palette.ink2)
                    .textCase(nil)
            } footer: {
                Text(account.map { "ログイン中：\($0)" } ?? "今の店（ログインなしで使っている店）を使っています")
                    .minopalFont(13, relativeTo: .footnote)
                    .foregroundStyle(Palette.ink2)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Palette.tile)
        .navigationTitle("設定")
        .alert(account == nil ? "最初の画面に戻りますか？" : "ログアウトしますか？", isPresented: $confirming) {
            Button("やめる", role: .cancel) {}
            Button(account == nil ? "戻る" : "ログアウト", role: .destructive, action: onLeave)
        } message: {
            Text(account == nil
                 ? "ログインするか、ログインせずに使うかを選び直します。店のデータは消えません。"
                 : "この端末からログアウトします。店のデータは消えません。もう一度使うときはログインし直します。")
        }
    }
}
