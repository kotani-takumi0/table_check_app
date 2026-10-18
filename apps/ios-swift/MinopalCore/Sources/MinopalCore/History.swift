import Foundation

// 履歴の CSV（packages/core/src/history.ts の sessionsCsv・csvFileName。No.34）。営業のあとに店長などが表計算や AI に渡して見返す。
// 営業日の区切り（businessDayOf など）は BusinessDay.swift。時刻はその端末の時間帯で数える

// 書き出しで読んだお客さん（TS の RecordedSession）。記録（No.113）に写したそのときの名前も一緒に持つ
public struct RecordedSession: Equatable, Sendable {
    public var session: Session
    public var record: SessionRecord
    public init(_ session: Session, record: SessionRecord = SessionRecord()) {
        self.session = session
        self.record = record
    }
}

public let csvHeader = ["営業日", "卓", "人数", "区分", "コース", "案内", "お通し・ファーストドリンク", "L.O.確認", "退店", "滞在（分）", "お会計", "最後の状態", "閉店で退店", "全卓消去", "卓の動き", "料理を出した時刻"]

// 表計算で開いても崩れないよう、カンマ・引用符・改行を含む欄は引用符で囲む
private func csvField(_ text: String) -> String {
    text.contains(where: { $0 == "," || $0 == "\"" || $0 == "\r" || $0 == "\n" || $0 == "\r\n" })
        ? "\"" + text.replacingOccurrences(of: "\"", with: "\"\"") + "\"" : text
}
// 卓の動き（No.113）を1つの欄にする。例「19:10 12→13番に移動 / 19:40 14番を足す」
private func tableLogText(_ log: [TableMove], calendar: Calendar) -> String {
    log.map { move in
        let what = switch move.kind {
        case .move: "\(move.from ?? "")→\(move.to ?? "")番に移動"
        case .add: "\(move.to ?? "")番を足す"
        case .remove: "\(move.from ?? "")番を外す"
        }
        return "\(formatClock(move.at, calendar: calendar)) \(what)"
    }.joined(separator: " / ")
}
// 料理を出した時刻（No.131・No.167）を1つの欄にする。例「1品目 18:20 / 3品目 18:35（+15分）」。
// 付けた料理だけを、その品目の番号で出す（飛ばした品は入れない）。時刻を残す前の版で出した品は「時刻なし」。
// 前の品からの分は、時刻がある直前の出した品から数える
private func dishTimesText(_ records: [(index: Int, at: Int?)], calendar: Calendar) -> String {
    records.enumerated().map { offset, record in
        guard let at = record.at else { return "\(record.index + 1)品目 時刻なし" }
        let before = records[..<offset].compactMap(\.at).last
        let gap = before.map { "（+\(Int((Double(at - $0) / 60_000).rounded()))分）" } ?? ""
        return "\(record.index + 1)品目 \(formatClock(at, calendar: calendar))\(gap)"
    }.joined(separator: " / ")
}

// 期間のお客さんを案内の順に1行ずつ。Excel で文字化けしないよう、先頭に BOM を付ける。
// 区分・コースは記録に写しておいたそのときの名前（No.113）で出し、写していない古い記録は今の設定の名前で出す（値段は写さないので今の値段）
public func sessionsCsv(_ sessions: [RecordedSession], drinkPlans: [DrinkPlan], courseMenus: [CourseMenu], calendar: Calendar = .current) -> String {
    let clock = { (at: Int?) in at.map { formatClock($0, calendar: calendar) } ?? "" }
    // TS の sort は同じ時刻の並びを崩さない
    let sorted = sessions.enumerated().sorted { ($0.element.session.seatedAt, $0.offset) < ($1.element.session.seatedAt, $1.offset) }.map(\.element)
    let rows = sorted.map { recorded -> [String] in
        let session = recorded.session, record = recorded.record
        let menu = session.course == nil ? nil : menuOf(session.menu, menus: courseMenus)
        let plan = session.course.flatMap { course in drinkPlans.first { $0.id == course } }
        // 記録に写した名前（二重の Optional の外側が nil なら写していない）
        let planName = record.drinkPlanName.flatMap { $0 }, courseName = record.courseName.flatMap { $0 }
        let courseText: String = if session.course == nil { "" }
            else if let menu { "\(priceLabel(menu)) \(courseName ?? menu.name)" }
            else if session.menu == nil { "未定" }
            else { courseName ?? "消したコース" }
        return [
            record.businessDay ?? businessDayOf(session.seatedAt, calendar: calendar),
            session.tableIds.joined(separator: "・"),
            session.guests.map(String.init) ?? "",
            session.course == nil ? "通常" : planName ?? plan?.name ?? "消した区分",
            courseText,
            clock(session.seatedAt),
            clock(session.otoshiAt),
            clock(session.loDoneAt),
            clock(session.exitedAt),
            session.exitedAt.map { String(Int((Double($0 - session.seatedAt) / 60_000).rounded())) } ?? "",
            session.paidAt.map { "会計済（\(formatClock($0, calendar: calendar))）" } ?? "未払い",
            Display(rawValue: session.status.rawValue)!.label,
            session.exitedByClosing ? "はい" : "",
            clock(session.clearedAt),
            tableLogText(session.tableLog, calendar: calendar),
            // 付けた料理だけ。時刻を残す前の版で出した品も「時刻なし」で数える
            dishTimesText(recordedDishTimes(session), calendar: calendar),
        ]
    }
    return "\u{FEFF}" + ([csvHeader] + rows).map { $0.map(csvField).joined(separator: ",") }.joined(separator: "\r\n") + "\r\n"
}

// 書き出すファイルの名前
public func csvFileName(_ from: String, _ to: String? = nil) -> String {
    let to = to ?? from
    return from == to ? "minopal-\(from).csv" : "minopal-\(from)_\(to).csv"
}
