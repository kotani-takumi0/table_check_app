import MinopalCore
import SwiftUI

// 設定（No.149「設定・ログイン案」・No.160）。店全体の設定は全端末にすぐ反映する（Web の Settings.tsx と同じ中身）。
// iPhone：「設定」タブのグループのリスト。上から「今日の営業」、「お店の設定」（各まとまりへ › で進む）、「アカウント」
struct PhoneSettingsView: View {
    let state: ShopState
    let onOpen: (EditorRoute) -> Void
    let onLeave: () -> Void
    let onDeleted: () -> Void
    @State private var clearing = false

    var body: some View {
        List {
            TodaySections(state: state, clearing: $clearing)
            Section(header: SettingsHeading(text: "お店の設定")) {
                ForEach(SettingsPage.allCases.filter { $0 != .today }) { page in
                    NavigationLink(value: page) { navLabel(page) }
                        .listRowBackground(Palette.page)
                        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                        .accessibilityIdentifier("settings-\(page.rawValue)")
                }
            }
            AccountSection(account: state.account, onLeave: onLeave, onDeleted: onDeleted)
        }
        .settingsListStyle()
        // 画面の名前（iOS 26 は左に出す）。奥の画面の戻るボタンにも使う
        .navigationTitle("設定")
        .navigationDestination(for: SettingsPage.self) { page in
            SettingsPageList(page: page, state: state, onOpen: onOpen, clearing: $clearing)
                .navigationBarTitleDisplayMode(.inline)
        }
        .clearAllConfirmation(isPresented: $clearing, state: state)
    }

    // NavigationLink が › を付けるので、ここでは印・名前・今の値だけ
    private func navLabel(_ page: SettingsPage) -> some View {
        HStack(spacing: 12) {
            Image(systemName: page.symbol).font(.body).foregroundStyle(Palette.keyText).frame(width: 24).accessibilityHidden(true)
            Text(page.title).minopalFont(17, relativeTo: .body).foregroundStyle(Palette.ink)
            Spacer(minLength: 8)
            if let value = page.value(state) {
                Text(value).minopalFont(16, relativeTo: .callout, digits: true).foregroundStyle(Palette.ink2).lineLimit(1)
            }
        }
        .frame(minHeight: 48)
    }
}

// iPad：サイドバーで「設定」を選んだまま、右を 2 列にする。真ん中は目次（選んだ行は緑の塗り）とアカウント、右は中身
struct PadSettingsView: View {
    let state: ShopState
    let onOpen: (EditorRoute) -> Void
    let onLeave: () -> Void
    let onDeleted: () -> Void
    @State private var page = SettingsPage.today
    @State private var clearing = false

    var body: some View {
        HStack(spacing: 0) {
            List {
                Section {
                    ForEach(SettingsPage.allCases) { item in
                        SettingsNavRow(title: item.title, symbol: item.symbol, value: item.value(state), selected: item == page) { page = item }
                            .accessibilityIdentifier("settings-\(item.rawValue)")
                    }
                }
                AccountSection(account: state.account, onLeave: onLeave, onDeleted: onDeleted)
            }
            .settingsListStyle()
            .frame(width: 340)
            Rectangle().fill(Palette.line).frame(width: 1).ignoresSafeArea(edges: .bottom)
            SettingsPageList(page: page, state: state, onOpen: onOpen, clearing: $clearing)
                .id(page)
        }
        .background(Palette.tile)
        .clearAllConfirmation(isPresented: $clearing, state: state)
    }
}

// アカウント：ログアウトは赤い文字の行（No.149）。今の店は「ログインする」で最初の画面に戻る。
// アカウントの削除は押し間違えないよう、ログアウトとは別のまとまりにして離す（No.172）
struct AccountSection: View {
    let account: String?
    let onLeave: () -> Void
    let onDeleted: () -> Void
    @State private var confirming = false
    @State private var deleting = false

    var body: some View {
        Group {
            Section(header: SettingsHeading(text: "アカウント"),
                    footer: SettingsFootnote(text: account.map { "ログイン中：\($0)" } ?? "今の店（ログインなしで使っている店）を使っています")) {
                Button { confirming = true } label: {
                    Text(account == nil ? "ログインする" : "ログアウト")
                        .minopalFont(17, .bold, relativeTo: .body)
                        .foregroundStyle(account == nil ? Palette.keyText : Palette.nowInk)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.borderless)
                .listRowBackground(Palette.page)
            }
            Section {
                Button { deleting = true } label: {
                    Text("アカウントを削除")
                        .minopalFont(17, .bold, relativeTo: .body)
                        .foregroundStyle(Palette.nowInk)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.borderless)
                .listRowBackground(Palette.page)
                .accessibilityIdentifier("delete-account")
            }
        }
        .sheet(isPresented: $deleting) {
            AccountDeletionSheet(isAnonymous: account == nil, email: account ?? "", onDeleted: {
                deleting = false
                onDeleted()
            })
        }
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

// 全卓消去の確認（Web の ClearAllDialog と同じ言葉）。最初に選ばれているのは「やめる」。確定で notification warning のハプティクス
extension View {
    func clearAllConfirmation(isPresented: Binding<Bool>, state: ShopState) -> some View {
        let unpaid = state.unpaidTables
        return alert("全卓を消去しますか？", isPresented: isPresented) {
            Button("やめる", role: .cancel) {}
            Button("全卓を消去", role: .destructive) {
                Haptics.warning()
                state.clearAll()
            }
        } message: {
            Text("すべての卓のお客さんを画面から消します。ほかの端末の画面からも消え、元に戻せません（記録には残り、書き出しで見られます）。"
                 + (unpaid > 0 ? "\n\n会計前の卓が \(unpaid) 卓あります" : ""))
        }
    }
}
