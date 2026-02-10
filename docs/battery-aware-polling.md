# バッテリー状態を考慮したポーリング

## 概要

ポーリングはバッテリーを消費するため、AC電源時のみポーリングを有効化し、バッテリー駆動時は無効化する実装を提案します。

## 既存の実装例

[vscode-battery-indicator](https://github.com/fbosch/vscode-battery-indicator)という拡張機能が、バッテリー状態の検出を実装しています。

### 使用しているnpmパッケージ

```json
{
  "is-charging": "^2.0.0",      // 充電中かどうか
  "node-power-info": "^1.0.6",  // Unix系でバッテリー情報
  "execa": "^1.0.0"             // Windowsでコマンド実行
}
```

### 実装方法

```typescript
import * as isCharging from 'is-charging'
import * as powerInfo from 'node-power-info'
import * as execa from 'execa'

// Unix系（macOS, Linux）
const getUnixPowerInfo = () => new Promise(resolve => {
    powerInfo.getChargeStatus(batteryStats => {
        const [ stats ] = batteryStats
        resolve(stats.powerLevel)
    })
})

// Windows
const getWindowsPowerInfo = () => new Promise((resolve, reject) => {
    execa.stdout('WMIC', ['Path', 'Win32_Battery', 'Get', 'EstimatedChargeRemaining'])
        .then(stdout => {
            if (!stdout) reject(new Error('No battery could be found'))
            const powerLevel = parseFloat(stdout.trim().split('\n')[1])
            const normalizedPowerLevel = Math.round(powerLevel > 100 ? 100 : powerLevel) * 100
            resolve(normalizedPowerLevel)
        })
})

// 充電状態の確認
const charging = await isCharging()
```

## 提案する実装

### 1. 依存関係の追加

```json
{
  "dependencies": {
    "axios": "^0.21.1",
    "is-charging": "^2.0.0"
  }
}
```

### 2. ActivityWatchクラスの拡張

```typescript
import * as isCharging from 'is-charging';

class ActivityWatch {
    private _pollingInterval: NodeJS.Timer | undefined;
    private _pollingEnabled: boolean = false;
    private _isCharging: boolean = false;

    public async init() {
        // 既存の初期化...
        await this.setupBatteryAwarePolling();
    }

    private async setupBatteryAwarePolling() {
        // 設定を読み込む
        const config = workspace.getConfiguration('aw-watcher-vscode');
        const pollingMode = config.get<string>('polling.mode', 'onACPower');
        const pollingInterval = config.get<number>('polling.interval', 10) * 1000;

        // ポーリングモードに応じて初期化
        switch (pollingMode) {
            case 'always':
                this._pollingEnabled = true;
                this.startPolling(pollingInterval);
                break;

            case 'never':
                this._pollingEnabled = false;
                break;

            case 'onACPower':
                // バッテリー状態を確認
                try {
                    this._isCharging = await isCharging();
                    this._pollingEnabled = this._isCharging;

                    if (this._isCharging) {
                        this.startPolling(pollingInterval);
                    }

                    // 5分ごとにバッテリー状態をチェック
                    setInterval(async () => {
                        await this.checkBatteryStatus(pollingInterval);
                    }, 300000); // 5分
                } catch (err) {
                    console.warn('[ActivityWatch] Failed to detect battery status, disabling polling:', err);
                    this._pollingEnabled = false;
                }
                break;
        }
    }

    private async checkBatteryStatus(pollingInterval: number) {
        try {
            const nowCharging = await isCharging();

            if (nowCharging !== this._isCharging) {
                this._isCharging = nowCharging;
                this._pollingEnabled = nowCharging;

                if (nowCharging) {
                    console.log('[ActivityWatch] AC power detected, enabling polling');
                    this.startPolling(pollingInterval);
                } else {
                    console.log('[ActivityWatch] Battery power detected, disabling polling');
                    this.stopPolling();
                }
            }
        } catch (err) {
            console.warn('[ActivityWatch] Failed to check battery status:', err);
        }
    }

    private startPolling(interval: number) {
        if (this._pollingInterval) {
            return; // 既に動作中
        }

        console.log(`[ActivityWatch] Starting polling with ${interval}ms interval`);

        this._pollingInterval = setInterval(() => {
            // VSCodeウィンドウがフォーカスされている場合のみ送信
            if (window.state.focused) {
                const heartbeat = this._createHeartbeat();
                const curTime = new Date().getTime();

                // レート制限を確認
                if (this._lastHeartbeatTime + (1000 / this._maxHeartbeatsPerSec) < curTime) {
                    this._lastHeartbeatTime = curTime;
                    this._sendHeartbeat(heartbeat);
                }
            }
        }, interval);
    }

    private stopPolling() {
        if (this._pollingInterval) {
            console.log('[ActivityWatch] Stopping polling');
            clearInterval(this._pollingInterval);
            this._pollingInterval = undefined;
        }
    }

    public dispose() {
        this.stopPolling();
        this._disposable.dispose();
    }
}
```

### 3. 設定の追加（package.json）

```json
{
  "contributes": {
    "configuration": {
      "type": "object",
      "title": "aw-watcher-vscode extension configuration",
      "properties": {
        "aw-watcher-vscode.maxHeartbeatsPerSec": {
          "type": "number",
          "default": 1,
          "description": "Controls the maximum number of heartbeats sent per second."
        },
        "aw-watcher-vscode.polling.mode": {
          "type": "string",
          "enum": ["always", "never", "onACPower"],
          "enumDescriptions": [
            "Always use polling (may affect battery life)",
            "Never use polling (event-driven only)",
            "Use polling only when on AC power (recommended)"
          ],
          "default": "onACPower",
          "description": "Controls when to use periodic polling for activity tracking."
        },
        "aw-watcher-vscode.polling.interval": {
          "type": "number",
          "default": 10,
          "minimum": 5,
          "maximum": 60,
          "description": "Polling interval in seconds (when polling is enabled)."
        }
      }
    }
  }
}
```

## 動作フロー

```
起動時:
  ├─ 設定を読み込む (polling.mode)
  ├─ mode = "always"
  │   └─ ポーリング開始
  ├─ mode = "never"
  │   └─ イベント駆動のみ
  └─ mode = "onACPower" (デフォルト)
      ├─ バッテリー状態をチェック
      ├─ AC電源/充電中 → ポーリング開始
      ├─ バッテリー駆動 → イベント駆動のみ
      └─ 5分ごとに状態をチェック
          ├─ AC電源に変更 → ポーリング開始
          └─ バッテリーに変更 → ポーリング停止
```

## ポーリング時の動作

```typescript
10秒ごと: (設定で変更可能)
  ├─ VSCodeがフォーカスされている？
  │   ├─ Yes:
  │   │   ├─ ハートビートを作成
  │   │   ├─ レート制限をチェック
  │   │   └─ 送信
  │   └─ No:
  │       └─ 何もしない
```

## メリット

### ユーザー視点

- ✅ **AC電源時**: 完全な追跡（AIチャット、読書時間も記録）
- ✅ **バッテリー駆動時**: バッテリー節約（イベント駆動のみ）
- ✅ **柔軟な設定**: 常時/無効/自動を選択可能

### 実装視点

- ✅ **軽量**: 10秒間隔のチェックのみ（ウィンドウがフォーカスされている時のみ送信）
- ✅ **既存コードとの互換性**: イベント駆動部分はそのまま
- ✅ **設定可能**: ユーザーの好みに応じて調整可能

## デメリットと対策

### バッテリー検出の失敗

**問題**: `is-charging`が一部の環境で動作しない可能性

**対策**:
- エラーをキャッチして、フォールバックとして無効化
- ログに警告を出力
- 設定で明示的に"always"や"never"を選択可能

### ポーリング間隔の調整

**問題**: 10秒は適切か？

**考慮点**:
- aw-watcher-window: 10秒
- aw-watcher-input: 5秒（初期）
- トレードオフ: 短い = 正確 / 長い = 効率的

**対策**:
- デフォルト10秒（他のwatcherと同様）
- 設定で5-60秒の範囲で調整可能

## テスト計画

1. **AC電源テスト**
   - AC電源接続 → ポーリング有効を確認
   - AIチャット中の記録を確認

2. **バッテリーテスト**
   - バッテリー駆動 → ポーリング無効を確認
   - イベント駆動のみで動作を確認

3. **切り替えテスト**
   - 実行中にAC電源を抜く → ポーリング停止
   - 実行中にAC電源を接続 → ポーリング開始

4. **設定テスト**
   - "always" → 常にポーリング
   - "never" → ポーリング無し
   - "onACPower" → バッテリー状態に応じて切り替え

## 参考リンク

- [is-charging - npm](https://www.npmjs.com/package/is-charging)
- [node-power-info - npm](https://www.npmjs.com/package/node-power-info)
- [vscode-battery-indicator](https://github.com/fbosch/vscode-battery-indicator)
