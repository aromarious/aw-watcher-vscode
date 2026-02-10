# 利用可能なVSCode APIイベント

## 概要

VSCode Extension APIで利用可能なイベントを調査し、追加すべきイベントを提案します。

## 現在使用中のイベント（2つのみ）

```typescript
window.onDidChangeTextEditorSelection  // カーソル移動、選択変更
window.onDidChangeActiveTextEditor     // エディタ切り替え
```

## 追加可能なイベント

### 最重要: ウィンドウフォーカス

#### `window.onDidChangeWindowState`

```typescript
export interface WindowState {
    /**
     * Whether the current window is focused.
     */
    readonly focused: boolean;
}

export const onDidChangeWindowState: Event<WindowState>;
```

**重要度: ⭐⭐⭐⭐⭐**

これを追加すれば：
- ✅ VSCodeウィンドウのフォーカス変更を検知
- ✅ Claude Code、Copilot Chatとのチャット中も検知可能
- ✅ 他のパネル（デバッグ、ターミナルなど）の使用も検知

**制限**: フォーカスを切り替えた時にのみ発火。継続的な作業は検知できない。

### エディタ関連イベント

#### `workspace.onDidChangeTextDocument`

```typescript
export const onDidChangeTextDocument: Event<TextDocumentChangeEvent>;
```

**重要度: ⭐⭐⭐⭐**

- テキスト変更（タイピング）を検知
- 実際にコードを書いている時を確実に記録

**制限**: TextDocumentのみ。チャットパネルなどWebviewは対象外。

#### `workspace.onDidSaveTextDocument`

```typescript
export const onDidSaveTextDocument: Event<TextDocument>;
```

**重要度: ⭐⭐⭐**

- ファイル保存を検知
- 作業の区切りとして有用

#### `workspace.onDidOpenTextDocument`

```typescript
export const onDidOpenTextDocument: Event<TextDocument>;
```

**重要度: ⭐⭐**

- ファイルを開いた時を検知

#### `workspace.onDidCloseTextDocument`

```typescript
export const onDidCloseTextDocument: Event<TextDocument>;
```

**重要度: ⭐⭐**

- ファイルを閉じた時を検知

#### `window.onDidChangeVisibleTextEditors`

```typescript
export const onDidChangeVisibleTextEditors: Event<TextEditor[]>;
```

**重要度: ⭐⭐**

- 分割エディタの変更を検知

#### `window.onDidChangeTextEditorVisibleRanges`

```typescript
export const onDidChangeTextEditorVisibleRanges: Event<TextEditorVisibleRangesChangeEvent>;
```

**重要度: ⭐**

- スクロール位置の変更を検知できる可能性
- ただし、パフォーマンスへの影響を考慮する必要あり

### ターミナル関連イベント

#### `window.onDidChangeActiveTerminal`（新しいAPI）

```typescript
export const onDidChangeActiveTerminal: Event<Terminal | undefined>;
```

**重要度: ⭐⭐⭐⭐**

- アクティブなターミナルが変わった時
- [PR #44](https://github.com/ActivityWatch/aw-watcher-vscode/pull/44)で実装予定

#### `window.onDidOpenTerminal`（新しいAPI）

```typescript
export const onDidOpenTerminal: Event<Terminal>;
```

**重要度: ⭐⭐⭐**

- 新しいターミナルが開かれた時
- [PR #44](https://github.com/ActivityWatch/aw-watcher-vscode/pull/44)で実装予定

#### `window.onDidCloseTerminal`

```typescript
export const onDidCloseTerminal: Event<Terminal>;
```

**重要度: ⭐⭐**

- ターミナルが閉じられた時

### デバッグ関連イベント

#### `debug.onDidStartDebugSession`

```typescript
export const onDidStartDebugSession: Event<DebugSession>;
```

**重要度: ⭐⭐⭐**

- デバッグセッション開始を検知

#### `debug.onDidTerminateDebugSession`

```typescript
export const onDidTerminateDebugSession: Event<DebugSession>;
```

**重要度: ⭐⭐⭐**

- デバッグセッション終了を検知

#### `debug.onDidChangeActiveDebugSession`

```typescript
export const onDidChangeActiveDebugSession: Event<DebugSession | undefined>;
```

**重要度: ⭐⭐**

- アクティブなデバッグセッションの変更

#### `debug.onDidChangeBreakpoints`

```typescript
export const onDidChangeBreakpoints: Event<BreakpointsChangeEvent>;
```

**重要度: ⭐⭐**

- ブレークポイントの変更

### ワークスペース関連イベント

#### `workspace.onDidChangeWorkspaceFolders`

```typescript
export const onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;
```

**重要度: ⭐⭐**

- プロジェクトの追加/削除

#### `workspace.onDidChangeConfiguration`

```typescript
export const onDidChangeConfiguration: Event<ConfigurationChangeEvent>;
```

**重要度: ⭐**

- 設定変更（必要に応じて）

## イベント追加の優先順位

### フェーズ1: 最重要（すぐに実装すべき）

1. **`onDidChangeWindowState`** - ウィンドウフォーカス
2. **`onDidChangeTextDocument`** - テキスト変更
3. **`onDidChangeActiveTerminal`** - ターミナル切り替え（PR #44）
4. **`onDidOpenTerminal`** - ターミナルを開く（PR #44）

### フェーズ2: 重要（早期に実装）

5. **`onDidSaveTextDocument`** - ファイル保存
6. **`onDidStartDebugSession`** - デバッグ開始
7. **`onDidTerminateDebugSession`** - デバッグ終了

### フェーズ3: 有用（必要に応じて）

8. `onDidOpenTextDocument` - ファイルを開く
9. `onDidCloseTextDocument` - ファイルを閉じる
10. `onDidChangeVisibleTextEditors` - 分割エディタ
11. その他

## イベント追加の限界

### 検知できない活動

イベントを追加しても、以下は依然として検知できません：

1. **AIチャット中（継続的な会話）**
   - `onDidChangeWindowState`で**フォーカス変更時のみ**検知可能
   - 会話を続けている間は検知されない

2. **スクロールしてコードを読んでいる**
   - `onDidChangeTextEditorVisibleRanges`で検知可能だが、頻繁に発火してパフォーマンス問題の可能性

3. **ファイルを開いたまま読んでいる**
   - カーソルを動かさない場合、イベントが発火しない

4. **デバッグ実行中に結果を見ている**
   - デバッグ開始/終了は検知できるが、実行中の状態は検知しにくい

### 根本的な問題

**イベント駆動だけでは、継続的な活動を完全には捕捉できない**

これらの活動を確実に記録するには：
- 定期的なポーリング
- またはバッテリー状態に応じたハイブリッドアプローチ

が必要です。

## 推奨アプローチ

### 最適解: ハイブリッド方式

```typescript
// 1. 豊富なイベントで即座に反応
window.onDidChangeWindowState(...)
window.onDidChangeTextDocument(...)
// ... その他のイベント

// 2. 軽量なポーリングで補完（10-30秒間隔）
setInterval(() => {
    if (window.state.focused) {
        // VSCodeがアクティブ = 何か作業している
        this._sendHeartbeat(...);
    }
}, 10000);
```

### 利点

- ✅ イベント駆動: 細かい変更を即座に検知（バッテリー効率的）
- ✅ ポーリング: イベントで捕捉できない活動をカバー
- ✅ バランス: 他のActivityWatch watcherと同様のアプローチ
