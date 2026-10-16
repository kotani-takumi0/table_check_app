import SwiftUI

@main
struct MinopalApp: App {
    private let connection: FirebaseConnection

    init() {
        connection = FirebaseSetup.configure()
        LocalNotifier.shared.install()
    }

    var body: some Scene {
        WindowGroup {
            RootView(connection: connection)
        }
    }
}
