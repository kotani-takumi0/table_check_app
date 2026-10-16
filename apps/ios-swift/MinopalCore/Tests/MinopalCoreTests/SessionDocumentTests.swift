import Foundation
import Testing
@testable import MinopalCore

// packages/core/src/firestoreMapping.test.ts と同じ中身（テスト名も TS に合わせる）
private let seated = newSession(id: "session", tableId: "31", at: 10_000)
// [String: Any] は Sendable でないので、使うたびに作る
private var data: [String: Any] {
    ["tableIds": ["31"], "status": "seated", "seatedAt": 10_000,
     "otoshiAt": NSNull(), "loDoneAt": NSNull(), "exitedAt": NSNull(), "paidAt": NSNull()]
}
private func with(_ changes: [String: Any?]) -> [String: Any] {
    var result = data
    for (key, value) in changes { result[key] = value }
    return result
}

@Suite("Firestore document mapping")
struct FirestoreDocumentMappingTests {
    @Test("正しい形を Session に変換し、監査用フィールドを除く")
    func readsValidDocument() {
        #expect(sessionFromDocument(id: "session", data: with(["updatedAt": 123])) == seated)
    }

    @Test("不正な形を拒否する")
    func rejectsInvalid() {
        let cases: [[String: Any?]] = [
            ["status": "invalid"], ["seatedAt": nil], ["tableIds": [String]()], ["tableIds": [31]],
            ["seatedAt": Double.infinity], ["otoshiAt": Double.nan], ["loDoneAt": nil], ["status": "otoshi"],
            ["status": "lo_done", "otoshiAt": 20_000], ["status": "exited", "otoshiAt": 20_000, "loDoneAt": 30_000],
        ]
        for changes in cases {
            #expect(sessionFromDocument(id: "session", data: with(changes)) == nil, "\(changes)")
        }
    }

    @Test("文書が無ければ拒否する")
    func rejectsMissing() {
        #expect(sessionFromDocument(id: "session", data: nil) == nil)
        #expect(sessionFromDocument(id: "session", data: [:]) == nil)
    }

    @Test("全卓消去・卓の動き（No.113）を書いて読み戻す。無い古い文書は消していない・動かしていないとして読む")
    func clearedAndTableLog() {
        var recorded = seated
        recorded.clearedAt = 90_000
        recorded.tableLog = [TableMove(at: 50_000, kind: .move, from: "31", to: "32")]
        #expect(sessionFromDocument(id: "session", data: toSessionDocument(recorded)) == recorded)
        let old = sessionFromDocument(id: "session", data: data)
        #expect(old?.clearedAt == nil && old?.tableLog == [])
        #expect(sessionFromDocument(id: "session", data: with(["clearedAt": "x"])) == nil)
    }

    @Test("卓の動きの壊れた項目は落として読む")
    func dropsBrokenTableLog() {
        let tableLog: [Any] = [
            ["at": 1, "kind": "move", "from": "1", "to": "2"], ["at": "x", "kind": "move"],
            ["at": 2, "kind": "jump", "from": NSNull(), "to": NSNull()], NSNull(),
        ]
        #expect(sessionFromDocument(id: "session", data: with(["tableLog": tableLog]))?.tableLog == [TableMove(at: 1, kind: .move, from: "1", to: "2")])
    }

    @Test("paidAt が無い古い文書は未払いとして読み、不正な paidAt は拒否する")
    func paidAt() {
        #expect(sessionFromDocument(id: "session", data: with(["paidAt": nil]))?.paidAt == nil)
        #expect(sessionFromDocument(id: "session", data: with(["paidAt": nil])) != nil)
        #expect(sessionFromDocument(id: "session", data: with(["paidAt": 50_000]))?.paidAt == 50_000)
        #expect(sessionFromDocument(id: "session", data: with(["paidAt": "x"])) == nil)
    }

    @Test("guests が無い古い文書は人数未入力として読み、不正な guests は拒否する")
    func guests() {
        #expect(sessionFromDocument(id: "session", data: data)?.guests == nil)
        #expect(sessionFromDocument(id: "session", data: with(["guests": 6]))?.guests == 6)
        for bad: Any in [0, 100, 2.5, "6", true] {
            #expect(sessionFromDocument(id: "session", data: with(["guests": bad])) == nil)
        }
    }

    @Test("人数が未入力でも guests: null を書く（古いアプリの上書きを見分けるため）")
    func writesNullGuests() {
        #expect(toSessionDocument(seated)["guests"] is NSNull)
        var three = seated
        three.guests = 3
        #expect(toSessionDocument(three)["guests"] as? Int == 3)
    }

