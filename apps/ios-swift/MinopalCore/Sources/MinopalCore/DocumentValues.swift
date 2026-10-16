import Foundation

// Firestore の文書の値を読む。iOS の Firestore は数も真偽も NSNumber で返し、Swift の `as? Int` は true を 1 として読んでしまうので、
// 真偽を数として読まないよう分けて確かめる（TS の typeof v === 'number' に合わせる）
func numberValue(_ value: Any?) -> Double? {
    guard let value, !isBoolean(value) else { return nil }
    if let number = value as? NSNumber { return number.doubleValue }
    return nil
}

// 数で、かつ小数を持たないもの（TS の Number.isInteger）
func integerValue(_ value: Any?) -> Int? {
    guard let number = numberValue(value), number.isFinite, number.rounded() == number,
          let integer = Int(exactly: number) else { return nil }
    return integer
}

// 時刻として読める数（TS の Number.isFinite）。ルールで整数しか書けないので、小数は切り捨てて読む
func timestampValue(_ value: Any?) -> Int? {
    guard let number = numberValue(value), number.isFinite, abs(number) < 9.0e15 else { return nil }
    return Int(number)
}

func booleanValue(_ value: Any?) -> Bool? {
    guard let value, isBoolean(value) else { return nil }
    return (value as? NSNumber)?.boolValue
}

// `value is Bool` は NSNumber の 1 も真偽と見なすので使わない。Swift の Bool も NSNumber にすると CFBoolean になる
func isBoolean(_ value: Any) -> Bool {
    guard let number = value as? NSNumber else { return false }
    return CFGetTypeID(number) == CFBooleanGetTypeID()
}

// null（NSNull）か、キーが無い
func isNullOrMissing(_ value: Any?) -> Bool {
    value == nil || value is NSNull
}
