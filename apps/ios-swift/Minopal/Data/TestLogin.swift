#if DEBUG
import Foundation

// UI テスト用に、画面を通さずにログインして始める。開発中のビルドで、Firebase エミュレータにつないでいて、
// 起動の引数に -MinopalTestLogin <メールアドレス> があるときだけ動く（パスワードは UI テストが作るアカウントと同じ password123）。
// 画面でログインすると iOS が「パスワードを保存しますか？」を出し、閉じるのに数秒〜2分かかってテストが止まるため。
// ログインの画面そのものは LoginScreenUITests で確かめる
enum TestLogin {
    static let password = "password123"
    static var email: String? { UserDefaults.standard.string(forKey: "MinopalTestLogin") }
}
#endif
