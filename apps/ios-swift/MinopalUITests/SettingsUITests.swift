import XCTest

// 設定（No.160）。Firebase エミュレータ（npm run ios-swift:emulators）を起動してから流す。
// 作ったばかりの店で、時間制限なし・時間のルール・全卓消去が Firestore を通って画面に戻ってくることを確かめる
final class SettingsUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testSettingsAndClearAll() throws {
        let email = "uitest-\(UUID().uuidString.prefix(8).lowercased())@example.com"
        try createEmulatorAccount(email: email, password: "password123")
        let app = XCUIApplication()
        app.launch()
        let pad = UIDevice.current.userInterfaceIdiom == .pad

        let table = app.buttons["table-1"]
        openLoginScreen(app)
        logIn(app, email: email)
        XCTAssertTrue(table.waitForExistence(timeout: 15), "ログインした店の卓が出ない")
        XCTAssertTrue(waitUntilSynced(app), "エミュレータと同期できない")
        dismissSavePassword(app)
        tuckNotices(app)

        // 1卓に案内してから設定へ
        table.tap()
        tap(app.buttons["seat-confirm"])
        XCTAssertTrue(waitForValue(table, "ご案内済み"), "1卓に案内できない")
        openSettings(app, pad: pad)

        // 時間制限なし：入れると全端末の設定に書き、読み直した値でスイッチが入る（スイッチは行の右端を押す）
        let timeLimitOff = app.switches["時間制限なし"].firstMatch
        XCTAssertTrue(timeLimitOff.waitForExistence(timeout: 5), "時間制限なしが無い")
        XCTAssertTrue(waitForValue(timeLimitOff, "0"), "時間制限なしが最初から入っている")
        timeLimitOff.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        XCTAssertTrue(waitForValue(timeLimitOff, "1"), "時間制限なしが入らない")
        timeLimitOff.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        XCTAssertTrue(waitForValue(timeLimitOff, "0"), "時間制限なしを切れない")

        // 時間のルール：L.O. を 5 分長くすると、目次（iPhone は行）の値も変わる
        tap(app.buttons["settings-time"])
        tap(app.buttons["L.O.を長く"])
        XCTAssertTrue(app.staticTexts["L.O. 95分"].waitForExistence(timeout: 10), "L.O. が 95分にならない")
        tap(app.buttons["L.O.を短く"])
        XCTAssertTrue(app.staticTexts["L.O. 90分"].waitForExistence(timeout: 10), "L.O. が 90分に戻らない")
        if pad {
            tap(app.buttons["settings-today"])
        } else {
            app.navigationBars.buttons.firstMatch.tap()
        }

        // 全卓消去：確認に会計前の卓の数を出し、消すと 1卓が空席になる
        tap(app.buttons["clear-all"])
        let alert = app.alerts["全卓を消去しますか？"]
        XCTAssertTrue(alert.waitForExistence(timeout: 5), "全卓消去の確認が出ない")
        XCTAssertTrue(alert.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "会計前の卓が 1 卓あります")).firstMatch.exists, "会計前の卓の数が出ない")
        alert.buttons["全卓を消去"].tap()
        if pad {
            tap(app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "テーブル状況")).firstMatch)
        } else {
            app.tabBars.buttons["テーブル状況"].tap()
        }
        XCTAssertTrue(waitForValue(table, "空席"), "全卓消去で 1卓が空かない")
    }
}
