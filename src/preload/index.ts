import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IPC,
  type AvailableShellInfo,
  type FsImportResult,
  type FsListResult,
  type FsOpResult,
  type FsReadDataUrlResult,
  type FsReadTextResult,
  type GitShowHeadResult,
  type GitStatusResult,
  type NotificationPayload,
  type PersistedAppState,
  type Preset,
  type PtyCreateOptions,
  type PtyCreateResult,
  type PtyDataPayload,
  type PtyExitPayload,
  type PtyReattachResult,
  type PtyUsage,
  type SessionHistoryEntryMeta,
  type SysInfoSnapshot
} from '@shared/types'

type UnsubscribeFn = () => void

const api = {
  appVersion: electronAPI.process.versions.electron,
  pty: {
    create: (id: string, options: PtyCreateOptions): Promise<PtyCreateResult> =>
      ipcRenderer.invoke(IPC.PTY_CREATE, id, options),
    write: (id: string, data: string): void => {
      ipcRenderer.send(IPC.PTY_WRITE, id, data)
    },
    resize: (id: string, cols: number, rows: number): void => {
      ipcRenderer.send(IPC.PTY_RESIZE, id, cols, rows)
    },
    kill: (id: string): void => {
      ipcRenderer.send(IPC.PTY_KILL, id)
    },
    onData: (callback: (payload: PtyDataPayload) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: PtyDataPayload): void =>
        callback(payload)
      ipcRenderer.on(IPC.PTY_DATA, listener)
      return () => ipcRenderer.removeListener(IPC.PTY_DATA, listener)
    },
    onExit: (callback: (payload: PtyExitPayload) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: PtyExitPayload): void =>
        callback(payload)
      ipcRenderer.on(IPC.PTY_EXIT, listener)
      return () => ipcRenderer.removeListener(IPC.PTY_EXIT, listener)
    },
    getUsage: (id: string): Promise<PtyUsage | null> => ipcRenderer.invoke(IPC.PTY_USAGE, id),
    detach: (id: string): void => {
      ipcRenderer.send(IPC.PTY_DETACH, id)
    },
    reattach: (id: string): Promise<PtyReattachResult> => ipcRenderer.invoke(IPC.PTY_REATTACH, id)
  },
  system: {
    detectShells: (): Promise<AvailableShellInfo[]> => ipcRenderer.invoke(IPC.SHELLS_DETECT),
    chooseDirectory: (): Promise<string | null> => ipcRenderer.invoke(IPC.DIALOG_CHOOSE_DIRECTORY),
    openExternal: (url: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SYSTEM_OPEN_EXTERNAL, url)
  },
  sysInfo: {
    // Aşama 16: sistem bilgisi paneli — anlık CPU/RAM/disk görüntüsü.
    get: (): Promise<SysInfoSnapshot> => ipcRenderer.invoke(IPC.SYS_INFO)
  },
  notifications: {
    show: (payload: NotificationPayload): void => {
      ipcRenderer.send(IPC.NOTIFICATION_SHOW, payload)
    }
  },
  config: {
    load: (): Promise<PersistedAppState | null> => ipcRenderer.invoke(IPC.CONFIG_LOAD),
    save: (state: PersistedAppState): void => {
      ipcRenderer.send(IPC.CONFIG_SAVE, state)
    }
  },
  presets: {
    load: (): Promise<Preset[]> => ipcRenderer.invoke(IPC.PRESETS_LOAD),
    save: (presets: Preset[]): void => {
      ipcRenderer.send(IPC.PRESETS_SAVE, presets)
    }
  },
  session: {
    saveBuffer: (paneId: string, data: string): void => {
      ipcRenderer.send(IPC.SESSION_SAVE_BUFFER, paneId, data)
    },
    loadBuffer: (paneId: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.SESSION_LOAD_BUFFER, paneId),
    pruneOrphans: (keepPaneIds: string[]): void => {
      ipcRenderer.send(IPC.SESSION_PRUNE, keepPaneIds)
    },
    // Aşama 14: tam oturum kaydı/replay.
    appendHistory: (paneId: string, data: string): void => {
      ipcRenderer.send(IPC.SESSION_APPEND_HISTORY, paneId, data)
    },
    listHistory: (paneId: string): Promise<SessionHistoryEntryMeta[]> =>
      ipcRenderer.invoke(IPC.SESSION_LIST_HISTORY, paneId),
    readHistoryEntry: (paneId: string, index: number): Promise<string | null> =>
      ipcRenderer.invoke(IPC.SESSION_READ_HISTORY_ENTRY, paneId, index)
  },
  appLifecycle: {
    onBeforeQuit: (callback: () => void): UnsubscribeFn => {
      const listener = (): void => callback()
      ipcRenderer.on(IPC.APP_BEFORE_QUIT, listener)
      return () => ipcRenderer.removeListener(IPC.APP_BEFORE_QUIT, listener)
    }
  },
  fs: {
    homeDir: (): Promise<string> => ipcRenderer.invoke(IPC.FS_HOME_DIR),
    list: (dirPath: string): Promise<FsListResult | { error: string }> =>
      ipcRenderer.invoke(IPC.FS_LIST, dirPath),
    createFolder: (dirPath: string, name: string): Promise<FsOpResult> =>
      ipcRenderer.invoke(IPC.FS_CREATE_FOLDER, dirPath, name),
    createFile: (dirPath: string, name: string): Promise<FsOpResult> =>
      ipcRenderer.invoke(IPC.FS_CREATE_FILE, dirPath, name),
    rename: (dirPath: string, oldName: string, newName: string): Promise<FsOpResult> =>
      ipcRenderer.invoke(IPC.FS_RENAME, dirPath, oldName, newName),
    delete: (dirPath: string, name: string): Promise<FsOpResult> =>
      ipcRenderer.invoke(IPC.FS_DELETE, dirPath, name),
    importPaths: (destDir: string, sourcePaths: string[]): Promise<FsImportResult> =>
      ipcRenderer.invoke(IPC.FS_IMPORT_PATHS, destDir, sourcePaths),
    openPath: (targetPath: string): Promise<FsOpResult> =>
      ipcRenderer.invoke(IPC.FS_OPEN_PATH, targetPath),
    reveal: (targetPath: string): Promise<FsOpResult> =>
      ipcRenderer.invoke(IPC.FS_REVEAL, targetPath),
    // Electron 32+: sürükle-bırak edilen OS dosyalarının gerçek disk yolunu
    // almanın standart yolu (eski File.path artık kaldırıldı).
    getDroppedPath: (file: File): string => webUtils.getPathForFile(file),
    // Aşama 13: dosya paneli içi editör/önizleme.
    readTextFile: (filePath: string): Promise<FsReadTextResult> =>
      ipcRenderer.invoke(IPC.FS_READ_TEXT_FILE, filePath),
    readDataUrl: (filePath: string): Promise<FsReadDataUrlResult> =>
      ipcRenderer.invoke(IPC.FS_READ_DATA_URL, filePath),
    writeTextFile: (filePath: string, content: string): Promise<FsOpResult> =>
      ipcRenderer.invoke(IPC.FS_WRITE_TEXT_FILE, filePath, content)
  },
  git: {
    // Aşama 14: git-farkında dosya paneli — durum rozetleri + editör diff modu.
    status: (dirPath: string): Promise<GitStatusResult> =>
      ipcRenderer.invoke(IPC.GIT_STATUS, dirPath),
    showHead: (filePath: string): Promise<GitShowHeadResult> =>
      ipcRenderer.invoke(IPC.GIT_SHOW_HEAD, filePath)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}

export type Api = typeof api
