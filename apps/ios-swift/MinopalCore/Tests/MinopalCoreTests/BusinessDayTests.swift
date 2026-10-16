import Testing
@testable import MinopalCore

// packages/core/src/history.test.ts（営業日の分）・closing.test.ts・serverClock.test.ts（estimateOffset）・tapGuard.test.ts と同じ中身
private func at(_ d: Int, _ h: Int, _ m: Int = 0) -> Int { tokyoMs(2026, 9, d, h, m) }

@Suite("営業日は朝4時で区切る")
struct BusinessDayTests {
    @Test("4時より前は前の日、4時からはその日")
    func dayOf() {
        #expect(businessDayOf(at(3, 3, 59), calendar: tokyo) == "2026-10-02")
        #expect(businessDayOf(at(3, 4), calendar: tokyo) == "2026-10-03")
        #expect(businessDayOf(at(3, 23, 30), calendar: tokyo) == "2026-10-03")
    }

    @Test("その日の4時から次の日の4時まで")
    func range() {
        #expect(businessDayRange("2026-10-03", calendar: tokyo) == TimeRange(start: at(3, 4), end: at(4, 4)))
        #expect(businessDayRange("2026-10-31", calendar: tokyo) == TimeRange(start: at(31, 4), end: tokyoMs(2026, 10, 1, 4)))
    }

    @Test("期間は、はじめの日の4時からおわりの日の次の日の4時まで（No.113）")
    func days() {
        #expect(businessDaysRange("2026-10-03", "2026-10-05", calendar: tokyo) == TimeRange(start: at(3, 4), end: at(6, 4)))
        #expect(businessDaysRange("2026-10-03", "2026-10-03", calendar: tokyo) == businessDayRange("2026-10-03", calendar: tokyo))
        #expect(businessDaysRange("2026-10-05", "2026-10-03", calendar: tokyo) == nil)
        #expect(businessDaysRange("2026-10-03", "", calendar: tokyo) == nil)
    }

    @Test("日付の形が違えば nil")
    func badDays() {
        for bad in ["", "2026-1-3", "2026-02-30", "きょう"] { #expect(businessDayRange(bad, calendar: tokyo) == nil) }
    }
}

@Suite("閉店時刻（No.129）")
struct ClosingTests {
    let h23 = 23 * 60, h1 = 60

    @Test("15分ごとの 0時からの分だけを閉店時刻として読む")
    func closingMin() {
        #expect([0, 15, 1410, 1425].allSatisfy { isClosingMin($0) })
        #expect(!([nil, -15, 1440, 1412, "1410", 23.5] as [Any?]).contains { isClosingMin($0) })
    }

    @Test("選べる時刻は朝4時から次の日の3:45まで、深夜は「深夜」を付けて出す")
    func choices() {
        #expect(closingChoices.first == 240)
        #expect(closingChoices.last == 225)
        #expect(closingChoices.count == 96)
        #expect([closingLabel(1410), closingLabel(0), closingLabel(90)] == ["23:30", "深夜0:00", "深夜1:30"])
    }

    @Test("0〜3時台の閉店時刻は、その営業日の次の日付")
    func lateNight() {
        #expect(closingAtOf("2026-10-03", h23, calendar: tokyo) == at(3, 23))
        #expect(closingAtOf("2026-10-03", h1, calendar: tokyo) == at(4, 1))
        #expect(closingAtOf("2026-13-03", h23, calendar: tokyo) == nil)
    }

    @Test("閉店時刻より後に案内したお客さんは、その営業日の終わり（朝4時）に閉じる")
    func afterClosing() {
        #expect(closeOutAtOf(newSession(id: "a", tableId: "12", at: at(3, 20)), h23, calendar: tokyo) == at(3, 23))
        #expect(closeOutAtOf(newSession(id: "a", tableId: "12", at: at(3, 23, 10)), h23, calendar: tokyo) == at(4, 4))
        // 深夜0時を過ぎて案内しても、営業日は前の日
        #expect(closeOutAtOf(newSession(id: "a", tableId: "12", at: at(4, 0, 30)), h1, calendar: tokyo) == at(4, 1))
    }

