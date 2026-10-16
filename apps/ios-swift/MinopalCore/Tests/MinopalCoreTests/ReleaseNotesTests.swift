import Foundation
import Testing
@testable import MinopalCore

// packages/core/src/releaseNotes.test.ts・roadmap.test.ts・feedback.test.ts と同じ中身。
// アプリの更新（appUpdate.ts）は Web の version.json を読み直す仕組みなので移していない。NoFeedbackStore のテストは No.148 の4つ目で移す

// リポジトリ直下の package.json の版（TS のテストと同じく、今の版のお知らせがあるかを確かめる）
private func repositoryVersion() throws -> String {
    let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../../../../package.json").standardized
    let json = try JSONSerialization.jsonObject(with: Data(contentsOf: root)) as? [String: Any]
    return try #require(json?["version"] as? String)
}
private func parts(_ version: String) -> [Int] { version.split(separator: ".").compactMap { Int($0) } }

@Suite("RELEASE_NOTES")
struct ReleaseNoteListTests {
    @Test("今の版（package.json）のお知らせがある。版を上げたら書き足す")
    func current() throws {
        #expect(releaseNoteOf(try repositoryVersion()) != nil)
    }

    @Test("新しい版から順に並び、同じ版が2つ無い")
    func order() {
        for (newer, older) in zip(releaseNotes, releaseNotes.dropFirst()) {
            #expect(parts(newer.version).lexicographicallyPrecedes(parts(older.version)) == false && parts(newer.version) != parts(older.version), "\(newer.version) と \(older.version)")
        }
    }

    @Test("どの版も日付と1つ以上の項目がある")
    func contents() {
        #expect(!releaseNotes.isEmpty)
        for note in releaseNotes {
            #expect(note.date.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", options: .regularExpression) != nil)
            #expect(!note.items.isEmpty)
            for item in note.items { #expect(!isBlank(item)) }
        }
    }
}

@Suite("releaseNoteOf・shouldAnnounce・releaseDateLabel")
struct ReleaseNoteLookupTests {
    // TS のテストは実際の一覧の 2.3.3 を使う。同じ版がここにもあることを確かめてから使う
    @Test("v付きでも引ける")
    func lookup() {
        #expect(releaseNoteOf("v2.3.3")?.version == "2.3.3")
        #expect(releaseNoteOf("2.3.3")?.version == "2.3.3")
        #expect(releaseNoteOf("v9.9.9") == nil)
    }

    @Test("まだ見ていない版なら出す（この機能の前から使っている端末も1回出す）")
    func unseen() {
        #expect(shouldAnnounce(seen: nil, current: "v2.3.3"))
        #expect(shouldAnnounce(seen: "2.3.2", current: "v2.3.3"))
    }

    @Test("見た版なら出さない。お知らせの無い版では出さない")
    func seen() {
        #expect(!shouldAnnounce(seen: "2.3.3", current: "v2.3.3"))
        #expect(!shouldAnnounce(seen: nil, current: "v9.9.9"))
    }

    @Test("年月日にする")
    func dateLabel() {
        #expect(releaseDateLabel("2026-10-07") == "2026年10月7日")
        #expect(releaseDateLabel("きょう") == "きょう")
    }
}

@Suite("ROADMAP")
struct RoadmapTests {
    @Test("足した予定は段階・長さの決まりを守り、日付や店や人の名前を持たない")
    func rules() {
        let stages = roadmap.map(\.stage)
        if let preparing = stages.lastIndex(of: .preparing), let considering = stages.firstIndex(of: .considering) {
            #expect(considering > preparing)
        }
        for item in roadmap {
            #expect(item.id.range(of: "^[a-z0-9]+(-[a-z0-9]+)*$", options: .regularExpression) != nil)
            #expect(item.title.hasSuffix("なります"))
            #expect(!item.title.isEmpty && jsLength(item.title) <= roadmapTitleMax)
            #expect(!item.detail.isEmpty && jsLength(item.detail) <= roadmapDetailMax)
            #expect("\(item.title)\(item.detail)".range(of: "[0-9]{4}年|[0-9]+月[0-9]+日|セキュリティ|脆弱", options: .regularExpression) == nil)
        }
        #expect(Set(roadmap.map(\.id)).count == roadmap.count)
        let groups = roadmapGroups()
        #expect(groups.allSatisfy { !$0.items.isEmpty })
        #expect(groups.reduce(0) { $0 + $1.items.count } == roadmap.count)
    }

