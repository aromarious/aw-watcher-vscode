# 現在の実装の分析

## 概要

aw-watcher-vscodeは、ActivityWatchのVSCode拡張機能で、エディタでの活動を記録します。このドキュメントでは、現在の実装の仕組みと問題点を分析します。

## `_onEvent`関数の役割

### 場所
- ファイル: [`src/extension.ts:101-125`](../src/extension.ts#L101-L125)

### 登録されているイベント

```typescript
window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
```

この**2つのイベントのみ**が登録されています。

### 動作

`_onEvent`は以下の条件でハートビートを送信します：

1. **ファイルが変更された** (`filePath !== this._lastFilePath`)
2. **Gitブランチが変更された** (`branch !== this._lastBranch`)
3. **一定時間が経過した** (`this._lastHeartbeatTime + (1000 / this._maxHeartbeatsPerSec) < curTime`)

デフォルトでは`maxHeartbeatsPerSec = 1`なので、**1秒間隔**で送信可能です。

### 重要な制約

⚠️ **時間経過の条件は、イベントが発生した時にのみチェックされます**

つまり：
- ✅ カーソルを動かす → イベント発火 → 時間チェック → 送信
- ❌ 何も操作しない → イベント発火しない → 送信されない

## 記録される活動 vs 記録されない活動

### ✅ 記録される活動

- カーソル移動
- テキスト選択
- ファイルタブの切り替え
- エディタを開く/閉じる

### ❌ 記録されない活動

1. **スクロールして読んでいる**
   - マウスホイールでスクロール
   - Page Up/Down でスクロール
   - 選択範囲が変わらないため、`onDidChangeTextEditorSelection`は発火しない

2. **AIとチャット中**
   - Claude Code、GitHub Copilot Chatなどのチャットパネル
   - Webviewとして実装されており、TextDocumentではない
   - 専用のイベントが無い

3. **ターミナルで作業中**
   - 現在のバージョンではターミナルイベントが未実装
   - PR #44で追加予定

4. **デバッグパネルを見ている**
   - デバッグコンソール、変数、ウォッチ式など
   - TextDocumentではない

5. **その他のパネル**
   - Output、Problems、拡張機能パネルなど
   - これらもTextDocumentではない

6. **ファイルを開いたまま読んでいる**
   - カーソルを動かさない場合
   - イベントが発火しない

## 実測データ

Issue #10より、実際のユーザーデータ：

- **aw-watcher-window**: 1時間41分（101分）
- **aw-watcher-vscode**: 51分

**約50%しか記録されていない**という結果が報告されています。

## メンテナーの見解（2020年3月）

メンテナーjohan-bjareはIssue #10で以下のように述べています：

> The pulsetime looks good, the frequency is very often so my first guess would be that our emitters are not good enough and need to be more varied for more types of actions within vscode.

「イベントemittersが十分ではない。より多様なアクションに対応する必要がある」

### ActivityWatchの哲学

> To us (ActivityWatch devs) it means time spent using your editor. If you read code inside your editor that should count (and probably will as you usually move your cursor)

「エディタを使っている時間として定義。コードを読んでいる時も記録すべき（カーソルを動かすだろうから）」

しかし、実際にはカーソルを動かさずに読んでいる時間が多く存在します。

## 技術的な原因

### イベント駆動アーキテクチャの限界

現在の実装は**完全にイベント駆動**です：

```typescript
// イベント発生時にのみ実行される
window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
```

イベントが発生しない = `_onEvent`が呼ばれない = ハートビートが送信されない

### 時間経過チェックの問題

時間経過の条件は存在しますが：

```typescript
if (this._lastHeartbeatTime + (1000 / this._maxHeartbeatsPerSec) < curTime) {
    // 送信
}
```

この条件チェックは**イベント発生時にのみ実行**されます。定期的なポーリングは行われていません。

## まとめ

現在の実装は：
- ✅ バッテリー効率が良い（イベント駆動）
- ✅ VSCode拡張機能として軽量
- ❌ 多くの実際の作業が記録されない
- ❌ 実測で約50%の記録漏れ

改善には、より多くのイベントの追加、またはポーリング方式の導入が必要です。
