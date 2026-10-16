import MinopalCore
import SwiftUI

// お知らせ（No.144・No.127・No.125。Web・今の iOS 版の Notices と同じ中身）：上で「今後の予定・最近の更新・ご意見を送る」を切り替える。
// 中身は設定と同じ iOS のグループのリスト（No.149）。iPad はサイドバーの「お知らせ」、iPhone は「お知らせ」タブ
struct NoticesView: View {
    let state: ShopState
    @Bindable var news: NewsBoard
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var regular: Bool { sizeClass == .regular }

    var body: some View {
        List {
            Section {
                Picker("お知らせ", selection: $news.tab) {
                    ForEach(NewsTab.allCases, id: \.self) { tab in
                        Text(tab.title).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("news-tabs")
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
            }
            switch news.tab {
            case .roadmap: roadmap
            case .updates: updates
            case .feedback: FeedbackSections(state: state, model: .shared)
            }
        }
        .settingsListStyle()
        .frame(maxWidth: 880)
        .frame(maxWidth: .infinity)
        .background(Palette.tile)
        .onAppear { news.saw(news.tab) }
        .onChange(of: news.tab) { news.saw(news.tab) }
    }

    // 今後の予定：「準備中」「検討中」に分け、日付は出さない。空のあいだは案内とご意見のボタンだけ
    @ViewBuilder private var roadmap: some View {
        let groups = roadmapGroups()
        if groups.isEmpty {
            Section {
                VStack(spacing: 16) {
                    Text(roadmapEmpty)
                        .minopalFont(regular ? 16 : 17, relativeTo: regular ? .callout : .body)
                        .foregroundStyle(Palette.ink2)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                    toFeedback
                }
                .padding(.vertical, 24)
                .listRowBackground(Palette.page)
            }
        } else {
            ForEach(groups, id: \.stage) { group in
                Section(header: SettingsHeading(text: group.stage.label)) {
                    ForEach(group.items, id: \.id) { item in roadmapRow(item) }
                }
            }
            Section(header: SettingsFootnote(text: roadmapNote).textCase(nil)) {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(roadmapCtaTitle)
                            .minopalFont(regular ? 16 : 17, .bold, relativeTo: regular ? .callout : .body)
                            .foregroundStyle(Palette.ink)
                        Text(roadmapCtaDetail)
                            .minopalFont(13, relativeTo: .footnote)
                            .foregroundStyle(Palette.ink2)
                    }
                    toFeedback
                }
                .padding(.vertical, 12)
                .listRowBackground(Palette.page)
            }
        }
    }

    private func roadmapRow(_ item: RoadmapItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.title)
                .minopalFont(regular ? 16 : 17, .bold, relativeTo: regular ? .callout : .body)
                .foregroundStyle(Palette.ink)
            Text(item.detail)
                .minopalFont(13, relativeTo: .footnote)
                .foregroundStyle(Palette.ink2)
            if item.fromFeedback {
                Label(roadmapFromFeedbackLabel, systemImage: "bubble.left")
                    .minopalFont(13, relativeTo: .footnote)
                    .foregroundStyle(Palette.ink2)
                    .padding(.top, 2)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.vertical, 12)
        .listRowBackground(Palette.page)
        .accessibilityElement(children: .combine)
    }

    private var toFeedback: some View {
        Button("ご意見を送る") { news.tab = .feedback }
            .buttonStyle(SecondaryButtonStyle())
            .accessibilityIdentifier("roadmap-feedback")
    }

    // 最近の更新：版ごとに新しくなったところ（新しい版から順）
    @ViewBuilder private var updates: some View {
        Section(header: SettingsFootnote(text: "版ごとに、新しくなったところをまとめています。いまの版は \(AppVersion.label) です。").textCase(nil)) {}
        ForEach(releaseNotes, id: \.version) { note in
            Section {
                HStack(spacing: 10) {
                    Text("v\(note.version)")
                        .minopalFont(regular ? 16 : 17, .bold, relativeTo: regular ? .callout : .body, digits: true)
                        .foregroundStyle(Palette.ink)
                        .accessibilityAddTraits(.isHeader)
                    if "v\(note.version)" == AppVersion.label {
                        Text("いまの版")
                            .minopalFont(12, .bold, relativeTo: .caption)
                            .foregroundStyle(Palette.keyText)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(Palette.keyWash, in: Capsule())
                    }
                    Spacer(minLength: 8)
                    Text(releaseDateLabel(note.date))
                        .minopalFont(13, relativeTo: .footnote, digits: true)
                        .foregroundStyle(Palette.ink2)
                }
                .frame(minHeight: Metrics.minTap)
                .listRowBackground(Palette.page)
                ForEach(note.items, id: \.self) { item in
                    Text(item)
                        .minopalFont(regular ? 15 : 16, relativeTo: regular ? .subheadline : .callout)
                        .foregroundStyle(Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.vertical, 8)
                        .listRowBackground(Palette.page)
                }
            }
        }
    }
}

