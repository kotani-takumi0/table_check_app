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

    // テストで動かすアプリ。通知の許可の説明（No.151）は、通知のテスト（NotificationUITests）のほかでは出さない（出ると画面の操作が止まるため）
    func minopalApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-minopal.notifications.asked", "YES"]
        return app
    }

    // 最初の画面を出す。前に流したテストのログインが残っていて卓（始める前の店は最初のページ）が出たら、ログアウトして戻る
    func openLoginScreen(_ app: XCUIApplication) {
        let emailField = app.textFields["メールアドレス"]
        let firstPage = app.buttons["first-blank"]
        let found = firstToAppear(emailField, app.buttons["table-1"], firstPage)
        if found == firstPage {
            app.buttons["ログアウト"].tap()
        } else if found != emailField {
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

    // ログインした店でアプリを起動する。画面ではログインせず、起動の引数でアプリにログインさせる（Minopal/Data/TestLogin.swift）。
    // 画面でログインすると iOS の「パスワードを保存しますか？」が出て、閉じるのに数秒〜2分かかるため。
    // 作ったばかりのアカウントは最初のページ（No.087）が出るので、テンプレート（居酒屋・21卓）で始める
    func launchLoggedIn(_ app: XCUIApplication, email: String, startWithTemplate: Bool = true) {
        app.launchArguments += ["-MinopalTestLogin", email]
        app.launch()
        guard startWithTemplate else { return }
        let template = app.buttons["first-template-izakaya_21"]
        if firstToAppear(template, app.buttons["table-1"]) == template {
            template.tap()
        }
    }

    // 設定を開く（iPad はサイドバー、iPhone はタブ）
    @MainActor
    func openSettings(_ app: XCUIApplication, pad: Bool) {
        if pad {
            let open = app.buttons["サイドバーを開く"]
            if open.exists { open.tap() }
            tap(app.buttons["設定"].firstMatch)
        } else {
            app.tabBars.buttons["設定"].tap()
        }
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

    @MainActor
    func tap(_ element: XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout: 5), "\(element) が出ない")
        element.tap()
    }

    // Auth エミュレータの REST でアカウントを作る（鍵は確かめられないので何でもよい）
    func createEmulatorAccount(email: String, password: String) throws {
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

    @MainActor
    func waitForValue(_ element: XCUIElement, _ value: String, not: Bool = false) -> Bool {
        let predicate = NSPredicate(format: not ? "value != %@" : "value == %@", value)
        return XCTWaiter().wait(for: [expectation(for: predicate, evaluatedWith: element)], timeout: 15) == .completed
    }

    // 通知のバナーが出ていれば閉じる（ベルにしまう）。iPhone では上の卓に重なることがあるため
    func tuckNotices(_ app: XCUIApplication) {
        let close = app.buttons["notice-close"].firstMatch
        if close.waitForExistence(timeout: 2) { close.tap() }
    }
}
