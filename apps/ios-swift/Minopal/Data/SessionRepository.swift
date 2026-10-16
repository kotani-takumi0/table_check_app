@preconcurrency import FirebaseFirestore
import MinopalCore
import Observation

// 店のお客さんを Firestore で読み書きする（packages/core/src/firestoreStore.ts の FirestoreSessionStore の Swift 版）。
// tables/{卓} がどのお客さんを指しているかと、12時間以内に案内した sessions を追い、resolveSessions で卓に出すお客さんを決める
@MainActor @Observable
final class SessionRepository {
    private(set) var sessions: [Session] = []
    private(set) var syncState: SyncState = .offline
    // 読めなかったときの知らせ（ルールで断られた、など）
    private(set) var lastError: String?
    let base: ShopBase

    @ObservationIgnored private let db: Firestore
    // 記録に写すもの（No.113）：店の設定（区分・コースの名前と時間のルール）と、書いた端末の種類・版
    @ObservationIgnored private let recordSource: (settings: () -> ShopSettings, app: AppInfo)?
    @ObservationIgnored private var tables: [String: String?] = [:]
    @ObservationIgnored private var rawSessions: [Session] = []
    @ObservationIgnored private var tablesMetadata: SnapshotMetadata?
    @ObservationIgnored private var sessionsMetadata: SnapshotMetadata?
    @ObservationIgnored private var listeners: [ListenerRegistration] = []

    init(base: ShopBase, recordSource: (settings: () -> ShopSettings, app: AppInfo)? = nil, db: Firestore = Firestore.firestore()) {
        self.base = base
        self.recordSource = recordSource
        self.db = db
    }

    func start() {
        guard listeners.isEmpty else { return }
        let cutoff = nowMs() - 12 * 60 * 60_000
        // Firestore はこの知らせをメインスレッドで呼ぶ
        listeners.append(db.collection(base.path("tables")).addSnapshotListener(includeMetadataChanges: true) { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                if let snapshot {
                    self.tables = Dictionary(uniqueKeysWithValues: snapshot.documents.map { ($0.documentID, $0.data()["sessionId"] as? String) })
                    self.tablesMetadata = snapshot.metadata
                } else {
                    self.tablesMetadata = nil
                    self.lastError = error?.localizedDescription
                }
                self.publish()
            }
        })
        let sessionsQuery = db.collection(base.path("sessions")).whereField("seatedAt", isGreaterThanOrEqualTo: cutoff)
        listeners.append(sessionsQuery.addSnapshotListener(includeMetadataChanges: true) { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                if let snapshot {
                    self.rawSessions = snapshot.documents.compactMap { sessionFromDocument(id: $0.documentID, data: $0.data()) }
                    self.sessionsMetadata = snapshot.metadata
                } else {
                    self.sessionsMetadata = nil
                    self.lastError = error?.localizedDescription
                }
                self.publish()
            }
        })
    }

    func stop() {
        listeners.forEach { $0.remove() }
        listeners = []
        tablesMetadata = nil
        sessionsMetadata = nil
    }

    // 両方そろってから卓に出す（片方だけだと、案内中の卓が一瞬空席に見える）
    private func publish() {
        let metadata = [tablesMetadata, sessionsMetadata]
        if metadata.allSatisfy({ $0 != nil }) {
            sessions = resolveSessions(tables: tables, sessions: rawSessions)
        }
        syncState = metadata.contains { $0 == nil || $0!.isFromCache } ? .offline
            : metadata.contains { $0!.hasPendingWrites } ? .pending : .synced
    }

    // お客さんと、そのお客さんがいる卓を一度に書く。お客さんの項目は merge で毎回すべて書く。
    // 記録（No.113）は名前が分からない項目を書かずに前の値を残すので、merge で書く
    func put(_ session: Session) {
        let batch = db.batch()
        var document = toSessionDocument(session)
        if let recordSource {
            document.merge(sessionRecord(session, settings: recordSource.settings(), app: recordSource.app).toDocument()) { $1 }
        }
        document["updatedAt"] = FieldValue.serverTimestamp()
        batch.setData(document, forDocument: db.collection(base.path("sessions")).document(session.id), merge: true)
        for tableId in session.tableIds {
            batch.setData(["sessionId": session.id, "updatedAt": FieldValue.serverTimestamp()],
                          forDocument: db.collection(base.path("tables")).document(tableId))
        }
        batch.commit { [weak self] error in
            guard let error else { return }
            MainActor.assumeIsolated { self?.lastError = error.localizedDescription }
        }
    }

    // 書き出し（No.34・No.113）：期間に案内したお客さんを、記録に写した名前と一緒に読む。電波が無ければキャッシュにある分だけになる
    func fetchSeatedBetween(start: Int, end: Int) async throws -> [RecordedSession] {
        let snapshot = try await db.collection(base.path("sessions"))
            .whereField("seatedAt", isGreaterThanOrEqualTo: start).whereField("seatedAt", isLessThan: end).getDocuments()
        return snapshot.documents.compactMap { item in
            sessionFromDocument(id: item.documentID, data: item.data()).map { RecordedSession($0, record: recordFromDocument(item.data())) }
        }
    }

    // 卓の参照は消さない（消えたお客さんを指す卓は resolveSessions で空席になる）
    func remove(id: String) {
        db.collection(base.path("sessions")).document(id).delete { [weak self] error in
            guard let error else { return }
            MainActor.assumeIsolated { self?.lastError = error.localizedDescription }
        }
    }
}
