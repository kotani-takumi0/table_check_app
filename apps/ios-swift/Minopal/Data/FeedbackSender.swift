@preconcurrency import FirebaseAuth
@preconcurrency import FirebaseFirestore
import MinopalCore

// ご意見を送る（No.125・No.144。packages/core/src/firestoreFeedback.ts の Swift 版）。
// feedback/{uid}_{印} に1件ずつ書き、同じ書き込みで feedbackPace/{uid} を進める。間隔が空くまで次はルールで断られる
struct FeedbackInput: Sendable {
    var message: String
    var version: String       // 送った端末のアプリの版（v3.0.0）
    var platform: Platform
    var shopName: String      // 設定の店名（空のこともある）
}
// ルールで断られたとき（間隔が短い）。画面はこの文を出す
struct FeedbackRejected: LocalizedError {
    var errorDescription: String? { feedbackWaitMessage }
}

@MainActor
final class FeedbackSender {
    // ここまで待って受け取れなければ、届いたか未確認（queued）として返す。書き込みはそのあとでも続き、受け取ったら onConfirmed を呼ぶ
    static let sendWaitSeconds = 8.0
    private let db: Firestore
    private let base: ShopBase

    init(base: ShopBase, db: Firestore = Firestore.firestore()) {
        self.db = db
        self.base = base
    }

    // onConfirmed：受け取ったと分かったとき（nil）か、断られたとき（エラー）に1回呼ぶ。queued のときだけ呼ぶ
    func send(_ input: FeedbackInput, onConfirmed: @escaping @MainActor (Error?) -> Void = { _ in }) async throws -> FeedbackDelivery {
        guard let uid = Auth.auth().currentUser?.uid else { throw FeedbackRejected() }
        let ticket = feedbackTicket()
        let batch = db.batch()
        batch.setData(["lastAt": FieldValue.serverTimestamp(), "ticket": ticket], forDocument: db.collection("feedbackPace").document(uid))
        // ログインした店はその店のアカウントの uid を shop に入れる（ほかの店の名で送れないようにルールが確かめる）
        let shop: Any = base.components.count >= 2 ? base.components[1] : NSNull()
        batch.setData(["message": input.message, "version": input.version, "platform": input.platform.rawValue, "shopName": input.shopName,
                       "shop": shop, "createdAt": FieldValue.serverTimestamp()],
                      forDocument: db.collection("feedback").document(feedbackDocId(uid: uid, ticket: ticket)))
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<FeedbackDelivery, Error>) in
            let once = Once()
            batch.commit { error in
                MainActor.assumeIsolated {
                    let result: Error? = error.map { Self.isPermissionDenied($0) ? FeedbackRejected() : $0 }
                    if once.claim() {
                        if let result { continuation.resume(throwing: result) } else { continuation.resume(returning: .sent) }
                    } else {
                        onConfirmed(result)
                    }
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + Self.sendWaitSeconds) {
                MainActor.assumeIsolated { if once.claim() { continuation.resume(returning: .queued) } }
            }
        }
    }

    private static func isPermissionDenied(_ error: Error) -> Bool {
        let nsError = error as NSError
        return nsError.domain == FirestoreErrorDomain && nsError.code == FirestoreErrorCode.permissionDenied.rawValue
    }
}
