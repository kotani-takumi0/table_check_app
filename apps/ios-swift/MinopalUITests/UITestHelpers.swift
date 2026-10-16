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
            app.buttons["アカウント"].firstMatch.tap()
            app.buttons["ログアウト"].tap()
        }
        XCTAssertTrue(emailField.waitForExistence(timeout: 15), "最初の画面が出ない")
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
