import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useWorkspaceStore } from '../state/useWorkspaceStore'
import { getPtyInstanceId } from '../lib/ptyRegistry'
import { useT } from '../hooks/useTranslation'

/**
 * Aşama 14: çoklu-ajan onay orkestratörü. Status motoru zaten her pane için
 * "onay bekliyor" durumunu tespit ediyor (bkz. useWorkspaceStore.paneStatuses).
 * Birden fazla pane (farklı workspace'lerde bile olsa) AYNI ANDA bu durumdaysa,
 * her birine tek tek gidip "↵ Onayla" tıklamak yerine, tek bir tuşla HEPSİNE
 * birden aynı yanıtı (Enter/y/n) gönderen yüzen bir çubuk gösterir. Tek bir
 * pane bekliyorsa (zaten kendi başlığındaki hızlı butonlarla erişilebilir)
 * bu çubuk gösterilmez — sadece gerçekten "orkestrasyon" gereken durumda çıkar.
 */
function ApprovalOrchestratorBar(): React.JSX.Element | null {
  const t = useT()
  const paneStatuses = useWorkspaceStore((state) => state.paneStatuses)
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace)
  const setFocusedPane = useWorkspaceStore((state) => state.setFocusedPane)
  const [isExpanded, setIsExpanded] = useState(false)

  const waitingPanes = useMemo(() => {
    const result: Array<{
      paneId: string
      title: string
      workspaceId: string
      workspaceName: string
    }> = []
    for (const [paneId, status] of Object.entries(paneStatuses)) {
      if (status !== 'waiting') continue
      for (const workspace of Object.values(workspaces)) {
        const pane = workspace.panes[paneId]
        if (pane) {
          result.push({
            paneId,
            title: pane.title,
            workspaceId: workspace.id,
            workspaceName: workspace.name
          })
          break
        }
      }
    }
    return result
  }, [paneStatuses, workspaces])

  function sendToAll(text: string): void {
    for (const { paneId } of waitingPanes) {
      const ptyId = getPtyInstanceId(paneId)
      if (ptyId) window.api.pty.write(ptyId, text)
    }
  }

  function jumpTo(paneId: string, workspaceId: string): void {
    setActiveWorkspace(workspaceId)
    setFocusedPane(paneId, workspaceId)
    setIsExpanded(false)
  }

  return (
    <AnimatePresence>
      {waitingPanes.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2"
        >
          <div className="pointer-events-auto flex flex-col items-stretch gap-1 rounded-lg border border-amber-500/50 bg-[var(--mtf-surface)] p-1.5 text-xs shadow-2xl">
            <div className="flex items-center gap-2 px-1.5">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
              <span className="font-medium text-[var(--mtf-text)]">
                {t('approvalBar.waiting', { count: waitingPanes.length })}
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded((value) => !value)}
                className="ml-1 text-[var(--mtf-text-muted)] hover:text-[var(--mtf-text)]"
              >
                {isExpanded ? t('approvalBar.hide') : t('approvalBar.show')}
              </button>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  title={t('approvalBar.sendEnterHint')}
                  onClick={() => sendToAll('\r')}
                  className="rounded bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/35"
                >
                  {t('approvalBar.approveAll')}
                </button>
                <button
                  type="button"
                  title={t('approvalBar.sendYesHint')}
                  onClick={() => sendToAll('y\r')}
                  className="rounded bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/35"
                >
                  y
                </button>
                <button
                  type="button"
                  title={t('approvalBar.sendNoHint')}
                  onClick={() => sendToAll('n\r')}
                  className="rounded bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/35"
                >
                  n
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="max-h-40 overflow-y-auto border-t border-[var(--mtf-border)] pt-1">
                {waitingPanes.map((pane) => (
                  <button
                    key={pane.paneId}
                    type="button"
                    onClick={() => jumpTo(pane.paneId, pane.workspaceId)}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-[var(--mtf-hover)]"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    <span className="min-w-0 flex-1 truncate text-[var(--mtf-text)]">
                      {pane.title}
                    </span>
                    <span className="shrink-0 text-[var(--mtf-text-muted)]">
                      {pane.workspaceName}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ApprovalOrchestratorBar
