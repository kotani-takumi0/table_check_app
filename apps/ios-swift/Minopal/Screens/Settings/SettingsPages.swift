import MinopalCore
import SwiftUI
import UIKit

// 設定のまとまり（Web の Settings.tsx の SETTINGS_SECTIONS に、iOS だけの「この端末」を足した）。
// 時間のルールはほとんど変えないので奥に置く（No.114・No.149。−／＋ は奥の画面だけ）
enum SettingsPage: String, CaseIterable, Hashable, Identifiable {
    case today, shop, course, timers, record, time, device
    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "今日の営業"
        case .shop: "お店"
        case .course: "コース"
        case .timers: "店のタイマー"
        case .record: "記録"
        case .time: "時間のルール"
        case .device: "この端末"
        }
    }
    var symbol: String {
        switch self {
        case .today: "clock"
        case .shop: "house"
        case .course: "list.bullet.clipboard"
        case .timers: "timer"
        case .record: "doc.text"
        case .time: "slider.horizontal.3"
        case .device: UIDevice.current.userInterfaceIdiom == .pad ? "ipad" : "iphone"
        }
    }
    // 行の右に出す今の値
    @MainActor func value(_ state: ShopState) -> String? {
        switch self {
        case .today: nil
        case .shop: state.shopName
        case .course: "\(state.settings.courseMenus.count)件"
        case .timers: "\(state.settings.shopTimers.count)件"
        case .record: "書き出し"
        case .time: "L.O. \(state.settings.rules.lastOrderMin)分"
        case .device: "音・外観"
        }
    }
}

// 1つのまとまりの中身。iPad は右の列に大きな見出し 28pt と一緒に、iPhone は奥の画面に出す
struct SettingsPageList: View {
    let page: SettingsPage
    let state: ShopState
    let onOpen: (ShopPage) -> Void       // 席の配置・コースの画面へ
    @Binding var clearing: Bool          // 全卓消去の確認を出す
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        List {
            if sizeClass == .regular {
                Section {
                    Text(page.title)
                        .minopalFont(28, .bold, relativeTo: .title)
                        .foregroundStyle(Palette.ink)
                        .accessibilityAddTraits(.isHeader)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 8, leading: 4, bottom: 0, trailing: 4))
                }
            }
            content
        }
        .settingsListStyle()
        // iPad は右の列の見出しで出すので、ヘッダーには出さない（ヘッダーは「設定」）
        .navigationTitle(sizeClass == .regular ? "" : page.title)
    }

    @ViewBuilder private var content: some View {
        switch page {
        case .today: TodaySections(state: state, clearing: $clearing, separate: true)
        case .shop: ShopSections(state: state, onOpen: onOpen)
        case .course: CourseSections(state: state, onOpen: onOpen)
        case .timers: TimerSections(state: state)
        case .record: RecordSections(state: state)
        case .time: TimeRuleSections(state: state)
        case .device: DeviceSections()
        }
    }
}

extension View {
    func settingsListStyle() -> some View {
        listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Palette.tile)
            .environment(\.defaultMinListRowHeight, Metrics.minTap)
            .scrollDismissesKeyboard(.interactively)
    }
}

// 今日の営業：時間制限なし（空いている日に切り替える）と全卓消去（ヘッダーから移した。No.149）。
// separate は iPad：全卓消去を「営業のあと」に分ける。iPhone は同じまとまりに並べる
struct TodaySections: View {
    let state: ShopState
    @Binding var clearing: Bool
    var separate = false

    var body: some View {
        let timeLimitOff = Binding(get: { state.settings.rules.timeLimitOff },
                                   set: { on in state.updateSettings([.timeLimitOff]) { $0.rules.timeLimitOff = on } })
        let canClear = state.sessions.contains { isVisible($0, now: state.now, rules: state.settings.rules) }
        let switchRow = SettingsSwitchRow(title: "時間制限なし",
                                          help: "空いている日などに、L.O.・お席の時間の通知と色を止めます。経過の時間とお通しの警告はそのまま出します。",
                                          isOn: timeLimitOff)
        let clearRow = SettingsDangerRow(title: "全卓を消去", symbol: "trash") { clearing = true }
            .disabled(!canClear)
            .accessibilityIdentifier("clear-all")
        if separate {
            Section(footer: SettingsFootnote(text: "変えると、すべての端末にすぐ反映されます。")) { switchRow }
            Section(header: SettingsHeading(text: "営業のあと"),
                    footer: SettingsFootnote(text: "すべての卓のお客さんを画面から消します。押すと確認が出ます。記録には残ります。")) { clearRow }
        } else {
            Section(header: SettingsHeading(text: "今日の営業"), footer: SettingsFootnote(text: "全卓を消去は確認が出ます。記録には残ります。")) {
                switchRow
                clearRow
            }
        }
    }
}

