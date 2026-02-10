# 他のActivityWatch Watcherとの比較

## 概要

ActivityWatchの他のwatcherがどのように実装されているかを調査し、aw-watcher-vscodeとの違いを明らかにします。

## aw-watcher-window（ウィンドウwatcher）

### 実装方式: ハイブリッド（イベント + ポーリング）

[PR #95](https://github.com/ActivityWatch/aw-watcher-window/pull/95)で、macOS向けにハイブリッドポーリング方式が追加されました。

### ポーリング間隔

```
Timer scheduled with a 10.0 second time interval
to call the pollActiveWindow method
```

**10秒間隔**でポーリングを実行します。

### 理由

> Fixes bugs where if the starting/ending event is missed, and would've created a long continuous event, that period of time would be lost.

「イベントを見逃した場合に、長い連続イベントの期間が失われてしまうバグを修正」

### アーキテクチャ

- **イベントベース**: OS のウィンドウ切り替えイベントを監視
- **ポーリング**: 10秒ごとにアクティブウィンドウをチェック
- **補完関係**: イベントを見逃した場合のバックアップとしてポーリングが機能

## aw-watcher-input（入力watcher）

### 設定可能なポーリング間隔

[Commit e012b51](https://github.com/ActivityWatch/aw-watcher-input/commit/e012b51)より：

- `--poll-time`パラメータで間隔を指定可能
- デフォルト: **5秒**（後に変更）

### 実装

```python
poll_time = 1  # seconds
```

キーボードやマウスの入力を監視し、一定間隔でチェックします。

## aw-watcher-vscode（VSCode watcher）

### 実装方式: イベント駆動のみ

```typescript
window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
```

**ポーリング無し**。イベント発火時のみ動作します。

## 比較表

| Watcher | 方式 | ポーリング間隔 | 理由 |
|---------|------|----------------|------|
| aw-watcher-window | ハイブリッド | 10秒 | イベント見逃しの防止 |
| aw-watcher-input | ポーリング | 5秒（デフォルト） | 入力活動の継続的監視 |
| aw-watcher-afk | ポーリング | 設定可能 | アイドル状態の検出 |
| **aw-watcher-vscode** | **イベント駆動のみ** | **無し** | **バッテリー効率？** |

## なぜVSCode watcherだけポーリングが無いのか？

### 推測される理由

1. **拡張機能としての配慮**
   - VSCodeはユーザーのマシン上で動作
   - バッテリー駆動のノートPCを考慮
   - 定期的なポーリングはリソースを消費

2. **VSCodeのリッチなイベントシステム**
   - VSCode APIには豊富なイベントがある
   - イベントを追加すれば対応できるという考え
   - メンテナーもIssue #10で「もっとイベントを追加する」と言及

3. **システムレベルwatcherとの違い**
   - aw-watcher-windowは常に動作（OS全体を監視）
   - aw-watcher-vscodeはVSCodeが動いている時だけ
   - 性質が異なるため、アプローチも異なる

### しかし、問題は残る

- イベント駆動だけでは、実際の作業時間の約50%しか記録できていない
- ユーザーが「作業している」と感じている時間が記録されない
- 特に現代の開発スタイル（AIチャット、コードレビュー、ドキュメント閲覧）では問題

## 結論

他のActivityWatch watcherは**ポーリングを使用**しているのに対し、aw-watcher-vscodeだけが**イベント駆動のみ**です。

これは意図的な設計判断と思われますが、実用上は問題があることがIssueやユーザーレポートから明らかになっています。

### 推奨される改善策

1. **ハイブリッドアプローチ**: イベント + ポーリング（他のwatcherと同様）
2. **設定可能**: ユーザーがポーリングのオン/オフを選択
3. **バッテリー検出**: AC電源時のみポーリング（後述）
