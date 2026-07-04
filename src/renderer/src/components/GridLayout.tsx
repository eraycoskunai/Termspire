import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Group as PanelGroup, Panel, Separator as PanelSeparator } from 'react-resizable-panels'
import type { PtyCreateOptions } from '@shared/types'
import TerminalPane, { type TerminalPaneHandle } from './TerminalPane'
import WebPane from './WebPane'
import PaneConfigModal from './PaneConfigModal'
import WebPaneModal from './WebPaneModal'
import FileExplorerPanel from './FileExplorerPanel'
import { useWorkspaceStore, type PaneState } from '../state/useWorkspaceStore'
import { useUiStore } from '../state/useUiStore'
import { useActivityStore } from '../state/useActivityStore'
import { chunkIntoRows, computeGridDimensions } from '../lib/gridAlgorithm'
import { markSoftClosed } from '../lib/softClosedPtys'
import { registerPaneHandle } from '../lib/paneHandleRegistry'

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

const EMPTY_ORDER: string[] = []
const EMPTY_PANES: Record<string, PaneState> = {}

interface GridCellProps {
  pane: PaneState
  workspaceId: string
  isZoomed: boolean
  isSpotlightDimmed: boolean
  broadcastEnabled: boolean
  isBroadcastTarget: boolean
  broadcastPeerIds: string[]
  pipeOptions: Array<{ id: string; title: string }>
  pipeTargetId?: string
  onRegisterHandle: (paneId: string, handle: TerminalPaneHandle | null) => void
  onRequestClose: (paneId: string) => void
}

function GridCell({
  pane,
  workspaceId,
  isZoomed,
  isSpotlightDimmed,
  broadcastEnabled,
  isBroadcastTarget,
  broadcastPeerIds,
  pipeOptions,
  pipeTargetId,
  onRegisterHandle,
  onRequestClose
}: GridCellProps): React.JSX.Element {
  const toggleZoom = useWorkspaceStore((state) => state.toggleZoom)
  const restartPane = useWorkspaceStore((state) => state.restartPane)
  const toggleBroadcastPane = useWorkspaceStore((state) => state.toggleBroadcastPane)
  const setPaneStatus = useWorkspaceStore((state) => state.setPaneStatus)
  const toggleAutoRestart = useWorkspaceStore((state) => state.toggleAutoRestart)
  const setPipeTarget = useWorkspaceStore((state) => state.setPipeTarget)
  const setFocusedPane = useWorkspaceStore((state) => state.setFocusedPane)
  const setPaneWebUrl = useWorkspaceStore((state) => state.setPaneWebUrl)
  const addActivityEntry = useActivityStore((state) => state.addEntry)
  const theme = useUiStore((state) => state.theme)

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging
  } = useDraggable({
    id: pane.id
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: pane.id })

  // Not: react-resizable-panels ile manuel sürükle-boyutlandırma sırasında
  // framer-motion'ın otomatik `layout` animasyonu KASITLI OLARAK kullanılmıyor
  // — bu, her panel sürüklemesinde gerçek boyutu "spring" ile geciktirerek
  // fareyi 1:1 takip etmeyi bozardı. Zoom geçişinde sadece kozmetik bir
  // scale/opacity "pop" animasyonu oynatılır; gerçek layout değişimi (ve
  // ona bağlı ResizeObserver/fit/pty-resize akışı) anında olur.
  //
  // ÖNEMLİ: opacity değeri BURADA, `animate` prop'u üzerinden hesaplanıyor —
  // framer-motion `animate` her render'da opacity'yi DOM'a inline `style`
  // olarak yazar, ve inline style CSS'te class tabanlı kurallardan (Tailwind'in
  // `opacity-35`'i gibi) her zaman önceliklidir. Opacity'yi Tailwind class'ı
  // ile ayarlamaya çalışmak (`isSpotlightDimmed && 'opacity-35'` gibi) bu
  // yüzden görünüşte hiçbir etki yaratmıyordu — spotlight modu ve sürükleme
  // dimme'si sessizce hiçbir şey yapmıyordu, çünkü `animate={{ opacity: 1 }}`
  // her zaman üzerine yazıyordu.
  const dimmedOpacity = isDragging ? 0.4 : isSpotlightDimmed ? 0.35 : 1
  return (
    <motion.div
      ref={setDropRef}
      initial={false}
      animate={
        isZoomed ? { scale: [0.97, 1], opacity: [0.6, 1] } : { scale: 1, opacity: dimmedOpacity }
      }
      whileHover={isSpotlightDimmed && !isDragging && !isZoomed ? { opacity: 0.9 } : undefined}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cx(
        'h-full w-full',
        isZoomed && 'visible fixed inset-0 z-50 bg-neutral-950 p-2',
        isOver && !isZoomed && 'ring-2 ring-blue-500'
      )}
    >
      {pane.kind === 'web' ? (
        <WebPane
          paneId={pane.id}
          title={pane.title}
          color={pane.color}
          url={pane.webUrl ?? 'about:blank'}
          isZoomed={isZoomed}
          onUrlChange={(url) => setPaneWebUrl(pane.id, url, workspaceId)}
          onClose={() => onRequestClose(pane.id)}
          onFocusPane={() => setFocusedPane(pane.id, workspaceId)}
          onToggleZoom={() => toggleZoom(pane.id, workspaceId)}
          dragHandleRef={setDragRef}
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      ) : (
        <TerminalPane
          key={`${pane.id}:${pane.restartToken}`}
          ref={(handle) => onRegisterHandle(pane.id, handle)}
          paneId={pane.id}
          config={pane.config}
          title={pane.title}
          color={pane.color}
          theme={theme}
          isZoomed={isZoomed}
          onClose={() => onRequestClose(pane.id)}
          onFocusPane={() => setFocusedPane(pane.id, workspaceId)}
          onToggleZoom={() => toggleZoom(pane.id, workspaceId)}
          onRestart={() => restartPane(pane.id, workspaceId)}
          onStatusChange={(status) => {
            setPaneStatus(pane.id, status)
            if (status === 'waiting' || status === 'error') {
              addActivityEntry({
                paneId: pane.id,
                workspaceId,
                paneTitle: pane.title,
                kind: status
              })
            }
          }}
          onResourceAlarm={() => {
            addActivityEntry({
              paneId: pane.id,
              workspaceId,
              paneTitle: pane.title,
              kind: 'resource'
            })
          }}
          autoRestart={pane.autoRestart}
          onToggleAutoRestart={() => toggleAutoRestart(pane.id, workspaceId)}
          dragHandleRef={setDragRef}
          dragHandleProps={{ ...attributes, ...listeners }}
          showBroadcastToggle={broadcastEnabled}
          isBroadcastTarget={isBroadcastTarget}
          onToggleBroadcastTarget={() => toggleBroadcastPane(pane.id, workspaceId)}
          broadcastPeerIds={broadcastPeerIds}
          pipeOptions={pipeOptions}
          pipeTargetId={pipeTargetId}
          onSetPipeTarget={(targetId) => setPipeTarget(pane.id, targetId)}
        />
      )}
    </motion.div>
  )
}

