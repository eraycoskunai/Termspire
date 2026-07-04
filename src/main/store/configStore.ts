import Store from 'electron-store'
import type { PersistedAppState, Preset } from '@shared/types'

const APP_STATE_KEY = 'appState'
const PRESETS_KEY = 'presets'

/**
 * `electron-store` üzerinde tek bir dosyada (config.json) hem workspace/pane
 * yapılandırmasını hem de preset listesini JSON olarak tutar. Dosya konumu
 * platforma göre otomatik yönetilir (Windows: %APPDATA%/termspire/config.json).
 */
const store = new Store<{ appState?: PersistedAppState; presets?: Preset[] }>({ name: 'config' })

export function loadAppState(): PersistedAppState | null {
  return store.get(APP_STATE_KEY) ?? null
}

export function saveAppState(state: PersistedAppState): void {
  store.set(APP_STATE_KEY, state)
}

export function loadPresets(): Preset[] {
  return store.get(PRESETS_KEY) ?? []
}

export function savePresets(presets: Preset[]): void {
  store.set(PRESETS_KEY, presets)
}
