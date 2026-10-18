import Testing
@testable import MinopalCore

@Suite("アカウント削除の失敗の分け方")
struct AccountDeletionErrorTests {
    @Test("パスワードの違いと、ログインの入れ直しと、それ以外を分ける")
    func mapsErrors() {
        #expect(accountDeletionError(authCode: "auth/wrong-password", functionsCode: nil, reason: nil) == .wrongPassword)
        #expect(accountDeletionError(authCode: "auth/invalid-credential", functionsCode: nil, reason: nil) == .wrongPassword)
        #expect(accountDeletionError(authCode: "auth/missing-password", functionsCode: nil, reason: nil) == .wrongPassword)
        #expect(accountDeletionError(authCode: "auth/network-request-failed", functionsCode: nil, reason: nil) == .failed)
        #expect(accountDeletionError(authCode: nil, functionsCode: "unauthenticated", reason: nil) == .notSignedIn)
        #expect(accountDeletionError(authCode: nil, functionsCode: "failed-precondition", reason: recentLoginRequiredReason) == .recentLoginRequired)
        #expect(accountDeletionError(authCode: nil, functionsCode: "failed-precondition", reason: "app-check-required") == .failed)
        #expect(accountDeletionError(authCode: nil, functionsCode: nil, reason: nil) == .failed)
        #expect(accountDeletionMessage(.wrongPassword, isAnonymous: false) == "パスワードが違います")
        #expect(accountDeletionMessage(.recentLoginRequired, isAnonymous: false) == "パスワードを入れ直してください")
        let anonymousRecent = accountDeletionMessage(.recentLoginRequired, isAnonymous: true)
        #expect(anonymousRecent == accountDeletionMessage(.failed, isAnonymous: true))
        #expect(!anonymousRecent.contains("ログアウト"))
        #expect(!anonymousRecent.contains("入り直"))
    }
}

@MainActor
final class FakeAccountDeletion: AccountDeletionClient {
    var reauthError: Error?
    var deleteError: Error?
    var signOutError: Error?
    var reauthCount = 0
    var deleteCount = 0
    var signedOut = false

    func reauthenticate(password: String) async throws {
        reauthCount += 1
        if let reauthError { throw reauthError }
    }

    func deleteAccount() async throws {
        deleteCount += 1
        if let deleteError { throw deleteError }
    }

    func signOut() throws {
        if let signOutError { throw signOutError }
        signedOut = true
    }
}

@MainActor
@Suite("アカウント削除の進み方")
struct AccountDeletionFlowTests {
    @Test("匿名はパスワードを飛ばし、確認で消してログアウトする")
    func anonymousConfirmsOnly() async {
        let client = FakeAccountDeletion()
        let model = AccountDeletionModel(isAnonymous: true, client: client)
        #expect(model.step == .confirm)
        await model.submitPassword()
        #expect(client.reauthCount == 0)
        await model.confirmDelete()
        #expect(client.deleteCount == 1)
        #expect(client.signedOut)
        #expect(model.finished)
        #expect(model.message.isEmpty)
    }

    @Test("メールの店は、パスワードが合ってから確認で消す")
    func passwordThenConfirm() async {
        let client = FakeAccountDeletion()
        let model = AccountDeletionModel(isAnonymous: false, client: client)
        #expect(model.step == .password)
        await model.confirmDelete()
        #expect(client.deleteCount == 0)

        model.password = ""
        await model.submitPassword()
        #expect(model.message == "パスワードを入れてください")
        #expect(client.reauthCount == 0)

        model.password = "nope"
        client.reauthError = AccountDeletionError.wrongPassword
        await model.submitPassword()
        #expect(model.step == .password)
        #expect(model.message == "パスワードが違います")
        #expect(client.deleteCount == 0)

        client.reauthError = nil
        model.password = "password123"
        await model.submitPassword()
        #expect(model.step == .confirm)
        #expect(model.message.isEmpty)
        #expect(client.deleteCount == 0)

        await model.confirmDelete()
        #expect(client.deleteCount == 1)
        #expect(client.signedOut)
        #expect(model.finished)
    }

    @Test("消せなかったときは残って、もう一度押せる")
    func retriesAfterFailure() async {
        let client = FakeAccountDeletion()
        let model = AccountDeletionModel(isAnonymous: true, client: client)
        client.deleteError = AccountDeletionError.failed
        await model.confirmDelete()
        #expect(!model.finished)
        #expect(!client.signedOut)
        #expect(model.message == accountDeletionMessage(.failed, isAnonymous: true))
        #expect(model.step == .confirm)

        client.deleteError = nil
        await model.confirmDelete()
        #expect(model.finished)
        #expect(client.signedOut)
        #expect(client.deleteCount == 2)
    }

    @Test("ログインが古いと、メールの店はパスワードに戻り、匿名は確認に残る")
    func recentLoginRequired() async {
        let email = FakeAccountDeletion()
        let model = AccountDeletionModel(isAnonymous: false, client: email)
        model.password = "password123"
        await model.submitPassword()
        email.deleteError = AccountDeletionError.recentLoginRequired
        await model.confirmDelete()
        #expect(model.step == .password)
        #expect(model.password.isEmpty)
        #expect(!model.finished)
        #expect(!email.signedOut)
        #expect(model.message == "パスワードを入れ直してください")

        let guest = FakeAccountDeletion()
        let anonymous = AccountDeletionModel(isAnonymous: true, client: guest)
        guest.deleteError = AccountDeletionError.recentLoginRequired
        await anonymous.confirmDelete()
        #expect(anonymous.step == .confirm)
        #expect(!anonymous.finished)
        #expect(!anonymous.message.contains("ログアウト"))
        #expect(!anonymous.message.contains("入り直"))
        #expect(anonymous.message == accountDeletionMessage(.failed, isAnonymous: true))
    }

    @Test("サーバーでは消えても、端末からログアウトできなければもう一度試せる")
    func retriesWhenSignOutFails() async throws {
        let client = FakeAccountDeletion()
        let model = AccountDeletionModel(isAnonymous: true, client: client)
        struct SignOutFailed: Error {}
        client.signOutError = SignOutFailed()
        await model.confirmDelete()
        #expect(client.deleteCount == 1)
        #expect(!model.finished)
        #expect(model.message == accountDeletionMessage(.failed, isAnonymous: true))

        client.signOutError = nil
        await model.confirmDelete()
        #expect(model.finished)
        #expect(client.signedOut)
    }
}
