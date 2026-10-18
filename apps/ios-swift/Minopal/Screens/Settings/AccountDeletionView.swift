import MinopalCore
import SwiftUI

// アカウントを消す（No.172）。設定の「アカウント」から開く。メールの店はパスワードの入れ直し、匿名は確認だけ
struct AccountDeletionSheet: View {
    @State private var model: AccountDeletionModel

    init(isAnonymous: Bool, email: String, onDeleted: @escaping @MainActor () -> Void) {
        _model = State(initialValue: AccountDeletionModel(
            isAnonymous: isAnonymous,
            client: FirebaseAccountDeletion(email: email, onDeleted: onDeleted)
        ))
    }

    var body: some View {
        NavigationStack {
            AccountDeletionForm(model: model)
        }
    }
}

private struct AccountDeletionForm: View {
    @Bindable var model: AccountDeletionModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            switch model.step {
            case .password:
                Section(footer: SettingsFootnote(text: "本人確認のため、パスワードを入れ直してください")) {
                    SecureField("パスワード", text: $model.password)
                        .textContentType(.password)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.go)
                        .onSubmit { Task { await model.submitPassword() } }
                        .accessibilityIdentifier("delete-account-password")
                        .listRowBackground(Palette.page)
                }
            case .confirm:
                Section {
                    Text("この店のデータ（席・履歴・設定）がすべて消えます。元に戻せません")
                        .minopalFont(17, relativeTo: .body)
                        .foregroundStyle(Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("delete-account-warning")
                        .listRowBackground(Palette.page)
                }
            }
            if !model.message.isEmpty {
                Section {
                    Text(model.message)
                        .minopalFont(15, .bold, relativeTo: .subheadline)
                        .foregroundStyle(Palette.nowInk)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("delete-account-error")
                        .listRowBackground(Palette.page)
                }
            }
            Section {
                Button(action: submit) {
                    Text(buttonTitle)
                        .minopalFont(17, .bold, relativeTo: .body)
                        .foregroundStyle(model.step == .confirm ? Palette.nowInk : Palette.keyText)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.borderless)
                .disabled(model.busy)
                .listRowBackground(Palette.page)
                .accessibilityIdentifier(model.step == .confirm ? "delete-account-confirm" : "delete-account-next")
            }
        }
        .settingsListStyle()
        .navigationTitle("アカウントを削除")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("やめる") { dismiss() }
                    .disabled(model.busy)
            }
        }
    }

    private var buttonTitle: String {
        if model.busy { return model.step == .confirm ? "消しています…" : "確認しています…" }
        return model.step == .confirm ? "アカウントを削除" : "次へ"
    }

    private func submit() {
        if model.step == .confirm { Haptics.warning() }
        Task {
            switch model.step {
            case .password: await model.submitPassword()
            case .confirm: await model.confirmDelete()
            }
        }
    }
}