// ご意見を送る：書く欄（1000 字まで）・一緒に送るもの・送るボタン。送ったあと 30 秒は待ちを出す
private struct FeedbackSections: View {
    let state: ShopState
    @Bindable var model: FeedbackDraft
    @FocusState private var focused: Bool
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        let cooldown = model.cooldownMs(now: localMs())
        Section(header: SettingsFootnote(text: "使いにくいところ・ほしい機能・おかしな動きなど、なんでも書いてください。作っている人に届きます。").textCase(nil)) {}
        Section(header: SettingsHeading(text: "ご意見"),
                footer: HStack(alignment: .top, spacing: 12) {
                    SettingsFootnote(text: note)
                    Spacer(minLength: 0)
                    Text("\(model.draft.utf16.count)/\(feedbackMax)")
                        .minopalFont(13, relativeTo: .footnote, digits: true)
                        .foregroundStyle(Palette.ink2)
                        .accessibilityHidden(true)
                }) {
            TextEditor(text: Binding(get: { model.draft }, set: { model.edit(clipped($0)) }))
                .minopalFont(sizeClass == .regular ? 16 : 17, relativeTo: .body)
                .foregroundStyle(model.checking ? Palette.ink2 : Palette.ink)
                .tint(Palette.keyText)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 168)
                .disabled(model.busy || model.checking)
                .focused($focused)
                .overlay(alignment: .topLeading) {
                    if model.draft.isEmpty {
                        Text("例：トイレチェックのボタンが押しにくい")
                            .minopalFont(sizeClass == .regular ? 16 : 17, relativeTo: .body)
                            .foregroundStyle(Palette.muted)
                            .padding(.top, 8)
                            .padding(.leading, 5)
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                    }
                }
                .accessibilityLabel("ご意見")
                .accessibilityIdentifier("feedback-text")
                // 改行も打てる欄なので、キーボードを閉じるボタンを上に出す
                .toolbar {
                    ToolbarItemGroup(placement: .keyboard) {
                        Spacer()
                        Button("完了") { focused = false }
                    }
                }
                .listRowBackground(Palette.page)
        }
        Section {
            if let result = model.result {
                Text(result.message)
                    .minopalFont(15, result.tone == .ok ? .regular : .bold, relativeTo: .subheadline)
                    .foregroundStyle(color(result.tone))
                    .fixedSize(horizontal: false, vertical: true)
                    .listRowBackground(Color.clear)
                    .accessibilityIdentifier("feedback-result")
            }
            Button(model.checking ? "確かめています…" : model.busy ? "送っています…" : "送る") {
                focused = false
                model.send(state.services.feedback, shopName: state.settings.shopName)
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(!model.canSend)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())
            .accessibilityIdentifier("feedback-send")
            if cooldown > 0 {
                Text(feedbackWaitNote((cooldown + 999) / 1000))
                    .minopalFont(13, relativeTo: .footnote, digits: true)
                    .foregroundStyle(Palette.ink2)
                    .listRowBackground(Color.clear)
            }
        }
        .onAppear {
            model.visible = true
            model.enter(shopId: state.account ?? "guest")
        }
        .onDisappear { model.visible = false }
        .onChange(of: state.account) { model.enter(shopId: state.account ?? "guest") }
    }

    // 1000 字（TS の length と同じく UTF-16 で数える）を超えた分は入れない
    private func clipped(_ text: String) -> String {
        var text = text
        while text.utf16.count > feedbackMax { text.removeLast() }
        return text
    }

    private var note: String {
        let name = state.settings.shopName
        return "アプリの版（\(AppVersion.label)）\(name.isEmpty ? "" : "と店名（\(name)）")も一緒に送ります。"
    }

    private func color(_ tone: FeedbackDraft.Tone) -> Color {
        switch tone {
        case .ok: Palette.ink
        case .pending: Palette.soonInk
        case .error: Palette.nowInk
        }
    }
}

// 新しい版になったあとに1回だけ出す帯（Web の ReleaseBar と同じ。元に戻すの帯と同じ場所・形）。× で閉じるまで残す
struct ReleaseBar: View {
    let onOpen: () -> Void
    let onClose: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Text("\(AppVersion.label) になりました")
                .minopalFont(15, .bold, relativeTo: .subheadline, digits: true)
                .foregroundStyle(Palette.ink)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button("内容を見る", action: onOpen)
                .minopalFont(15, .bold, relativeTo: .subheadline)
                .foregroundStyle(Palette.keyText)
                .padding(.horizontal, 12)
                .frame(minHeight: Metrics.minTap)
                .contentShape(Rectangle())
                .accessibilityIdentifier("release-open")
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Palette.ink2)
                    .frame(width: Metrics.minTap, height: Metrics.minTap)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("閉じる")
        }
        .padding(.leading, 18)
        .padding(.trailing, 6)
        .padding(.vertical, 6)
        .frame(minHeight: 56)
        .floatingGlass(cornerRadius: 28)
        .frame(maxWidth: 480)
        .padding(.horizontal, 16)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("release-bar")
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}