// お店：店名・席の配置・閉店時刻（Web と同じ並び）
private struct ShopSections: View {
    let state: ShopState
    let onOpen: (ShopPage) -> Void

    var body: some View {
        Section(footer: SettingsFootnote(text: "ログインしたときに、どの店か分かるように出します。変えると、すべての端末にすぐ反映されます。")) {
            LabeledContent {
                SettingsTextField(label: "店名", value: state.settings.shopName, maxLength: shopNameMax, placeholder: "店の名前") { name in
                    state.updateSettings([.shopName]) { $0.shopName = name }
                }
                .multilineTextAlignment(.trailing)
            } label: { SettingsLabel(title: "店名") }
        }
        Section(footer: SettingsFootnote(text: "卓の場所・大きさ・卓番と、入口・キッチンなどの目印を、マス目にブロックを置いて作り直します。すべての端末に反映されます。")) {
            SettingsNavRow(title: "席の配置", symbol: "square.grid.3x3", value: "\(state.summary.total)卓") { onOpen(.layout) }
        }
        Section(footer: SettingsFootnote(text: "この時刻を過ぎても退店していない卓を、閉店時刻で退店にします。記録には「閉店で退店」と残ります。閉店時刻より後に案内した卓は、朝4時に退店にします。")) {
            Picker(selection: Binding(get: { state.settings.closingMin }, set: { min in state.updateSettings([.closingMin]) { $0.closingMin = min } })) {
                Text("決めない").tag(Int?.none)
                ForEach(closingChoices, id: \.self) { min in Text(closingLabel(min)).tag(Int?.some(min)) }
            } label: { SettingsLabel(title: "閉店時刻") }
            .pickerStyle(.menu)
            .tint(Palette.ink2)
            .frame(minHeight: Metrics.minTap)
        }
    }
}

// コース：飲み放題の区分（名前を直す・足す・消す。No.90）と料理のコース（直すのは「コース」の画面。No.161）
private struct CourseSections: View {
    let state: ShopState
    let onOpen: (ShopPage) -> Void

