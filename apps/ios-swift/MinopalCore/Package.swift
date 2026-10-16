// swift-tools-version: 6.0
// 卓のルール（packages/core の Swift 版）。画面にも Firebase にも依存しないので、`swift test` だけで確かめられる
import PackageDescription

let package = Package(
    name: "MinopalCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "MinopalCore", targets: ["MinopalCore"]),
    ],
    targets: [
        .target(name: "MinopalCore"),
        .testTarget(name: "MinopalCoreTests", dependencies: ["MinopalCore"]),
    ]
)
