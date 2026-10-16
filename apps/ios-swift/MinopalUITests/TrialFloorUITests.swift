import XCTest

// 仮の画面で、ログインと Firestore の読み書きを確かめる。
// Firebase エミュレータ（npm run ios-swift:emulators）を起動してから流す。本物の Firebase にはつながない
final class TrialFloorUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testGuestSeatsAndClearsTable() {
        let app = XCUIApplication()
        app.launch()

        // 前に流したときの「ログインせずに使う」が残っていれば、最初の画面を飛ばして卓が出る
        let guest = app.buttons["ログインせずに使う"]
        let table = app.buttons["table-1"]
        if firstToAppear(guest, table) == guest {
            guest.tap()
        }
        XCTAssertTrue(table.waitForExistence(timeout: 15), "卓が出ない")
        XCTAssertTrue(waitUntilSynced(app), "エミュレータと同期できない")

        // 空いていれば案内し、案内中なら消す。もう一度押すと元に戻る（どちらも Firestore を通って画面に戻ってくる）
        let before = table.value as? String
        let after = before == "空席" ? "ご案内済み" : "空席"
        table.tap()
        XCTAssertTrue(waitForValue(table, after), "1卓が「\(after)」にならない")
        table.tap()
        XCTAssertTrue(waitForValue(table, before ?? "空席"), "1卓が元に戻らない")
    }

    // ログインした店（shops/{uid}/）でも、同じように案内して消せる。アカウントはエミュレータに直接作ってから、画面でログインする
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
        // 作ったばかりの店なので、1卓は空いている
        XCTAssertEqual(table.value as? String, "空席")
        table.tap()
        XCTAssertTrue(waitForValue(table, "ご案内済み"), "1卓に案内できない")
        table.tap()
        XCTAssertTrue(waitForValue(table, "空席"), "1卓のお客さんを消せない")
    }


    // Auth エミュレータの REST でアカウントを作る（鍵は確かめられないので何でもよい）
    private func createEmulatorAccount(email: String, password: String) throws {
        var request = URLRequest(url: URL(string: "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password, "returnSecureToken": true])
        let done = expectation(description: "アカウントを作る")
        var status = 0
        URLSession.shared.dataTask(with: request) { _, response, _ in
            status = (response as? HTTPURLResponse)?.statusCode ?? 0
            done.fulfill()
        }.resume()
        wait(for: [done], timeout: 10)
        XCTAssertEqual(status, 200, "エミュレータにアカウントを作れない（npm run ios-swift:emulators を起動しているか）")
    }

    private func waitForValue(_ element: XCUIElement, _ value: String) -> Bool {
        let predicate = NSPredicate(format: "value == %@", value)
        return XCTWaiter().wait(for: [expectation(for: predicate, evaluatedWith: element)], timeout: 15) == .completed
    }

    private func waitUntilSynced(_ app: XCUIApplication) -> Bool {
        app.staticTexts["同期済み"].waitForExistence(timeout: 15)
    }
}
