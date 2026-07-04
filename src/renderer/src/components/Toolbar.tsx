import { useState } from 'react'
import type { PtyCreateOptions } from '@shared/types'
import { useWorkspaceStore } from '../state/useWorkspaceStore'
import { useUiStore } from '../state/useUiStore'
import PaneConfigModal from './PaneConfigModal'
import WebPaneModal from './WebPaneModal'
import ActivityLogButton from './ActivityLogButton'
import RecentlyClosedButton from './RecentlyClosedButton'
import SystemInfoPanel from './SystemInfoPanel'
import appLogo from '../assets/logo.png'

/**
 * Üst araç çubuğu: aktif workspace'teki pane sayısı, broadcast/arama/tema
 * aksiyonları ve `PaneConfigModal`'ı açan "+ Terminal ekle" butonu.
 */
function Toolbar(): React.JSX.Element {
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId)
  const paneCount = useWorkspaceStore(
    (state) => state.workspaces[state.activeWorkspaceId]?.order.length ?? 0
  )
  const addPane = useWorkspaceStore((state) => state.addPane)
  const addWebPane = useWorkspaceStore((state) => state.addWebPane)
  const broadcastEnabled = useWorkspaceStore(
    (state) => state.broadcastEnabled[state.activeWorkspaceId] ?? false
  )
  const toggleBroadcastMode = useWorkspaceStore((state) => state.toggleBroadcastMode)
  const isSearchOpen = useUiStore((state) => state.isSearchOpen)
  const toggleSearch = useUiStore((state) => state.toggleSearch)
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const crtEffect = useUiStore((state) => state.crtEffect)
  const toggleCrtEffect = useUiStore((state) => state.toggleCrtEffect)
  const toggleKioskMode = useUiStore((state) => state.toggleKioskMode)
  const filesPanelOpen = useUiStore((state) => state.filesPanelOpen)
  const toggleFilesPanel = useUiStore((state) => state.toggleFilesPanel)
  const spotlightMode = useUiStore((state) => state.spotlightMode)
  const toggleSpotlightMode = useUiStore((state) => state.toggleSpotlightMode)
  const openCommandPalette = useUiStore((state) => state.openCommandPalette)
  const openMissionControl = useUiStore((state) => state.openMissionControl)
  const hackerMode = useUiStore((state) => state.hackerMode)
  const toggleHackerMode = useUiStore((state) => state.toggleHackerMode)
  const [isModalOpen, setModalOpen] = useState(false)
  const [isWebModalOpen, setWebModalOpen] = useState(false)

  function handleSubmit(config: PtyCreateOptions, title: string, color: string): void {
    addPane(config, title, color || undefined, activeWorkspaceId)
    setModalOpen(false)
  }

  function handleWebSubmit(url: string, title: string, color: string): void {
    addWebPane(url, title, color || undefined, activeWorkspaceId)
    setWebModalOpen(false)
  }

  return (
    <div className="flex items-center gap-3 border-b border-[var(--mtf-border)] bg-[var(--mtf-surface)] px-3 py-2 text-sm text-[var(--mtf-text)]">
      <img src={appLogo} alt="" className="h-5 w-5 rounded-sm" draggable={false} />
      <span className="font-semibold">Termspire</span>
      <span className="text-xs text-[var(--mtf-text-muted)]">{paneCount} pane</span>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          title="Komut Paleti (Ctrl+K)"
          onClick={openCommandPalette}
          className="rounded-md border border-[var(--mtf-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]"
        >
          ⌘K Komutlar
        </button>
        <button
          type="button"
          title="Mission Control — tüm workspace/pane kuşbakışı (Ctrl+Shift+O)"
          onClick={openMissionControl}
          className="rounded-md border border-[var(--mtf-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]"
        >
          🛰️ Mission Control
        </button>
        <button
          type="button"
          title="Broadcast modu: seçili pane'lere aynı anda yaz"
          onClick={() => toggleBroadcastMode(activeWorkspaceId)}
          className={
            'rounded-md border px-2.5 py-1.5 text-xs font-medium ' +
            (broadcastEnabled
              ? 'border-blue-500 bg-blue-600 text-white'
              : 'border-[var(--mtf-border)] text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]')
          }
        >
          ⇶ Broadcast
        </button>
        <button
          type="button"
          title="Tüm pane'lerde ara (Ctrl+Shift+F)"
          onClick={toggleSearch}
          className={
            'rounded-md border px-2.5 py-1.5 text-xs font-medium ' +
            (isSearchOpen
              ? 'border-blue-500 bg-blue-600 text-white'
              : 'border-[var(--mtf-border)] text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]')
          }
        >
          🔍 Ara
        </button>
        <ActivityLogButton />
        <RecentlyClosedButton />
        <SystemInfoPanel />
        <button
          type="button"
          title="Seçili terminalin dizinini gösteren dosya paneli"
          onClick={toggleFilesPanel}
          className={
            'rounded-md border px-2.5 py-1.5 text-xs font-medium ' +
            (filesPanelOpen
              ? 'border-blue-500 bg-blue-600 text-white'
              : 'border-[var(--mtf-border)] text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]')
          }
        >
          📁 Dosyalar
        </button>
        <button
          type="button"
          title="Spotlight modu: odaklanılan pane dışındakileri karart"
          onClick={toggleSpotlightMode}
          className={
            'rounded-md border px-2.5 py-1.5 text-xs font-medium ' +
            (spotlightMode
              ? 'border-blue-500 bg-blue-600 text-white'
              : 'border-[var(--mtf-border)] text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]')
          }
        >
          🔦 Spotlight
        </button>
        <button
          type="button"
          title={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
          onClick={toggleTheme}
          className="rounded-md border border-[var(--mtf-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]"
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
        <button
          type="button"
          title="Retro CRT/tarama çizgisi efekti"
          onClick={toggleCrtEffect}
          className={
            'rounded-md border px-2.5 py-1.5 text-xs font-medium ' +
            (crtEffect
              ? 'border-blue-500 bg-blue-600 text-white'
              : 'border-[var(--mtf-border)] text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]')
          }
        >
          📺 CRT
        </button>
        <button
          type="button"
          title="Sunum/Kiosk modu (Ctrl+Shift+K / F11)"
          onClick={toggleKioskMode}
          className="rounded-md border border-[var(--mtf-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]"
        >
          ⛶ Sunum
        </button>
        <button
          type="button"
          title="Saldırı Modu: kodlama ortamını neon/hacker temasına çevirir (Ctrl+Shift+H)"
          onClick={toggleHackerMode}
          className={
            'rounded-md border px-2.5 py-1.5 text-xs font-bold ' +
            (hackerMode
              ? 'animate-pulse border-emerald-400 bg-emerald-600 text-white shadow-[0_0_14px_rgba(16,255,130,0.6)]'
              : 'border-[var(--mtf-border)] text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]')
          }
        >
          💀 Saldırı Modu
        </button>
        <button
          type="button"
          onClick={() => setWebModalOpen(true)}
          className="rounded-md border border-[var(--mtf-border)] px-3 py-1.5 text-xs font-medium text-[var(--mtf-text)] hover:bg-[var(--mtf-hover)]"
        >
          + Web ekle
        </button>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
        >
          + Terminal ekle
        </button>
      </div>
      <PaneConfigModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
      <WebPaneModal
        isOpen={isWebModalOpen}
        onClose={() => setWebModalOpen(false)}
        onSubmit={handleWebSubmit}
      />
    </div>
  )
}

export default Toolbar
