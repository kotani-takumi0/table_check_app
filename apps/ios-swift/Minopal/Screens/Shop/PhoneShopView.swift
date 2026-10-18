import MinopalCore
import SwiftUI

// iPhone（No.149 の iPhone案）：タブは「テーブル状況・お店・お知らせ・設定」。
// テーブル状況は上に帯（いま対応・L.O.・空席・店のタイマー）、その下に配置図（iPad と同じ並びで回さない。横に入らない分は横スクロール）
struct PhoneShopView: View {
    let state: ShopState
    let onLeave: () -> Void
    let onDeleted: () -> Void
    @State private var tab = Tab.floor
    @State private var focus: FloorFocus?
    @State private var shopPath = NavigationPath()
    @State private var settingsPath = NavigationPath()
    @State private var interaction = FloorInteraction()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Tab: Hashable { case floor, shop, notices, settings }

    var body: some View {
        TabView(selection: tabSelection) {
            NavigationStack { floor }
                // 通知のバナー：上（Dynamic Island の下）に左右 12pt で 1 枚。ヘッダーと卓に重なってよい。上へスワイプでもベルにしまう
                .overlay(alignment: .top) {
                    if state.noticeBoard.open && interaction.pick == nil {
                        NoticeBanners(state: state, limit: 1, compact: true) { state.noticeBoard.reveal($0) }
                            .padding(.horizontal, 12)
                            .gesture(DragGesture(minimumDistance: 20).onEnded { drag in
                                if drag.translation.height < -30 { state.noticeBoard.tuck() }
                            })
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }
                }
                .animation(.snappy, value: state.noticeBoard.open)
                .overlay(alignment: .bottom) { floorBar }
                .tabItem { Label("テーブル状況", systemImage: "square.grid.2x2") }
                .tag(Tab.floor)
            NavigationStack(path: $shopPath) {
                ShopOverviewList(state: state, page: .floor, focus: nil, sidebar: false,
                                 onPage: { page in
                                     if page == .floor { focus = nil; tab = .floor } else { shopPath.append(page) }
                                 },
                                 onFocus: { item in focus = item; tab = .floor })
                    .toolbar { ToolbarItem(placement: .topBarTrailing) { clock } }
                    .navigationDestination(for: ShopPage.self) { page in
                        if page == .layout {
                            EditorDestination(route: .layout, state: state)
                                .navigationBarTitleDisplayMode(.inline)
                        } else {
                            SettingsPageList(page: .course, state: state, onOpen: { shopPath.append($0) }, clearing: .constant(false))
                                .navigationBarTitleDisplayMode(.inline)
                        }
                    }
                    .navigationDestination(for: EditorRoute.self) { route in
                        EditorDestination(route: route, state: state)
                            .navigationBarTitleDisplayMode(.inline)
                    }
            }
            // お店タブの店のタイマーを済にしたとき
            .overlay(alignment: .bottom) { undoBar }
            .tabItem { Label("お店", systemImage: "house") }
            .tag(Tab.shop)
            NavigationStack {
                NoticesView(state: state, news: state.news)
                    .navigationTitle("お知らせ")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { trailingItems }
            }
            .tabItem { Label("お知らせ", systemImage: "bell") }
            // 新しい予定があるときの印（Web のメニューの点と同じ）
            .badge(state.news.roadmapNew ? Text("新") : nil)
            .tag(Tab.notices)
            NavigationStack(path: $settingsPath) {
                PhoneSettingsView(state: state, onOpen: { settingsPath.append($0) }, onLeave: onLeave, onDeleted: onDeleted)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { trailingItems }
                    .navigationDestination(for: EditorRoute.self) { route in
                        EditorDestination(route: route, state: state)
                            .navigationBarTitleDisplayMode(.inline)
                    }
            }
            .overlay(alignment: .bottom) { undoBar }
            .tabItem { Label("設定", systemImage: "gearshape") }
                .tag(Tab.settings)
        }
        // タブのアイコンは線（ふだんは monochrome。No.149 の SF Symbols の決まり）
        .environment(\.symbolVariants, .none)
        .tint(Palette.keyText)
    }

    // お知らせはタブから開くと今後の予定から（今の iOS 版と同じ）。帯の「内容を見る」は最近の更新を開く
    private var tabSelection: Binding<Tab> {
        Binding(get: { tab }, set: { next in
            if next == .notices && tab != .notices { state.news.tab = .roadmap }
            tab = next
        })
    }

