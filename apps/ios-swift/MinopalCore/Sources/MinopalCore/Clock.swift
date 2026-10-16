import Foundation

// 時計（packages/core/src/clock.ts と serverClock.ts の計算の部分）。端末の時計がずれていても全端末で同じ経過時間になるよう、
// サーバーとの時差を足した時刻を使う。時差を Firestore で測る部分は、Firestore の読み書きを移すとき（No.148 の4つ目）に足す
private final class ServerOffset: @unchecked Sendable {
    private let lock = NSLock()
    private var ms = 0
    var value: Int {
        get { lock.withLock { ms } }
        set { lock.withLock { ms = newValue } }
    }
}
private let serverOffset = ServerOffset()

// 今の時刻（ミリ秒）。サーバーとの時差を足す
public func nowMs() -> Int { ms(Date()) + serverOffset.value }
public func setServerOffset(_ ms: Int) { serverOffset.value = ms }

// 書き込みを送った時刻・届いた時刻と、サーバーが付けた時刻から時差を見積もる（往復の真ん中でサーバーが時刻を付けたとする）。
// 丸めは TS の Math.round と同じく、ちょうど半分のときは大きいほうにする
public func estimateOffset(sentAt: Int, receivedAt: Int, serverAt: Int) -> Int {
    Int((Double(serverAt) - Double(sentAt + receivedAt) / 2 + 0.5).rounded(.down))
}

// 次の状態へのボタンの二度押し（No.122。tapGuard.ts）。急いで2回押すと2段進むので、押した直後は次を受け付けない
public let tapGuardMs = 500
// last は前に受け付けた時刻（まだ無ければ nil）。端末の時計が戻ったときは止めたままにしない
public func tooSoon(last: Int?, at: Int, ms: Int = tapGuardMs) -> Bool {
    guard let last else { return false }
    return at >= last && at - last < ms
}
