import XCTest

// 配置図で、ご案内・卓の詳細・団体と、Firestore の読み書きを確かめる。
// Firebase エミュレータ（npm run ios-swift:emulators）を起動してから流す。本物の Firebase にはつながない
final class FloorUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    // ご案内 → 卓を追加（団体）→ 次の段階へ → 1つ戻す → 案内を取り消す（どれも Firestore を通って画面に戻ってくる）
    @MainActor
    func testGuestSeatsGroupsAdvancesAndClearsTable() {
        let app = XCUIApplication()
        app.launch()

        // 前に流したときの「ログインせずに使う」が残っていれば、最初の画面を飛ばして卓が出る
        let guest = app.buttons["ログインせずに使う"]
        let table = app.buttons["table-1"]
        let other = app.buttons["table-2"]
        if firstToAppear(guest, table) == guest {
            guest.tap()
        }
        XCTAssertTrue(table.waitForExistence(timeout: 15), "卓が出ない")
        XCTAssertTrue(waitUntilSynced(app), "エミュレータと同期できない")
        tuckNotices(app)
        clear(app, table)
        clear(app, other)

        // ご案内：2名を選んで案内する
        table.tap()
        tap(app.buttons["2名"])
        tap(app.buttons["seat-confirm"])
        XCTAssertTrue(waitForValue(table, "ご案内済み"), "1卓に案内できない")

        // 卓を追加（団体）：詳細から選び始め、空いている 2卓を押す
        table.tap()
        tap(app.buttons["detail-add"])
        XCTAssertTrue(app.buttons["pick-cancel"].waitForExistence(timeout: 5), "追加先を選ぶ帯が出ない")
        other.tap()
        XCTAssertTrue(waitForValue(other, "ご案内済み"), "2卓が団体に入らない")

        // 次の段階へ進め、1つ戻す
        table.tap()
        tap(app.buttons["detail-next"])
        tap(app.buttons["detail-close"])
        XCTAssertTrue(waitForValue(table, "お通し提供済み"), "お通し提供済みにならない")
        table.tap()
        tap(app.buttons["detail-back"])
        tap(app.buttons["detail-close"])
        XCTAssertTrue(waitForValue(table, "ご案内済み"), "1つ戻せない")

        // 案内を取り消すと、団体の卓ごと空く（詳細は閉じる）
        table.tap()
        tap(app.buttons["detail-back"])
        XCTAssertTrue(waitForValue(table, "空席"), "1卓が空かない")
        XCTAssertTrue(waitForValue(other, "空席"), "2卓が空かない")
    }

    // ログインした店（shops/{uid}/）でも、同じように案内して取り消せる。アカウントはエミュレータに直接作ってから、画面でログインする
    @MainActor
    func testAccountSeatsAndClearsTable() throws {
        let email = "uitest-\(UUID().uuidString.prefix(8).lowercased())@example.com"
        try createEmulatorAccount(email: email, password: "password123")
        let app = XCUIApplication()
        app.launch()

        // 前に流したときのログインが残っていれば、ログアウトして最初の画面に戻る
        let table = app.buttons["table-1"]
        openLoginScreen(app)
        enter(app.textFields["メールアドレス"], email)
        typeSlowly(app.secureTextFields["パスワード"], "password123")
        app.buttons["ログイン"].tap()

        XCTAssertTrue(table.waitForExistence(timeout: 15), "ログインした店の卓が出ない")
        XCTAssertTrue(waitUntilSynced(app), "エミュレータと同期できない")
        dismissSavePassword(app)
        // 作ったばかりの店なので、1卓は空いている
        XCTAssertEqual(table.value as? String, "空席")
        table.tap()
        tap(app.buttons["seat-confirm"])
        XCTAssertTrue(waitForValue(table, "ご案内済み"), "1卓に案内できない")
        table.tap()
        tap(app.buttons["detail-back"])
        XCTAssertTrue(waitForValue(table, "空席"), "1卓のお客さんを消せない")
    }

    // 前に流したときのお客さんが残っていれば、詳細で戻して空ける（退店済みの卓は長押しで詳細を開く）
    @MainActor
    private func clear(_ app: XCUIApplication, _ table: XCUIElement) {
        for _ in 0..<5 {
            guard let value = table.value as? String, value != "空席" else { return }
            if value == "退店済み" { table.press(forDuration: 1) } else { table.tap() }
            tap(app.buttons["detail-back"])
            let close = app.buttons["detail-close"]
            if close.waitForExistence(timeout: 1) { close.tap() }
            _ = waitForValue(table, value, not: true)
        }
        XCTAssertEqual(table.value as? String, "空席", "\(table.identifier) を空けられない")
    }
}