    @Test("course が無い古い文書は通常として読み、不正な course は拒否する")
    func course() {
        #expect(sessionFromDocument(id: "session", data: data)?.course == nil)
        #expect(sessionFromDocument(id: "session", data: with(["course": "premium_drinks"]))?.course == "premium_drinks")
        #expect(sessionFromDocument(id: "session", data: with(["course": "plan_abc"]))?.course == "plan_abc")
        for bad: Any in ["", "Course!", 1, true] {
            #expect(sessionFromDocument(id: "session", data: with(["course": bad])) == nil)
        }
    }

    @Test("店が足した区分（No.90）は course を前の版も読める drinks にし、本当の区分は drinkPlan に入れる")
    func customDrinkPlan() {
        var custom = seated
        custom.course = "plan_abc"
        let doc = toSessionDocument(custom)
        #expect(doc["course"] as? String == "drinks" && doc["drinkPlan"] as? String == "plan_abc")
        #expect(sessionFromDocument(id: "session", data: doc)?.course == "plan_abc")
        var premium = seated
        premium.course = "premium_drinks"
        let premiumDoc = toSessionDocument(premium)
        #expect(premiumDoc["course"] as? String == "premium_drinks" && premiumDoc["drinkPlan"] as? String == "premium_drinks")
        // 前の版のアプリは drinkPlan を書かない。通常に戻したら drinkPlan が残っていても通常
        #expect(sessionFromDocument(id: "session", data: with(["course": "drinks"]))?.course == "drinks")
        var reverted = doc
        reverted["course"] = NSNull()
        let revertedSession = sessionFromDocument(id: "session", data: reverted)
        #expect(revertedSession != nil && revertedSession?.course == nil)
        var broken = doc
        broken["drinkPlan"] = "Bad!"
        #expect(sessionFromDocument(id: "session", data: broken) == nil)
    }

    @Test("通常でも course: null を書く（古いアプリの上書きを見分けるため）")
    func writesNullCourse() {
        #expect(toSessionDocument(seated)["course"] is NSNull)
        var drinks = seated
        drinks.course = "drinks"
        #expect(toSessionDocument(drinks)["course"] as? String == "drinks")
    }

    @Test("menu・dishesServed が無い古い文書はコース未選択・まだ出していないとして読み、不正な値は拒否する")
    func menu() {
        let course = with(["course": "drinks"])
        let plain = sessionFromDocument(id: "session", data: course)
        #expect(plain?.menu == nil && plain?.dishesServed == 0)
        var cheese = course
        cheese["menu"] = "cheese"
        cheese["dishesServed"] = 3
        let chosen = sessionFromDocument(id: "session", data: cheese)
        #expect(chosen?.menu == "cheese" && chosen?.dishesServed == 3)
        let bads: [[String: Any]] = [["menu": "X!"], ["courseMenu": "X!"], ["menu": 1], ["dishesServed": -1], ["dishesServed": 1.5], ["dishesServed": "1"]]
        for bad in bads {
            #expect(sessionFromDocument(id: "session", data: course.merging(bad) { $1 }) == nil)
        }
    }

    @Test("通常の卓のメニューは読まない")
    func plainIgnoresMenu() {
        let session = sessionFromDocument(id: "session", data: with(["menu": "cheese", "dishesServed": 3]))
        #expect(session?.menu == nil && session?.dishesServed == 0)
    }

    @Test("店が作ったコース（No.89）は menu を前の版も読める null にし、本当のコースは courseMenu に入れる")
    func customMenu() {
        var custom = seated
        custom.course = "drinks"
        custom.menu = "menu_abc"
        custom.dishesServed = 2
        let doc = toSessionDocument(custom)
        #expect(doc["menu"] is NSNull && doc["courseMenu"] as? String == "menu_abc" && doc["dishesServed"] as? Int == 2)
        let read = sessionFromDocument(id: "session", data: doc)
        #expect(read?.menu == "menu_abc" && read?.dishesServed == 2)
        custom.menu = "cheese"
        let cheese = toSessionDocument(custom)
        #expect(cheese["menu"] as? String == "cheese" && cheese["courseMenu"] as? String == "cheese")
        // 前の版のアプリは courseMenu を書かない
        #expect(sessionFromDocument(id: "session", data: with(["course": "drinks", "menu": "cheese", "dishesServed": 1]))?.menu == "cheese")
    }

    @Test("未選択でも menu: null と dishesServed を書く（古いアプリの上書きを見分けるため）")
    func writesNullMenu() {
        let doc = toSessionDocument(seated)
        #expect(doc["menu"] is NSNull && doc["dishesServed"] as? Int == 0)
    }

