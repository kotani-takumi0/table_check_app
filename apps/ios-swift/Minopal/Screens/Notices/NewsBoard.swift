import MinopalCore
import Observation
import SwiftUI

// お知らせのタブ（No.144。Web・今の iOS 版の Notices と同じ 3 つ）
enum NewsTab: String, CaseIterable, Hashable {
    case roadmap, updates, feedback

    var title: String {
        switch self {
        case .roadmap: "今後の予定"
        case .updates: "最近の更新"
        case .feedback: "ご意見を送る"
        }
    }
}

// お知らせの見た印（Web の useReleaseAnnounce と roadmapNew。No.127・No.144）：
// 新しい版になったら配置図の下に1回だけ帯を出し、新しい予定が足されたらメニュー（iPad はサイドバー、iPhone はタブ）に印を出す。見たかどうかは端末ごとに覚える
@MainActor @Observable
final class NewsBoard {
    var tab = NewsTab.roadmap
    private(set) var announce: Bool
    private(set) var roadmapNew: Bool
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        announce = shouldAnnounce(seen: defaults.string(forKey: seenReleaseKey), current: AppVersion.label)
        roadmapNew = shouldShowRoadmapDot(seen: defaults.string(forKey: seenRoadmapKey))
    }

    // お知らせを開いて今のタブを見た
    func saw(_ tab: NewsTab) {
        switch tab {
        case .roadmap: markRoadmapSeen()
        case .updates: markReleaseSeen()
        case .feedback: break
        }
    }
    // 帯の「内容を見る」：最近の更新を開く（開いたので見たことにもなる）
    func openUpdates() { tab = .updates }

    func markReleaseSeen() {
        announce = false
        if let note = releaseNoteOf(AppVersion.label) { defaults.set(note.version, forKey: seenReleaseKey) }
    }
    private func markRoadmapSeen() {
        roadmapNew = false
        defaults.set(roadmapSeenValue(), forKey: seenRoadmapKey)
    }
}

// ご意見を送る（No.125。今の iOS 版の FeedbackForm と同じ）。画面を離れても下書きと送った時刻は残す（店が替わったら下書きは消す）。
// 連続では送れない（30 秒。ルールでも断る）。送った時刻は端末に覚え、アプリを開き直しても待ちを続ける
@MainActor @Observable
final class FeedbackDraft {
    static let shared = FeedbackDraft()

    enum Tone { case ok, pending, error }
    struct Result: Equatable {
        var tone: Tone
        var message: String
    }

    var draft = ""
    private(set) var busy = false
    private(set) var checking = false
    private(set) var result: Result?
    private(set) var sentAt: Int?
    // 画面に出ているか（Web の alive）。出ていないときに届いた・断られたときは、文とハプティクスを出さない
    @ObservationIgnored var visible = false
    @ObservationIgnored private var shop = ""
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        sentAt = defaults.object(forKey: feedbackSentAtKey) as? Int
    }

    // 画面を開いた・店が替わった：替わったら下書きを消し、確かめている途中でも押せるようにする
    func enter(shopId: String) {
        result = nil
        guard shopId != shop else { return }
        let next = feedbackShopSwitch(keptShop: shop, keptDraft: draft, shopId: shopId)
        shop = next.shop
        draft = next.draft
        checking = next.checking
    }
    func edit(_ text: String) {
        draft = text
        result = nil
    }
    // 次に送れるまで（ミリ秒）。待ちは端末の時計で数える（サーバーとの時差は入れない。Web と同じ）
    func cooldownMs(now: Int = localMs()) -> Int { feedbackCooldownMs(lastSentAt: sentAt, now: now) }
    var canSend: Bool { !busy && !checking && feedbackText(draft) != nil && cooldownMs() == 0 }

    func send(_ sender: FeedbackSender, shopName: String) {
        guard let text = feedbackText(draft) else { return }
        if cooldownMs() > 0 {
            result = Result(tone: .error, message: feedbackWaitMessage)
            return
        }
        let sentShop = shop
        Haptics.light()
        busy = true
        result = nil
        Task {
            defer { busy = false }
            do {
                let input = FeedbackInput(message: text, version: AppVersion.label, platform: .ios, shopName: shopName)
                // 届いたかの確認は画面を離れたあとにも来る（この下書きはアプリの間ずっと1つ）
                let delivery = try await sender.send(input) { error in
                    self.checking = false
                    if let error { self.fail(error) } else { self.accept(text, sentShop: sentShop) }
                }
                if feedbackAccepted(delivery) {
                    accept(text, sentShop: sentShop)
                } else {
                    if visible { Haptics.warning() }
                    checking = true
                    result = Result(tone: .pending, message: feedbackUnconfirmedMessage)
                }
            } catch {
                fail(error)
            }
        }
    }

    // 前の店の分が届いても「送りました」は出さない。待ちは始める（30 秒の制限はサーバーがユーザーごとにかけるため）
    private func accept(_ text: String, sentShop: String) {
        let arrival = feedbackArrival(sentShop: sentShop, currentShop: shop)
        if arrival.showSent && feedbackText(draft) == text { draft = "" }
        if arrival.startWait { rememberSent() }
        guard visible && arrival.showSent else { return }
        Haptics.success()
        result = Result(tone: .ok, message: feedbackSentMessage)
        AccessibilityNotification.Announcement(feedbackSentMessage).post()
    }
    private func fail(_ error: Error) {
        if error is FeedbackRejected {
            // 画面を離れたあとに断られても待ちは残す。送った時刻を先に覚える
            let plan = feedbackOnReject(mounted: visible)
            if plan.remember { rememberSent() }
            guard plan.showMessage else { return }
            show(Result(tone: .error, message: feedbackWaitMessage))
            return
        }
        guard visible else { return }
        show(Result(tone: .error, message: feedbackErrorMessage))
    }
    private func show(_ next: Result) {
        Haptics.warning()
        result = next
        AccessibilityNotification.Announcement(next.message).post()
    }
    private func rememberSent() {
        let at = localMs()
        sentAt = at
        defaults.set(at, forKey: feedbackSentAtKey)
    }
}

// 端末の時計（ミリ秒）
func localMs() -> Int { Int(Date().timeIntervalSince1970 * 1000) }
