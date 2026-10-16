import XCTest

// UI テストで共通に使う待ち方・打ち方
@MainActor
extension XCTestCase {
    // どちらか先に出たほうを返す（どちらも出なければ nil）。片方を時間いっぱい待ってから次を見ると、そのぶん遅くなるため
    func firstToAppear(_ elements: XCUIElement..., timeout: TimeInterval = 15) -> XCUIElement? {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if let found = elements.first(where: { $0.exists }) { return found }
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        } while Date() < deadline
        return nil
    }

    // 最初の画面を出す。前に流したテストのログインが残っていて卓が出たら、ログアウトして戻る
    func openLoginScreen(_ app: XCUIApplication) {
        let emailField = app.textFields["メールアドレス"]
        if firstToAppear(emailField, app.buttons["table-1"]) != emailField {
            leaveShop(app)
        }
        XCTAssertTrue(emailField.waitForExistence(timeout: 15), "最初の画面が出ない")
    }

    // 店の画面から最初の画面に戻る：設定（iPad はサイドバー、iPhone はタブ）→ ログアウト（今の店は「ログインする」）→ 確認
    func leaveShop(_ app: XCUIApplication) {
        let open = app.buttons["サイドバーを開く"]
        if open.exists { open.tap() }
        app.buttons["設定"].firstMatch.tap()
        let row = firstToAppear(app.buttons["ログアウト"], app.buttons["ログインする"])
        XCTAssertNotNil(row, "設定にログアウトが無い")
        row?.tap()
        let confirm = firstToAppear(app.alerts.buttons["ログアウト"], app.alerts.buttons["戻る"], timeout: 5)
        XCTAssertNotNil(confirm, "ログアウトの確認が出ない")
        confirm?.tap()
    }

    // エミュレータと同期するまで待つ。iPad はヘッダーに同期の状態が出る。iPhone は同期済みのときは出さない（送信待ち・オフラインだけ出す）
    func waitUntilSynced(_ app: XCUIApplication, timeout: TimeInterval = 15) -> Bool {
        let state = app.descendants(matching: .any)["sync-state"]
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if !state.exists ? UIDevice.current.userInterfaceIdiom == .phone : state.label == "同期済み" { return true }
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        } while Date() < deadline
        return false
    }

    // パスワードの欄にまとめて打つと、1文字しか入らないことがある（シミュレータのテストだけで起き、人が打つときは起きない）ので1文字ずつ打つ
    func typeSlowly(_ field: XCUIElement, _ text: String) {
        field.tap()
        for ch in text {
            field.typeText(String(ch))
        }
    }

    func enter(_ field: XCUIElement, _ text: String) {
        field.tap()
        field.typeText(text)
    }
}
