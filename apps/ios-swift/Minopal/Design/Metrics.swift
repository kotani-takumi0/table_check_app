import SwiftUI

// 押せる大きさと角丸（No.149「実装用の値一覧（確定版）」）。押せるものはすべて 44×44pt 以上
enum Metrics {
    static let minTap: CGFloat = 44
    // 入力欄・大きいボタンの高さ
    static let field: CGFloat = 48
    static let loginButton: CGFloat = 52
    // 中身の角丸（入力欄 8・リストのまとまり 10・ログインの面 12）
    static let fieldRadius: CGFloat = 8
    static let groupRadius: CGFloat = 10
    static let loginPanelRadius: CGFloat = 12
}
