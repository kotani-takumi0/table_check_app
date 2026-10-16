import MinopalCore
import SwiftUI

// 卓の詳細（Web の DetailPanel・今の iOS 版の DetailSheet と同じ中身。見た目は No.149 の確定画像 ipad_detail_*_lg・iphone_detail_*_lg）。
// No.71：いちばん見てほしいのは「次にやること」1つ。大きいボタンはそれだけにし、戻す・お会計は小さく、ほかは「変更する」にしまう
struct SeatDetailView: View {
    let state: ShopState
    let session: Session
    let from: String            // 開いた卓。団体から外して無くなったら、残っている卓の先頭
    let sheet: Bool
    let maxHeight: CGFloat
    let interaction: FloorInteraction
    let onClose: () -> Void
    @State private var changing = false
    @State private var showDishes = false
    // 次の状態へのボタンは、押した直後の 0.5秒はもう一度押しても進めない（No.122）
    @State private var lastNextAt: Int?
    @Environment(\.dynamicTypeSize) private var typeSize

    private var rules: Rules { state.rules(session) }
    private var paid: Bool { session.paidAt != nil }
    private var tables: String { session.tableIds.joined(separator: "・") }
    // コース・お通しを出さない店（No.14）は、お通しの欄にファーストドリンクの時刻を入れる
    private var otoshi: Bool { session.course == nil && rules.otoshi }
    private var order: String { "案内 → \(otoshi ? "お通し" : "ファーストドリンク") → L.O.確認・現在" }

