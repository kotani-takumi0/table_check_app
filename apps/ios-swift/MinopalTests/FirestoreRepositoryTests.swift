@preconcurrency import FirebaseAuth
@preconcurrency import FirebaseFirestore
import Foundation
import MinopalCore
import Testing
@testable import Minopal

// Firestore の読み書き（Minopal/Data）を、Firebase エミュレータ（npm run ios-swift:emulators）に対して確かめる。
// アプリの中で動き、アプリがエミュレータにつなぐ。テストごとに新しいアカウントを作り、その店（shops/{uid}/）だけを使う。
// 本物の Firestore のルール（firestore.rules）で断られないことも、ここで確かめる
@MainActor
@Suite("Firestore の読み書き", .serialized)
struct FirestoreRepositoryTests {
    // 新しいアカウントを作ってログインし、その店を返す
    private func newShop() async throws -> ShopBase {
        let email = "repo-\(UUID().uuidString.prefix(8).lowercased())@example.com"
        let result = try await Auth.auth().createUser(withEmail: email, password: "password123")
        return .account(uid: result.user.uid)
    }
    // Firestore の知らせが届くまで待つ
    private func waitUntil(_ timeout: Double = 10, _ condition: () -> Bool) async -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if condition() { return true }
            try? await Task.sleep(for: .milliseconds(100))
        }
        return condition()
    }

    @Test("店の設定を変えると、変えた項目だけが書かれ、読み戻せる")
    func settings() async throws {
        let base = try await newShop()
        let repository = ShopSettingsRepository(base: base)
        repository.start()
        defer { repository.stop() }
        #expect(await waitUntil { repository.syncState == .synced })
        var settings = repository.settings
        settings.shopName = "テスト店"
        settings.closingMin = 1410
        repository.update(settings, fields: [.shopName, .closingMin])
        #expect(await waitUntil { repository.settings.shopName == "テスト店" && repository.settings.closingMin == 1410 && repository.syncState == .synced })
        let raw = try await Firestore.firestore().collection(base.path("shopSettings")).document("main").getDocument(source: .server).data() ?? [:]
        #expect(Set(raw.keys) == ["shopName", "closingMin", "updatedAt"])
    }

    @Test("店のタイマーを済にして、元に戻せる")
    func timers() async throws {
        let repository = ShopTimerRepository(base: try await newShop())
        repository.start()
        defer { repository.stop() }
        #expect(await waitUntil { repository.syncState == .synced })
        let at = nowMs()
        repository.markDone("toilet_check", at: at)
        #expect(await waitUntil { repository.done["toilet_check"] == at && repository.syncState == .synced })
        repository.undoDone("toilet_check", after: at, before: nil)
        #expect(await waitUntil { repository.done["toilet_check"] == nil && repository.syncState == .synced })
    }

    @Test("席の配置を保存すると保存済みになり、お客さんがいる卓を消す配置は保存しない")
    func layout() async throws {
        let base = try await newShop()
        let layout = ShopLayoutRepository(base: base, app: AppVersion.info)
        let sessions = SessionRepository(base: base)
        layout.start()
        sessions.start()
        defer { layout.stop(); sessions.stop() }
        #expect(await layout.isSaved() == false)
        try await layout.save(defaultLayout)
        #expect(await layout.isSaved() == true)
        // 12番に案内してから、12番を外した配置を保存しようとする
        sessions.put(newSession(id: UUID().uuidString.lowercased(), tableId: "12", at: nowMs(), guests: 2))
        #expect(await waitUntil { sessions.sessions.contains { $0.tableIds == ["12"] } && sessions.syncState == .synced })
        let without12 = ShopLayout(seats: defaultLayout.seats.filter { $0.id != "12" }, labels: defaultLayout.labels)
        await #expect(throws: LayoutSaveError.self) { try await layout.save(without12) }
        // 配置の移り変わりも残る
        let history = try await Firestore.firestore().collection(base.path("layoutHistory")).getDocuments(source: .server)
        #expect(history.documents.count == 1)
        #expect(history.documents.first?.data()["platform"] as? String == "ios")
    }

    @Test("最初のページ：設定と配置をまとめて入れる")
    func startShop() async throws {
        let base = try await newShop()
        let layout = ShopLayoutRepository(base: base, app: AppVersion.info)
        let settings = ShopSettingsRepository(base: base)
        settings.start()
        defer { settings.stop() }
        try await layout.startShop(defaultLayout, settings: blankSettings)
        #expect(await layout.isSaved() == true)
        #expect(await waitUntil { settings.settings.courseMenus.isEmpty && settings.settings.drinkPlans.isEmpty && settings.syncState == .synced })
    }

    @Test("お客さんを書くと、記録（営業日・端末の種類と版）も写す")
    func sessionRecord() async throws {
        let base = try await newShop()
        let services = ShopServices(base: base, app: AppInfo(platform: .ios, version: "0.1.0"))
        services.start()
        defer { services.stop() }
        #expect(await waitUntil { services.settings.syncState == .synced })
        let session = newSession(id: UUID().uuidString.lowercased(), tableId: "21", at: nowMs(), guests: 4, course: "drinks", menu: "casual")
        services.sessions.put(session)
        #expect(await waitUntil { services.sessions.sessions.contains { $0.id == session.id } && services.sessions.syncState == .synced })
        let raw = try await Firestore.firestore().collection(base.path("sessions")).document(session.id).getDocument(source: .server).data() ?? [:]
        #expect(raw["platform"] as? String == "ios" && raw["appVersion"] as? String == "0.1.0")
        #expect(raw["businessDay"] as? String == businessDayOf(session.seatedAt))
        #expect(raw["drinkPlanName"] as? String == "飲み放題" && raw["courseName"] as? String == menuOf("casual")?.name)
    }

    @Test("通常の組（コースなし）も、記録を写して書ける")
    func plainSessionRecord() async throws {
        let base = try await newShop()
        let services = ShopServices(base: base, app: AppInfo(platform: .ios, version: "0.1.0"))
        services.start()
        defer { services.stop() }
        #expect(await waitUntil { services.syncState == .synced })
        let session = newSession(id: UUID().uuidString.lowercased(), tableId: "1", at: nowMs(), guests: 2)
        services.sessions.put(session)
        #expect(await waitUntil { services.sessions.syncState == .synced })
        let raw = try await Firestore.firestore().collection(base.path("sessions")).document(session.id).getDocument(source: .server)
        #expect(raw.exists)
        #expect(services.sessions.lastError == nil, "\(services.sessions.lastError ?? "")")
    }

    @Test("ほかの端末が詳細を開いているお客さんに、編集中の印が出て、閉じたら消える")
    func editing() async throws {
        let base = try await newShop()
        let mine = EditingRepository(base: base, deviceId: "device-a")
        let other = EditingRepository(base: base, deviceId: "device-b")
        mine.start()
        other.start()
        defer { mine.stop(); other.stop() }
        mine.setEditing("session-1")
        #expect(await waitUntil { other.marks.map(\.sessionId) == ["session-1"] })
        // 自分の端末の印は出さない
        #expect(mine.marks.isEmpty)
        mine.setEditing(nil)
        #expect(await waitUntil { other.marks.isEmpty })
    }

    @Test("ご意見は送れ、続けて送ると間隔が空くまで断られる")
    func feedback() async throws {
        let sender = FeedbackSender(base: try await newShop())
        let input = FeedbackInput(message: "テストのご意見", version: "v0.1.0", platform: .ios, shopName: "")
        #expect(try await sender.send(input) == .sent)
        await #expect(throws: FeedbackRejected.self) { _ = try await sender.send(input) }
    }

    @Test("サーバーとの時差を測り、端末に覚える")
    func serverClock() async throws {
        _ = try await newShop()
        let uid = try #require(Auth.auth().currentUser?.uid)
        let defaults = try #require(UserDefaults(suiteName: "minopal-tests-\(UUID().uuidString)"))
        // アカウントを作った直後は、Firestore がまだ前の利用者の権限で書いて断られることがある（テストで何度も切り替えるため）。
        // アプリは10分ごとに測り直すので、ここでも測れるまで数回やり直す
        for _ in 0..<5 where defaults.string(forKey: ServerClock.storageKey) == nil {
            await ServerClock(defaults: defaults).measure(uid: uid)
            if defaults.string(forKey: ServerClock.storageKey) == nil { try await Task.sleep(for: .milliseconds(500)) }
        }
        // エミュレータはこの Mac の時計で動くので、時差はほぼ0
        let saved = try #require(defaults.string(forKey: ServerClock.storageKey).flatMap { Int($0) })
        #expect(abs(saved) < 5_000)
    }
}
