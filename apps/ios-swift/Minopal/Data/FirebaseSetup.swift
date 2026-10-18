import FirebaseAuth
import FirebaseCore
import FirebaseFirestore
import FirebaseFunctions
import MinopalCore

// どの Firebase につないだか
struct FirebaseConnection {
    let projectId: String
    // エミュレータには本物のデータが無いので、「ログインせずに使う」（いちばん上の店）も試せる
    var isEmulator: Bool { isEmulatorProject(projectId) }
}

enum FirebaseSetup {
    // 手元の Firebase エミュレータ（npm run ios-swift:emulators）。demo- で始まるプロジェクトは本物の Firebase に届かない
    static let emulatorProjectId = "demo-minopal"
    static let emulatorHost = "127.0.0.1"
    static let authPort = 9099
    static let firestorePort = 8080
    static let functionsPort = 5001
    // アカウント削除の関数。Firestore の場所（東京）に合わせる
    static let functionsRegion = "asia-northeast1"

    // GoogleService-Info.plist をアプリに入れていればそのプロジェクトに、無ければエミュレータにつなぐ。
    // dev・prod とも店のデータが入っているので、試すときはエミュレータか、試し用のアカウントでログインして使う
    static func configure() -> FirebaseConnection {
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
            return FirebaseConnection(projectId: FirebaseApp.app()?.options.projectID ?? "")
        }
        // エミュレータは鍵を確かめないので、形だけ合わせた値を入れる
        let options = FirebaseOptions(googleAppID: "1:000000000000:ios:0000000000000000", gcmSenderID: "000000000000")
        options.projectID = emulatorProjectId
        options.apiKey = "AIzaSyDemoMinopalEmulatorOnly0000000000"
        FirebaseApp.configure(options: options)
        Auth.auth().useEmulator(withHost: emulatorHost, port: authPort)
        let settings = Firestore.firestore().settings
        settings.host = "\(emulatorHost):\(firestorePort)"
        settings.isSSLEnabled = false
        // エミュレータは止めるとデータが消えるので、端末に古いキャッシュを残さない
        settings.cacheSettings = MemoryCacheSettings()
        Firestore.firestore().settings = settings
        Functions.functions(region: functionsRegion).useEmulator(withHost: emulatorHost, port: functionsPort)
        return FirebaseConnection(projectId: emulatorProjectId)
    }
}