    var body: some View {
        PromptContainer(sheet: sheet, maxHeight: maxHeight) {
            head
            nextButton
            quickRow("お会計", value: paid ? "会計済（\(formatClock(session.paidAt ?? 0))）" : "未払い",
                     button: paid ? "未払いに戻す" : "お会計済みにする", id: "detail-pay") {
                if !paid { Haptics.success() }
                state.pay(session)
            }
            // No.118：卓の追加（団体）はよく使うので、変更するにしまわずお会計と同じ形で出す
            quickRow("卓", value: "\(tables)番", button: "卓を追加（団体）", id: "detail-add") {
                interaction.startPick(.add, session: session, from: from)
            }
            UnderlineButton(title: session.status == .seated ? "案内を取り消す" : "1つ戻す") {
                Haptics.light()
                state.back(session)
            }
            .accessibilityIdentifier("detail-back")
            // No.132：お通し（コースはファーストドリンク）の時刻は、L.O.・お席の時間の数え始め。変更するにしまわず直せるようにする
            if let otoshiAt = session.otoshiAt {
                section {
                    Text("\(otoshi ? "お通し" : "ファーストドリンク")の時刻")
                        .minopalFont(15, .bold, relativeTo: .subheadline)
                        .foregroundStyle(Palette.ink)
                        .accessibilityAddTraits(.isHeader)
                    TimeRow(label: otoshi ? "お通し" : "ドリンク", value: otoshiAt, button: "修正",
                            error: "\(order) の順になる時刻にしてください") { save(.otoshiAt, $0, near: otoshiAt) }
                        .id("otoshi-\(otoshiAt)")
                    Text("L.O.・お席の時間はこの時刻から数えます。始まりをずらすときはここを直します。")
                        .minopalFont(13, relativeTo: .footnote)
                        .foregroundStyle(Palette.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            if session.course != nil { dishes }
            change
        }
    }

    // 卓番の札と人数・コース。その下に今の段階（見出し）と経過・残り時間、警告の帯
    private var head: some View {
        let display = displayOf(session.status, course: session.course, rules: rules)
        let timer = timerOf(session, now: state.now, rules: rules)
        let remaining = remainingOf(session, now: state.now, rules: rules)
        let alert = alertOf(session, now: state.now, rules: rules)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 12) {
                Text(tables)
                    .minopalFont(18, .bold, relativeTo: .headline, digits: true)
                    .foregroundStyle(Palette.page)
                    .padding(.horizontal, 12)
                    .frame(minWidth: 40, minHeight: 32)
                    .background(Palette.ink, in: RoundedRectangle(cornerRadius: 8))
                    .accessibilityLabel("\(tables)番")
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    if let guests = session.guests {
                        Text("\(guests)").minopalFont(16, .bold, relativeTo: .subheadline, digits: true).foregroundStyle(Palette.ink)
                        Text("名")
                    } else {
                        Text("人数未入力")
                    }
                    Text("・\(session.course.map { drinkPlanName(state.settings.drinkPlans, $0) } ?? "通常")")
                }
                .minopalFont(15, relativeTo: .subheadline)
                .foregroundStyle(Palette.ink2)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
                PromptCloseButton(action: onClose)
            }
            Text(display.label)
                .minopalFont(24, .bold, relativeTo: .title2)
                .foregroundStyle(Palette.ink)
                .accessibilityAddTraits(.isHeader)
                .fixedSize(horizontal: false, vertical: true)
            let line = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2)) : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 8))
            line {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(timer.label).minopalFont(15, relativeTo: .subheadline).foregroundStyle(Palette.ink2)
                    Text(timer.elapsedMs.map(formatElapsed) ?? "--:--").minopalFont(16, .semibold, relativeTo: .subheadline, digits: true).foregroundStyle(Palette.ink)
                }
                if let remaining {
                    Text(remainingLabel(remaining)).minopalFont(15, relativeTo: .subheadline, digits: true).foregroundStyle(Palette.ink2)
                }
            }
            .accessibilityElement(children: .combine)
            // ほかの端末でもこの卓の詳細を開いている（No.72）
            if state.editingIds.contains(session.id) {
                band("ほかの端末でもこの卓を開いています。操作がぶつからないよう声をかけてください", fill: Palette.keyWash, ink: Palette.keyText)
            }
            // 退店の時刻を決めた卓は、変更するを開かなくても分かるように出す
            if let leaveAt = session.leaveAt {
                Text("退店 \(formatClock(leaveAt))")
                    .minopalFont(14, .bold, relativeTo: .footnote, digits: true)
                    .foregroundStyle(Palette.soonInk)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 3)
                    .background(Palette.soonWash, in: Capsule())
                    .overlay(Capsule().strokeBorder(Palette.soonEdge, lineWidth: 1))
            }
            if let reason = alert.reason {
                band(reason.label, symbol: "exclamationmark.circle",
                     fill: alert.level == .soon ? Palette.soon : Palette.now, ink: alert.level == .soon ? Palette.soonOnFill : .white)
            }
        }
    }

    private func band(_ text: String, symbol: String? = nil, fill: Color, ink: Color) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            if let symbol { Image(systemName: symbol).font(.subheadline.weight(.bold)) }
            Text(text).fixedSize(horizontal: false, vertical: true)
        }
        .minopalFont(15, .bold, relativeTo: .subheadline)
        .foregroundStyle(ink)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(fill, in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
    }

    // いちばん大事なボタン：押すと何が起きるかを「〜にする」で出す（No.123）。退店済みは次のお客さんのご案内
    @ViewBuilder private var nextButton: some View {
        if nextStatus(session.status) != nil || session.status == .exited {
            Button(nextActionLabel(session, from: from, rules: rules)) {
                let at = nowMs()
                guard !tooSoon(last: lastNextAt, at: at) else { return }
                lastNextAt = at
                if session.status == .exited {
                    interaction.prompt = .seating(tableId: from)
                } else {
                    Haptics.light()
                    state.next(session)
                }
            }
            .buttonStyle(DetailButtonStyle(kind: .primary, height: 56, radius: sheet ? 22 : 20))
            .accessibilityIdentifier("detail-next")
        }
    }

    // お会計・卓：左に今の状態、右に枠のボタン。文字が大きくて入らなければ縦に並べる
    private func quickRow(_ label: String, value: String, button: String, id: String, action: @escaping () -> Void) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) { quickState(label, value); Spacer(minLength: 8); quickButton(button, id: id, action: action) }
            VStack(alignment: .leading, spacing: 8) { quickState(label, value); quickButton(button, id: id, action: action) }
        }
    }

    private func quickState(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(label).minopalFont(15, relativeTo: .subheadline).foregroundStyle(Palette.ink2)
            Text(value).minopalFont(16, .bold, relativeTo: .callout, digits: true).foregroundStyle(Palette.ink)
        }
        .accessibilityElement(children: .combine)
    }

    private func quickButton(_ title: String, id: String, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .buttonStyle(DetailButtonStyle(kind: .outline, height: Metrics.minTap, radius: 16))
            .fixedSize()
            .accessibilityIdentifier(id)
    }

    // 罫で区切ったまとまり
    private func section<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Rectangle().fill(Palette.line).frame(height: 1).padding(.bottom, 6)
            content()
        }
    }

    // 料理（コースの卓だけ）：進みの帯と次に出す料理、「1品戻す」「N品目を出した」。どのコースかが未定なら、ここで選ぶ
    private var dishes: some View {
        let progress = dishProgress(session, menus: state.settings.courseMenus)
        let list = menuOf(session.menu, menus: state.settings.courseMenus)?.dishes ?? []
        return section {
            HStack(alignment: .firstTextBaseline) {
                Text("料理").minopalFont(15, .bold, relativeTo: .subheadline).accessibilityAddTraits(.isHeader)
                Spacer()
                if let progress {
                    Text("\(progress.served)/\(progress.total)品").minopalFont(15, .bold, relativeTo: .subheadline, digits: true)
                }
            }
            .foregroundStyle(Palette.ink)
            if let progress {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Palette.track)
                        Capsule().fill(Palette.key).frame(width: proxy.size.width * (progress.total == 0 ? 0 : Double(progress.served) / Double(progress.total)))
                    }
                }
                .frame(height: 8)
                .accessibilityElement()
                .accessibilityLabel("料理の進み")
                .accessibilityValue("\(progress.total)品中\(progress.served)品提供済み")
                Group {
                    if let next = progress.next {
                        Text("次：") + Text(next).bold()
                    } else {
                        Text("全部出しました")
                    }
                }
                .minopalFont(16, relativeTo: .callout)
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 12) {
                    Button("1品戻す") {
                        Haptics.light()
                        state.unserve(session)
                    }
                    .buttonStyle(DetailButtonStyle(kind: .secondary, height: Metrics.field, radius: 16))
                    .disabled(progress.served == 0)
                    Button(progress.next == nil ? "全部出しました" : "\(progress.served + 1)品目を出した") {
                        Haptics.success()
                        state.serve(session)
                    }
                    .buttonStyle(DetailButtonStyle(kind: .primary, height: Metrics.field, radius: 16))
                    .disabled(progress.next == nil)
                    .accessibilityIdentifier("detail-serve")
                }
                UnderlineButton(title: showDishes ? "料理の一覧を閉じる" : "料理の一覧を見る") { showDishes.toggle() }
                if showDishes {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(Array(list.enumerated()), id: \.offset) { index, dish in
                            dishRow(index, dish, served: index < progress.served, next: index == progress.served)
                        }
                    }
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel("料理 \(progress.total)品中\(progress.served)品提供済み")
                }
            } else {
                pickerRow("料理", selection: session.menu, options: menuOptions(state.settings.courseMenus, current: session.menu)) {
                    state.changeMenu(session, $0)
                }
            }
        }
    }

    private func dishRow(_ index: Int, _ dish: String, served: Bool, next: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Group {
                if served { Image(systemName: "checkmark") } else { Text("\(index + 1)") }
            }
            .minopalFont(14, relativeTo: .footnote, digits: true)
            .frame(minWidth: 20)
            Text(dish)
                .minopalFont(14, next ? .bold : .regular, relativeTo: .footnote)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .foregroundStyle(served ? Palette.muted : Palette.ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(next ? Palette.keyText : .clear, lineWidth: 2))
        .accessibilityElement(children: .combine)
        .accessibilityValue(served ? "提供済み" : next ? "次に出す" : "")
    }

    // 変更する：人数・コース・時刻の修正・卓の移動と団体から外す。ふだんは閉じておく
    private var change: some View {
        let progress = dishProgress(session, menus: state.settings.courseMenus)
        return section {
            Button {
                withAnimation(.easeOut(duration: 0.2)) { changing.toggle() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "chevron.right")
                        .font(.subheadline.weight(.semibold))
                        .rotationEffect(.degrees(changing ? 90 : 0))
                    Text("変更する（人数・コース・時刻・卓）")
                        .minopalFont(15, .bold, relativeTo: .subheadline)
                        .multilineTextAlignment(.leading)
                }
                .foregroundStyle(Palette.ink)
                .frame(maxWidth: .infinity, minHeight: Metrics.field, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityValue(changing ? "開いている" : "閉じている")
            .accessibilityIdentifier("detail-change")
            if changing {
                VStack(alignment: .leading, spacing: 12) {
                    pickerRow("人数", selection: session.guests, options: guestOptions(emptyLabel: "未入力", current: session.guests)) {
                        state.changeGuests(session, $0)
                    }
                    pickerRow("コース", selection: session.course, options: courseOptions(state.settings.drinkPlans, current: session.course)) {
                        state.changeCourse(session, $0)
                    }
                    if session.course != nil && progress != nil {
                        pickerRow("料理", selection: session.menu, options: menuOptions(state.settings.courseMenus, current: session.menu)) {
                            state.changeMenu(session, $0)
                        }
                    }
                    TimeRow(label: "案内", value: session.seatedAt, button: "修正", error: "\(order) の順になる時刻にしてください") {
                        save(.seatedAt, $0, near: session.seatedAt)
                    }
                    .id("seated-\(session.seatedAt)")
                    leaveRow.id("leave-\(limitsOf(session, rules: rules)?.seatEndAt ?? 0)")
                    tableChips
                    Button("\(from)番を移動") { interaction.startPick(.move, session: session, from: from) }
                        .buttonStyle(DetailButtonStyle(kind: .secondary, height: Metrics.field, radius: 16))
                        .accessibilityIdentifier("detail-move")
                }
            }
        }
    }

    // 退店の時刻（No.80）：早めに退店してもらう卓だけ決める。L.O.はその「お席の時間 − L.O.」（ふつう30分）前になる
    @ViewBuilder private var leaveRow: some View {
        if let limits = limitsOf(session, rules: rules) {
            VStack(alignment: .leading, spacing: 4) {
                TimeRow(label: "退店", value: limits.seatEndAt, button: "決める", error: "案内より後の時刻にしてください") { hhmm in
                    guard let at = clockTimeNear(hhmm, near: limits.seatEndAt) else { return false }
                    return state.changeLeaveAt(session, at)
                }
                HStack(spacing: 12) {
                    Text(session.leaveAt == nil ? "ふつう（\(rules.seatLimitMin)分）。早めに退店してもらう卓だけ決めます" : "L.O.は \(formatClock(limits.lastOrderAt))")
                        .minopalFont(13, relativeTo: .footnote, digits: true)
                        .foregroundStyle(Palette.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                    if session.leaveAt != nil {
                        UnderlineButton(title: "ふつうに戻す") {
                            if state.changeLeaveAt(session, nil) { Haptics.success() }
                        }
                    }
                }
                .padding(.leading, 64)
            }
        } else {
            HStack(spacing: 8) {
                rowLabel("退店")
                Text("\(otoshi ? "お通し" : "ファーストドリンク")のあとで決められます")
                    .minopalFont(15, relativeTo: .subheadline)
                    .foregroundStyle(Palette.muted)
            }
        }
    }

    // 卓：団体の卓を並べ、2卓以上なら × で外せる
    private var tableChips: some View {
        HStack(spacing: 8) {
            rowLabel("卓")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(session.tableIds, id: \.self) { id in
                        HStack(spacing: 0) {
                            Text("\(id)番").minopalFont(15, .medium, relativeTo: .subheadline, digits: true)
                            if session.tableIds.count > 1 {
                                Button {
                                    Haptics.light()
                                    state.release(session, id)
                                } label: {
                                    Image(systemName: "xmark").font(.footnote.weight(.semibold)).foregroundStyle(Palette.ink2)
                                        .frame(width: Metrics.minTap, height: Metrics.minTap)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("\(id)番を団体から外す")
                            }
                        }
                        .foregroundStyle(Palette.ink)
                        .padding(.leading, 14)
                        .padding(.trailing, session.tableIds.count > 1 ? 0 : 14)
                        .frame(minHeight: Metrics.minTap)
                        .overlay(Capsule().strokeBorder(Palette.edge, lineWidth: 1))
                    }
                }
            }
        }
    }

    // 選ぶ欄（Web の <select>）：押すと iOS のメニューで選べる
    private func pickerRow<Value: Hashable>(_ label: String, selection: Value, options: [SelectOption<Value>], onChange: @escaping (Value) -> Void) -> some View {
        HStack(spacing: 8) {
            rowLabel(label)
            Picker(label, selection: Binding(get: { selection }, set: { value in
                Haptics.select()
                onChange(value)
            })) {
                ForEach(options, id: \.self) { option in
                    Text(option.label).tag(option.value)
                }
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .frame(minHeight: Metrics.minTap)
            Spacer(minLength: 0)
        }
    }

    private func save(_ field: EditableTime, _ hhmm: String, near: Int) -> Bool {
        guard let at = clockTimeNear(hhmm, near: near) else { return false }
        return state.retime(session, field, at: at)
    }
}

// 行の左のラベル（人数・コース・案内・退店・卓）
@MainActor
private func rowLabel(_ text: String) -> some View {
    Text(text)
        .minopalFont(15, .bold, relativeTo: .subheadline)
        .foregroundStyle(Palette.ink)
        .frame(minWidth: 56, alignment: .leading)
}

// 時刻の行：時刻を選び、ボタン（修正・決める）で保存する。保存できなかったら（順番が崩れる）理由を出す
private struct TimeRow: View {
    let label: String
    let value: Int
    let button: String
    let error: String
    let onSave: (String) -> Bool
    @State private var draft: Date
    @State private var failed = false

    init(label: String, value: Int, button: String, error: String, onSave: @escaping (String) -> Bool) {
        self.label = label
        self.value = value
        self.button = button
        self.error = error
        self.onSave = onSave
        _draft = State(initialValue: Date(ms: value))
    }

    var body: some View {
        let hhmm = formatClock(draft.ms)
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                rowLabel(label)
                DatePicker(label, selection: $draft, displayedComponents: .hourAndMinute)
                    .labelsHidden()
                    .environment(\.locale, Locale(identifier: "ja_JP"))
                    .onChange(of: draft) { failed = false }
                Spacer(minLength: 8)
                Button(button) {
                    let ok = onSave(hhmm)
                    failed = !ok
                    if ok { Haptics.success() } else { Haptics.warning() }
                }
                .buttonStyle(DetailButtonStyle(kind: .outline, height: Metrics.minTap, radius: 16))
                .fixedSize()
                .disabled(hhmm == formatClock(value))
                .accessibilityLabel("\(label)の時刻を\(button)")
            }
            if failed {
                Text(error)
                    .minopalFont(14, relativeTo: .footnote)
                    .foregroundStyle(Palette.nowInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
