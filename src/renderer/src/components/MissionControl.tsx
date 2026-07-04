import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useWorkspaceStore } from '../state/useWorkspaceStore'
import { useUiStore } from '../state/useUiStore'
import { getPaneHandle } from '../lib/paneHandleRegistry'
import type { PaneStatus } from '../hooks/usePaneStatusEngine'

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

const PREVIEW_REFRESH_MS = 1200
const PREVIEW_LINES = 6

const STATUS_DOT_CLASS: Record<PaneStatus, string> = {
  starting: 'bg-neutral-500',
  idle: 'bg-neutral-500',
  active: 'bg-emerald-400',
  waiting: 'bg-amber-400',
  error: 'bg-red-500',
  exited: 'bg-neutral-600'
}

/**
 * Aşama 14: Mission Control (Ctrl+Shift+O). macOS Mission Control/Exposé
 * mantığında, TÜM workspace'lerin TÜM pane'lerini tek bir kuşbakışı ekranda
 * gösterir — her kart, o pane'in ekranının son birkaç satırının canlı bir
 * metin önizlemesini içerir (gerçek bir xterm instance'ı DEĞİL; performans
 * için `TerminalPaneHandle.getPreviewLines()` ile periyodik olarak "pull"
 * edilen düz metin). Bir karta tıklamak ilgili workspace'e geçer, pane'i
 * odaklar ve gerçek klavye odağını verir. 15-20 terminal paralel çalışırken
 * "hangi pane'de ne oluyor" sorusuna saniyeler içinde cevap verir.
 */
function MissionControl(): React.JSX.Element | null {
  const isOpen = useUiStore((state) => state.isMissionControlOpen)
  const close = useUiStore((state) => state.closeMissionControl)
  const workspaceOrder = useWorkspaceStore((state) => state.workspaceOrder)
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const paneStatuses = useWorkspaceStore((state) => state.paneStatuses)
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace)
  const setFocusedPane = useWorkspaceStore((state) => state.setFocusedPane)

  const [previews, setPreviews] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (!isOpen) return

    function refresh(): void {
      const next: Record<string, string[]> = {}
      for (const workspace of Object.values(workspaces)) {
        for (const paneId of workspace.order) {
          next[paneId] = getPaneHandle(paneId)?.getPreviewLines(PREVIEW_LINES) ?? []
        }
      }
      setPreviews(next)
    }

    refresh()
    const interval = setInterval(refresh, PREVIEW_REFRESH_MS)
    return () => clearInterval(interval)
  }, [isOpen, workspaces])

  function handleJump(paneId: string, workspaceId: string): void {
    setActiveWorkspace(workspaceId)
    setFocusedPane(paneId, workspaceId)
    close()
    setTimeout(() => getPaneHandle(paneId)?.focusTerminal(), 60)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={close}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close()
          }}
          tabIndex={-1}
          ref={(node) => node?.focus()}
          className="fixed inset-0 z-[90] flex flex-col overflow-y-auto bg-black/70 p-6 backdrop-blur-sm"
        >
          <div className="mb-4 flex shrink-0 items-center gap-3 text-white">
            <span className="text-lg font-semibold">🛰️ Mission Control</span>
            <span className="text-xs text-white/60">
              Tüm workspace'ler ve pane'ler — tıkla ve git · Esc ile kapat
            </span>
            <button
              type="button"
              onClick={close}
              className="ml-auto rounded-md border border-white/20 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              ✕ Kapat
            </button>
          </div>
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className="flex flex-1 flex-col gap-5"
          >
            {workspaceOrder.map((workspaceId) => {
              const workspace = workspaces[workspaceId]
              if (!workspace || workspace.order.length === 0) return null
              return (
                <div key={workspaceId}>
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-white/70">
                    <span>🗂️ {workspace.name}</span>
                    <span className="text-white/40">{workspace.order.length} pane</span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
                    {workspace.order.map((paneId) => {
                      const pane = workspace.panes[paneId]
                      if (!pane) return null
                      const status = paneStatuses[paneId] ?? 'idle'
                      const lines = previews[paneId] ?? []
                      return (
                        <button
                          key={paneId}
                          type="button"
                          onClick={() => handleJump(paneId, workspaceId)}
                          className="flex flex-col overflow-hidden rounded-md border border-white/10 bg-neutral-900/90 text-left shadow-lg transition-transform hover:-translate-y-0.5 hover:border-blue-500/60"
                        >
                          <div className="flex items-center gap-1.5 border-b border-white/10 bg-neutral-800/80 px-2 py-1.5">
                            <span
                              className={cx(
                                'h-2 w-2 shrink-0 rounded-full',
                                STATUS_DOT_CLASS[status]
                              )}
                            />
                            {pane.color && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: pane.color }}
                              />
                            )}
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">
                              {pane.title}
                            </span>
                          </div>
                          <pre className="h-28 overflow-hidden whitespace-pre-wrap break-all px-2 py-1.5 font-mono text-[10px] leading-tight text-neutral-400">
                            {pane.kind === 'web'
                              ? `🌐 ${pane.webUrl ?? ''}`
                              : lines.length > 0
                                ? lines.join('\n')
                                : '…'}
                          </pre>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default MissionControl
