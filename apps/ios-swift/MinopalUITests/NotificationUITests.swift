import XCTest

// 端末の通知（No.151）。Firebase エミュレータ（npm run ios-swift:emulators）を起動してから流す。
// 本当の時刻（店のタイマーは 30 分後）を待てないので、起動の引数 -MinopalNotifyWithin で、予約した通知を数秒のうちに出す（開発中のビルドだけ）。
// どの条件で予約するかは MinopalCore のテスト（ScheduledNoticeTests）で確かめている
final class NotificationUITests: XCTestCase {
    @MainActor private var springboard: XCUIApplication { XCUIApplication(bundleIdentifier: "com.apple.springboard") }

    override func setUp() {
        continueAfterFailure = false
    }

    // 店のタイマーを済にしてアプリを閉じると、時間が来たときに端末の通知が届く。「この端末」で通知を切ると届かない
    @MainActor
    func testNotifiesWhenClosedAndStopsWhenOff() throws {
        let pad = UIDevice.current.userInterfaceIdiom == .pad
        let email = "uitest-\(UUID().uuidString.prefix(8).lowercased())@example.com"
        try createEmulatorAccount(email: email, password: "password123")
        // 許可の説明を出す（-minopal.notifications.asked を付けない）
        let app = XCUIApplication()
        app.launchArguments = ["-MinopalNotifyWithin", "5"]

        launchLoggedIn(app, email: email)
        XCTAssertTrue(app.buttons["table-1"].waitForExistence(timeout: 15), "ログインした店の卓が出ない")
        XCTAssertTrue(waitUntilSynced(app), "エミュレータと同期できない")
        // まだ iOS に聞いていない端末では、初めて店の画面を開くと説明が出る
        let ask = app.alerts["通知を出してもよいですか？"]
        if ask.waitForExistence(timeout: 3) {
            ask.buttons["通知を許可する"].tap()
            allowSystemNotifications()
        }
        tuckNotices(app)

        // 「この端末」で通知が入っていて、iOS の許可もあること（説明で「あとで」を選んだ端末でも、ここから許可できる）
        openDeviceSettings(app, pad: pad)
        let toggle = app.switches["通知"].firstMatch
        XCTAssertTrue(toggle.waitForExistence(timeout: 5), "通知の切り替えが無い")
        if toggle.value as? String == "0" { flip(toggle) }
        let allow = app.buttons["notifications-allow"]
        if allow.waitForExistence(timeout: 2) {
            allow.tap()
            allowSystemNotifications()
        }
        XCTAssertFalse(app.buttons["notifications-open-settings"].exists, "この端末で通知が断られている（シミュレータの設定で許可してから流す）")

        // 済にしてアプリを閉じると、時間が来たら届く
        markDone(app, "トイレチェック", pad: pad)
        XCUIDevice.shared.press(.home)
        XCTAssertTrue(banner("トイレチェックの時間です").waitForExistence(timeout: 20), "閉じているときに通知が届かない")

        // 通知を切ると届かない
        app.activate()
        openDeviceSettings(app, pad: pad)
        flip(toggle)
        XCTAssertTrue(waitForValue(toggle, "0"), "通知を切れない")
        markDone(app, "トイレ清掃", pad: pad)
        XCUIDevice.shared.press(.home)
        XCTAssertFalse(banner("トイレ清掃の時間です").waitForExistence(timeout: 12), "通知を切っても届いた")

        // 次に流すときのため、通知を入れ直しておく
        app.activate()
        openDeviceSettings(app, pad: pad)
        flip(toggle)
        XCTAssertTrue(waitForValue(toggle, "1"), "通知を入れ直せない")
    }

    @MainActor
    private func openDeviceSettings(_ app: XCUIApplication, pad: Bool) {
        openSettings(app, pad: pad)
        // iPhone は設定タブの奥に進んだまま戻ってくることがある
        if !app.switches["通知"].firstMatch.waitForExistence(timeout: 1) { tap(app.buttons["settings-device"]) }
    }

    // 切り替えのスイッチそのものを押す。行の右端を押すと、iPad でサイドバーを開いていて列が細いときに、スイッチの外に当たるため
    @MainActor
    private func flip(_ toggle: XCUIElement) {
        let knob = toggle.switches.firstMatch
        if knob.exists {
            knob.tap()
        } else {
            toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        }
    }

    // 店のタイマーを済にする（iPad はサイドバー、iPhone はお店タブの行の「済」）
    @MainActor
    private func markDone(_ app: XCUIApplication, _ label: String, pad: Bool) {
        if pad {
            let open = app.buttons["サイドバーを開く"]
            if open.exists { open.tap() }
        } else {
            app.tabBars.buttons["お店"].tap()
        }
        tap(app.buttons["\(label)を済にする"].firstMatch)
    }

    // iOS の「通知を送信します」の確認で許可する（言語によって文言が違う）
    @MainActor
    private func allowSystemNotifications() {
        let button = firstToAppear(springboard.alerts.buttons["許可"], springboard.alerts.buttons["Allow"], timeout: 5)
        button?.tap()
    }

    @MainActor
    private func banner(_ text: String) -> XCUIElement {
        springboard.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }
}
