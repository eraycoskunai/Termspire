import { ipcMain, dialog, shell, type BrowserWindow } from 'electron'
import { IPC, type AvailableShellInfo, type NotificationPayload } from '@shared/types'
import { detectAvailableShells } from '../pty/shellResolver'
import { showNotification } from '../notifications'

export function registerSystemHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.SHELLS_DETECT, (): AvailableShellInfo[] => detectAvailableShells())

  // Aşama 16: "web" pane'lerinden ("harici tarayıcıda aç") çağrılır.
  ipcMain.handle(IPC.SYSTEM_OPEN_EXTERNAL, async (_event, url: string): Promise<boolean> => {
    if (!/^https?:\/\//i.test(url)) return false
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle(IPC.DIALOG_CHOOSE_DIRECTORY, async (): Promise<string | null> => {
    const window = getWindow()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      title: 'Başlangıç dizini seç'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.on(IPC.NOTIFICATION_SHOW, (_event, payload: NotificationPayload) => {
    showNotification(payload.title, payload.body)
  })
}
