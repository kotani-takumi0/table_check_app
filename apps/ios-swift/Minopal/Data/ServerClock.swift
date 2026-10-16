@preconcurrency import FirebaseFirestore
import Foundation
import MinopalCore

// サーバーとの時差を測り、全端末で同じ経過時間になるようにする（packages/core/src/serverClock.ts の Swift 版）。
// clockProbes/{uid} にサーバーの時刻を書いて読み戻し、書き込みの往復の真ん中でサーバーが時刻を付けたとして時差を見積もる。
// 測った時差は端末に覚え、次に開いたときは測り終える前から使う
@MainActor
final class ServerClock {
    static let storageKey = "table-check:offset"
    static let intervalSeconds = 10 * 60.0
    private let db: Firestore
    private let defaults: UserDefaults
    private var task: Task<Void, Never>?

    init(db: Firestore = Firestore.firestore(), defaults: UserDefaults = .standard) {
        self.db = db
        self.defaults = defaults
    }

    func start(uid: String) {
        guard task == nil else { return }
        if let saved = defaults.string(forKey: Self.storageKey), let offset = Int(saved.trimmingCharacters(in: .whitespaces)) {
            setServerOffset(offset)
        }
        task = Task { [weak self] in
            while !Task.isCancelled {
                await self?.measure(uid: uid)
                try? await Task.sleep(for: .seconds(Self.intervalSeconds))
            }
        }
    }
    func stop() {
        task?.cancel()
        task = nil
    }

    // オフラインのときは前に測った時差のままにする
    func measure(uid: String) async {
        let ref = db.collection("clockProbes").document(uid)
        do {
            let sentAt = deviceNowMs()
            try await ref.setData(["at": FieldValue.serverTimestamp()])
            // 書き込みの往復だけで時差を測る（読み戻しの往復を含めると、その半分だけずれる）
            let receivedAt = deviceNowMs()
            guard !Task.isCancelled, let at = try await ref.getDocument(source: .server).data()?["at"] as? Timestamp else { return }
            let offset = estimateOffset(sentAt: sentAt, receivedAt: receivedAt, serverAt: Int((at.dateValue().timeIntervalSince1970 * 1000).rounded()))
            setServerOffset(offset)
            defaults.set(String(offset), forKey: Self.storageKey)
        } catch {
            logError(error)
        }
    }

    // 時差を足す前の端末の時刻
    private func deviceNowMs() -> Int { Int((Date().timeIntervalSince1970 * 1000).rounded()) }
}
