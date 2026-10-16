import Foundation

// 押し間違えを数秒のうちだけ戻せるようにする（No.102・No.121。packages/core/src/undo.ts）。
// 「案内を取り消す」「1つ戻す」「L.O.確認済みにする」「済にする」と、詳細の次の状態へのボタン（No.122）が対象。
// 戻すときは前の中身（ID・時刻）をそのまま書き戻す。数秒で消す部分（TS の useUndo）は画面の側で作る
public enum Undo: Equatable, Sendable {
    // after が nil は、お客さんの記録を消した（案内を取り消した）
    case session(message: String, before: Session, after: Session?)
    // before が nil は、一度も済にしていなかった
    case shopTimer(message: String, id: String, before: Int?, after: Int)

    public var message: String {
        switch self {
        case .session(let message, _, _), .shopTimer(let message, _, _, _): message
        }
    }
}
// 「元に戻す」を出しておく長さ
public let undoMs = 6000
// ok：戻せる / changed：ほかの端末などで中身が変わった / taken：取り消した卓に別のお客さんを案内した
public enum UndoCheck: Sendable {
    case ok, changed, taken

    // UNDO_REFUSED
    public var refusedMessage: String? {
        switch self {
        case .ok: nil
        case .changed: "ほかの端末で変わったので、元に戻せませんでした"
        case .taken: "その卓にはもう次のお客さんがいるので、元に戻せませんでした"
        }
    }
}

private func tables(_ session: Session) -> String { "\(session.tableIds.joined(separator: "・"))番" }
// 段階と時刻・卓が同じなら、そのあと誰も触っていないとみなす（全卓消去したあとは戻さない。No.113）
private func sameStep(_ a: Session, _ b: Session) -> Bool {
    a.status == b.status && a.seatedAt == b.seatedAt && a.otoshiAt == b.otoshiAt && a.loDoneAt == b.loDoneAt && a.exitedAt == b.exitedAt
        && a.tableIds == b.tableIds && a.clearedAt == b.clearedAt
}

// 「案内を取り消す」「1つ戻す」のあと（after は revert の結果。nil は記録を消した）
public func backUndo(before: Session, after: Session?, rules: Rules = .standard) -> Undo {
    let message = after.map { "\(tables(before))を「\(displayOf($0.status, course: $0.course, rules: rules).label)」に戻しました" }
        ?? "\(tables(before))の案内を取り消しました"
    return .session(message: message, before: before, after: after)
}
// 詳細の次の状態へのボタン・通知の「L.O.確認済みにする」のあと
public func nextUndo(before: Session, after: Session, rules: Rules = .standard) -> Undo {
    .session(message: "\(tables(before))を「\(displayOf(after.status, course: after.course, rules: rules).label)」にしました", before: before, after: after)
}
public func shopTimerUndo(id: String, label: String, before: Int?, after: Int) -> Undo {
    .shopTimer(message: "\(label)を済にしました", id: id, before: before, after: after)
}

// 今の中身を見て、戻してよいかを決める（sessions は卓に出ているお客さん）
public func checkUndo(_ undo: Undo, sessions: [Session], done: ShopTimerDone) -> UndoCheck {
    switch undo {
    case .shopTimer(_, let id, _, let after):
        return done[id] == after ? .ok : .changed
    case .session(_, let before, let after):
        let current = sessions.first { $0.id == before.id }
        guard let after else {
            if current != nil { return .changed }
            // 取り消した卓に、そのあと案内したお客さんがいれば戻さない（戻すと卓を取り返してしまう）。退店済みの表示だけなら置き換えてよい
            let taken = sessions.contains { $0.status != .exited && $0.clearedAt == nil && $0.tableIds.contains(where: before.tableIds.contains) }
            return taken ? .taken : .ok
        }
        return current.map { sameStep($0, after) } == true ? .ok : .changed
    }
}
