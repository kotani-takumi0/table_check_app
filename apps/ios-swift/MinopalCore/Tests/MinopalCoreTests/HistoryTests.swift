import Testing
@testable import MinopalCore

// packages/core/src/history.test.ts（CSV の分）と同じ中身。営業日の分は BusinessDayTests
private func at(_ d: Int, _ h: Int, _ m: Int = 0) -> Int { tokyoMs(2026, 9, d, h, m) }
private func lines(_ csv: String) -> [String] {
    String(csv.drop { $0 == "\u{FEFF}" }).trimmingCharacters(in: .whitespacesAndNewlines).components(separatedBy: "\r\n")
}
private func csv(_ sessions: [RecordedSession], drinkPlans: [DrinkPlan] = defaultDrinkPlans, courseMenus: [CourseMenu] = defaultCourseMenus) -> String {
    sessionsCsv(sessions, drinkPlans: drinkPlans, courseMenus: courseMenus, calendar: tokyo)
}
private func cells(_ csv: String) -> [String] { lines(csv)[1].components(separatedBy: ",") }

@Suite("CSV")
struct HistoryCsvTests {
    let plain: Session = {
        var s = newSession(id: "a", tableId: "12", at: at(3, 18, 5), guests: 4)
        s.status = .exited
        s.otoshiAt = at(3, 18, 10)
        s.loDoneAt = at(3, 19, 40)
        s.exitedAt = at(3, 20, 5)
        s.paidAt = at(3, 20, 0)
        return s
    }()
    let course: Session = {
        var s = newSession(id: "b", tableId: "11", at: at(3, 18, 0), course: "drinks", menu: defaultCourseMenus[1].id)
        s.tableIds = ["11", "13"]
        return s
    }()

    @Test("見出しと、案内の順に1行ずつ。先頭に BOM、改行は CRLF")
    func rows() {
        let text = csv([RecordedSession(plain), RecordedSession(course)])
        #expect(text.hasPrefix("\u{FEFF}"))
        #expect(text.hasSuffix("\r\n"))
        let all = lines(text)
        #expect(all[0] == csvHeader.joined(separator: ","))
        #expect(all[1].hasPrefix("2026-10-03,11・13,,飲み放題,"))
        #expect(all[1].hasSuffix(",18:00,,,,,未払い,ご案内済み,,,,"))
        #expect(all[2] == "2026-10-03,12,4,通常,,18:05,18:10,19:40,20:05,120,会計済（20:00）,退店済み,,,,")
    }

    @Test("どのコースか未定なら「未定」、消したコースは「消したコース」")
    func undecided() {
        var undecided = course
        undecided.menu = nil
        #expect(cells(csv([RecordedSession(undecided)]))[4] == "未定")
        #expect(cells(csv([RecordedSession(course)], courseMenus: []))[4] == "消したコース")
    }

    @Test("カンマや引用符を含む欄は引用符で囲む")
    func quoted() {
        var menu = defaultCourseMenus[1]
        menu.name = "お肉, \"特上\""
        #expect(lines(csv([RecordedSession(course)], courseMenus: [menu]))[1].contains("\"3,000円 お肉, \"\"特上\"\"\""))
    }

    @Test("全卓消去の時刻と卓の動きを出す（No.113）")
    func clearedAndMoves() {
        var moved = plain
        moved.clearedAt = at(3, 23, 0)
        moved.tableLog = [TableMove(at: at(3, 18, 30), kind: .move, from: "12", to: "13"), TableMove(at: at(3, 19, 0), kind: .add, from: nil, to: "14")]
        #expect(Array(cells(csv([RecordedSession(moved)])).suffix(3).prefix(2)) == ["23:00", "18:30 12→13番に移動 / 19:00 14番を足す"])
    }

    @Test("閉店で退店にしたお客さんは「閉店で退店」に「はい」（No.129）")
    func closed() {
        var closed = plain
        closed.exitedAt = at(3, 23, 0)
        closed.exitedByClosing = true
        #expect(Array(cells(csv([RecordedSession(closed)])).suffix(5)) == ["退店済み", "はい", "", "", ""])
    }

    @Test("料理を出した時刻を品ごとに、前の品からの分を添えて出す。時刻の無い品は「時刻なし」（No.131）")
    func dishes() {
        var served = course
        served.dishesServed = 4
        served.dishServedAt = [nil, at(3, 18, 20), at(3, 18, 35), at(3, 18, 52)]
        #expect(cells(csv([RecordedSession(served)])).last == "1品目 時刻なし / 2品目 18:20 / 3品目 18:35（+15分） / 4品目 18:52（+17分）")
        // 時刻を残す前の記録も、出した品数だけ「時刻なし」で出す
        var old = course
        old.dishesServed = 2
        #expect(cells(csv([RecordedSession(old)])).last == "1品目 時刻なし / 2品目 時刻なし")
        // 順番を飛ばして付けた卓は、付けた品目だけ出す（2品目は出していない。No.167）
        var skipped = course
        skipped.dishesServed = 2
        skipped.dishServedAt = [at(3, 18, 20), nil, at(3, 18, 35)]
        #expect(cells(csv([RecordedSession(skipped)])).last == "1品目 18:20 / 3品目 18:35（+15分）")
    }

    @Test("名前を変えた区分・コースも、記録に写したそのときの名前で出す（No.113）")
    func recordedNames() {
        let recorded = RecordedSession(course, record: SessionRecord(drinkPlanName: .some("前の名前"), courseName: .some("前のコース名")))
        #expect(cells(csv([recorded]))[3] == "前の名前")
        #expect(lines(csv([recorded]))[1].contains("\"\(priceLabel(defaultCourseMenus[1])) 前のコース名\""))
    }

    @Test("設定で消した区分・コースは、記録に写した名前で出す（No.113）")
    func removedNames() {
        let recorded = RecordedSession(course, record: SessionRecord(drinkPlanName: .some("昔の飲み放題"), courseName: .some("昔のコース")))
        let row = cells(csv([recorded], drinkPlans: [], courseMenus: []))
        #expect(row[3] == "昔の飲み放題")
        #expect(row[4] == "昔のコース")
    }

    @Test("書き出すファイルの名前")
    func fileName() {
        #expect(csvFileName("2026-10-03", "2026-10-05") == "minopal-2026-10-03_2026-10-05.csv")
        #expect(csvFileName("2026-10-03", "2026-10-03") == "minopal-2026-10-03.csv")
    }
}
