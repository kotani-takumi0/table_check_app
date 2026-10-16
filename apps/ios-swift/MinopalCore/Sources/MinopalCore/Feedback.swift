import Foundation

// ご意見を送る（No.125。packages/core/src/feedback.ts のうち、送る前後の計算）。
// 送り先は Firestore のいちばん上の feedback。送る部分（FeedbackStore）は、Firestore の読み書きを移すとき（No.148 の4つ目）に足す

// 1件の長さ（firestore.rules の canSendFeedback と同じ）
public let feedbackMax = 1000
// 連続送信の間隔（firestore.rules の duration.value(30, 's') と同じ）。ルールは「30秒よりあと」なので、画面では1秒多く待つ
public let feedbackIntervalMs = 30_000
private let feedbackIntervalSlackMs = 1_000
public let feedbackTicketPattern = "^[a-z0-9]{16}$"
public let feedbackSentAtKey = "minopal:feedbackSentAt"
public let feedbackWaitMessage = "少し待ってから、もう一度送ってください。"
public let feedbackUnconfirmedMessage = "届いたか確かめています。送り直さなくて大丈夫です。"
public let feedbackSentMessage = "送りました。ありがとうございます。"
public let feedbackErrorMessage = "送れませんでした。時間をおいてもう一度お試しください。"

private let ticketAlphabet = Array("abcdefghijklmnopqrstuvwxyz0123456789")
// 送信ごとに変える印。文書 id に使い、1回の書き込みで1件だけに束ねる。random は 0 以上 1 未満（テストで決められる）
public func feedbackTicket(random: () -> Double = { Double.random(in: 0..<1) }) -> String {
    String((0..<16).map { _ in ticketAlphabet[min(ticketAlphabet.count - 1, Int(random() * Double(ticketAlphabet.count)))] })
}
public func feedbackDocId(uid: String, ticket: String) -> String { "\(uid)_\(ticket)" }
// 次に送れるまで残っている時間（ミリ秒）。0 なら送ってよい
public func feedbackCooldownMs(lastSentAt: Int?, now: Int) -> Int {
    guard let lastSentAt else { return 0 }
    return max(0, feedbackIntervalMs + feedbackIntervalSlackMs - (now - lastSentAt))
}
// sent：サーバーが受け取った。queued：8秒待っても、受け取ったかまだ分からない
public enum FeedbackDelivery: Sendable { case sent, queued }
// 受け取ったと確かめてから、下書きを消し、次に送れるまでの待ち時間を始める
public func feedbackAccepted(_ delivery: FeedbackDelivery) -> Bool { delivery == .sent }

// 前の店の分が届いても、いまの店には「送りました」を出さない。待ちは始める（30秒の制限はサーバーがユーザーごとにかけるため）
public func feedbackArrival(sentShop: String, currentShop: String) -> (showSent: Bool, startWait: Bool) {
    (sentShop == currentShop, true)
}
public func feedbackWaitNote(_ remainSec: Int) -> String {
    "続けて送るには少し待ってください（あと\(remainSec)秒）"
}
// 送信が断られたとき。画面を離れていても待ちは記録する。送った時刻を先に覚え、文はそのあと
public func feedbackOnReject(mounted: Bool) -> (remember: Bool, showMessage: Bool) {
    (true, mounted)
}
// 店が替わったとき。下書きを消し、届いたか確かめている最中でも押せない状態を解く
public func feedbackShopSwitch(keptShop: String, keptDraft: String, shopId: String) -> (shop: String, draft: String, checking: Bool) {
    keptShop == shopId ? (keptShop, keptDraft, false) : (shopId, "", false)
}
// 送る文。前後の空白を落とし、空・長すぎるときは nil
public func feedbackText(_ draft: String) -> String? {
    let text = jsTrim(draft)
    return text.isEmpty || jsLength(text) > feedbackMax ? nil : text
}
