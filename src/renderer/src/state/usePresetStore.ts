import { create } from 'zustand'
import type { PersistedPaneConfig, Preset } from '@shared/types'

interface PresetStore {
  presets: Preset[]
  loaded: boolean
  load: () => Promise<void>
  savePreset: (name: string, panes: PersistedPaneConfig[]) => void
  removePreset: (id: string) => void
}

function makePresetId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function persist(presets: Preset[]): void {
  window.api.presets.save(presets)
}

/**
 * Aşama 8: preset sistemi. Bir workspace'in o anki pane setini isimlendirip
 * kaydeder; kayıtlı bir preset tek tıkla yeni bir workspace olarak (pane'ler
 * sıfırdan spawn edilerek) açılabilir. electron-store'da ayrı bir anahtar
 * altında tutulur (bkz. main/store/configStore.ts).
 */
export const usePresetStore = create<PresetStore>((set, get) => ({
  presets: [],
  loaded: false,

  load: async () => {
    if (get().loaded) return
    const presets = await window.api.presets.load()
    set({ presets, loaded: true })
  },

  savePreset: (name, panes) => {
    const preset: Preset = { id: makePresetId(), name: name.trim() || 'Preset', panes }
    set((state) => {
      const next = [...state.presets, preset]
      persist(next)
      return { presets: next }
    })
  },

  removePreset: (id) => {
    set((state) => {
      const next = state.presets.filter((preset) => preset.id !== id)
      persist(next)
      return { presets: next }
    })
  }
}))
