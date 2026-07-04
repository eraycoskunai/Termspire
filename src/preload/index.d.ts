import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AvailableShellInfo,
  FsImportResult,
  FsListResult,
  FsOpResult,
  FsReadDataUrlResult,
  FsReadTextResult,
  GitShowHeadResult,
  GitStatusResult,
  NotificationPayload,
  PersistedAppState,
  Preset,
  PtyCreateOptions,
  PtyCreateResult,
  PtyDataPayload,
  PtyExitPayload,
  PtyReattachResult,
  PtyUsage,
  SessionHistoryEntryMeta,
  SysInfoSnapshot
} from '@shared/types'

export interface PtyApi {
  create: (id: string, options: PtyCreateOptions) => Promise<PtyCreateResult>
  write: (id: string, data: string) => void
  resize: (id: string, cols: number, rows: number) => void
  kill: (id: string) => void
  onData: (callback: (payload: PtyDataPayload) => void) => () => void
  onExit: (callback: (payload: PtyExitPayload) => void) => () => void
  getUsage: (id: string) => Promise<PtyUsage | null>
  detach: (id: string) => void
  reattach: (id: string) => Promise<PtyReattachResult>
}

export interface SystemApi {
  detectShells: () => Promise<AvailableShellInfo[]>
  chooseDirectory: () => Promise<string | null>
  openExternal: (url: string) => Promise<boolean>
}

export interface SysInfoApi {
  get: () => Promise<SysInfoSnapshot>
}

export interface NotificationsApi {
  show: (payload: NotificationPayload) => void
}

export interface ConfigApi {
  load: () => Promise<PersistedAppState | null>
  save: (state: PersistedAppState) => void
}

export interface PresetsApi {
  load: () => Promise<Preset[]>
  save: (presets: Preset[]) => void
}

export interface SessionApi {
  saveBuffer: (paneId: string, data: string) => void
  loadBuffer: (paneId: string) => Promise<string | null>
  pruneOrphans: (keepPaneIds: string[]) => void
  appendHistory: (paneId: string, data: string) => void
  listHistory: (paneId: string) => Promise<SessionHistoryEntryMeta[]>
  readHistoryEntry: (paneId: string, index: number) => Promise<string | null>
}

export interface AppLifecycleApi {
  onBeforeQuit: (callback: () => void) => () => void
}

export interface FsApi {
  homeDir: () => Promise<string>
  list: (dirPath: string) => Promise<FsListResult | { error: string }>
  createFolder: (dirPath: string, name: string) => Promise<FsOpResult>
  createFile: (dirPath: string, name: string) => Promise<FsOpResult>
  rename: (dirPath: string, oldName: string, newName: string) => Promise<FsOpResult>
  delete: (dirPath: string, name: string) => Promise<FsOpResult>
  importPaths: (destDir: string, sourcePaths: string[]) => Promise<FsImportResult>
  openPath: (targetPath: string) => Promise<FsOpResult>
  reveal: (targetPath: string) => Promise<FsOpResult>
  readTextFile: (filePath: string) => Promise<FsReadTextResult>
  readDataUrl: (filePath: string) => Promise<FsReadDataUrlResult>
  writeTextFile: (filePath: string, content: string) => Promise<FsOpResult>
  getDroppedPath: (file: File) => string
}

export interface GitApi {
  status: (dirPath: string) => Promise<GitStatusResult>
  showHead: (filePath: string) => Promise<GitShowHeadResult>
}

export interface AppApi {
  appVersion: string
  pty: PtyApi
  system: SystemApi
  sysInfo: SysInfoApi
  notifications: NotificationsApi
  config: ConfigApi
  presets: PresetsApi
  session: SessionApi
  appLifecycle: AppLifecycleApi
  fs: FsApi
  git: GitApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
