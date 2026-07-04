import { ipcMain } from 'electron'
import {
  IPC,
  type PtyCreateOptions,
  type PtyCreateResult,
  type PtyReattachResult,
  type PtyUsage
} from '@shared/types'
import type { PtyManager } from '../pty/PtyManager'

export function registerPtyHandlers(manager: PtyManager): void {
  ipcMain.handle(
    IPC.PTY_CREATE,
    (_event, id: string, options: PtyCreateOptions): PtyCreateResult => {
      manager.create(id, options)
      return { id }
    }
  )

  ipcMain.on(IPC.PTY_WRITE, (_event, id: string, data: string) => {
    manager.write(id, data)
  })

  ipcMain.on(IPC.PTY_RESIZE, (_event, id: string, cols: number, rows: number) => {
    manager.resize(id, cols, rows)
  })

  ipcMain.on(IPC.PTY_KILL, (_event, id: string) => {
    manager.kill(id)
  })

  ipcMain.handle(IPC.PTY_USAGE, (_event, id: string): Promise<PtyUsage | null> => {
    return manager.getUsage(id)
  })

  ipcMain.on(IPC.PTY_DETACH, (_event, id: string) => {
    manager.detach(id)
  })

  ipcMain.handle(IPC.PTY_REATTACH, (_event, id: string): PtyReattachResult => {
    return manager.reattach(id)
  })
}