    @Test("料理を出した時刻（No.131）を書いて読む。無い古い文書は空、品数より後の時刻は落とし、壊れた値は nil")
    func dishServedAt() {
        var served = seated
        served.course = "drinks"
        served.menu = "cheese"
        served.dishesServed = 2
        served.dishServedAt = [30_000, 40_000]
        #expect(toSessionDocument(served)["dishServedAt"] as? [Int] == [30_000, 40_000])
        #expect((toSessionDocument(seated)["dishServedAt"] as? [Any])?.isEmpty == true)
        let course = with(["course": "drinks", "menu": "cheese", "dishesServed": 2])
        #expect(sessionFromDocument(id: "session", data: course)?.dishServedAt == [])
        #expect(sessionFromDocument(id: "session", data: course.merging(["dishServedAt": [30_000, 40_000, 50_000]]) { $1 })?.dishServedAt == [30_000, 40_000])
        #expect(sessionFromDocument(id: "session", data: course.merging(["dishServedAt": ["x", 40_000] as [Any]]) { $1 })?.dishServedAt == [nil, 40_000])
        #expect(sessionFromDocument(id: "session", data: with(["dishServedAt": [30_000]]))?.dishServedAt == [])
    }

    @Test("複数卓を許可する")
    func multipleTables() {
        #expect(sessionFromDocument(id: "session", data: with(["tableIds": ["31", "33"]]))?.tableIds == ["31", "33"])
    }

    @Test("全状態で往復でき、id と updatedAt を文書に含めない")
    func roundTrip() {
        // TS は advance で状態を進める。advance は卓の計算を移すとき（No.148）に足すので、ここでは時刻を直接入れる
        var otoshi = seated
        otoshi.status = .otoshi
        otoshi.otoshiAt = 20_000
        var loDone = otoshi
        loDone.status = .loDone
        loDone.loDoneAt = 30_000
        var exited = loDone
        exited.status = .exited
        exited.exitedAt = 40_000
        for session in [seated, otoshi, loDone, exited] {
            let document = toSessionDocument(session)
            #expect(document["id"] == nil && document["updatedAt"] == nil)
            #expect(sessionFromDocument(id: session.id, data: document) == session)
        }
    }

    @Test("閉店で退店にした卓（No.129）は、お通し・L.O.確認の時刻が空でも読む")
    func exitedByClosing() {
        let closed = with(["status": "exited", "exitedAt": 40_000, "exitedByClosing": true])
        #expect(sessionFromDocument(id: "session", data: closed)?.exitedByClosing == true)
        // 真偽でない値（1）は閉店の印として読まない
        #expect(sessionFromDocument(id: "session", data: closed.merging(["exitedByClosing": 1]) { $1 }) == nil)
    }
}

@Suite("卓参照による表示")
struct ResolveSessionsTests {
    let other = newSession(id: "other", tableId: "33", at: 20_000)

    @Test("指されていないセッションは返さない")
    func ignoresUnreferenced() {
        #expect(resolveSessions(tables: ["31": seated.id, "33": nil], sessions: [seated, other]) == [seated])
    }

    @Test("同時案内で負けたセッションは新しい時刻でも返さない")
    func ignoresLoser() {
        let loser = newSession(id: "loser", tableId: "31", at: 30_000)
        #expect(resolveSessions(tables: ["31": seated.id], sessions: [loser, seated]) == [seated])
    }

    @Test("複数卓から指されても一度だけ返す")
    func onlyOnce() {
        #expect(resolveSessions(tables: ["31": seated.id, "33": seated.id], sessions: [seated]) == [seated])
    }

    @Test("存在しない id を無視する")
    func ignoresMissing() {
        #expect(resolveSessions(tables: ["31": "missing"], sessions: [seated]) == [])
    }

    @Test("移動元の卓の古い参照は、セッションの tableIds に無いので空席として扱う")
    func staleReference() {
        var moved = seated
        moved.tableIds = ["15"]
        #expect(resolveSessions(tables: ["31": seated.id, "15": seated.id], sessions: [moved]) == [moved])
        #expect(resolveSessions(tables: ["31": seated.id], sessions: [moved]) == [])
    }

    @Test("同時操作で他の客に取られた卓は団体の tableIds から外す")
    func trimsTakenTables() {
        var group = seated
        group.tableIds = ["11", "12"]
        let other12 = newSession(id: "other12", tableId: "12", at: 30_000)
        var trimmed = group
        trimmed.tableIds = ["11"]
        #expect(resolveSessions(tables: ["11": seated.id, "12": other12.id], sessions: [group, other12]) == [trimmed, other12])
    }
}
