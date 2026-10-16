import MinopalCore
import SwiftUI

// コースを作る・直す画面（No.161。今の iOS 版・Web の CourseEditor と同じ中身。No.89）。下書きを直して「保存して使う」で全端末に反映する。
// 案内中の卓が使っているコースは消せず、料理の順番を変えたり料理を消したりもできない（出した品数がずれるので。名前を直す・最後に足すのはできる）
struct CourseEditorView: View {
    let state: ShopState
    @State private var original: CourseMenu
    @State private var isNew: Bool
    @State private var draft: CourseMenu
    @State private var priceText: String
    @State private var saveError = ""
    @State private var confirmingDelete = false
    @Environment(\.dismiss) private var dismiss

    // courseId が nil（または、ほかの端末で消えていた）なら新しいコースを足す
    init(state: ShopState, courseId: String?) {
        self.state = state
        let found = courseId.flatMap { id in state.settings.courseMenus.first { $0.id == id } }
        let course = found ?? newCourse(state.settings.courseMenus, now: nowMs())
        _original = State(initialValue: course)
        _isNew = State(initialValue: found == nil)
        // 新しいコースの値段は空から始める（0円のまま保存しないように。入れるまで保存できない）
        var draft = course
        if found == nil { draft.price = -1 }
        _draft = State(initialValue: draft)
        _priceText = State(initialValue: found == nil ? "" : String(course.price))
    }

    private var rules: Rules { state.settings.rules }
    private var usedBy: [String] { coursesInUse(state.sessions, now: state.now, rules: rules)[original.id] ?? [] }
    private var inUse: Bool { !usedBy.isEmpty && !isNew }
    private var problems: [String] { courseProblems(draft) }
    private var changed: Bool { isNew || draft != original }
    private var own: Bool { draft.lastOrderMin != nil || draft.seatLimitMin != nil }
    private var status: String {
        if !saveError.isEmpty { return saveError }
        if !problems.isEmpty { return "直すところ：\(problems.joined(separator: "／"))" }
        if inUse { return "\(usedBy.joined(separator: "・"))番が使っているので、コースを消したり料理の順番を変えたりはできません（名前を直す・最後に足すのはできます）" }
        return changed ? "保存すると、すべての端末のコースが変わります" : ""
    }

