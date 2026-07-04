import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light'

const THEME_STORAGE_KEY = 'mtf-theme'
const CRT_STORAGE_KEY = 'mtf-crt-effect'

function readStoredTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'dark'
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

function readStoredCrtEffect(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(CRT_STORAGE_KEY) === '1'
}

function applyThemeClass(theme: ThemeMode): void {
  document.documentElement.classList.toggle('light', theme === 'light')
}

function applyHackerModeClass(active: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('hacker-mode', active)
}

interface UiStore {
  theme: ThemeMode
  toggleTheme: () => void
  isSearchOpen: boolean
  toggleSearch: () => void
  closeSearch: () => void
  /** Aşama 9: opsiyonel retro CRT/tarama çizgisi görsel efekti. */
  crtEffect: boolean
  toggleCrtEffect: () => void
  /** Aşama 10: sunum/kiosk modu — toolbar, sekme çubuğu ve preset barını gizler. */
  kioskMode: boolean
  toggleKioskMode: () => void
  /** Aşama 12: seçili pane'in dizinini gösteren IDE tarzı dosya paneli. */
  filesPanelOpen: boolean
  toggleFilesPanel: () => void
  /** Aşama 14: odaklanılan pane dışındaki pane'leri hafifçe karartıp dikkati tek pane'e toplar. */
  spotlightMode: boolean
  toggleSpotlightMode: () => void
  /** Aşama 14: Ctrl+K komut paleti. */
  isCommandPaletteOpen: boolean
  openCommandPalette: () => void
  closeCommandPalette: () => void
  /** Aşama 14: Ctrl+Shift+O Mission Control (tüm workspace/pane'lerin kuşbakışı görünümü). */
  isMissionControlOpen: boolean
  openMissionControl: () => void
  closeMissionControl: () => void
  /**
   * Aşama 15: "Saldırı Modu" (Hacker Attack Mode) — tüm uygulamanın renk
   * paletini yeşil/neon bir "sızma" temasına çeviren, matrix yağmuru ve HUD
   * göstergeleriyle ortamı dramatik biçimde değiştiren eğlence/motivasyon modu.
   */
  hackerMode: boolean
  toggleHackerMode: () => void
}

const initialTheme = readStoredTheme()
if (typeof document !== 'undefined') applyThemeClass(initialTheme)

/**
 * Workspace/pane verisiyle ilgisi olmayan, kalıcılığı electron-store'a değil
 * localStorage'a bırakılan hafif UI tercihleri (tema) ve geçici UI durumu
 * (global arama çubuğunun açık olup olmadığı).
 */
export const useUiStore = create<UiStore>((set, get) => ({
  theme: initialTheme,
  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(THEME_STORAGE_KEY, next)
    applyThemeClass(next)
    set({ theme: next })
  },
  isSearchOpen: false,
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
  closeSearch: () => set({ isSearchOpen: false }),
  crtEffect: readStoredCrtEffect(),
  toggleCrtEffect: () => {
    const next = !get().crtEffect
    localStorage.setItem(CRT_STORAGE_KEY, next ? '1' : '0')
    set({ crtEffect: next })
  },
  kioskMode: false,
  toggleKioskMode: () => set((state) => ({ kioskMode: !state.kioskMode })),
  filesPanelOpen: false,
  toggleFilesPanel: () => set((state) => ({ filesPanelOpen: !state.filesPanelOpen })),
  spotlightMode: false,
  toggleSpotlightMode: () => set((state) => ({ spotlightMode: !state.spotlightMode })),
  isCommandPaletteOpen: false,
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
  isMissionControlOpen: false,
  openMissionControl: () => set({ isMissionControlOpen: true }),
  closeMissionControl: () => set({ isMissionControlOpen: false }),
  hackerMode: false,
  toggleHackerMode: () => {
    const next = !get().hackerMode
    applyHackerModeClass(next)
    set({ hackerMode: next })
  }
}))
