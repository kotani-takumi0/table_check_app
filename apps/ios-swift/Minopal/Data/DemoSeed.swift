#if DEBUG
import Foundation
import MinopalCore

// 画面の確かめ・スクショ用に、配置図にいろいろな状態のお客さんを入れる（テストデータだけ）。
// 開発中のビルドで、Firebase エミュレータにつないでいて、起動の引数に -MinopalDemoSeed があるときだけ動く。
// 同じ卓には同じ id で書くので、何度起動しても増えない
enum DemoSeed {
    static let argument = "-MinopalDemoSeed"
    static var requested: Bool { ProcessInfo.processInfo.arguments.contains(argument) }

    @MainActor
    static func seed(_ services: ShopServices, now: Int = nowMs()) {
        let minute = 60_000
        let tables = services.layout.layout.seats.filter { $0.kind == .table }.map(\.id)
        let counters = services.layout.layout.seats.filter { $0.kind == .counter }.map(\.id)
        // （経過の分・お通しを出したか・人数・退店済み・お会計済み・コース）。お通し（コースはファーストドリンク）は案内の2分後に出したことにする
        let tablePlans: [(Int, Bool, Int, Bool, Bool, Bool)] = [
            (42, true, 4, false, false, false),    // ふだん
            (16, false, 2, false, false, false),   // お通し未提供（いま対応）
            (75, true, 3, false, false, false),
            (20, true, 2, false, false, false),
            (97, true, 2, false, false, false),    // L.O.の時間を過ぎた（もうすぐ）
            (125, true, 4, false, true, false),    // お席の時間（いま対応）・会計済
            (60, true, 3, true, true, false),      // 退店済
            (55, true, 6, false, false, true),     // コース（飲み放題・カジュアル）で料理を2品出した
        ]
        let counterPlans: [(Int, Bool)] = [(25, true), (48, true), (97, true), (20, false), (65, true)]
        for (id, plan) in zip(tables, tablePlans) {
            var session = newSession(id: "demo-\(id)", tableId: id, at: now - plan.0 * minute, guests: plan.2,
                                     course: plan.5 ? "drinks" : nil, menu: plan.5 ? "casual" : nil)
            if plan.1 { session = advance(session, at: session.seatedAt + 2 * minute) }
            if plan.5 {
                session.dishesServed = 2
                session.dishServedAt = [now - 40 * minute, now - 25 * minute]
            }
            if plan.3 { session = advance(advance(session, at: now - 15 * minute), at: now - 10 * minute) }
            if plan.4 { session.paidAt = now - 12 * minute }
            services.sessions.put(session)
        }
        for (id, plan) in zip(counters, counterPlans) {
            var session = newSession(id: "demo-\(id)", tableId: id, at: now - plan.0 * minute)
            if plan.1 { session = advance(session, at: session.seatedAt + 2 * minute) }
            services.sessions.put(session)
        }
    }
}
#endif
