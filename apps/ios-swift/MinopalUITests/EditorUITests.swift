import XCTest

// 最初のページ・席の配置・コースを直す画面（No.161）。Firebase エミュレータ（npm run ios-swift:emulators）を起動してから流す。
// どれも保存したものが Firestore を通って画面に戻ってくることを確かめる
final class EditorUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    // 作ったばかりの店は最初のページが出る。「自分で作る」で何もないマス目に卓を置いて始め、設定の「席の配置」で卓を足して動かす
    @MainActor
    func testFirstPageAndLayout() throws {
        let email = "uitest-\(UUID().uuidString.prefix(8).lowercased())@example.com"
        try createEmulatorAccount(email: email, password: "password123")
        let app = minopalApp()
        let pad = UIDevice.current.userInterfaceIdiom == .pad

        launchLoggedIn(app, email: email, startWithTemplate: false)
        let blank = app.buttons["first-blank"]
        XCTAssertTrue(blank.waitForExistence(timeout: 15), "最初のページが出ない")
        XCTAssertTrue(app.buttons["first-template-izakaya_21"].exists, "テンプレートが無い")
        blank.tap()

        // 大きいテーブル（最初に選んでいるブロック）を左上に置くと 11番になる。保存すると店が始まり、配置図に 11番だけが出る
        tap(app.buttons["layout-cell-1-1"])
        XCTAssertTrue(app.buttons["layout-seat-11"].waitForExistence(timeout: 5), "卓を置けない")
        tap(app.buttons["editor-save"])
        XCTAssertTrue(app.buttons["table-11"].waitForExistence(timeout: 15), "始めた店の配置図に 11番が出ない")
        XCTAssertFalse(app.buttons["table-1"].exists, "置いていない卓が出ている")

        // 設定 → お店 → 席の配置：カウンター席を足すと 1番になる。11番はつかんで右へ動かす
        openSettings(app, pad: pad)
        tap(app.buttons["settings-shop"])
        tap(app.buttons["open-layout"])
        tap(app.buttons["layout-block-counter"])
        tap(app.buttons["layout-cell-1-5"])
        XCTAssertTrue(app.buttons["layout-seat-1"].waitForExistence(timeout: 5), "カウンター席を置けない")
        tap(app.buttons["直し終わる"])
        let seat = app.buttons["layout-seat-11"]
        let before = seat.frame
        seat.press(forDuration: 0.2, thenDragTo: app.buttons["layout-cell-8-4"])
        XCTAssertTrue(waitForFrame(seat) { $0.minX > before.minX + 10 && $0.minY > before.minY + 10 }, "11番をつかんで動かせない")

        // 保存せずに戻ろうとすると確かめる。直し続けて保存すると、もう一度開いても 1番がある
        tap(app.buttons["editor-back"])
        let alert = app.alerts["保存せずにもどりますか？"]
        XCTAssertTrue(alert.waitForExistence(timeout: 5), "保存せずにもどる確認が出ない")
        alert.buttons["直し続ける"].tap()
        tap(app.buttons["editor-save"])
        tap(app.buttons["open-layout"])
        XCTAssertTrue(app.buttons["layout-seat-1"].waitForExistence(timeout: 10), "保存したカウンター席が残っていない")
    }

    // コースを足す・直す・消す（テンプレートで始めた店）
    @MainActor
    func testCourseEditor() throws {
        let email = "uitest-\(UUID().uuidString.prefix(8).lowercased())@example.com"
        try createEmulatorAccount(email: email, password: "password123")
        let app = minopalApp()
        let pad = UIDevice.current.userInterfaceIdiom == .pad

        launchLoggedIn(app, email: email)
        XCTAssertTrue(app.buttons["table-1"].waitForExistence(timeout: 15), "ログインした店の卓が出ない")
        tuckNotices(app)

        // コースを足す：名前・ボタンの名前・値段・料理を入れるまで保存できない
        openSettings(app, pad: pad)
        tap(app.buttons["settings-course"])
        // 「コースを足す」は料理のコースの下（区分とコースが並ぶので、画面の下にあれば上へスクロールする）
        let addCourse = app.buttons["コースを足す"]
        // 「コースを足す」があるリスト（いちばん右の列）の、画面に見えている所を上へドラッグする。
        // iPad でサイドバーを開いていると、この列は右の画面の外まで押し出されるので、列の真ん中や画面の決まった位置では当たらない
        let rightmost = app.collectionViews.matching(NSPredicate(format: "label != %@", "Sidebar")).allElementsBoundByIndex.max { $0.frame.minX < $1.frame.minX }
        let list = pad ? rightmost ?? app : app
        let shown = list.frame.intersection(app.frame)
        let origin = app.coordinate(withNormalizedOffset: .zero)
        for _ in 0..<5 where !addCourse.isHittable {
            origin.withOffset(CGVector(dx: shown.midX, dy: shown.minY + shown.height * 0.7))
                .press(forDuration: 0.05, thenDragTo: origin.withOffset(CGVector(dx: shown.midX, dy: shown.minY + shown.height * 0.3)))
        }
        tap(addCourse)
        let save = app.buttons["editor-save"]
        XCTAssertTrue(save.waitForExistence(timeout: 5), "コースを足す画面が出ない")
        XCTAssertFalse(save.isEnabled, "空のコースを保存できてしまう")
        enter(app.textFields["名前"], "UIテストのコース")
        enter(app.textFields["ボタンの名前"], "UIテスト")
        enter(app.textFields["値段（円）"], "3800")
        enter(app.textFields["1品目"], "前菜")
        XCTAssertTrue(save.isEnabled, "入れ終わっても保存できない")
        save.tap()

        // 一覧に出る。押すと直す画面になり、消すと一覧から消える
        let row = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "3,800円 UIテスト")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10), "足したコースが一覧に出ない")
        row.tap()
        tap(app.buttons["このコースを消す"])
        let alert = app.alerts["このコースを消しますか？"]
        XCTAssertTrue(alert.waitForExistence(timeout: 5), "コースを消す確認が出ない")
        alert.buttons["消す"].tap()
        XCTAssertTrue(waitForGone(row), "消したコースが一覧に残る")
    }

    @MainActor
    private func waitForFrame(_ element: XCUIElement, timeout: TimeInterval = 5, _ check: @escaping (CGRect) -> Bool) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if check(element.frame) { return true }
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        } while Date() < deadline
        return false
    }

    @MainActor
    private func waitForGone(_ element: XCUIElement) -> Bool {
        XCTWaiter().wait(for: [expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: element)], timeout: 10) == .completed
    }
}
