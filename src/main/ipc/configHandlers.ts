import { ipcMain } from 'electron'
import { IPC, type PersistedAppState, type Preset } from '@shared/types'
import { loadAppState, loadPresets, saveAppState, savePresets } from '../store/configStore'

/** Aşama 7/8: workspace/pane yapılandırmasını ve presetleri electron-store'a kaydet/yükle. */
export function registerConfigHandlers(): void {
  ipcMain.handle(IPC.CONFIG_LOAD, (): PersistedAppState | null => loadAppState())

  ipcMain.on(IPC.CONFIG_SAVE, (_event, state: PersistedAppState) => {
    saveAppState(state)
  })

  ipcMain.handle(IPC.PRESETS_LOAD, (): Preset[] => loadPresets())

  ipcMain.on(IPC.PRESETS_SAVE, (_event, presets: Preset[]) => {
    savePresets(presets)
  })
}