    private var floor: some View {
        VStack(spacing: 0) {
            // 卓の移動先・追加先を選んでいる間は、帯の代わりにどこを押すかを出す
            if let pick = interaction.pick, let picked = state.visibleSession(pick.sessionId) {
                PickBar(label: pickGuideLabel(pick.mode, from: pick.from, tableIds: picked.tableIds)) { interaction.pick = nil }
                    .padding(.horizontal, 16)
                    .frame(minHeight: 52)
            } else {
                chips
            }
            ScrollViewReader { scroller in
                ScrollView(.horizontal, showsIndicators: false) {
                    FloorView(state: state, interaction: interaction, focus: focus.map(state.summary.seats), metrics: .phone,
                              ringed: state.ringedSeats(limit: 1))
                        .padding(FloorMetrics.phone.padding)
                }
                // 「卓を見る」・ベル：右にはみ出している卓なら、その卓まで横にスクロールする
                .onChange(of: state.noticeBoard.flashRun) {
                    guard let seatId = state.noticeBoard.flashSeat else { return }
                    withAnimation(reduceMotion ? nil : .easeInOut) { scroller.scrollTo(FloorView.anchor(seatId), anchor: .center) }
                }
            }
            // 右に続きがあることが分かるよう、右端に影を出す
            .overlay(alignment: .trailing) {
                LinearGradient(colors: [.clear, .black.opacity(0.08)], startPoint: .leading, endPoint: .trailing)
                    .frame(width: 16)
                    .allowsHitTesting(false)
            }
            Spacer(minLength: 0)
        }
        .background(Palette.tile)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Text("テーブル状況")
                    .minopalFont(17, .bold, relativeTo: .headline)
                    .foregroundStyle(Palette.ink)
                    .fixedSize()
                    .accessibilityAddTraits(.isHeader)
            }
            // 同期済みのときは出さない。送信待ち・オフラインのときだけ、時刻の前に出す
            if state.services.syncState != .synced {
                ToolbarItem(placement: .topBarTrailing) { SyncStatusView(state: state.services.syncState).padding(.horizontal, 6).fixedSize() }
            }
            if !state.notices.isEmpty && !state.noticeBoard.open {
                ToolbarItem(placement: .topBarTrailing) {
                    NoticeBell(count: state.notices.count, showsLabel: false) { state.openNotices() }
                }
            }
            ToolbarItem(placement: .topBarTrailing) { clock }
        }
    }

    // 設定・お知らせのヘッダーの右：通知のベルと時刻。
    // 通知のバナーはテーブル状況に出すので、ベルを押したらテーブル状況に戻して開く
    @ToolbarContentBuilder private var trailingItems: some ToolbarContent {
        if !state.notices.isEmpty {
            ToolbarItem(placement: .topBarTrailing) {
                NoticeBell(count: state.notices.count, showsLabel: false) {
                    tab = .floor
                    state.openNotices()
                }
            }
        }
        ToolbarItem(placement: .topBarTrailing) { clock }
    }

    // テーブル状況の下の帯：元に戻すが無いときだけ、新しい版になったことを出す（Web と同じ場所）
    @ViewBuilder private var floorBar: some View {
        if state.undo.message == nil && state.news.announce && interaction.pick == nil {
            ReleaseBar(onOpen: {
                state.news.openUpdates()
                tab = .notices
            }, onClose: { state.news.markReleaseSeen() })
            .padding(.bottom, 8)
        } else {
            undoBar
        }
    }

    private var undoBar: some View {
        UndoBar(board: state.undo) { state.undo.apply(state.services) }
            .padding(.bottom, 8)
    }

    // 帯：いま対応・L.O.・空席（押すとその卓を目立たせる）と店のタイマー（時間が来たものを先に）。横にスクロール
    private var chips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if state.settings.rules.timeLimitOff {
                    TimeLimitOffChip { tab = .settings }
                }
                ForEach(FloorFocus.allCases, id: \.self) { item in
                    focusChip(item)
                }
                let timers = state.settings.shopTimers.sorted { state.timerDue($0) && !state.timerDue($1) }
                if !timers.isEmpty {
                    Rectangle().fill(Palette.line).frame(width: 1, height: 28)
                    ForEach(timers, id: \.id) { timer in timerChip(timer) }
                }
            }
            .padding(.horizontal, 16)
        }
        .frame(height: 52)
    }

    private func focusChip(_ item: FloorFocus) -> some View {
        let count = state.summary.seats(item).count
        let selected = focus == item
        let (wash, ink): (Color, Color) = switch item {
        case .now: count > 0 ? (Palette.nowWash, Palette.nowInk) : (Palette.page, Palette.ink)
        case .soon: count > 0 ? (Palette.soonWash, Palette.soonInk) : (Palette.page, Palette.ink)
        case .empty: (Palette.page, Palette.ink)
        }
        return Button { focus = selected ? nil : item } label: {
            HStack(spacing: 6) {
                Text(item.chip).minopalFont(15, .bold, relativeTo: .subheadline).foregroundStyle(Palette.ink)
                Text("\(count)").minopalFont(16, .bold, relativeTo: .callout, digits: true).foregroundStyle(ink)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 36)
            .background(wash, in: Capsule())
            .overlay(Capsule().strokeBorder(selected ? Palette.keyText : Palette.edge, lineWidth: selected ? 2 : 1))
            .frame(minHeight: Metrics.minTap)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(item.title) \(count)卓")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func timerChip(_ timer: ShopTimer) -> some View {
        let due = state.timerDue(timer)
        return HStack(spacing: 6) {
            ShopTimerMark(left: state.timerLeft(timer), due: due)
            Text(timer.label).minopalFont(13, relativeTo: .caption).foregroundStyle(due ? Palette.nowInk : Palette.ink2)
            Text(state.timerRest(timer)).minopalFont(15, .semibold, relativeTo: .headline, digits: true).foregroundStyle(due ? Palette.nowInk : Palette.ink)
        }
        .lineLimit(1)
        .padding(.horizontal, 12)
        .frame(minHeight: 36)
        .background(Palette.page, in: Capsule())
        .overlay(Capsule().strokeBorder(due ? Palette.now : Palette.edge, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }

    private var clock: some View {
        Text(formatClock(state.now))
            .minopalFont(20, .semibold, relativeTo: .title3, digits: true)
            .foregroundStyle(Palette.ink)
            .padding(.horizontal, 6)
            .fixedSize()
    }
}
