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
    @State private var interaction = FloorInteraction()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
            // 元に戻す（どの画面でも、サイドバーの店のタイマーを済にしたときなどに出す）
            .overlay(alignment: .bottom) {
                UndoBar(board: state.undo) { state.undo.apply(state.services) }
                    .padding(.bottom, 16)
            }
        }
        .navigationSplitViewStyle(.balanced)
        .tint(Palette.keyText)
    }

    private var floor: some View {
        GeometryReader { proxy in
            let metrics = FloorMetrics.pad(sidebarOpen: sidebarOpen, available: proxy.size)
            ScrollViewReader { scroller in
                ScrollView([.horizontal, .vertical]) {
                    FloorView(state: state, interaction: interaction, focus: focus.map(state.summary.seats), metrics: metrics,
                              promptMaxHeight: proxy.size.height, ringed: state.ringedSeats(limit: 2))
                        .padding(metrics.padding)
                        .frame(minWidth: proxy.size.width, minHeight: proxy.size.height)
                }
                .scrollBounceBehavior(.basedOnSize, axes: [.horizontal, .vertical])
                // 「卓を見る」・ベル：画面の外の卓なら、その卓まで動かす
                .onChange(of: state.noticeBoard.flashRun) {
                    guard let seatId = state.noticeBoard.flashSeat else { return }
                    withAnimation(reduceMotion ? nil : .easeInOut) { scroller.scrollTo(FloorView.anchor(seatId), anchor: .center) }
                }
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) { pickBar }
        // 通知のバナー：右上（ヘッダーの下 8pt・右から 24pt）、幅 480pt で 2 枚まで。卓に重なってよい
        .overlay(alignment: .topTrailing) {
            if state.noticeBoard.open && interaction.pick == nil {
                NoticeBanners(state: state, limit: 2, compact: false) { state.noticeBoard.reveal($0) }
                    .frame(width: 480)
                    .padding(.top, 8)
                    .padding(.trailing, 24)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.snappy, value: state.noticeBoard.open)
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
            if !state.notices.isEmpty && !state.noticeBoard.open {
                ToolbarItem(placement: .topBarTrailing) {
                    NoticeBell(count: state.notices.count) { state.openNotices() }
                }
            }
            ToolbarItem(placement: .topBarTrailing) { status }
        }
    }

    // 卓の移動先・追加先を選んでいる間の帯（配置図の上）
    @ViewBuilder private var pickBar: some View {
        if let pick = interaction.pick, let picked = state.visibleSession(pick.sessionId) {
            PickBar(label: pickGuideLabel(pick.mode, from: pick.from, tableIds: picked.tableIds)) { interaction.pick = nil }
                .padding(.horizontal, 24)
                .padding(.top, 8)
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
