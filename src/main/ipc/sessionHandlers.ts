import { ipcMain } from 'electron'
import { IPC, type SessionHistoryEntryMeta } from '@shared/types'
import {
  loadSessionBuffer,
  pruneSessionBuffers,
  saveSessionBuffer
} from '../store/sessionBufferStore'
import {
  appendHistoryEntry,
  listHistoryEntries,
  pruneOrphanHistory,
  readHistoryEntry
} from '../store/sessionHistoryStore'

/** Aşama 11: pane ekran içeriğinin diske kaydedilip/yüklenmesi ("kaldığın yerden devam et"). */
export function registerSessionHandlers(): void {
  ipcMain.on(IPC.SESSION_SAVE_BUFFER, (_event, paneId: string, data: string) => {
    saveSessionBuffer(paneId, data)
  })

  ipcMain.handle(IPC.SESSION_LOAD_BUFFER, (_event, paneId: string): string | null => {
    return loadSessionBuffer(paneId)
  })

  ipcMain.on(IPC.SESSION_PRUNE, (_event, keepPaneIds: string[]) => {
    pruneSessionBuffers(keepPaneIds)
    pruneOrphanHistory(keepPaneIds)
  })

  // Aşama 14: tam oturum kaydı/replay.
  ipcMain.on(IPC.SESSION_APPEND_HISTORY, (_event, paneId: string, data: string) => {
    appendHistoryEntry(paneId, data)
  })

  ipcMain.handle(IPC.SESSION_LIST_HISTORY, (_event, paneId: string): SessionHistoryEntryMeta[] => {
    return listHistoryEntries(paneId)
  })

  ipcMain.handle(
    IPC.SESSION_READ_HISTORY_ENTRY,
    (_event, paneId: string, index: number): string | null => {
      return readHistoryEntry(paneId, index)
    }
  )
}
