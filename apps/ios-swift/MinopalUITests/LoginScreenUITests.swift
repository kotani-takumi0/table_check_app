import XCTest

// 最初の画面（ログイン・アカウントを作る・ログインせずに使う）を押して確かめる。
// Firebase エミュレータ（npm run ios-swift:emulators）を起動してから流す。本物の Firebase にはつながない
final class LoginScreenUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    // 「アカウントを作る」に切り替えると確認の欄が出て、確認と違うパスワードは送る前に断る。作るとそのまま店が開く
    @MainActor
    func testSignUpChecksPasswordThenOpensShop() {
        let app = XCUIApplication()
        app.launch()
        openLoginScreen(app)

        app.buttons["アカウントを作る"].tap()
        let confirm = app.secureTextFields["パスワード（確認のため、もう一度）"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 5), "確認の欄が出ない")

        let email = "uitest-\(UUID().uuidString.prefix(8).lowercased())@example.com"
        enter(app.textFields["メールアドレス"], email)
        // 新しいパスワードの欄（.newPassword）に伏せたまま打つと、シミュレータのテストでは1文字しか入らないので、見せてから打つ
        app.buttons["パスワードを見せる"].firstMatch.tap()
        enter(app.textFields["パスワード（6文字以上）"], "pass12")
        typeSlowly(confirm, "pass99")
        app.buttons["アカウントを作る"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["パスワードが確認用と違います"].waitForExistence(timeout: 5), "確認と違うのに断らない")

        confirm.tap()
        confirm.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 6))
        typeSlowly(confirm, "pass12")
        app.buttons["アカウントを作る"].firstMatch.tap()
        XCTAssertTrue(app.buttons["table-1"].waitForExistence(timeout: 15), "作ったアカウントの店が開かない")
    }

    // ログインに戻すと確認の欄が消える。パスワードは表示を切り替えられる
    @MainActor
    func testSwitchBackAndRevealPassword() {
        let app = XCUIApplication()
        app.launch()
        openLoginScreen(app)

        app.buttons["アカウントを作る"].tap()
        XCTAssertTrue(app.secureTextFields["パスワード（確認のため、もう一度）"].waitForExistence(timeout: 5))
        app.buttons["ログイン"].firstMatch.tap()
        XCTAssertFalse(app.secureTextFields["パスワード（確認のため、もう一度）"].exists, "ログインに戻しても確認の欄が残る")

        typeSlowly(app.secureTextFields["パスワード"], "abc123")
        app.buttons["パスワードを見せる"].tap()
        XCTAssertEqual(app.textFields["パスワード"].value as? String, "abc123", "パスワードを見せられない")
        app.buttons["パスワードを隠す"].tap()
        XCTAssertTrue(app.secureTextFields["パスワード"].exists)
    }
}
