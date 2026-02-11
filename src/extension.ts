// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below

import { hostname } from "node:os"
import { AWClient, type IAppEditorEvent } from "aw-client"
import {
  commands,
  Disposable,
  type Extension,
  type ExtensionContext,
  env,
  extensions,
  type Uri,
  window,
  workspace,
} from "vscode"
import type { API, GitExtension } from "./git"

// アプリ名をバケット名用の省略形に変換
function getAppShortName(appName: string): string {
  // ユーザー設定の bucketSuffix を確認
  const config = workspace.getConfiguration("aw-watcher-vscode")
  const bucketSuffix = config.get<string>("bucketSuffix")

  // bucketSuffix が設定されていればそれを優先
  if (bucketSuffix && bucketSuffix.trim() !== "") {
    return bucketSuffix
  }

  // デフォルトマッピング
  const defaultMapping: Record<string, string> = {
    "Visual Studio Code": "vscode",
    "Visual Studio Code - Insiders": "vscode-insiders",
    Cursor: "cursor",
    Windsurf: "windsurf",
    Antigravity: "antigravity",
  }

  // 優先順位: デフォルト > 自動変換
  return defaultMapping[appName] || appName.toLowerCase().replace(/\s+/g, "-")
}

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "ActivityWatch" is now active!')

  // Init ActivityWatch
  const controller = new ActivityWatch()
  controller.init()
  context.subscriptions.push(controller)

  // Command:Reload
  const reloadCommand = commands.registerCommand("extension.reload", () =>
    controller.init()
  )
  context.subscriptions.push(reloadCommand)

  // Command:Show App Name
  const showAppNameCommand = commands.registerCommand(
    "extension.showAppName",
    () => {
      const appName = env.appName
      const shortName = getAppShortName(appName)
      window.showInformationMessage(
        `App Name: "${appName}"\nBucket suffix: "${shortName}"`
      )
    }
  )
  context.subscriptions.push(showAppNameCommand)
}

export class ActivityWatch {
  private readonly _disposable: Disposable
  private readonly _client: AWClient
  private _git: API | undefined

  // Bucket info
  private readonly _bucket: {
    id: string
    hostName: string
    clientName: string
    eventType: string
  }
  private _bucketCreated = false

  // Heartbeat handling
  private readonly _pulseTime = 20
  private _maxHeartbeatsPerSec = 1
  private _lastFilePath = ""
  private _lastHeartbeatTime = 0 // Date.getTime()
  private _lastBranch = ""

  constructor() {
    const appShortName = getAppShortName(env.appName)
    this._bucket = {
      id: "",
      hostName: hostname(),
      clientName: `aw-watcher-vscode-${appShortName}`,
      eventType: "app.editor.activity",
    }
    this._bucket.id = `${this._bucket.clientName}_${this._bucket.hostName}`

    // Create AWClient
    this._client = new AWClient(this._bucket.clientName, { testing: false })

    // subscribe to VS Code Events
    const subscriptions: Disposable[] = []
    window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions)
    window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions)
    this._disposable = Disposable.from(...subscriptions)
  }

  public init() {
    // Create new Bucket (if not existing)
    this._client
      .ensureBucket(
        this._bucket.id,
        this._bucket.eventType,
        this._bucket.hostName
      )
      .then((res: { alreadyExist: boolean }) => {
        if (res.alreadyExist) {
          console.log("Bucket already exists")
        } else {
          console.log("Created Bucket")
        }
        this._bucketCreated = true
      })
      .catch((err: unknown) => {
        this._handleError(
          "Couldn't create Bucket. Please make sure the server is running properly and then run the [Reload ActivityWatch] command.",
          true
        )
        this._bucketCreated = false
        console.error(err)
      })
    this.initGit().then((res: API) => {
      this._git = res
    })
    this.loadConfigurations()
  }

  private async initGit() {
    const extension = extensions.getExtension(
      "vscode.git"
    ) as Extension<GitExtension>
    const gitExtension = extension.isActive
      ? extension.exports
      : await extension.activate()
    return gitExtension.getAPI(1)
  }

  public loadConfigurations() {
    const extConfigurations = workspace.getConfiguration("aw-watcher-vscode")
    const maxHeartbeatsPerSec = extConfigurations.get("maxHeartbeatsPerSec")
    if (maxHeartbeatsPerSec) {
      this._maxHeartbeatsPerSec = maxHeartbeatsPerSec as number
    }
  }

  public dispose() {
    this._disposable.dispose()
  }

  // テスト可能にするためpublicに変更
  public _onEvent() {
    if (!this._bucketCreated) {
      return
    }

    // Create and send heartbeat
    try {
      const heartbeat = this._createHeartbeat()
      const filePath = this._getFilePath()
      const curTime = Date.now()
      const branch = this._getCurrentBranch()

      // Send heartbeat if file changed, branch changed or enough time passed
      if (
        filePath !== this._lastFilePath ||
        branch !== this._lastBranch ||
        this._lastHeartbeatTime + 1000 / this._maxHeartbeatsPerSec < curTime
      ) {
        this._lastFilePath = filePath || "unknown"
        this._lastBranch = branch || "unknown"
        this._lastHeartbeatTime = curTime
        this._sendHeartbeat(heartbeat)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      this._handleError(errorMessage)
    }
  }

  public _sendHeartbeat(event: IAppEditorEvent) {
    return this._client
      .heartbeat(this._bucket.id, this._pulseTime, event)
      .then(() => console.log("Sent heartbeat", event))
      .catch(({ err }: { err: unknown }) => {
        console.error("sendHeartbeat error: ", err)
        this._handleError("Error while sending heartbeat", true)
      })
  }

  private _createHeartbeat(): IAppEditorEvent {
    return {
      timestamp: new Date(),
      duration: 0,
      data: {
        language: this._getFileLanguage() || "unknown",
        project: this._getProjectFolder() || "unknown",
        file: this._getFilePath() || "unknown",
        branch: this._getCurrentBranch() || "unknown",
      },
    }
  }

  private _getProjectFolder(): string | undefined {
    const fileUri = this._getActiveFileUri()
    if (!fileUri) {
      return
    }
    const workspaceFolder = workspace.getWorkspaceFolder(fileUri)
    if (!workspaceFolder) {
      return
    }

    return workspaceFolder.uri.path
  }

  private _getActiveFileUri(): Uri | undefined {
    const editor = window.activeTextEditor
    if (!editor) {
      return
    }

    return editor.document.uri
  }

  private _getFilePath(): string | undefined {
    const editor = window.activeTextEditor
    if (!editor) {
      return
    }

    return editor.document.fileName
  }

  private _getFileLanguage(): string | undefined {
    const editor = window.activeTextEditor
    if (!editor) {
      return
    }

    return editor.document.languageId
  }

  private _getCurrentBranch(): string | undefined {
    if (this._git === undefined) {
      return
    }
    return this._git.repositories[0]?.state?.HEAD?.name
  }

  private _handleError(err: string, isCritical = false): undefined {
    if (isCritical) {
      console.error("[ActivityWatch][handleError]", err)
      window.showErrorMessage(`[ActivityWatch] ${err}`)
    } else {
      console.warn("[AcitivtyWatch][handleError]", err)
    }
    return
  }
}