    @Test("予定が空なら点を出さない")
    func emptyItems() {
        #expect(roadmapGroups([]) == [])
        #expect(roadmapSeenValue([]) == "")
        #expect(!roadmapHasUnseen([], seen: nil))
        #expect(!roadmapHasUnseen([], seen: ""))
        #expect(roadmapEmpty == "いまお知らせできる予定はありません。使っていて気になることがあれば、ご意見を送ってください。")
    }

    @Test("まだ見ていない端末は点を出す。いまの予定を見たら出さない。新しい予定が足されたら出す")
    func unseen() {
        let ids = ["overtime-seats", "phone-seat-text"]
        #expect(roadmapHasUnseen(ids, seen: nil))
        #expect(roadmapHasUnseen(ids, seen: ""))
        #expect(!roadmapHasUnseen(ids, seen: ids.joined(separator: ",")))
        #expect(roadmapHasUnseen(ids, seen: "phone-seat-text"))
        #expect(!roadmapHasUnseen(ids, seen: "\(ids.joined(separator: ",")),old-plan"))
    }

    @Test("段階の名前")
    func stageLabels() {
        #expect(RoadmapStage.allCases.map(\.label) == ["準備中", "検討中"])
    }
}

@Suite("feedbackText")
struct FeedbackTextTests {
    @Test("前後の空白を落とす")
    func trims() {
        #expect(feedbackText("  ボタンが小さい\n") == "ボタンが小さい")
    }

    @Test("空・空白だけは送らない")
    func empty() {
        #expect(feedbackText("") == nil)
        #expect(feedbackText(" \n\t ") == nil)
    }

    @Test("長さはルールと同じ上限まで")
    func limit() {
        #expect(feedbackText(String(repeating: "あ", count: feedbackMax))?.count == feedbackMax)
        #expect(feedbackText(String(repeating: "あ", count: feedbackMax + 1)) == nil)
    }
}

@Suite("feedback の間隔")
struct FeedbackIntervalTests {
    @Test("印はルールと同じ16文字で、文書 id は uid と印をつなぐ")
    func ticket() {
        let ticket = feedbackTicket(random: { 0 })
        #expect(ticket == String(repeating: "a", count: 16))
        #expect(ticket.range(of: feedbackTicketPattern, options: .regularExpression) != nil)
        #expect(feedbackTicket().range(of: feedbackTicketPattern, options: .regularExpression) != nil)
        #expect(feedbackDocId(uid: "shopUid", ticket: ticket) == "shopUid_\(ticket)")
    }

    @Test("送った直後は待てて、間隔のあとは送れる")
    func cooldown() {
        #expect(feedbackCooldownMs(lastSentAt: nil, now: 1_000) == 0)
        #expect(feedbackCooldownMs(lastSentAt: 1_000, now: 1_000) == feedbackIntervalMs + 1_000)
        #expect(feedbackCooldownMs(lastSentAt: 1_000, now: 1_000 + feedbackIntervalMs + 1_000) == 0)
    }

    @Test("間隔は30秒（firestore.rules の duration.value(30, 's') と同じ）")
    func interval() {
        #expect(feedbackIntervalMs == 30_000)
        #expect(feedbackMax == 1000)
    }

    @Test("受け取ったと確かめるまで、下書きは消さない")
    func accepted() {
        #expect(feedbackAccepted(.sent))
        #expect(!feedbackAccepted(.queued))
        #expect(feedbackUnconfirmedMessage == "届いたか確かめています。送り直さなくて大丈夫です。")
    }

    @Test("確かめている途中で店が替わったら、下書きは消え押せない状態は解ける")
    func shopSwitch() {
        #expect(feedbackShopSwitch(keptShop: "shop-a", keptDraft: "トイレが押しにくい", shopId: "shop-b") == ("shop-b", "", false))
        #expect(feedbackShopSwitch(keptShop: "shop-a", keptDraft: "トイレが押しにくい", shopId: "shop-a") == ("shop-a", "トイレが押しにくい", false))
    }

    @Test("前の店の分が届いても、いまの店には送りましたを出さず待ちだけ始める")
    func arrival() {
        #expect(feedbackArrival(sentShop: "shop-a", currentShop: "shop-b") == (false, true))
        #expect(feedbackArrival(sentShop: "shop-a", currentShop: "shop-a") == (true, true))
        #expect(feedbackWaitNote(12) == "続けて送るには少し待ってください（あと12秒）")
    }

    @Test("画面を離れたあとに断られても、待ちを先に記録する")
    func reject() {
        #expect(feedbackOnReject(mounted: false) == (true, false))
        #expect(feedbackOnReject(mounted: true) == (true, true))
    }
}