    @Test("閉店時刻を過ぎて退店していない卓を、閉店時刻で退店にする")
    func closesOut() {
        let seated = newSession(id: "a", tableId: "12", at: at(3, 20))
        let exited = advance(advance(advance(newSession(id: "b", tableId: "13", at: at(3, 19)), at: at(3, 19, 5)), at: at(3, 20, 30)), at: at(3, 21))
        var cleared = newSession(id: "c", tableId: "14", at: at(3, 20))
        cleared.clearedAt = at(3, 22)
        #expect(closeOuts([seated, exited, cleared], now: at(3, 22, 59), closingMin: h23, calendar: tokyo) == [])
        var closed = seated
        closed.status = .exited
        closed.exitedAt = at(3, 23)
        closed.exitedByClosing = true
        #expect(closeOuts([seated, exited, cleared], now: at(3, 23), closingMin: h23, calendar: tokyo) == [closed])
        // 閉店時刻を決めていなければ何もしない
        #expect(closeOuts([seated], now: at(5, 12), closingMin: nil, calendar: tokyo) == [])
    }

    @Test("次の日に開いた端末でも、退店の時刻は閉店時刻")
    func nextDay() {
        let closed = closeOuts([newSession(id: "a", tableId: "12", at: at(3, 20))], now: at(4, 18), closingMin: h23, calendar: tokyo)
        #expect(closed.first?.exitedAt == at(3, 23))
    }

    @Test("「1つ戻す」で閉店の前の本当の状態に戻る")
    func reverts() {
        let seated = newSession(id: "a", tableId: "12", at: at(3, 20))
        let otoshi = advance(seated, at: at(3, 20, 5))
        for before in [seated, otoshi] {
            let closed = closeOuts([before], now: at(3, 23), closingMin: h23, calendar: tokyo)
            #expect(closed.first.flatMap(revert) == before)
        }
    }

    @Test("お通し前に閉店で退店にした卓も、保存して読み直せる")
    func roundTrip() {
        let closed = closeOuts([newSession(id: "a", tableId: "12", at: at(3, 20))], now: at(3, 23), closingMin: h23, calendar: tokyo)[0]
        var document = toSessionDocument(closed)
        #expect(document["exitedByClosing"] as? Bool == true)
        #expect(sessionFromDocument(id: "a", data: document) == closed)
        // 印の無い退店は、今までどおりお通し・L.O.確認の時刻が要る
        document["exitedByClosing"] = false
        #expect(sessionFromDocument(id: "a", data: document) == nil)
        // ふつうの卓も印を false で書く（merge で書くので、戻したときに true を残さない）
        #expect(toSessionDocument(newSession(id: "z", tableId: "1", at: at(3, 18)))["exitedByClosing"] as? Bool == false)
    }
}

@Test("サーバーとの時差を、往復の真ん中で見積もる")
func estimatesOffset() {
    for (sentAt, receivedAt, serverAt, expected) in [(1000, 1200, 5000, 3900), (0, 0, 0, 0), (1000, 1200, 500, -600), (1000, 1201, 5000, 3900), (1000, 1201, 500, -600)] {
        #expect(estimateOffset(sentAt: sentAt, receivedAt: receivedAt, serverAt: serverAt) == expected)
    }
}

@Test("押した直後の 0.5秒は次を受け付けない。それを過ぎれば受け付ける")
func tapGuard() {
    #expect(!tooSoon(last: nil, at: 1000))
    #expect(tooSoon(last: 1000, at: 1000))
    #expect(tooSoon(last: 1000, at: 1000 + tapGuardMs - 1))
    #expect(!tooSoon(last: 1000, at: 1000 + tapGuardMs))
    // 時計が戻っても押せなくならない
    #expect(!tooSoon(last: 1000, at: 900))
}
