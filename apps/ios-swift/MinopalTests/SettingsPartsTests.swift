import MinopalCore
import Testing
import UIKit
@testable import Minopal

// 設定の部品（No.160。エミュレータは使わない）
@Suite("設定の部品")
struct SettingsPartsTests {
    @Test("店のタイマーのアイコンは、どれも iOS にある SF Symbols で描く")
    func timerSymbols() {
        for icon in shopTimerIcons {
            #expect(UIImage(systemName: ShopTimerSymbol.name(icon.id)) != nil, "\(icon.id) の SF Symbols が無い")
        }
        // 前の版の絵文字・知らない値も描ける
        #expect(ShopTimerSymbol.name("🚽") == "toilet")
        #expect(ShopTimerSymbol.name("??") == "clock")
    }

    @Test("文字数の上限は Web と同じく UTF-16 で数える（絵文字は2つ）")
    func limited() {
        #expect(limitedText("サンプル店", 3) == "サンプ")
        #expect(limitedText("店😀", 2) == "店")
        #expect(limitedText("短い", 30) == "短い")
    }
}
