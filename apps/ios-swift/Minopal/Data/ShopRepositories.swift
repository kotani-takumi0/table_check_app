@preconcurrency import FirebaseFirestore
import MinopalCore
import Observation

// 店の設定・店のタイマー・席の配置・編集中の印を Firestore で読み書きする
// （packages/core/src/firestoreShopSettings.ts・firestoreShopTimers.ts・firestoreShopLayout.ts・firestoreEditing.ts の Swift 版）。
// Firestore はこれらの知らせをメインスレッドで呼ぶ。オフラインだと書き込みが終わらないので、書き込みは待たない

func syncStateOf(_ metadata: SnapshotMetadata?) -> SyncState {
    guard let metadata, !metadata.isFromCache else { return .offline }
    return metadata.hasPendingWrites ? .pending : .synced
}
func logError(_ error: Error?) {
    if let error { print("Firestore:", error.localizedDescription) }
}

// shopSettings/main に店全体の設定を持ち、全端末で共有する
@MainActor @Observable
final class ShopSettingsRepository {
    private(set) var settings = ShopSettings.standard
    private(set) var syncState = SyncState.offline
    @ObservationIgnored private let document: DocumentReference
    @ObservationIgnored private var listener: ListenerRegistration?

    init(base: ShopBase, db: Firestore = Firestore.firestore()) {
        document = db.collection(base.path("shopSettings")).document("main")
    }

    func start() {
        guard listener == nil else { return }
        listener = document.addSnapshotListener(includeMetadataChanges: true) { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                logError(error)
                if let snapshot { self.settings = parseShopSettings(snapshot.data()) }
                self.syncState = syncStateOf(snapshot?.metadata)
            }
        }
    }
    func stop() {
        listener?.remove()
        listener = nil
        syncState = .offline
    }
    // 変えた項目だけを書き、ほかの項目は残す（merge）
    func update(_ settings: ShopSettings, fields: Set<ShopSettingsField>) {
        var data = shopSettingsDocument(settings, fields: fields)
        data["updatedAt"] = FieldValue.serverTimestamp()
        document.setData(data, merge: true) { logError($0) }
    }
}

// shopTimers/{タイマーID} に最後に済にした時刻を持ち、全端末で共有する
@MainActor @Observable
final class ShopTimerRepository {
    private(set) var done: ShopTimerDone = [:]
    private(set) var syncState = SyncState.offline
    @ObservationIgnored private let collection: CollectionReference
    @ObservationIgnored private var listener: ListenerRegistration?

    init(base: ShopBase, db: Firestore = Firestore.firestore()) {
        collection = db.collection(base.path("shopTimers"))
    }

    func start() {
        guard listener == nil else { return }
        listener = collection.addSnapshotListener(includeMetadataChanges: true) { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                logError(error)
                if let snapshot { self.done = shopTimerDone(snapshot.documents.map { (id: $0.documentID, data: $0.data()) }) }
                self.syncState = syncStateOf(snapshot?.metadata)
            }
        }
    }
    func stop() {
        listener?.remove()
        listener = nil
        syncState = .offline
    }
    // 前の時刻も残し、元に戻すときはルールがその値に戻すことだけを許す（No.102）。古い時刻の書き込みはルールで断られ、画面はサーバーの値に戻る
    func markDone(_ id: String, at: Int) {
        collection.document(id).setData(["doneAt": at, "prevDoneAt": done[id].map { $0 as Any } ?? NSNull(), "updatedAt": FieldValue.serverTimestamp()]) { logError($0) }
    }
    // 済にしたのを取り消す（No.102）。今の時刻が after のときだけ before に戻す（一度も済にしていなかったタイマーは doneAt: null）
    func undoDone(_ id: String, after: Int, before: Int?) {
        guard done[id] == after else { return }
        collection.document(id).setData(["doneAt": before.map { $0 as Any } ?? NSNull(), "prevDoneAt": NSNull(), "updatedAt": FieldValue.serverTimestamp()]) { logError($0) }
    }
}

// 席の配置を保存できなかった理由（お店の人が読める言葉）
struct LayoutSaveError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

// shopLayout/main に席の配置を持ち、全端末で共有する。まだ無い・壊れているときは最初の配置を使う
@MainActor @Observable
final class ShopLayoutRepository {
    private(set) var layout = defaultLayout
    @ObservationIgnored private let db: Firestore
    @ObservationIgnored private let base: ShopBase
    @ObservationIgnored private let app: AppInfo?
    @ObservationIgnored private var listener: ListenerRegistration?
    // ここまで待って返事が無ければ、送信待ちとして成功にする（オフラインだと書き込みが終わらないため）
    static let saveWaitSeconds = 4.0

    init(base: ShopBase, app: AppInfo?, db: Firestore = Firestore.firestore()) {
        self.db = db
        self.base = base
        self.app = app
    }
    private var document: DocumentReference { db.collection(base.path("shopLayout")).document("main") }

