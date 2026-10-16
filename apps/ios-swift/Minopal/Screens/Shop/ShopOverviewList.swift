import MinopalCore
import SwiftUI

// 店のまとめ（No.149 のサイドバー v6・iPhone のお店タブ）：上に店名と日付、まとまりは「フロア」「店のタイマー」「お店の準備」。
// 行には今の中身（卓の数・残り時間）を出す。iPad はサイドバー（選んだ行を緑で塗る）、iPhone はお店タブ（グループのリスト）
struct ShopOverviewList: View {
    let state: ShopState
    let page: ShopPage
    let focus: FloorFocus?
    let sidebar: Bool                  // iPad のサイドバーか（iPhone はお店タブ。設定はタブにあるので出さない）
    let onPage: (ShopPage) -> Void
    let onFocus: (FloorFocus) -> Void

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text(state.shopName)
                        .minopalFont(sidebar ? 28 : 34, .bold, relativeTo: sidebar ? .title : .largeTitle)
                        .foregroundStyle(Palette.ink)
                        .lineLimit(2)
                        .accessibilityAddTraits(.isHeader)
                    Text(businessDayLabel(state.now))
                        .minopalFont(13, relativeTo: .footnote, digits: true)
                        .foregroundStyle(Palette.ink2)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 8, leading: sidebar ? 12 : 4, bottom: 4, trailing: 12))
            }
            Section(header: heading("フロア")) {
                row("テーブル状況", symbol: "square.grid.2x2", value: "\(state.summary.seated) / \(state.summary.total)卓",
                    selected: page == .floor && focus == nil && sidebar) { onPage(.floor) }
                ForEach(FloorFocus.allCases, id: \.self) { item in
                    let count = state.summary.seats(item).count
                    row(item.title, symbol: item.symbol, value: "\(count)卓", valueColor: count == 0 ? Palette.ink2 : countColor(item),
                        valueWeight: count == 0 || item == .empty ? .regular : .bold, selected: focus == item, chevron: true) { onFocus(item) }
                }
            }
            if !state.settings.shopTimers.isEmpty {
                Section(header: heading("店のタイマー")) {
                    ForEach(state.settings.shopTimers, id: \.id) { timer in timerRow(timer) }
                }
            }
            Section(header: heading("お店の準備")) {
                row("席の配置", symbol: "square.grid.3x3", selected: page == .layout, chevron: true) { onPage(.layout) }
                row("コース", symbol: "list.bullet.clipboard", value: "\(state.settings.courseMenus.count)件", selected: page == .course, chevron: true) { onPage(.course) }
                if sidebar {
                    row("設定", symbol: "gearshape", selected: page == .settings, chevron: true) { onPage(.settings) }
                }
            }
        }
        .modifier(OverviewListStyle(sidebar: sidebar))
        .scrollContentBackground(sidebar ? .automatic : .hidden)
        .background(sidebar ? Color.clear : Palette.tile)
        .environment(\.defaultMinListRowHeight, sidebar ? Metrics.minTap : 48)
    }

    private func heading(_ text: String) -> some View {
        Text(text)
            .minopalFont(13, .semibold, relativeTo: .footnote)
            .foregroundStyle(Palette.ink2)
            .textCase(nil)
    }

    private func row(_ title: String, symbol: String, value: String? = nil, valueColor: Color = Palette.ink2, valueWeight: Font.Weight = .regular,
                     selected: Bool, chevron: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.body)
                    .foregroundStyle(selected ? .white : Palette.keyText)
                    .frame(width: 24)
                Text(title)
                    .minopalFont(sidebar ? 16 : 17, relativeTo: sidebar ? .callout : .body)
                    .foregroundStyle(selected ? .white : Palette.ink)
                Spacer(minLength: 8)
                if let value {
                    Text(value)
                        .minopalFont(sidebar ? 15 : 16, valueWeight, relativeTo: sidebar ? .subheadline : .callout, digits: true)
                        .foregroundStyle(selected ? .white : valueColor)
                }
                if chevron {
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(selected ? .white : Palette.muted)
                }
            }
            .frame(minHeight: Metrics.minTap)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 0, leading: sidebar ? 20 : 16, bottom: 0, trailing: sidebar ? 20 : 16))
        .listRowBackground(selected ? RoundedRectangle(cornerRadius: 12).fill(Palette.key).padding(.horizontal, sidebar ? 8 : 0) : nil)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // 店のタイマー：印・名前・残り時間・「済」（時間が来たら赤い文字）
    private func timerRow(_ timer: ShopTimer) -> some View {
        let due = state.timerState(timer).due
        return HStack(spacing: 12) {
            ShopTimerMark(left: state.timerLeft(timer), due: due).frame(width: 24)
            Text(timer.label)
                .minopalFont(sidebar ? 16 : 17, due ? .bold : .regular, relativeTo: sidebar ? .callout : .body)
                .foregroundStyle(due ? Palette.nowInk : Palette.ink)
                .lineLimit(1)
                .layoutPriority(1)
            Spacer(minLength: 8)
            Text(state.timerRest(timer))
                .minopalFont(sidebar ? 15 : 16, due ? .bold : .regular, relativeTo: sidebar ? .subheadline : .callout, digits: true)
                .foregroundStyle(due ? Palette.nowInk : Palette.ink2)
                .fixedSize()
            Button { state.markTimerDone(timer) } label: {
                Text("済")
                    .minopalFont(15, .bold, relativeTo: .subheadline)
                    .foregroundStyle(Palette.keyText)
                    .frame(width: Metrics.minTap, height: Metrics.minTap)
                    .overlay(Circle().strokeBorder(Palette.keyText, lineWidth: 1.5).padding(4))
                    .contentShape(Circle())
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("\(timer.label)を済にする")
        }
        .listRowInsets(EdgeInsets(top: 0, leading: sidebar ? 20 : 16, bottom: 0, trailing: sidebar ? 12 : 8))
        .accessibilityElement(children: .contain)
    }

    private func countColor(_ focus: FloorFocus) -> Color {
        switch focus {
        case .now: Palette.nowInk
        case .soon: Palette.soonInk
        case .empty: Palette.ink2
        }
    }
}

private struct OverviewListStyle: ViewModifier {
    let sidebar: Bool
    @ViewBuilder func body(content: Content) -> some View {
        if sidebar { content.listStyle(.sidebar) } else { content.listStyle(.insetGrouped) }
    }
}
