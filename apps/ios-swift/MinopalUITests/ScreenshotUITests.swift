import XCTest

// PR に添えるスクショを撮る（ふだんのテストでは飛ばす）。テストデータ（-MinopalDemoSeed）を入れた「ログインせずに使う」の店で撮り、
// 結果（.xcresult）の添付として残す。ライト・ダークはシミュレータの外観（xcrun simctl ui <端末> appearance dark）で切り替える。
// 流し方：TEST_RUNNER_MINOPAL_SCREENSHOTS=1 xcodebuild test ... -only-testing:MinopalUITests/ScreenshotUITests
final class ScreenshotUITests: XCTestCase {
    override func setUpWithError() throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["MINOPAL_SCREENSHOTS"] == "1", "スクショを撮るときだけ流す")
        continueAfterFailure = false
    }

    @MainActor
    func testShopScreens() {
        let app = XCUIApplication()
        app.launchArguments = ["-MinopalDemoSeed"]
        let pad = UIDevice.current.userInterfaceIdiom == .pad
        XCUIDevice.shared.orientation = pad ? .landscapeLeft : .portrait
        app.launch()

        let guest = app.buttons["ログインせずに使う"]
        let table = app.buttons["table-1"]
        if firstToAppear(guest, table) == guest {
            snap("login")
            guest.tap()
        }
        XCTAssertTrue(table.waitForExistence(timeout: 15), "卓が出ない")
        // テストデータは店を開いて2秒後に入る
        RunLoop.current.run(until: Date().addingTimeInterval(5))
        snap("floor")
        if pad {
            app.buttons["サイドバーを閉じる"].tap()
            RunLoop.current.run(until: Date().addingTimeInterval(1.5))
            snap("floor-sidebar-closed")
            app.buttons["サイドバーを開く"].tap()
        } else {
            app.tabBars.buttons["お店"].tap()
            RunLoop.current.run(until: Date().addingTimeInterval(1))
            snap("shop")
            app.tabBars.buttons["テーブル状況"].tap()
        }
        // 空いている 11番のご案内と、卓の詳細（テストデータの 22番はコースで料理を2品出した卓）。
        // iPhone は 22番が配置図の右にあるので、横にスクロールしてから押す
        app.buttons["table-11"].tap()
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        snap("seating")
        app.buttons["detail-close"].tap()
        RunLoop.current.run(until: Date().addingTimeInterval(1))
        if !pad {
            app.buttons["table-12"].swipeLeft()
            RunLoop.current.run(until: Date().addingTimeInterval(1))
        }
        app.buttons["table-22"].tap()
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        snap("detail")
        // 変更する（人数・コース・時刻・卓）を開いた中身。下にあれば中をスクロールして押す
        app.buttons["detail-change"].tap()
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        snap("detail-change")
        app.buttons["detail-close"].tap()
    }

    @MainActor
    private func snap(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
