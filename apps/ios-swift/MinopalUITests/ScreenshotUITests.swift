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
    }

    @MainActor
    private func snap(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