function EmptyState({
  onAddPane,
  onAddWebPane
}: {
  onAddPane: () => void
  onAddWebPane: () => void
}): React.JSX.Element {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-[var(--mtf-text-muted)]">
      <p className="text-sm">Henüz açık bir pane yok.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAddPane}
          className="rounded-md bg-[var(--mtf-surface-2)] px-4 py-2 text-sm text-[var(--mtf-text)] hover:bg-[var(--mtf-hover)]"
        >
          + Terminal ekle
        </button>
        <button
          type="button"
          onClick={onAddWebPane}
          className="rounded-md bg-[var(--mtf-surface-2)] px-4 py-2 text-sm text-[var(--mtf-text)] hover:bg-[var(--mtf-hover)]"
        >
          + Web ekle
        </button>
      </div>
    </div>
  )
}

interface GlobalSearchBarProps {
  onSearch: (term: string, direction: 'next' | 'previous') => void
  onClose: () => void
}

/** Aşama 8: aktif workspace'teki tüm pane'lerin scrollback'inde eşzamanlı arama yapan çubuk. */
function GlobalSearchBar({ onSearch, onClose }: GlobalSearchBarProps): React.JSX.Element {
  const [term, setTerm] = useState('')

  return (
    <div className="absolute right-2 top-2 z-40 flex items-center gap-1 rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-surface)] p-1.5 shadow-xl">
      <input
        autoFocus
        value={term}
        onChange={(event) => {
          setTerm(event.target.value)
          onSearch(event.target.value, 'next')
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSearch(term, event.shiftKey ? 'previous' : 'next')
          if (event.key === 'Escape') onClose()
        }}
        placeholder="Tüm pane'lerde ara…"
        className="w-48 rounded border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-2 py-1 text-xs text-[var(--mtf-text)] outline-none focus:border-blue-500"
      />
      <button
        type="button"
        title="Önceki"
        onClick={() => onSearch(term, 'previous')}
        className="rounded px-1.5 py-1 text-xs text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]"
      >
        ↑
      </button>
      <button
        type="button"
        title="Sonraki"
        onClick={() => onSearch(term, 'next')}
        className="rounded px-1.5 py-1 text-xs text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]"
      >
        ↓
      </button>
      <button
        type="button"
        title="Kapat"
        onClick={onClose}
        className="rounded px-1.5 py-1 text-xs text-[var(--mtf-text-muted)] hover:bg-red-900/60 hover:text-red-200"
      >
        ✕
      </button>
    </div>
  )
}

