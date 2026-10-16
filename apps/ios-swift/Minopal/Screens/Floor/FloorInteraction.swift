import MinopalCore
import Observation
import SwiftUI

// 卓を押したときに出すもの（No.158）：空席・退店済みの卓はご案内、お客さんのいる卓は詳細。
// iPad は押した卓のそばのポップオーバー、iPhone（幅が狭いとき）は下からのシート
enum FloorPrompt: Hashable {
    case seating(tableId: String)
    case detail(sessionId: String, from: String)   // from：開いた卓（団体のときは、この卓を移動する）

    // そばに出す卓
    var anchor: String {
        switch self {
        case .seating(let tableId): tableId
        case .detail(_, let from): from
        }
    }
}

// 卓の移動先・追加先を選んでいる間（No.133）。空席と退店済みの卓を押すと反映する
struct TablePick: Equatable {
    var sessionId: String
    var mode: PickMode
    var from: String
}

// 配置図で今出しているもの（ご案内・詳細）と、選んでいる卓の移動先・追加先。店の画面（iPad・iPhone）ごとに1つ持つ
@MainActor @Observable
final class FloorInteraction {
    var prompt: FloorPrompt?
    var pick: TablePick?

    // 卓を押した。選んでいる間は、空席・退店済みの卓だけ反映する。退店済みの卓は次のお客さんのご案内（詳細は長押し）
    func tap(_ seat: Seat, _ session: Session?, state: ShopState) {
        if let pick {
            guard isPickable(session) else { return }
            if let picked = state.visibleSession(pick.sessionId) {
                Haptics.success()
                switch pick.mode {
                case .move: state.moveTo(picked, from: pick.from, to: seat.id)
                case .add: state.addTo(picked, seat.id)
                }
            }
            self.pick = nil
            return
        }
        if let session, session.status != .exited {
            prompt = .detail(sessionId: session.id, from: seat.id)
        } else {
            prompt = .seating(tableId: seat.id)
        }
    }

    // 長押し：お客さんがいれば（退店済みでも）詳細を開く
    func longPress(_ seat: Seat, _ session: Session?) {
        guard pick == nil, let session else { return }
        Haptics.light()
        prompt = .detail(sessionId: session.id, from: seat.id)
    }

    // 詳細の「卓を追加（団体）」「〜番を移動」：詳細を閉じて、配置図で選んでもらう
    func startPick(_ mode: PickMode, session: Session, from: String) {
        prompt = nil
        pick = TablePick(sessionId: session.id, mode: mode, from: from)
    }

    // 今も出せるか。詳細はそのお客さんが卓に出ている間、ご案内はその卓が空席か退店済みの間（ほかの端末で案内されたら閉じる）
    func isLive(_ prompt: FloorPrompt, state: ShopState) -> Bool {
        switch prompt {
        case .seating(let tableId): state.layout.seats.contains { $0.id == tableId } && isPickable(state.occupant(tableId))
        case .detail(let sessionId, _): state.visibleSession(sessionId) != nil
        }
    }

    // この端末で詳細を開いているお客さん（ほかの端末に「編集中」を出す。No.72）
    func openedSessionId(state: ShopState) -> String? {
        guard let prompt, case .detail(let sessionId, _) = prompt, isLive(prompt, state: state) else { return nil }
        return sessionId
    }
}

// 卓の移動先・追加先を選んでいる間の帯：どこを押すかと「やめる」
struct PickBar: View {
    let label: String
    let onCancel: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text(label)
                .minopalFont(15, .bold, relativeTo: .subheadline)
                .foregroundStyle(Palette.keyText)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button("やめる", action: onCancel)
                .buttonStyle(DetailButtonStyle(kind: .secondary, height: Metrics.minTap, radius: 16))
                .fixedSize()
                .accessibilityIdentifier("pick-cancel")
        }
        .padding(.leading, 16)
        .padding(.trailing, 6)
        .padding(.vertical, 4)
        .background(Palette.keyWash, in: RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(Palette.keyText, lineWidth: 1.5))
        .accessibilityElement(children: .contain)
    }
}
