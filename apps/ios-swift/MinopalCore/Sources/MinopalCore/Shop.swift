import Foundation

// 店のデータの置き場所（packages/core/src/shopPath.ts）。今の店（ログインなし）はいちばん上、
// ログインした店は shops/{アカウントの uid}/ の下に同じ形で持つ
public struct ShopBase: Equatable, Sendable {
    public let components: [String]

    public static let guest = ShopBase(components: [])
    public static func account(uid: String) -> ShopBase { ShopBase(components: ["shops", uid]) }

    // コレクションの場所（例：shops/abc/sessions）
    public func path(_ name: String) -> String { (components + [name]).joined(separator: "/") }
}

// 席の配置を保存していない店の卓番（firestore.rules の tableIds と同じ）
public let defaultTableIds = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "21", "22", "31", "33", "34", "36", "38"]

// 同期の状態（store.ts の SyncState）
public enum SyncState: Sendable {
    case synced, pending, offline
}
// 複数の購読のうち、いちばん悪い状態を表示する
public func worstSyncState(_ states: [SyncState]) -> SyncState {
    states.contains(.offline) ? .offline : states.contains(.pending) ? .pending : .synced
}

// どの Firebase につないでいるか。Firebase エミュレータのプロジェクト（demo- で始まる）には本物のデータが無い。
// それ以外（table-check-dev・table-check-prod）は店のデータが入っているので、試しの版では「ログインせずに使う」（いちばん上の店）を開かない
public func isEmulatorProject(_ projectId: String) -> Bool { projectId.hasPrefix("demo-") }
