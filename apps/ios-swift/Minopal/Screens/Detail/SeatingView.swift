import MinopalCore
import SwiftUI

// ご案内（Web の SeatDialog・今の iOS 版の SeatSheet と同じ。No.85）：人数は −／＋ と「よく来る人数」、
// コース（通常・飲み放題の区分）と、区分を選んだら料理（どのコースか）をボタンで選び（言葉は Web と同じ）、最後に大きな「ご案内」を1つだけ押す
struct SeatingView: View {
    let state: ShopState
    let tableId: String
    let sheet: Bool
    let maxHeight: CGFloat
    let onClose: () -> Void
    @State private var guests: Int?
    @State private var course: String?
    @State private var menu: String?   // 料理（どのコースか）。区分を選んだときだけ聞く（任意）

    var body: some View {
        let previous = state.occupant(tableId)
        PromptContainer(sheet: sheet, maxHeight: maxHeight) {
            HStack(alignment: .top) {
                Text("\(tableId)番にご案内")
                    .minopalFont(24, .bold, relativeTo: .title2)
                    .foregroundStyle(Palette.ink)
                    .accessibilityAddTraits(.isHeader)
                    .frame(maxWidth: .infinity, alignment: .leading)
                PromptCloseButton(action: onClose)
            }
            // No.120：灰色の1文だと見落とすので、退店済みであることを赤い太字で先に出す
            if let previous, previous.status == .exited {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(tableId)番は退店済みです。")
                        .minopalFont(17, .bold, relativeTo: .headline)
                        .foregroundStyle(Palette.nowInk)
                    Text("ご案内すると、前のお客さんの表示は新しいお客さんに置き換わります。")
                        .minopalFont(15, relativeTo: .subheadline)
                        .foregroundStyle(Palette.ink)
                    if previous.paidAt == nil {
                        Text("前のお客さんはお会計済みになっていません")
                            .minopalFont(15, .bold, relativeTo: .subheadline)
                            .foregroundStyle(Palette.nowInk)
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
            }
            heading("人数")
            stepper
            HStack(spacing: 8) {
                ForEach(quickGuests, id: \.self) { count in
                    choice("\(count)名", selected: guests == count) { guests = count }
                }
            }
            heading("コース")
            LazyVGrid(columns: columns, spacing: 8) {
                choice("通常", selected: course == nil) { course = nil }
                ForEach(state.settings.drinkPlans, id: \.id) { plan in
                    choice(plan.name, selected: course == plan.id) { course = plan.id }
                }
            }
            if course != nil && !state.settings.courseMenus.isEmpty {
                heading("料理")
                LazyVGrid(columns: columns, spacing: 8) {
                    choice("未定", selected: menu == nil) { menu = nil }
                    ForEach(state.settings.courseMenus, id: \.id) { item in
                        choice(priceLabel(item), sub: item.short, selected: menu == item.id) { menu = item.id }
                    }
                }
            }
        } footer: {
            Button(guests.map { "\($0)名でご案内" } ?? "ご案内（人数はあとで）") {
                Haptics.success()
                state.seat(tableId, guests: guests, course: course, menu: course == nil ? nil : menu)
                onClose()
            }
            .buttonStyle(DetailButtonStyle(kind: .primary, height: 56, radius: sheet ? 22 : 20))
            .accessibilityIdentifier("seat-confirm")
        }
    }

    private var columns: [GridItem] { [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)] }

    private func heading(_ title: String) -> some View {
        Text(title)
            .minopalFont(15, .bold, relativeTo: .subheadline)
            .foregroundStyle(Palette.ink)
            .accessibilityAddTraits(.isHeader)
    }

    // 人数：−／＋（64pt の丸）と今の人数。未入力は「あとで」
    private var stepper: some View {
        HStack(spacing: 12) {
            stepButton("minus", label: "1人へらす", delta: -1).disabled(guests == nil)
            Text(guests.map { "\($0)名" } ?? "あとで")
                .minopalFont(guests == nil ? 24 : 36, guests == nil ? .bold : .heavy, relativeTo: .largeTitle, digits: true)
                .foregroundStyle(guests == nil ? Palette.muted : Palette.ink)
                .frame(maxWidth: .infinity)
                .accessibilityLabel(guests.map { "\($0)名" } ?? "人数はあとで")
            stepButton("plus", label: "1人ふやす", delta: 1)
        }
    }

    private func stepButton(_ symbol: String, label: String, delta: Int) -> some View {
        Button {
            Haptics.select()
            guests = stepGuests(guests, delta)
        } label: {
            Image(systemName: symbol)
                .font(.title2.weight(.bold))
                .foregroundStyle(Palette.ink)
                .frame(width: 64, height: 64)
                .background(Palette.page, in: Circle())
                .overlay(Circle().strokeBorder(Palette.edge, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    // 選んでいるものを緑で塗るボタン（人数・コース・料理）
    private func choice(_ title: String, sub: String? = nil, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.select()
            action()
        } label: {
            VStack(spacing: 0) {
                Text(title)
                    .minopalFont(15, selected ? .bold : .regular, relativeTo: .subheadline)
                    .lineLimit(2)
                if let sub {
                    Text(sub).minopalFont(12, relativeTo: .caption).lineLimit(1)
                }
            }
            .multilineTextAlignment(.center)
            .foregroundStyle(selected ? .white : Palette.ink)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, minHeight: Metrics.field)
            .background(selected ? Palette.key : Palette.cellbg, in: RoundedRectangle(cornerRadius: 16))
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(sub.map { "\(title) \($0)" } ?? title)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
