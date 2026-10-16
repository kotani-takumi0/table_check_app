import MinopalCore
import SwiftUI

// 仮の配置図：Firestore の読み書きを確かめるための画面。空いている卓を押すと2名で案内し、案内中の卓を押すとそのお客さんを消す。
// 卓番は配置を保存していない店のもの（配置を保存した店では、配置に無い卓はルールで断られる）
struct TrialFloorView: View {
    let connection: FirebaseConnection
    let account: String?
    let onLeave: () -> Void
    @State private var repository: SessionRepository

    init(connection: FirebaseConnection, base: ShopBase, account: String?, onLeave: @escaping () -> Void) {
        self.connection = connection
        self.account = account
        self.onLeave = onLeave
        _repository = State(initialValue: SessionRepository(base: base))
    }

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 12)], spacing: 12) {
                ForEach(defaultTableIds, id: \.self) { tableId in
                    let session = repository.sessions.first { $0.tableIds.contains(tableId) }
                    Button { toggle(tableId: tableId, session: session) } label: {
                        TableTile(tableId: tableId, session: session)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("table-\(tableId)")
                    .accessibilityValue(session.map { displayOf($0.status, course: $0.course).label } ?? "空席")
                }
            }
            .padding()
            if let error = repository.lastError {
                Text(error).foregroundStyle(.red).padding(.horizontal)
            }
        }
        .navigationTitle("卓（試し）")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Text(syncLabel).font(.footnote).foregroundStyle(.secondary)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Text(connection.isEmulator ? "エミュレータ（\(connection.projectId)）" : connection.projectId)
                    Text(account ?? "ログインせずに使う")
                    Button("ログアウト", role: .destructive, action: onLeave)
                } label: {
                    Image(systemName: "person.crop.circle")
                        .accessibilityLabel("アカウント")
                }
            }
        }
        .onAppear { repository.start() }
        .onDisappear { repository.stop() }
    }

    private var syncLabel: String {
        switch repository.syncState {
        case .synced: "同期済み"
        case .pending: "送信待ち"
        case .offline: "オフライン"
        }
    }

    private func toggle(tableId: String, session: Session?) {
        if let session {
            repository.remove(id: session.id)
        } else {
            repository.put(newSession(id: UUID().uuidString.lowercased(), tableId: tableId, at: nowMs(), guests: 2))
        }
    }
}

private struct TableTile: View {
    let tableId: String
    let session: Session?

    var body: some View {
        VStack(spacing: 4) {
            Text(tableId).font(.title2.bold())
            Text(session.map { displayOf($0.status, course: $0.course).label } ?? "空席").font(.caption)
            if let guests = session?.guests {
                Text("\(guests)名").font(.caption)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 88)
        .background(session == nil ? Color.secondary.opacity(0.12) : Color.accentColor.opacity(0.2), in: .rect(cornerRadius: 12))
        .contentShape(.rect)
    }
}
