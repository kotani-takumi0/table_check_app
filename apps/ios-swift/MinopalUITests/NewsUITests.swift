import XCTest

// お知らせ（No.162）：今後の予定・最近の更新・ご意見を送る。Firebase エミュレータ（npm run ios-swift:emulators）を起動してから流す。
// 今後の予定は今は空なので、案内と「ご意見を送る」が出る
final class NewsUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    // 今後の予定 →「ご意見を送る」で書く欄へ → 送ると「送りました」と待ちが出る（Firestore のルールを通って届く）→ 最近の更新に版ごとのまとめが出る
    @MainActor
    func testRoadmapFeedbackAndUpdates() throws {
        let pad = UIDevice.current.userInterfaceIdiom == .pad
        let email = "uitest-\(UUID().uuidString.prefix(8).lowercased())@example.com"
        try createEmulatorAccount(email: email, password: "password123")
        let app = XCUIApplication()
        app.launch()

        openLoginScreen(app)
        logIn(app, email: email)
        XCTAssertTrue(app.buttons["table-1"].waitForExistence(timeout: 15), "ログインした店の卓が出ない")
        XCTAssertTrue(waitUntilSynced(app), "エミュレータと同期できない")
        dismissSavePassword(app)
        tuckNotices(app)

        // iPad はサイドバー、iPhone はタブから開く。最初は今後の予定
        if pad {
            let open = app.buttons["サイドバーを開く"]
            if open.exists { open.tap() }
            tap(app.buttons["お知らせ"].firstMatch)
        } else {
            tap(app.tabBars.buttons["お知らせ"])
        }
        tap(app.buttons["roadmap-feedback"])

        let text = app.textViews["feedback-text"]
        enter(text, "UI test feedback")
        // キーボードが出ていれば閉じる（送るボタンが隠れないように）
        let done = app.buttons["完了"]
        if done.waitForExistence(timeout: 2) { done.tap() }
        let send = app.buttons["feedback-send"]
        tap(send)
        XCTAssertTrue(app.staticTexts["送りました。ありがとうございます。"].waitForExistence(timeout: 15), "ご意見が届かない")
        XCTAssertFalse(send.isEnabled, "送ったあとも続けて送れる")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "続けて送るには少し待ってください")).firstMatch.exists,
                      "待ちの案内が出ない")

        tap(app.buttons["最近の更新"])
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "版ごとに、新しくなったところ")).firstMatch.waitForExistence(timeout: 5),
                      "最近の更新が出ない")
        // いちばん新しい版はいちばん上に出る（版が増えても画面の中にある）
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "v[0-9]+\\.[0-9]+\\.[0-9]+")).firstMatch.exists, "版ごとのまとめが出ない")
    }
}
