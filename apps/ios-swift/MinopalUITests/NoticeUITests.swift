import XCTest

// 通知のバナー・ベルと「元に戻す」（No.159）。Firebase エミュレータ（npm run ios-swift:emulators）を起動してから流す。
// 作ったばかりの店は、店のタイマー（トイレチェック・トイレ清掃）を一度も済にしていないので、2つとも時間が来た通知が出る
final class NoticeUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    // 通知：閉じるとベルにしまい、ベルで開き直す。済にすると通知が減り、元に戻すと戻る。
    // 卓：次の段階へ進めたあと、元に戻すで前の段階に戻る（どれも Firestore を通って画面に戻ってくる）
    @MainActor
    func testNoticesAndUndo() throws {
        let email = "uitest-\(UUID().uuidString.prefix(8).lowercased())@example.com"
        try createEmulatorAccount(email: email, password: "password123")
        let app = XCUIApplication()
        app.launch()

        let table = app.buttons["table-1"]
        openLoginScreen(app)
        enter(app.textFields["メールアドレス"], email)
        typeSlowly(app.secureTextFields["パスワード"], "password123")
        app.buttons["ログイン"].tap()
        XCTAssertTrue(table.waitForExistence(timeout: 15), "ログインした店の卓が出ない")
        XCTAssertTrue(waitUntilSynced(app), "エミュレータと同期できない")
        dismissSavePassword(app)

        // 閉じるとベルにしまう（10 秒たって自分でしまっていても同じ）。ベルを押すと開き直す
        let bell = app.buttons["notice-bell"]
        tuckNotices(app)
        XCTAssertTrue(waitForLabel(bell, "通知 2件"), "ベルに 2件が出ない")
        bell.tap()
        tap(app.buttons["notice-action"].firstMatch)

        // 済にすると 1件になり、元に戻すと 2件に戻る（戻った通知はもう一度バナーで知らせる）
        let undo = app.buttons["undo-button"]
        XCTAssertTrue(undo.waitForExistence(timeout: 5), "元に戻すが出ない")
        tuckNotices(app)
        XCTAssertTrue(waitForLabel(bell, "通知 1件"), "済にしても通知が減らない")
        undo.tap()
        XCTAssertTrue(app.buttons["notice-close"].firstMatch.waitForExistence(timeout: 10), "戻した通知がバナーに出ない")
        tuckNotices(app)
        XCTAssertTrue(waitForLabel(bell, "通知 2件"), "元に戻しても通知が戻らない")

        // ご案内 → 次の段階へ → 元に戻す
        table.tap()
        tap(app.buttons["seat-confirm"])
        XCTAssertTrue(waitForValue(table, "ご案内済み"), "1卓に案内できない")
        table.tap()
        tap(app.buttons["detail-next"])
        tap(app.buttons["detail-close"])
        XCTAssertTrue(waitForValue(table, "お通し提供済み"), "お通し提供済みにならない")
        tap(undo)
        XCTAssertTrue(waitForValue(table, "ご案内済み"), "元に戻せない")
    }

    @MainActor
    private func waitForLabel(_ element: XCUIElement, _ label: String) -> Bool {
        XCTWaiter().wait(for: [expectation(for: NSPredicate(format: "label == %@", label), evaluatedWith: element)], timeout: 10) == .completed
    }
}
