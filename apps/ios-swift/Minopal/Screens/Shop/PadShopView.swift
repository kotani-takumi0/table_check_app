import MinopalCore
import SwiftUI

// iPad（No.149 のサイドバー v6・フロア図 v6）：左にサイドバー（幅 300pt、sidebar.left と左端のスワイプで開け閉め）、右に今の画面。
// サイドバーを開いている間はヘッダーを詰め、ロゴと店のタイマーはサイドバー側に出す（同じものを2か所に出さない）
struct PadShopView: View {
    let state: ShopState
    let onLeave: () -> Void
    @State private var visibility = NavigationSplitViewVisibility.all
    @State private var page = ShopPage.floor
    @State private var focus: FloorFocus?

    private var sidebarOpen: Bool { visibility != .detailOnly }

    var body: some View {
        NavigationSplitView(columnVisibility: $visibility) {
            ShopOverviewList(state: state, page: page, focus: focus, sidebar: true,
                             onPage: { page = $0; focus = nil },
                             onFocus: { item in page = .floor; focus = focus == item ? nil : item })
                .navigationSplitViewColumnWidth(300)
                .toolbar(removing: .sidebarToggle)
        } detail: {
            NavigationStack {
                switch page {
                case .floor: floor
                case .settings: AccountSettingsView(account: state.account, onLeave: onLeave)
                case .layout: ComingLaterView(title: "席の配置")
                case .course: ComingLaterView(title: "コース")
                }
            }
        }
        .navigationSplitViewStyle(.balanced)
        .tint(Palette.keyText)
    }

    private var floor: some View {
        GeometryReader { proxy in
            let metrics = FloorMetrics.pad(sidebarOpen: sidebarOpen, available: proxy.size)
            ScrollView([.horizontal, .vertical]) {
                FloorView(layout: state.layout, sessions: state.sessions, settings: state.settings, now: state.now, editingIds: state.editingIds,
                          focus: focus.map(state.summary.seats), metrics: metrics, onTap: state.tap)
                    .padding(metrics.padding)
                    .frame(minWidth: proxy.size.width, minHeight: proxy.size.height)
            }
            .scrollBounceBehavior(.basedOnSize, axes: [.horizontal, .vertical])
        }
        .background(Palette.tile)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    withAnimation { visibility = sidebarOpen ? .detailOnly : .all }
                } label: {
                    Image(systemName: "sidebar.left")
                }
                .accessibilityLabel(sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く")
            }
            if !sidebarOpen {
                ToolbarItem(placement: .topBarLeading) { brand }
                if !state.settings.shopTimers.isEmpty {
                    ToolbarItem(placement: .topBarLeading) { timers }
                }
            }
            ToolbarItem(placement: .topBarTrailing) { status }
        }
    }

    private var brand: some View {
        HStack(spacing: 8) {
            BrandMark(cell: 8, relativeTo: .headline)
            Text("Minopal")
                .minopalFont(17, .bold, relativeTo: .headline)
                .foregroundStyle(Palette.ink)
        }
        .fixedSize()
        .accessibilityElement(children: .combine)
    }

    // 店のタイマー（サイドバーを閉じているとき）：印・名前・残り時間と「済にする」
    private var timers: some View {
        HStack(spacing: 16) {
            ForEach(state.settings.shopTimers, id: \.id) { timer in
                let due = state.timerState(timer).due
                HStack(spacing: 8) {
                    ShopTimerMark(left: state.timerLeft(timer), due: due)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(timer.label)
                            .minopalFont(12, relativeTo: .caption)
                            .foregroundStyle(due ? Palette.nowInk : Palette.ink2)
                        Text(state.timerRest(timer))
                            .minopalFont(17, .semibold, relativeTo: .headline, digits: true)
                            .foregroundStyle(due ? Palette.nowInk : Palette.ink)
                    }
                    .lineLimit(1)
                    Button("済にする") { state.markTimerDone(timer) }
                        .minopalFont(14, .bold, relativeTo: .subheadline)
                        .foregroundStyle(Palette.keyText)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 36)
                        .overlay(Capsule().strokeBorder(Palette.keyText, lineWidth: 1.5))
                        .frame(minHeight: Metrics.minTap)
                        .contentShape(Capsule())
                        .accessibilityLabel("\(timer.label)を済にする")
                }
            }
        }
        .fixedSize()
    }

    // 右上：同期・バージョン・時刻（サイドバーを開いている間はバージョンを隠し、同期は印だけ）
    private var status: some View {
        HStack(spacing: 12) {
            SyncStatusView(state: state.services.syncState, onlyIcon: sidebarOpen)
            if !sidebarOpen {
                Text(AppVersion.label)
                    .minopalFont(13, relativeTo: .footnote, digits: true)
                    .foregroundStyle(Palette.muted)
            }
            Text(formatClock(state.now))
                .minopalFont(22, .semibold, relativeTo: .title3, digits: true)
                .foregroundStyle(Palette.ink)
        }
        .padding(.horizontal, 6)
        .fixedSize()
    }
}
