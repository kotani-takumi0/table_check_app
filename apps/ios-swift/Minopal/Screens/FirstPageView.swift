import MinopalCore
import SwiftUI

// 最初のページ（No.161。今の iOS 版・Web の FirstPage と同じ。No.087）：ログインした店で、席の配置をまだ保存していなければ出す。
// テンプレートを選ぶと配置と設定一式を入れてすぐ使い始める。「自分で作る」は何もないマス目から配置を作る
struct FirstPageView: View {
    let account: String?
    let onStarted: () -> Void
    let onLeave: () -> Void
    @State private var repository: ShopLayoutRepository
    @State private var blank = false
    @State private var busy = false
    @State private var error = ""
    @Environment(\.horizontalSizeClass) private var sizeClass

    init(base: ShopBase, account: String?, onStarted: @escaping () -> Void, onLeave: @escaping () -> Void) {
        self.account = account
        self.onStarted = onStarted
        self.onLeave = onLeave
        _repository = State(initialValue: ShopLayoutRepository(base: base, app: AppVersion.info))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                card
                    .frame(maxWidth: 720)
                    .padding(16)
                    .frame(maxWidth: .infinity)
            }
            .background(Palette.tile)
            .navigationDestination(isPresented: $blank) {
                LayoutEditorView(layout: blankLayout, occupied: []) { layout in try await start(layout, blankSettings) }
                    .navigationBarTitleDisplayMode(.inline)
            }
        }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("お店の形を選んでください")
                .minopalFont(22, .bold, relativeTo: .title2)
                .foregroundStyle(Palette.ink)
                .accessibilityAddTraits(.isHeader)
            help("選ぶと、席の配置とコース・飲み放題の区分・店のタイマー・時間のルールが入り、すぐに使えます。あとから設定でいつでも変えられます。")
            let choices = Group {
                ForEach(shopTemplates, id: \.id) { template in
                    choice(name: template.name, help: template.help, label: "\(template.name)で始める", id: "first-template-\(template.id)") {
                        LayoutPreview(layout: template.layout)
                    } action: { choose(template) }
                }
                choice(name: "何もない状態から自分で作る", help: "マス目に卓を置いて配置を作ります。コース・区分・店のタイマーはあとから設定で足します。",
                       label: "何もない状態から自分で作る", id: "first-blank") {
                    Image(systemName: "plus")
                        .font(.title2)
                        .foregroundStyle(Palette.muted)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } action: {
                    Haptics.select()
                    blank = true
                }
            }
            if sizeClass == .regular {
                HStack(alignment: .top, spacing: 12) { choices }
            } else {
                VStack(spacing: 12) { choices }
            }
            if !error.isEmpty {
                Text(error)
                    .minopalFont(15, .bold, relativeTo: .subheadline)
                    .foregroundStyle(Palette.nowInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 12) {
                help("\(account ?? "") でログインしています")
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button("ログアウト") {
                    Haptics.select()
                    onLeave()
                }
                .buttonStyle(SecondaryButtonStyle(height: Metrics.minTap))
                .fixedSize()
            }
        }
        .padding(24)
        .background(Palette.page, in: RoundedRectangle(cornerRadius: Metrics.loginPanelRadius))
        .overlay(RoundedRectangle(cornerRadius: Metrics.loginPanelRadius).strokeBorder(Palette.line, lineWidth: 1))
        .disabled(busy)
    }

    private func help(_ text: String) -> some View {
        Text(text)
            .minopalFont(13, relativeTo: .footnote)
            .foregroundStyle(Palette.ink2)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func choice(name: String, help text: String, label: String, id: String, @ViewBuilder preview: () -> some View, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                preview()
                    .padding(6)
                    .aspectRatio(CGFloat(Grid.cols) / CGFloat(Grid.rows), contentMode: .fit)
                    .frame(maxWidth: .infinity)
                    .background(Palette.tile, in: RoundedRectangle(cornerRadius: Metrics.groupRadius))
                Text(name)
                    .minopalFont(16, .bold, relativeTo: .headline)
                    .foregroundStyle(Palette.ink)
                    .multilineTextAlignment(.leading)
                help(text)
                    .multilineTextAlignment(.leading)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .background(Palette.page, in: RoundedRectangle(cornerRadius: Metrics.loginPanelRadius))
            .overlay(RoundedRectangle(cornerRadius: Metrics.loginPanelRadius).strokeBorder(Palette.edge, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: Metrics.loginPanelRadius))
            .opacity(busy ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityHint(text)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier(id)
    }

    private func choose(_ template: ShopTemplate) {
        Haptics.select()
        busy = true
        error = ""
        Task {
            do {
                try await start(template.layout, template.settings)
            } catch {
                self.error = "始められませんでした。もう一度押してください（\(error.localizedDescription)）"
                busy = false
            }
        }
    }

    // 設定と配置を同じ書き込みで入れる（配置があれば「始めた店」とみなすので、設定だけ届かないことがないように）
    private func start(_ layout: ShopLayout, _ settings: ShopSettings) async throws {
        try await repository.startShop(layout, settings: settings)
        Haptics.success()
        onStarted()
    }
}

// テンプレートの配置を小さく見せる（卓・目印の場所だけ）
private struct LayoutPreview: View {
    let layout: ShopLayout

    var body: some View {
        GeometryReader { proxy in
            let cell = proxy.size.width / CGFloat(Grid.cols)
            ZStack(alignment: .topLeading) {
                ForEach(Array(layout.labels.enumerated()), id: \.offset) { _, label in
                    RoundedRectangle(cornerRadius: 3)
                        .strokeBorder(Palette.dash, style: StrokeStyle(lineWidth: 1, dash: [2, 2]))
                        .frame(width: CGFloat(label.box.colSpan) * cell - 2, height: CGFloat(label.box.rowSpan) * cell - 2)
                        .offset(x: CGFloat(label.box.col - 1) * cell + 1, y: CGFloat(label.box.row - 1) * cell + 1)
                }
                ForEach(layout.seats, id: \.id) { seat in
                    let shape = RoundedRectangle(cornerRadius: seat.kind == .counter ? 99 : 3)
                    shape.fill(Palette.page)
                        .overlay(shape.strokeBorder(Palette.edge, lineWidth: 1))
                        .frame(width: CGFloat(seat.box.colSpan) * cell - 2, height: CGFloat(seat.box.rowSpan) * cell - 2)
                        .offset(x: CGFloat(seat.box.col - 1) * cell + 1, y: CGFloat(seat.box.row - 1) * cell + 1)
                }
            }
        }
        .accessibilityHidden(true)
    }
}
