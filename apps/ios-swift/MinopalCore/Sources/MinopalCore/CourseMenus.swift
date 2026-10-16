import Foundation

// コースのメニュー（料理と提供順。packages/core/src/courseMenus.ts）。店が設定の「コース」で作る（No.89。ShopSettings の courseMenus）。
// 最初の一覧は公式HP（https://mucho-amigo.com/course/ 、2026-09-30 取得）から。
// 最初の一覧の id は前の版のアプリも知っているので変えない（firestore.rules の isMenuOrNull も同じ一覧）
public struct CourseMenu: Equatable, Sendable {
    public var id: String
    public var name: String
    public var price: Int        // 税込の値段（円）。お店ではコースを値段で呼ぶので、選ぶボタンは値段を大きく出す
    public var short: String     // 選ぶボタン用の短い名前（同じ値段のコースを見分ける）
    public var dishes: [String]  // 提供順
    public var lastOrderMin: Int?  // このコースだけの L.O.（ファーストドリンクから）。nil は店の設定のまま
    public var seatLimitMin: Int?  // このコースだけのお席の時間。nil は店の設定のまま

    public init(id: String, name: String, price: Int, short: String, dishes: [String], lastOrderMin: Int? = nil, seatLimitMin: Int? = nil) {
        self.id = id
        self.name = name
        self.price = price
        self.short = short
        self.dishes = dishes
        self.lastOrderMin = lastOrderMin
        self.seatLimitMin = seatLimitMin
    }
}

// 最初の一覧。選ぶボタンに並べる順（値段の安い順）
public let defaultCourseMenus: [CourseMenu] = [
    CourseMenu(id: "nijikai", name: "二次会Mexicanコース", price: 1500, short: "二次会", dishes: [
        "プレミアムアボカドのワカモレ・フレスコ＆トルティーヤチップ",
        "チチャロン＆2種の自家製テーブルサルサ",
        "新鮮魚介のメキシカンクラシック・セビーチェ",
        "4種のチーズ ケサディーヤ",
        "MUCHO特製フラワートルティーヤのメキシカンタコス",
    ]),
    CourseMenu(id: "casual", name: "カジュアルメキシカンコース", price: 3000, short: "カジュアル", dishes: [
        "プレミアムアボカドのワカモレ・フレスコ＆トルティーヤチップ",
        "チチャロン＆2種の自家製テーブルサルサ",
        "新鮮魚介のセビーチェ",
        "メキシコ発祥シーザーサラダ",
        "4種のチーズ ケサディーヤ",
        "自家製トルティーヤのメキシカンタコス",
        "スパイスマリネのグリルチキン～ファフィータ仕立て～",
        "バニラアイス with メキシカンスパイス Tajin",
    ]),
    CourseMenu(id: "meat_share", name: "TEX-MEX ミートシェアコース", price: 4000, short: "ミートシェア", dishes: [
        "2種のテーブルサルサ＆プレミアムアボカドのワカモレ・フレスコ",
        "新鮮魚介のセビーチェ",
        "具沢山コブサラダ",
        "TEX-MEX スライダーバーガー",
        "バッファロー・チキンウイング",
        "メキシコ産三元豚太郎のローストポーク～ファフィータ仕立て～",
        "スパイシーチリコンカンミートのタコライス",
        "バニラアイス with メキシカンスパイス Tajin",
    ]),
    CourseMenu(id: "cheese", name: "メキシカンチーズコース", price: 4000, short: "チーズ", dishes: [
        "プレミアムアボカドのワカモレ・フレスコ＆トルティーヤチップ",
        "新鮮魚介のセビーチェ",
        "チチャロン＆2種の自家製テーブルサルサ",
        "アボカドとサボテンのメキシカンサラダ～自家製フレッシュサルサ和え～",
        "4種のチーズのケサディーヤ",
        "石焼きチーズ鍋 ケソ・フンディード（アボカド／シュリンプ）",
        "特製トルティーヤ＆バケットセット",
        "ケソ・フンディードのソースで仕上げるチーズリゾット",
        "バニラアイス with メキシカンスパイス Tajin",
    ]),
    CourseMenu(id: "premium", name: "プレミアムメキシカンコース", price: 5000, short: "プレミアム", dishes: [
        "プレミアムアボカドのワカモレ・フレスコ＆トルティーヤチップ",
        "新鮮魚介のセビーチェ・クラシコ",
        "神の海老のメキシカン・シュリンプカクテル",
        "アボカドとサボテンのメキシカンサラダ",
        "峯野牛 特上赤身ステーキのファフィータ",
        "特製トルティーヤセット",
        "彩り焼き野菜のメキシカングリル",
        "アロス・ア・ラ・メヒカーナ",
        "バニラアイス with メキシカンスパイス Tajin",
    ]),
]

public func menuOf(_ id: String?, menus: [CourseMenu] = defaultCourseMenus) -> CourseMenu? {
    menus.first { $0.id == id }
}

// 値段の表示（例 4,000円）。端末の言語設定によらず、桁区切りはカンマにする
public func priceLabel(_ menu: CourseMenu) -> String {
    var digits = Array(String(menu.price))
    var index = digits.count - 3
    while index > 0 && digits[index - 1] != "-" {
        digits.insert(",", at: index)
        index -= 3
    }
    return String(digits) + "円"
}
