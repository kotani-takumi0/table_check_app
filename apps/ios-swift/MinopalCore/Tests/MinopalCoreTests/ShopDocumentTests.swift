import Foundation
import Testing
@testable import MinopalCore

// 店の設定・席の配置を書く形が、読む側（parseShopSettings・parseShopLayout）と往復できることを確かめる。
// TS は書く形をそのまま Firestore に渡すのでテストが無い。Swift は書く形を自分で組み立てるので、ここで確かめる
@Suite("店の設定・席の配置を書く形")
struct ShopDocumentTests {
    @Test("店の設定を全部書くと、読み戻して同じになる")
    func settingsRoundTrip() {
        var settings = ShopSettings.standard
        settings.rules = Rules(otoshiWarnMin: 10, lastOrderMin: 60, seatLimitMin: 90, exitedKeepMin: 3, otoshi: false, timeLimitOff: true)
        settings.shopName = "ミノパル"
        settings.drinkPlans = [DrinkPlan(id: "plan_a", name: "2時間飲み放題")]
        var menu = defaultCourseMenus[1]
        menu.lastOrderMin = 80; menu.seatLimitMin = 100
        settings.courseMenus = [menu, defaultCourseMenus[0]]
        settings.shopTimers = [ShopTimer(id: "timer_a", label: "ゴミ出し", icon: "bag", intervalMin: 60)]
        settings.closingMin = 1410
        #expect(parseShopSettings(shopSettingsDocument(settings)) == settings)
        #expect(parseShopSettings(shopSettingsDocument(.standard)) == .standard)
    }

    @Test("変えた項目だけを書く（閉店時刻を決めていなければ null）")
    func onlyFields() {
        let document = shopSettingsDocument(.standard, fields: [.timeLimitOff, .closingMin])
        #expect(Set(document.keys) == ["timeLimitOff", "closingMin"])
        #expect(document["closingMin"] is NSNull)
        #expect(document["timeLimitOff"] as? Bool == false)
    }

    @Test("テンプレートの設定を書くと、読み戻して同じになる（TS の shopTemplates.test と同じ確かめ）")
    func templates() {
        #expect(parseShopSettings(shopSettingsDocument(shopTemplates[0].settings)) == .standard)
        let blank = parseShopSettings(shopSettingsDocument(blankSettings))
        #expect(blank.drinkPlans.isEmpty && blank.courseMenus.isEmpty && blank.shopTimers.isEmpty)
        #expect(blank.rules == .standard)
    }

    @Test("席の配置を書くと、読み戻して同じになり、卓番を数の順に添える")
    func layoutRoundTrip() {
        #expect(parseShopLayout(shopLayoutDocument(defaultLayout)) == defaultLayout)
        #expect(shopLayoutDocument(defaultLayout)["seatIds"] as? [String] == seatIdsOf(defaultLayout))
        #expect((shopLayoutDocument(defaultLayout)["seatIds"] as? [String])?.count == defaultLayout.seats.count)
    }

    @Test("配置の移り変わりには、保存した端末の種類と版を添える")
    func history() {
        let document = layoutHistoryDocument(defaultLayout, app: AppInfo(platform: .ios, version: "3.0.0"))
        #expect(document["platform"] as? String == "ios" && document["appVersion"] as? String == "3.0.0")
        #expect(Set(document.keys) == ["seats", "labels", "platform", "appVersion"])
        #expect(layoutHistoryDocument(defaultLayout, app: nil)["platform"] is NSNull)
    }

    @Test("お客さんがいる卓を消す配置は、卓番を数の順に並べて知らせる")
    func occupiedProblem() {
        let layout = ShopLayout(seats: defaultLayout.seats.filter { !["3", "12", "21"].contains($0.id) }, labels: [])
        #expect(removedOccupiedSeatsProblem(layout, occupied: ["21", "3", "12", "11"]) == "3・12・21番にお客さんがいます")
        #expect(removedOccupiedSeatsProblem(defaultLayout, occupied: ["21"]) == nil)
    }

    @Test("店のタイマーの済の時刻は、形の正しい id と数の時刻だけ読む")
    func timerDone() {
        let done = shopTimerDone([(id: "toilet_check", data: ["doneAt": 1000]), (id: "Bad", data: ["doneAt": 1]),
                                  (id: "toilet_clean", data: ["doneAt": NSNull()]), (id: "x", data: ["doneAt": "1"])])
        #expect(done == ["toilet_check": 1000])
    }

    @Test("端末ID は毎回ちがう")
    func deviceIds() {
        #expect(newDeviceId(now: 1000) != newDeviceId(now: 1000))
        #expect(newDeviceId(now: 1000).hasPrefix("rs-"))
    }
}
