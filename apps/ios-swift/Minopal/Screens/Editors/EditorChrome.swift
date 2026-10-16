import MinopalCore
import SwiftUI

// 設定から奥へ進む、直す画面（No.161）。iPad は設定の上に重ね、iPhone は設定・お店タブの奥に進む
enum EditorRoute: Hashable {
    case layout
    case course(String?)   // nil は新しいコースを足す
}

struct EditorDestination: View {
    let route: EditorRoute
    let state: ShopState

    var body: some View {
        switch route {
        case .layout:
            LayoutEditorView(layout: state.layout, occupied: state.occupiedSeats) { layout in
                try await state.services.layout.save(layout, rules: state.settings.rules)
            }
        case .course(let id):
            CourseEditorView(state: state, courseId: id)
        }
    }
}

// 直す画面の上の段：右に「保存して使う」。直したあとは戻るボタンを「もどる」に替え、押すと保存せずにもどるかを確かめる
// （指で端からスワイプして戻ることもできなくなる）。showsBack が false（iPad でサイドバーから開いたとき）は戻るボタンが無い
struct EditorToolbar: ViewModifier {
    let changed: Bool
    let canSave: Bool
    let saving: Bool
    var showsBack = true
    let onSave: () -> Void
    let onBack: () -> Void
    @State private var confirming = false

    func body(content: Content) -> some View {
        content
            .navigationBarBackButtonHidden(showsBack && changed)
            .toolbar {
                if showsBack && changed {
                    ToolbarItem(placement: .topBarLeading) {
                        Button { confirming = true } label: {
                            Label("もどる", systemImage: "chevron.backward").labelStyle(.titleAndIcon)
                        }
                        .accessibilityIdentifier("editor-back")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if saving {
                        ProgressView().accessibilityLabel("保存しています")
                    } else {
                        Button("保存して使う", action: onSave)
                            .fontWeight(.bold)
                            .disabled(!canSave)
                            .accessibilityIdentifier("editor-save")
                    }
                }
            }
            .alert("保存せずにもどりますか？", isPresented: $confirming) {
                Button("直し続ける", role: .cancel) {}
                Button("保存せずにもどる", role: .destructive, action: onBack)
            } message: {
                Text("直したところは消えます。")
            }
    }
}

// 直す画面の下に出す、直すところ・保存したときのこと（読み上げは変わるたびに読む）
struct EditorStatus: View {
    let text: String

    var body: some View {
        Text(text)
            .minopalFont(14, relativeTo: .footnote)
            .foregroundStyle(Palette.ink2)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, minHeight: 19, alignment: .leading)
            .accessibilityIdentifier("editor-status")
            .accessibilityAddTraits(.updatesFrequently)
    }
}
