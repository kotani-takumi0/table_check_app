import Foundation

// Firestore の sessions の文書と Session の変換（packages/core/src/firestoreMapping.ts の Swift 版）。
// TS と同じ形で書く。料理のチェック（No.167）は、飛ばした品の nil を残して読む（Web は上から dishesServed 品で切る）

// 保存する形。店が足した区分（No.90）は course に 'drinks' を入れ、本当の区分は drinkPlan に入れる。
// 店が作ったコース（No.89）も同じく、menu は前の版も知っているものだけにし、本当のコースは courseMenu に入れる。
// null は NSNull で書く（前の版のアプリの上書きを見分けるため、空の項目も毎回書く）
public func toSessionDocument(_ session: Session) -> [String: Any] {
    let legacy: String? = session.course.map { legacyDrinkPlanIds.contains($0) ? $0 : "drinks" }
    let legacyMenu: String? = session.menu.flatMap { legacyMenuIds.contains($0) ? $0 : nil }
    return [
        "tableIds": session.tableIds,
        "status": session.status.rawValue,
        "seatedAt": session.seatedAt,
        "otoshiAt": nullable(session.otoshiAt),
        "loDoneAt": nullable(session.loDoneAt),
        "exitedAt": nullable(session.exitedAt),
        "paidAt": nullable(session.paidAt),
        "guests": nullable(session.guests),
        "course": nullable(legacy),
        "drinkPlan": nullable(session.course),
        "menu": nullable(legacyMenu),
        "courseMenu": nullable(session.menu),
        "dishesServed": session.dishesServed,
        "dishServedAt": session.dishServedAt.map { nullable($0) },
        "leaveAt": nullable(session.leaveAt),
        "clearedAt": nullable(session.clearedAt),
        "tableLog": session.tableLog.map { move -> [String: Any] in
            ["at": move.at, "kind": move.kind.rawValue, "from": nullable(move.from), "to": nullable(move.to)]
        },
        "exitedByClosing": session.exitedByClosing,
    ]
}

private func nullable<T>(_ value: T?) -> Any { value.map { $0 as Any } ?? NSNull() }

// 文書を Session にする。形が違えば nil（読まずに捨てる。fromSessionDoc と同じ条件）
public func sessionFromDocument(id: String, data: [String: Any]?) -> Session? {
    guard let s = data else { return nil }
    func timeOrNull(_ key: String) -> Bool { isNullOrMissing(s[key]) || timestampValue(s[key]) != nil }
    guard let tableIds = s["tableIds"] as? [Any], !tableIds.isEmpty, tableIds.allSatisfy({ $0 is String }),
          let statusText = s["status"] as? String, let status = Status(rawValue: statusText),
          let seatedAt = timestampValue(s["seatedAt"]) else { return nil }
    // otoshiAt・loDoneAt・exitedAt はキーが必ずある（undefined は拒否）
    for key in ["otoshiAt", "loDoneAt", "exitedAt"] {
        guard let value = s[key], value is NSNull || timestampValue(value) != nil else { return nil }
    }
    guard timeOrNull("paidAt"), timeOrNull("leaveAt"), timeOrNull("clearedAt"),
          isNullOrMissing(s["guests"]) || isGuestCount(s["guests"]),
          isNullOrMissing(s["course"]) || isCourse(s["course"]),
          isNullOrMissing(s["drinkPlan"]) || isCourse(s["drinkPlan"]),
          isNullOrMissing(s["menu"]) || isMenuId(s["menu"]),
          isNullOrMissing(s["courseMenu"]) || isMenuId(s["courseMenu"]),
          s["dishesServed"] == nil || (integerValue(s["dishesServed"]).map { $0 >= 0 } ?? false) else { return nil }
    // 閉店で退店にした卓（No.129）は、お通し・L.O.確認をしないまま退店になるので、その2つの時刻が空でもよい
    let closedByClosing = status == .exited && booleanValue(s["exitedByClosing"]) == true
    let otoshiAt = timestampValue(s["otoshiAt"]), loDoneAt = timestampValue(s["loDoneAt"]), exitedAt = timestampValue(s["exitedAt"])
    guard status == .seated || otoshiAt != nil || closedByClosing,
          ![.loDone, .exited].contains(status) || loDoneAt != nil || closedByClosing,
          status != .exited || exitedAt != nil else { return nil }
    // 前の版の文書に無い項目は、未払い・人数未入力・通常・コース未選択・まだ出していない・ふつうの退店時刻として読む（withDefaults と同じ）
    // 区分は drinkPlan、コースは courseMenu を優先して読む（前の版のアプリが通常に戻した文書は course が null なので通常）
    let course: String? = isNullOrMissing(s["course"]) ? nil : (isCourse(s["drinkPlan"]) ? s["drinkPlan"] : s["course"]) as? String
    let menu: String? = course == nil ? nil : (isMenuId(s["courseMenu"]) ? s["courseMenu"] : s["menu"]) as? String
    let dishesServed = menu == nil ? 0 : integerValue(s["dishesServed"]) ?? 0
    return Session(
        id: id, tableIds: tableIds.compactMap { $0 as? String }, status: status, seatedAt: seatedAt,
        otoshiAt: otoshiAt, loDoneAt: loDoneAt, exitedAt: exitedAt, paidAt: timestampValue(s["paidAt"]),
        guests: integerValue(s["guests"]), course: course, menu: menu, dishesServed: dishesServed,
        dishServedAt: parseDishTimes(s["dishServedAt"], served: dishesServed), leaveAt: timestampValue(s["leaveAt"]),
        clearedAt: timestampValue(s["clearedAt"]), tableLog: parseTableLog(s["tableLog"]), exitedByClosing: closedByClosing
    )
}