interface GridLayoutProps {
  workspaceId: string
}

/**
 * Pane sayısına göre otomatik en kare/dengeli grid'i kurar, react-resizable-panels
 * ile sürüklenerek boyutlandırılabilir hale getirir ve dnd-kit ile pane'lerin
 * grid içinde yer değiştirmesine izin verir. Zoom'a alınan pane, grid DOM'undan
 * hiç kaldırılmadan (pty bağlantısı kopmadan) `visibility` hilesiyle tam ekran yapılır.
 * Her workspace kendi GridLayout instance'ını alır; App.tsx aktif olmayanları
 * unmount etmeden sadece CSS ile gizler.
 */
function GridLayout({ workspaceId }: GridLayoutProps): React.JSX.Element | null {
  const workspace = useWorkspaceStore((state) => state.workspaces[workspaceId])
  const addPane = useWorkspaceStore((state) => state.addPane)
  const addWebPane = useWorkspaceStore((state) => state.addWebPane)
  const removePane = useWorkspaceStore((state) => state.removePane)
  const broadcastEnabled = useWorkspaceStore(
    (state) => state.broadcastEnabled[workspaceId] ?? false
  )
  const broadcastPaneIds = useWorkspaceStore(
    (state) => state.broadcastPaneIds[workspaceId] ?? EMPTY_ORDER
  )
  const pipeTargets = useWorkspaceStore((state) => state.pipeTargets)
  const isSearchOpen = useUiStore((state) => state.isSearchOpen)
  const closeSearch = useUiStore((state) => state.closeSearch)
  const filesPanelOpen = useUiStore((state) => state.filesPanelOpen)
  const toggleFilesPanel = useUiStore((state) => state.toggleFilesPanel)
  const theme = useUiStore((state) => state.theme)
  const spotlightMode = useUiStore((state) => state.spotlightMode)

  const [isModalOpen, setModalOpen] = useState(false)
  const [isWebModalOpen, setWebModalOpen] = useState(false)
  const [homeDir, setHomeDir] = useState<string | null>(null)
  const paneHandles = useRef(new Map<string, TerminalPaneHandle>())

  // Aşama 12: dosya paneli — pane'in kendi cwd'si yoksa (varsayılan) kullanıcı
  // ana dizinine düşer; bu tek seferlik IPC çağrısıyla önceden alınır.
  useEffect(() => {
    window.api.fs.homeDir().then(setHomeDir)
  }, [])

  const order = workspace?.order ?? EMPTY_ORDER
  const panesById = workspace?.panes ?? EMPTY_PANES

  const panes = useMemo(() => order.map((id) => panesById[id]).filter(Boolean), [order, panesById])
  const { cols } = computeGridDimensions(panes.length)
  const rows = useMemo(() => chunkIntoRows(panes, cols), [panes, cols])

  function registerHandle(paneId: string, handle: TerminalPaneHandle | null): void {
    if (handle) paneHandles.current.set(paneId, handle)
    else paneHandles.current.delete(paneId)
    // Aşama 12: workspace kapatma gibi bu GridLayout instance'ının dışından
    // tetiklenen soft-close akışları için global bir kopya da tutulur.
    registerPaneHandle(paneId, handle)
  }

  /**
   * Aşama 12: pane ✕ ile kapatılırken çağrılır — gerçek pty process'i ÖLDÜRÜLMEZ,
   * arka planda canlı bırakılır (detach). "Geri Al" ile pane yeniden mount
   * edildiğinde bu process'e sıfırdan spawn etmeden yeniden bağlanılır.
   */
  function handleCloseRequest(paneId: string): void {
    const handle = paneHandles.current.get(paneId)
    const livePtyInstanceId = handle?.prepareForSoftClose() ?? null
    if (livePtyInstanceId) markSoftClosed(paneId, livePtyInstanceId)
    removePane(paneId, workspaceId)
  }

  function handleGlobalSearch(term: string, direction: 'next' | 'previous'): void {
    if (!term) return
    for (const handle of paneHandles.current.values()) {
      if (direction === 'next') handle.searchNext(term)
      else handle.searchPrevious(term)
    }
  }

  function handleModalSubmit(config: PtyCreateOptions, title: string, color: string): void {
    addPane(config, title, color || undefined, workspaceId)
    setModalOpen(false)
  }

  function handleWebModalSubmit(url: string, title: string, color: string): void {
    addWebPane(url, title, color || undefined, workspaceId)
    setWebModalOpen(false)
  }

  if (!workspace) return null

  const zoomedPaneId = workspace.zoomedPaneId
  const focusedPane = workspace.focusedPaneId ? (panesById[workspace.focusedPaneId] ?? null) : null

  if (panes.length === 0) {
    return (
      <>
        <EmptyState
          onAddPane={() => setModalOpen(true)}
          onAddWebPane={() => setWebModalOpen(true)}
        />
        <PaneConfigModal
          isOpen={isModalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleModalSubmit}
        />
        <WebPaneModal
          isOpen={isWebModalOpen}
          onClose={() => setWebModalOpen(false)}
          onSubmit={handleWebModalSubmit}
        />
      </>
    )
  }

  return (
    <div className="flex h-full w-full">
      <div className="relative min-w-0 flex-1">
        {isSearchOpen && <GlobalSearchBar onSearch={handleGlobalSearch} onClose={closeSearch} />}
        <div className={cx('h-full w-full', zoomedPaneId && 'invisible')}>
          <PanelGroup orientation="vertical" className="h-full w-full gap-1">
            {rows.map((rowPanes, rowIndex) => (
              <Fragment key={rowIndex}>
                {rowIndex > 0 && (
                  <PanelSeparator className="my-0.5 h-1 rounded-full bg-transparent transition-colors hover:bg-blue-500/60 data-[resize-handle-active]:bg-blue-500" />
                )}
                <Panel id={`row-${rowIndex}`} minSize={10}>
                  <PanelGroup orientation="horizontal" className="h-full w-full gap-1">
                    {rowPanes.map((pane, colIndex) => (
                      <Fragment key={pane.id}>
                        {colIndex > 0 && (
                          <PanelSeparator className="mx-0.5 w-1 rounded-full bg-transparent transition-colors hover:bg-blue-500/60 data-[resize-handle-active]:bg-blue-500" />
                        )}
                        <Panel id={pane.id} minSize={10}>
                          <GridCell
                            pane={pane}
                            workspaceId={workspaceId}
                            isZoomed={pane.id === zoomedPaneId}
                            isSpotlightDimmed={
                              spotlightMode &&
                              !zoomedPaneId &&
                              Boolean(workspace.focusedPaneId) &&
                              pane.id !== workspace.focusedPaneId
                            }
                            broadcastEnabled={broadcastEnabled}
                            isBroadcastTarget={broadcastPaneIds.includes(pane.id)}
                            broadcastPeerIds={
                              broadcastEnabled && broadcastPaneIds.includes(pane.id)
                                ? broadcastPaneIds.filter((id) => id !== pane.id)
                                : EMPTY_ORDER
                            }
                            pipeOptions={panes
                              .filter((sibling) => sibling.id !== pane.id)
                              .map((sibling) => ({ id: sibling.id, title: sibling.title }))}
                            pipeTargetId={pipeTargets[pane.id]}
                            onRegisterHandle={registerHandle}
                            onRequestClose={handleCloseRequest}
                          />
                        </Panel>
                      </Fragment>
                    ))}
                  </PanelGroup>
                </Panel>
              </Fragment>
            ))}
          </PanelGroup>
        </div>
      </div>
      {filesPanelOpen && (
        <FileExplorerPanel
          pane={focusedPane}
          homeDir={homeDir}
          platform={window.electron.process.platform}
          theme={theme}
          onClose={toggleFilesPanel}
        />
      )}
    </div>
  )
}

export default GridLayout
