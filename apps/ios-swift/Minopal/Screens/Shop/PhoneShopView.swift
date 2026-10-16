import MinopalCore
import SwiftUI

// iPhone（No.149 の iPhone案）：タブは「テーブル状況・お店・お知らせ・設定」。
// テーブル状況は上に帯（いま対応・L.O.・空席・店のタイマー）、その下に配置図（iPad と同じ並びで回さない。横に入らない分は横スクロール）
struct PhoneShopView: View {
    let state: ShopState
    let onLeave: () -> Void
    @State private var tab = Tab.floor
    @State private var focus: FloorFocus?
    @State private var shopPath: [ShopPage] = []
    @State private var interaction = FloorInteraction()

    private enum Tab: Hashable { case floor, shop, notices, settings }

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { floor }
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
                        ComingLaterView(title: page == .layout ? "席の配置" : "コース")
                    }
            }
            .tabItem { Label("お店", systemImage: "house") }
            .tag(Tab.shop)
            NavigationStack { ComingLaterView(title: "お知らせ") }
                .tabItem { Label("お知らせ", systemImage: "bell") }
                .tag(Tab.notices)
            NavigationStack { AccountSettingsView(account: state.account, onLeave: onLeave) }
                .tabItem { Label("設定", systemImage: "gearshape") }
                .tag(Tab.settings)
        }
        // タブのアイコンは線（ふだんは monochrome。No.149 の SF Symbols の決まり）
        .environment(\.symbolVariants, .none)
        .tint(Palette.keyText)
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
            ScrollView(.horizontal, showsIndicators: false) {
                FloorView(state: state, interaction: interaction, focus: focus.map(state.summary.seats), metrics: .phone)
                    .padding(FloorMetrics.phone.padding)
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
            ToolbarItem(placement: .topBarTrailing) { clock }
        }
    }

    // 帯：いま対応・L.O.・空席（押すとその卓を目立たせる）と店のタイマー（時間が来たものを先に）。横にスクロール
    private var chips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(FloorFocus.allCases, id: \.self) { item in
                    focusChip(item)
                }
                let timers = state.settings.shopTimers.sorted { state.timerState($0).due && !state.timerState($1).due }
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
        let due = state.timerState(timer).due
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