// 料理を出した時刻を読む（No.131・No.167）。壊れた値は時刻が分からないとして nil にする。
// 時刻の個数が dishesServed より多いときは、前の版が品数だけ戻したので上からその品数だけ残す。
// 順番を飛ばしたチェックは dishesServed が出した数なので、うしろの時刻は切らない（nil は出していない品）
public func parseDishTimes(_ value: Any?, served: Int) -> [Int?] {
    guard let times = value as? [Any] else { return [] }
    let parsed = times.prefix(CourseLimits.dishes).map { timestampValue($0) }
    let known = parsed.filter { $0 != nil }.count
    if known > max(served, 0) { return Array(parsed.prefix(max(served, 0))) }
    return Array(parsed)
}

// 卓の動きを読む。壊れた項目は落とす（記録の読み違いで、卓の画面を止めない）
public func parseTableLog(_ value: Any?) -> [TableMove] {
    guard let items = value as? [Any] else { return [] }
    func tableOrNull(_ v: Any?) -> Bool { v is NSNull || v is String }
    return items.suffix(tableLogMax).compactMap { item in
        guard let m = item as? [String: Any], let at = timestampValue(m["at"]),
              let kindText = m["kind"] as? String, let kind = TableMove.Kind(rawValue: kindText),
              tableOrNull(m["from"]), tableOrNull(m["to"]) else { return nil }
        return TableMove(at: at, kind: kind, from: m["from"] as? String, to: m["to"] as? String)
    }
}

// 卓の持ち主は「tables/{卓} がそのセッションを指し、かつセッションの tableIds にもその卓がある」ときだけ（resolveSessions と同じ）。
// 古い参照や、同時操作で他の客に取られた卓は、ここで tableIds から外す
public func resolveSessions(tables: [String: String?], sessions: [Session]) -> [Session] {
    var seen = Set<String>()
    return sessions.compactMap { session in
        guard seen.insert(session.id).inserted else { return nil }
        let owned = session.tableIds.filter { tables[$0] == .some(session.id) }
        if owned.isEmpty { return nil }
        if owned.count == session.tableIds.count { return session }
        var trimmed = session
        trimmed.tableIds = owned
        return trimmed
    }
}
