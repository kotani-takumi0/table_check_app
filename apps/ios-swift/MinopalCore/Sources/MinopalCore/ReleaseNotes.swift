import Foundation

// 更新のお知らせ（No.127。packages/core/src/releaseNotes.ts）と今後の予定（No.144。roadmap.ts）。
// 文章は TS のファイルだけで持ち、ここでは scripts/export-ios-content.mjs が書き出した Resources/content.json を読む
public struct ReleaseNote: Equatable, Decodable, Sendable {
    public var version: String   // package.json の version（2.3.3）
    public var date: String      // 出した日（YYYY-MM-DD）
    public var items: [String]
}

public enum RoadmapStage: String, CaseIterable, Decodable, Sendable {
    case preparing, considering

    // ROADMAP_STAGE_LABEL
    public var label: String {
        switch self {
        case .preparing: "準備中"
        case .considering: "検討中"
        }
    }
}
public struct RoadmapItem: Equatable, Decodable, Sendable {
    public var id: String
    public var stage: RoadmapStage
    public var title: String       // 機能名ではなく、店の人ができるようになること
    public var detail: String
    public var fromFeedback: Bool  // ご意見から生まれた機能です。店や人の名前は持たない
}

private struct Content: Decodable {
    var releaseNotes: [ReleaseNote]
    var roadmap: [RoadmapItem]
}
// アプリに入れた JSON は、書き出しのテスト（npm test）で TS と同じことを確かめてあるので、読めなければ作りの誤りとして止める
private let content: Content = {
    guard let url = Bundle.module.url(forResource: "content", withExtension: "json"),
          let data = try? Data(contentsOf: url), let decoded = try? JSONDecoder().decode(Content.self, from: data) else {
        preconditionFailure("Resources/content.json を読めません。npm run ios-swift:content で書き出してください")
    }
    return decoded
}()

// RELEASE_NOTES（新しい版から順）
public var releaseNotes: [ReleaseNote] { content.releaseNotes }
// 画面の版（v2.3.3）でも package.json の版（2.3.3）でも引ける
public func releaseNoteOf(_ version: String, notes: [ReleaseNote] = releaseNotes) -> ReleaseNote? {
    let bare = version.hasPrefix("v") ? String(version.dropFirst()) : version
    return notes.first { $0.version == bare }
}
// 新しい版になったあと、その版のお知らせを1回だけ出す。見た版はこの端末に覚える（端末ごと）
public let seenReleaseKey = "minopal:seenRelease"
// seen：この端末で最後に見た（閉じた）版。まだ無ければ nil（最初の1回は出す）
public func shouldAnnounce(seen: String?, current: String, notes: [ReleaseNote] = releaseNotes) -> Bool {
    guard let note = releaseNoteOf(current, notes: notes) else { return false }
    return seen != note.version
}
// 「2026-10-07」→「2026年10月7日」
public func releaseDateLabel(_ date: String) -> String {
    guard date.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", options: .regularExpression) != nil else { return date }
    let parts = date.split(separator: "-")
    return "\(parts[0])年\(Int(parts[1])!)月\(Int(parts[2])!)日"
}

// 今後の予定。日付は出さない。「準備中」「検討中」の2段階。セキュリティの修正は載せない
public let roadmapTitleMax = 80
public let roadmapDetailMax = 200
public let roadmapFromFeedbackLabel = "ご意見から生まれた機能です"
public let roadmapNote = "予定は変わることがあります。時期はお約束できないため、「準備中」「検討中」で表しています。"
public let roadmapCtaTitle = "ほしい機能はありますか？"
public let roadmapCtaDetail = "いただいたご意見をもとに予定を決めています。"
public let roadmapEmpty = "いまお知らせできる予定はありません。使っていて気になることがあれば、ご意見を送ってください。"
// ROADMAP。空のあいだは画面に案内だけを出し、メニューに点は出さない
public var roadmap: [RoadmapItem] { content.roadmap }

public struct RoadmapGroup: Equatable, Sendable {
    public var stage: RoadmapStage
    public var items: [RoadmapItem]
}
public func roadmapGroups(_ items: [RoadmapItem] = roadmap) -> [RoadmapGroup] {
    RoadmapStage.allCases.map { stage in RoadmapGroup(stage: stage, items: items.filter { $0.stage == stage }) }.filter { !$0.items.isEmpty }
}
// この端末で見た予定（id をカンマでつないだもの）。新しい id が足されたときだけ、メニューに点を出す
public let seenRoadmapKey = "minopal:seenRoadmap"
public func roadmapSeenValue(_ items: [RoadmapItem] = roadmap) -> String {
    items.map(\.id).joined(separator: ",")
}
// 予定の id と、この端末で見た id の文字列から、点を出すか決める。予定が空なら出さない。
// seen が nil や空の端末（まだ開いていない）は、予定があるときだけ最初の1回を出す
public func roadmapHasUnseen(_ ids: [String], seen: String?) -> Bool {
    if ids.isEmpty { return false }
    guard let seen, !seen.isEmpty else { return true }
    let seenIds = Set(seen.split(separator: ",", omittingEmptySubsequences: false).map(String.init))
    return ids.contains { !seenIds.contains($0) }
}
public func shouldShowRoadmapDot(seen: String?) -> Bool {
    roadmapHasUnseen(roadmap.map(\.id), seen: seen)
}
