import MinopalCore
import Testing
@testable import Minopal

// 卓の詳細の「変更する」で選ぶ欄の選び肢（apps/ios/src/sheets/pickers.ts と同じ並び。エミュレータは使わない）
@Suite("詳細の選び肢")
struct PromptOptionsTests {
    @Test("コース：通常のあとに店の区分。設定で消した区分を使っている卓は、その区分も残す")
    func courses() {
        let plans = [DrinkPlan(id: "a", name: "飲み放題A")]
        #expect(courseOptions(plans, current: nil).map(\.label) == ["通常", "コース（飲み放題A）"])
        #expect(courseOptions(plans, current: "gone").map(\.label) == ["通常", "コース（飲み放題A）", "コース（消した区分）"])
        #expect(courseOptions(plans, current: "gone").last?.value == "gone")
    }

    @Test("料理：未定のあとに値段と短い名前。設定で消したコースは「消したコース」で残す")
    func menus() {
        let menu = CourseMenu(id: "m", name: "テストコース", price: 3000, short: "テスト", dishes: ["テスト料理1"])
        #expect(menuOptions([menu], current: nil).map(\.label) == ["未定", "\(priceLabel(menu)) テスト"])
        #expect(menuOptions([menu], current: "gone").last == SelectOption(value: "gone", label: "消したコース"))
    }

    @Test("人数：未入力と1〜30名。今の人数が30名より多ければそこまで並べる")
    func guests() {
        let options = guestOptions(emptyLabel: "未入力", current: 4)
        #expect(options.count == 31)
        #expect(options.first == SelectOption(value: nil, label: "未入力"))
        #expect(options.last?.label == "30名")
        #expect(guestOptions(emptyLabel: "未入力", current: 45).last?.value == 45)
    }
}