    var body: some View {
        List {
            Section(header: SettingsHeading(text: "コース"),
                    footer: SettingsFootnote(text: "ボタンの名前は、選ぶボタンに値段と並べて出します。同じ値段のコースを見分けられる短い名前にしてください")) {
                textRow("名前", text: $draft.name, max: CourseLimits.name, placeholder: "例：カジュアルコース")
                textRow("ボタンの名前", text: $draft.short, max: CourseLimits.short, placeholder: "例：カジュアル")
                LabeledContent {
                    TextField("0", text: Binding(get: { priceText }, set: { text in
                        // 数字だけ・6けたまで。先頭の 0 は落とす（「0」のあとに打てば、その値段になる）。空なら保存できない
                        let digits = String(text.filter { ("0"..."9").contains($0) }.prefix(6))
                        let price = Int(digits)
                        priceText = price.map(String.init) ?? ""
                        draft.price = price ?? -1
                    }))
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .modifier(RowInput())
                    .accessibilityLabel("値段（円）")
                } label: { SettingsLabel(title: "値段（円）") }
            }
            Section(header: SettingsHeading(text: "時間")) {
                SettingsSwitchRow(title: "このコースだけ L.O.・お席の時間を変える",
                                  help: own ? "ファーストドリンクから数えます" : "店の設定（L.O. \(rules.lastOrderMin)分・お席の時間 \(rules.seatLimitMin)分）を使います",
                                  isOn: Binding(get: { own }, set: { on in
                                      Haptics.select()
                                      draft = setOwnMinutes(draft, rules, own: on)
                                  }))
                if own {
                    let minutes = courseMinutes(draft, rules)
                    stepper(.lastOrderMin, "L.O.", minutes.lastOrderMin)
                    stepper(.seatLimitMin, "お席の時間", minutes.seatLimitMin)
                }
            }
            Section(header: SettingsHeading(text: "料理（出す順）")) {
                ForEach(draft.dishes.indices, id: \.self) { i in dishRow(i) }
                if draft.dishes.count < CourseLimits.dishes {
                    SettingsAddRow(title: "料理を足す") { draft.dishes.append("") }
                }
            }
            if !isNew {
                Section {
                    SettingsDangerRow(title: "このコースを消す", symbol: "trash") { confirmingDelete = true }
                        .disabled(inUse)
                }
            }
            Section {
                EditorStatus(text: status)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 0, leading: 4, bottom: 0, trailing: 4))
            }
        }
        .settingsListStyle()
        .navigationTitle(isNew ? "コースを足す" : "\(priceLabel(original)) \(original.short)を直す")
        .modifier(EditorToolbar(changed: changed, canSave: changed && problems.isEmpty, saving: false, onSave: save, onBack: { dismiss() }))
        .alert("このコースを消しますか？", isPresented: $confirmingDelete) {
            Button("やめる", role: .cancel) {}
            Button("消す", role: .destructive, action: delete)
        } message: {
            Text("すべての端末から「\(priceLabel(original)) \(original.short)」が消えます。")
        }
    }

    private func textRow(_ title: String, text: Binding<String>, max: Int, placeholder: String) -> some View {
        LabeledContent {
            TextField(placeholder, text: Binding(get: { text.wrappedValue }, set: { text.wrappedValue = limitedText($0, max) }))
                .multilineTextAlignment(.trailing)
                .modifier(RowInput())
                .accessibilityLabel(title)
        } label: { SettingsLabel(title: title) }
    }

    // 設定の画面と同じく 5 分ずつ動かす。範囲の外や、L.O. がお席の時間に届く向きは押せない
    private func stepper(_ key: MinuteSetting, _ title: String, _ value: Int) -> some View {
        let less = stepCourseMinutes(draft, rules, key, -1), more = stepCourseMinutes(draft, rules, key, 1)
        return SettingsStepperRow(title: title, value: "\(value)分",
                                  onLess: less.map { next in { Haptics.select(); draft = next } },
                                  onMore: more.map { next in { Haptics.select(); draft = next } })
    }

    private func dishRow(_ i: Int) -> some View {
        HStack(spacing: 6) {
            Text("\(i + 1)")
                .minopalFont(14, relativeTo: .footnote, digits: true)
                .foregroundStyle(Palette.muted)
                .frame(minWidth: 22, alignment: .trailing)
                .accessibilityHidden(true)
            TextField("料理の名前", text: Binding(get: { draft.dishes.indices.contains(i) ? draft.dishes[i] : "" },
                                              set: { if draft.dishes.indices.contains(i) { draft.dishes[i] = limitedText($0, CourseLimits.dish) } }))
                .modifier(RowInput())
                .accessibilityLabel("\(i + 1)品目")
            dishButton("arrow.up", "\(i + 1)品目を上へ", disabled: inUse || i == 0) { draft.dishes = moveDish(draft.dishes, index: i, -1) }
            dishButton("arrow.down", "\(i + 1)品目を下へ", disabled: inUse || i == draft.dishes.count - 1) { draft.dishes = moveDish(draft.dishes, index: i, 1) }
            dishButton("trash", "\(i + 1)品目を消す", disabled: inUse, danger: true) { draft.dishes.remove(at: i) }
        }
    }

    private func dishButton(_ symbol: String, _ label: String, disabled: Bool, danger: Bool = false, action: @escaping () -> Void) -> some View {
        Button {
            if danger { Haptics.warning() } else { Haptics.select() }
            action()
        } label: {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(danger ? Palette.nowInk : Palette.ink)
                .frame(width: Metrics.minTap, height: Metrics.minTap)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
        .disabled(disabled)
        .opacity(disabled ? 0.3 : 1)
        .accessibilityLabel(label)
    }

    private func save() {
        guard let menus = putCourse(state.settings.courseMenus, draft) else {
            Haptics.warning()
            saveError = "コースは\(CourseLimits.menus)個までです。ほかのコースを消してから保存してください"
            return
        }
        state.updateSettings([.courseMenus]) { $0.courseMenus = menus }
        Haptics.success()
        dismiss()
    }

    private func delete() {
        Haptics.warning()
        state.updateSettings([.courseMenus]) { $0.courseMenus = $0.courseMenus.filter { $0.id != original.id } }
        dismiss()
    }
}

// リストの行の中の入力欄の文字
private struct RowInput: ViewModifier {
    @Environment(\.horizontalSizeClass) private var sizeClass

    func body(content: Content) -> some View {
        content
            .minopalFont(sizeClass == .regular ? 16 : 17, relativeTo: sizeClass == .regular ? .callout : .body)
            .foregroundStyle(Palette.ink)
            .tint(Palette.keyText)
            .frame(minHeight: Metrics.minTap)
    }
}
