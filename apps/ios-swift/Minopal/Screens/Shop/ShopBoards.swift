import MinopalCore
import Observation
import SwiftUI

// 通知のバナー（No.159。Web の App.tsx の noticesOpen・shownNotice・flashSeat と同じ）：
// 新しい通知が来たら開いてその通知を出し、10 秒でヘッダーのベルにしまう。通知は「済にする」などを押すまで残り、ベルから開き直せる
@MainActor @Observable
final class NoticeBoard {
    static let tuckAfter = Duration.seconds(10)
    private(set) var open = false
    private(set) var shownKey: String?
    // 開き直すたびに変える数。下の線を最初から縮め直す
    private(set) var run = 0
    // 「卓を見る」・ベルで動かした卓を、少しのあいだ光らせる
    private(set) var flashSeat: String?
    private(set) var flashRun = 0
    @ObservationIgnored private var seen: Set<String> = []

    // 今の通知の key（並び順）。前に無かった key があれば、その通知を出して知らせる。通知が無くなったら閉じる
    func sync(_ notices: [Notice]) {
        let keys = notices.map(\.key)
        let fresh = notices.first { !seen.contains($0.key) }
        seen = Set(keys)
        if let fresh {
            show(fresh.key)
            Haptics.warning()
            AccessibilityNotification.Announcement(fresh.message).post()
        } else if keys.isEmpty {
            open = false
        }
    }

    func show(_ key: String?) {
        shownKey = key
        open = true
        restart()
    }
    // 通知のボタンを押した：残りの通知を、もう一度 10 秒出す
    func restart() {
        run += 1
        let current = run
        Task { [weak self] in
            try? await Task.sleep(for: Self.tuckAfter)
            if self?.run == current { self?.open = false }
        }
    }
    func tuck() { open = false }

    func reveal(_ seatId: String) {
        flashSeat = seatId
        flashRun += 1
        let current = flashRun
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(1.4))
            if self?.flashRun == current { self?.flashSeat = nil }
        }
    }
}

// 押し間違えを数秒のうちだけ戻せるようにする（No.102・No.121。Web の useUndo と UndoBar）。
// 戻せなかったとき（ほかの端末で変わった）は、ボタンを出さずに理由だけを同じ場所に出す
@MainActor @Observable
final class UndoBoard {
    private(set) var undo: Undo?
    private(set) var note: String?
    private(set) var run = 0

    var message: String? { undo?.message ?? note }

    func offer(_ undo: Undo) {
        self.undo = undo
        note = nil
        restart()
        AccessibilityNotification.Announcement(undo.message).post()
    }

    // 今の中身を見て、戻してよければ前の中身を書き戻す
    func apply(_ services: ShopServices) {
        guard let undo else { return }
        self.undo = nil
        if let refused = checkUndo(undo, sessions: services.sessions.sessions, done: services.timers.done).refusedMessage {
            note = refused
            restart()
            AccessibilityNotification.Announcement(refused).post()
            return
        }
        switch undo {
        case .session(_, let before, _): services.sessions.put(before)
        case .shopTimer(_, let id, let before, let after): services.timers.undoDone(id, after: after, before: before)
        }
    }

    private func restart() {
        run += 1
        let current = run
        Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(undoMs))
            guard let self, self.run == current else { return }
            self.undo = nil
            self.note = nil
        }
    }
}