    func start() {
        guard listener == nil else { return }
        listener = document.addSnapshotListener { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                logError(error)
                if let snapshot { self?.layout = parseShopLayout(snapshot.data()) ?? defaultLayout }
            }
        }
    }
    func stop() {
        listener?.remove()
        listener = nil
    }
    // 席の配置を一度でも保存したか（最初のページを出すかを決める。No.087）。手元のキャッシュではなくサーバーで確かめ、分からなければ nil
    func isSaved() async -> Bool? {
        do { return try await document.getDocument(source: .server).exists } catch { return nil }
    }
    // 配置の移り変わり（No.113）：保存した時点の配置を layoutHistory に足す（配置と同じ書き込みにまとめる）
    private func addHistory(_ batch: WriteBatch, _ layout: ShopLayout) {
        var data = layoutHistoryDocument(layout, app: app)
        data["savedAt"] = FieldValue.serverTimestamp()
        batch.setData(data, forDocument: db.collection(base.path("layoutHistory")).document())
    }
    private func layoutData(_ layout: ShopLayout) -> [String: Any] {
        var data = shopLayoutDocument(layout)
        data["updatedAt"] = FieldValue.serverTimestamp()
        return data
    }
    // 最初のページ（No.087）：設定と配置を同じ書き込みで入れる（配置があれば始めた店とみなすので、設定だけ届かないことがないように）
    func startShop(_ layout: ShopLayout, settings: ShopSettings) async throws {
        let batch = db.batch()
        var settingsData = shopSettingsDocument(settings, fields: Set(ShopSettingsField.allCases).subtracting([.shopName]))
        settingsData["updatedAt"] = FieldValue.serverTimestamp()
        batch.setData(settingsData, forDocument: db.collection(base.path("shopSettings")).document("main"), merge: true)
        batch.setData(layoutData(layout), forDocument: document)
        addHistory(batch, layout)
        try await commitOrWait(batch)
    }
    // 保存する。お客さんがいる卓を消す配置は保存しない。rules：お客さんがいる卓を確かめるときの店の時間のルール（退店済みを残す時間）
    func save(_ layout: ShopLayout, rules: Rules = .standard) async throws {
        var occupied = Set<String>()
        do {
            // クエリと配置の書き込みは同じトランザクションにできないので、直前にサーバーで確かめる
            let tables = try await db.collection(base.path("tables")).getDocuments(source: .server)
            let refs: [String: String?] = Dictionary(uniqueKeysWithValues: tables.documents.map { table in
                let id = table.data()["sessionId"] as? String
                return (table.documentID, id?.isEmpty == false ? id : nil)
            })
            var sessions: [Session] = []
            for id in Set(refs.values.compactMap { $0 }) {
                let snapshot = try await db.collection(base.path("sessions")).document(id).getDocument(source: .server)
                if let session = sessionFromDocument(id: snapshot.documentID, data: snapshot.data()) { sessions.append(session) }
            }
            occupied = occupiedSeatIds(tables: refs, sessions: sessions, now: nowMs(), rules: rules)
        } catch {
            // オフラインなどで読めないときは、今までどおり書き込みを送信待ちにする
        }
        if let problem = removedOccupiedSeatsProblem(layout, occupied: occupied) { throw LayoutSaveError(message: problem) }
        let batch = db.batch()
        batch.setData(layoutData(layout), forDocument: document)
        addHistory(batch, layout)
        try await commitOrWait(batch)
    }
    // ルールに断られたら失敗を返す。少し待って返事が無ければ送信待ちとして成功にする（あとで届く）
    private func commitOrWait(_ batch: WriteBatch) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let once = Once()
            batch.commit { error in
                MainActor.assumeIsolated {
                    guard once.claim() else { logError(error); return }
                    if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + Self.saveWaitSeconds) {
                MainActor.assumeIsolated { if once.claim() { continuation.resume() } }
            }
        }
    }
}

// 待つか届くかの、先に来たほうだけを受け取る
@MainActor
final class Once {
    private var done = false
    func claim() -> Bool {
        defer { done = true }
        return !done
    }
}

// editing/{端末ID} に、その端末が詳細を開いているお客さんを持つ。端末ID はアプリを開くたびに作る（保存しない）
@MainActor @Observable
final class EditingRepository {
    // ほかの端末が開いているお客さんの印（自分の端末は含めない）
    private(set) var marks: [EditingMark] = []
    let deviceId: String
    @ObservationIgnored private let collection: CollectionReference
    @ObservationIgnored private var listener: ListenerRegistration?
    @ObservationIgnored private var heartbeat: Task<Void, Never>?
    @ObservationIgnored private var current: String?
    // 消しに行った古い印（同じ文書を何度も消しに行かない）
    @ObservationIgnored private var removing = Set<String>()

    init(base: ShopBase, deviceId: String = newDeviceId(), db: Firestore = Firestore.firestore()) {
        self.deviceId = deviceId
        collection = db.collection(base.path("editing"))
    }

    func start() {
        guard listener == nil else { return }
        listener = collection.addSnapshotListener { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                logError(error)
                guard let snapshot else { return }
                self.marks = snapshot.documents.compactMap { item in
                    guard item.documentID != self.deviceId else { return nil }
                    let data = item.data(with: .estimate)
                    guard let at = (data["updatedAt"] as? Timestamp).map({ Int(($0.dateValue().timeIntervalSince1970 * 1000).rounded()) }) else { return nil }
                    // 閉じずに落ちた端末の古い印は消す。消えると次の知らせから外れる
                    if nowMs() - at > editingStaleMs && self.removing.insert(item.documentID).inserted {
                        item.reference.delete { logError($0) }
                    }
                    return (data["sessionId"] as? String).map { EditingMark(sessionId: $0, at: at) }
                }
            }
        }
    }
    func stop() {
        listener?.remove()
        listener = nil
        setEditing(nil)
    }
    // この端末で詳細を開いた（nil で閉じた）。開いている間は editingHeartbeatMs ごとに書き直す
    func setEditing(_ sessionId: String?) {
        guard sessionId != current else { return }
        current = sessionId
        heartbeat?.cancel()
        heartbeat = nil
        let ref = collection.document(deviceId)
        guard let sessionId else {
            ref.delete { logError($0) }
            return
        }
        heartbeat = Task { @MainActor in
            while !Task.isCancelled {
                ref.setData(["sessionId": sessionId, "updatedAt": FieldValue.serverTimestamp()]) { logError($0) }
                try? await Task.sleep(for: .milliseconds(editingHeartbeatMs))
            }
        }
    }
}