    var body: some View {
        let plans = state.settings.drinkPlans
        Section(header: SettingsHeading(text: "飲み放題の区分"),
                footer: SettingsFootnote(text: "ご案内のときに選ぶと、その卓はコースになります（L.O.・お席の時間はファーストドリンクから数えます）。区分が無ければコースは選べません。消しても、その区分で案内中の卓はそのままです。")) {
            ForEach(Array(plans.enumerated()), id: \.element.id) { i, plan in
                HStack(spacing: 12) {
                    SettingsTextField(label: "区分\(i + 1)の名前", value: plan.name, maxLength: drinkPlanNameMax, placeholder: "区分の名前", allowsEmpty: false) { name in
                        put(plans.map { $0.id == plan.id ? DrinkPlan(id: $0.id, name: name) : $0 })
                    }
                    Button("消す") { put(plans.filter { $0.id != plan.id }) }
                        .minopalFont(15, .bold, relativeTo: .subheadline)
                        .foregroundStyle(Palette.nowInk)
                        .frame(minWidth: Metrics.minTap, minHeight: Metrics.minTap)
                        .buttonStyle(.borderless)
                        .accessibilityLabel("「\(plan.name)」を消す")
                }
            }
            if plans.count < drinkPlansMax {
                SettingsAddRow(title: "区分を足す") { put(plans + [DrinkPlan(id: newDrinkPlanId(plans, now: nowMs()), name: "新しい区分")]) }
            }
        }
        Section(header: SettingsHeading(text: "料理のコース"),
                footer: SettingsFootnote(text: "ご案内のときに「料理」で選びます。料理を出す順に並べておくと、詳細で1品ずつ進められます。")) {
            ForEach(state.settings.courseMenus, id: \.id) { menu in
                Button { onOpen(.course) } label: {
                    HStack(spacing: 12) {
                        SettingsLabel(title: "\(priceLabel(menu)) \(menu.short)",
                                      help: "\(menu.name)・\(menu.dishes.count)品\(menu.lastOrderMin != nil || menu.seatLimitMin != nil ? "・このコースだけの時間あり" : "")")
                        Spacer(minLength: 8)
                        Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Palette.muted)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func put(_ plans: [DrinkPlan]) { state.updateSettings([.drinkPlans]) { $0.drinkPlans = plans } }
}

// 店のタイマー（No.91）：アイコン・名前・間隔・消す。4つまで
private struct TimerSections: View {
    let state: ShopState

    var body: some View {
        let timers = state.settings.shopTimers
        Section {
            SettingsFootnote(text: "ヘッダー（iPhone は上の帯）に残り時間を出し、時間になったら知らせます。\(ShopTimerLimits.timers)つまで。")
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 0, leading: 4, bottom: 0, trailing: 4))
        }
        ForEach(Array(timers.enumerated()), id: \.element.id) { i, timer in
            Section(header: SettingsHeading(text: "タイマー\(i + 1)")) {
                HStack(spacing: 12) {
                    iconMenu(timer, index: i)
                    SettingsTextField(label: "タイマー\(i + 1)の名前", value: timer.label, maxLength: ShopTimerLimits.label, placeholder: "作業の名前", allowsEmpty: false) { label in
                        put(timer.with { $0.label = label })
                    }
                }
                let less = stepInterval(timer, -1), more = stepInterval(timer, 1)
                SettingsStepperRow(title: "間隔", value: "\(timer.intervalMin)分ごと",
                                   onLess: less.map { next in { put(next) } }, onMore: more.map { next in { put(next) } })
                SettingsDangerRow(title: "このタイマーを消す") { state.updateSettings([.shopTimers]) { $0.shopTimers = timers.filter { $0.id != timer.id } } }
                    .accessibilityLabel("「\(timer.label)」を消す")
            }
        }
        if timers.count < ShopTimerLimits.timers {
            Section {
                SettingsAddRow(title: "タイマーを足す") {
                    let added = ShopTimer(id: newShopTimerId(timers, now: nowMs()), label: "新しいタイマー", icon: fallbackShopTimerIcon, intervalMin: 60)
                    state.updateSettings([.shopTimers]) { $0.shopTimers = timers + [added] }
                }
            }
        }
    }

    // アイコン（No.99）：押すと候補を出す。iOS では Web の線の代わりに近い SF Symbols で描く
    private func iconMenu(_ timer: ShopTimer, index: Int) -> some View {
        let current = shopTimerIcon(timer.icon)
        return Menu {
            Picker("アイコン", selection: Binding(get: { current.id }, set: { id in if id != timer.icon { put(timer.with { $0.icon = id }) } })) {
                ForEach(shopTimerIcons, id: \.id) { icon in
                    Label(icon.name, systemImage: ShopTimerSymbol.name(icon.id)).tag(icon.id)
                }
            }
        } label: {
            Image(systemName: ShopTimerSymbol.name(current.id))
                .font(.body.weight(.semibold))
                .foregroundStyle(Palette.keyText)
                .frame(width: Metrics.minTap, height: Metrics.minTap)
                .background(Palette.keyWash, in: RoundedRectangle(cornerRadius: Metrics.fieldRadius))
        }
        .accessibilityLabel("タイマー\(index + 1)のアイコンを変える（いまは\(current.name)）")
    }

    private func put(_ timer: ShopTimer) {
        state.updateSettings([.shopTimers]) { $0.shopTimers = $0.shopTimers.map { $0.id == timer.id ? timer : $0 } }
    }
}

private extension ShopTimer {
    func with(_ change: (inout ShopTimer) -> Void) -> ShopTimer {
        var copy = self
        change(&copy)
        return copy
    }
}

// 店のタイマーのアイコン（MinopalCore の shopTimerIcons の id）を、iOS で描く SF Symbols の名前にする
enum ShopTimerSymbol {
    static let names = [
        "patrol": "eye", "toilet": "toilet", "clean": "bubbles.and.sparkles", "spray": "hands.sparkles", "drop": "drop",
        "bag": "trash", "wind": "wind", "box": "shippingbox", "clock": "clock",
    ]
    static func name(_ id: String) -> String { names[shopTimerIcon(id).id] ?? "clock" }
}

// 時間のルール（No.14・No.132）：L.O.・お席の時間はお通し（コースはファーストドリンク）から数える
private struct TimeRuleSections: View {
    let state: ShopState

    var body: some View {
        let rules = state.settings.rules
        let from = rules.otoshi ? "お通しから数えます（コースはファーストドリンクから）" : "案内から数えます（コースはファーストドリンクから）"
        Section(footer: SettingsFootnote(text: "変えると、すべての端末にすぐ反映されます。")) {
            minutes(.lastOrderMin, "L.O.", help: from)
            minutes(.seatLimitMin, "お席の時間", help: from)
        }
        Section {
            SettingsSwitchRow(title: "お通しを出す",
                              help: "出さない店は「お通し提供済み」を「ファーストドリンク提供済み」と呼び、L.O.・お席の時間は案内から数えます。お通し未提供の警告は出しません。",
                              isOn: Binding(get: { rules.otoshi }, set: { on in state.updateSettings([.otoshi]) { $0.rules.otoshi = on } }))
            if rules.otoshi {
                minutes(.otoshiWarnMin, "お通しの警告", help: "案内からこの時間たってもお通しがまだなら知らせます")
            }
        }
        Section {
            minutes(.exitedKeepMin, "退店済みを残す", help: "退店したあと、卓に退店済みを出しておく時間")
        }
    }

    private func minutes(_ key: MinuteSetting, _ title: String, help: String) -> some View {
        let rules = state.settings.rules
        let field = ShopSettingsField(rawValue: key.rawValue)!
        let step = { (direction: Int) -> (() -> Void)? in
            stepMinutes(rules, key, direction).map { value in { state.updateSettings([field]) { $0.rules[key] = value } } }
        }
        return SettingsStepperRow(title: title, help: help, value: "\(rules[key])分", onLess: step(-1), onMore: step(1))
    }
}

// この端末（iOS だけ）：音・ハプティクス・外観。この端末だけで覚える
private struct DeviceSections: View {
    @AppStorage(DeviceSettings.soundKey) private var sound = true
    @AppStorage(DeviceSettings.hapticsKey) private var haptics = true
    @AppStorage(DeviceSettings.appearanceKey) private var appearance = Appearance.system

    var body: some View {
        Section(header: SettingsHeading(text: "音とハプティクス"), footer: SettingsFootnote(text: "この端末だけの設定です。ほかの端末には反映されません。")) {
            SettingsSwitchRow(title: "通知の音", help: "L.O.・店のタイマーの通知が来たときに鳴らします。消音モードのときは鳴りません。", isOn: $sound)
            SettingsSwitchRow(title: "ハプティクス", help: "押したとき・通知が来たときに軽く震えます。", isOn: $haptics)
        }
        Section(header: SettingsHeading(text: "外観")) {
            Picker(selection: $appearance) {
                ForEach(Appearance.allCases) { Text($0.label).tag($0) }
            } label: { EmptyView() }
            .pickerStyle(.inline)
            .labelsHidden()
            .tint(Palette.keyText)
        }
    }
}

// 記録（No.34・No.113）：選んだ期間のお客さんを CSV にして、共有のシート（ファイルに保存・AirDrop など）で渡す。日は朝4時で区切る
private struct RecordSections: View {
    let state: ShopState
    @State private var from = Date()
    @State private var to = Date()
    @State private var busy = false
    @State private var message: String?
    @State private var file: ExportFile?

    var body: some View {
        let today = businessDate(businessDayOf(state.now)) ?? Date()
        Section(header: SettingsHeading(text: "お客さんを CSV で書き出す"),
                footer: SettingsFootnote(text: "選んだ期間のお客さんを、卓・人数・コース・時刻・お会計・卓の動き・料理を出した時刻と一緒に1組1行で書き出します。日は朝4時で区切ります（0時を過ぎたお客さんも前の日に入ります）。全卓消去したお客さんも、消した時刻と一緒に入ります。")) {
            DatePicker(selection: $from, in: ...today, displayedComponents: .date) { SettingsLabel(title: "はじめの日") }
                .onChange(of: from) { if from > to { to = from } }
            DatePicker(selection: $to, in: from...max(from, today), displayedComponents: .date) { SettingsLabel(title: "おわりの日") }
            Button { export() } label: {
                Text(busy ? "書き出しています…" : "書き出す")
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(busy)
            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
            .accessibilityIdentifier("export-csv")
            if let message {
                Text(message)
                    .minopalFont(15, relativeTo: .subheadline)
                    .foregroundStyle(Palette.ink2)
                    .accessibilityIdentifier("export-message")
            }
        }
        .onAppear {
            from = today
            to = today
        }
        .sheet(item: $file) { file in ShareSheet(url: file.url) }
    }

    private func export() {
        let fromDay = dayString(from), toDay = dayString(to)
        guard let range = businessDaysRange(fromDay, toDay) else {
            message = "はじめの日をおわりの日より前にしてください"
            return
        }
        busy = true
        message = nil
        let settings = state.settings, sessions = state.services.sessions
        Task {
            defer { busy = false }
            do {
                let recorded = try await sessions.fetchSeatedBetween(start: range.start, end: range.end)
                guard !recorded.isEmpty else {
                    message = "この期間のお客さんはいませんでした"
                    return
                }
                let url = FileManager.default.temporaryDirectory.appendingPathComponent(csvFileName(fromDay, toDay))
                try sessionsCsv(recorded, drinkPlans: settings.drinkPlans, courseMenus: settings.courseMenus).write(to: url, atomically: true, encoding: .utf8)
                message = "\(recorded.count)組を書き出しました"
                file = ExportFile(url: url)
            } catch {
                message = "書き出せませんでした（\(error.localizedDescription)）"
            }
        }
    }

    // 日付の選択は端末の時間帯の日。営業日の文字（YYYY-MM-DD）と行き来する
    private func dayString(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
    private func businessDate(_ day: String) -> Date? {
        businessDayRange(day).map { Date(timeIntervalSince1970: Double($0.start) / 1000) }
    }
}

private struct ExportFile: Identifiable {
    let url: URL
    var id: URL { url }
}

// 共有のシート（ファイルに保存・AirDrop・メールなど）
private struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
