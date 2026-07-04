import { useEffect, useMemo, useRef, useState } from 'react'
import { useActivityStore } from '../state/useActivityStore'
import { useWorkspaceStore } from '../state/useWorkspaceStore'

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 5) return 'şimdi'
  if (diffSec < 60) return `${diffSec}sn önce`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}dk önce`
  const diffHour = Math.floor(diffMin / 60)
  return `${diffHour}sa önce`
}

/**
 * Aşama 10: aktivite geçmişi butonu — native bildirimler kaybolup gittiği için,
 * hangi pane'in ne zaman onay beklediğini/hata verdiğini listeleyen açılır panel.
 * Bir satıra tıklamak, o olayın gerçekleştiği workspace'e geçer.
 */
function ActivityLogButton(): React.JSX.Element {
  const entries = useActivityStore((state) => state.entries)
  const clear = useActivityStore((state) => state.clear)
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace)
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const recentCount = useMemo(
    () => entries.filter((entry) => Date.now() - entry.timestamp < 10 * 60 * 1000).length,
    [entries]
  )

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  function handleJump(workspaceId: string): void {
    setActiveWorkspace(workspaceId)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Aktivite geçmişi (onay/hata olayları)"
        onClick={() => setIsOpen((value) => !value)}
        className={
          'relative rounded-md border px-2.5 py-1.5 text-xs font-medium ' +
          (isOpen
            ? 'border-blue-500 bg-blue-600 text-white'
            : 'border-[var(--mtf-border)] text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]')
        }
      >
        🔔
        {recentCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
            {recentCount > 9 ? '9+' : recentCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-surface)] p-1.5 text-xs shadow-xl">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="font-medium text-[var(--mtf-text)]">Aktivite geçmişi</span>
            <button
              type="button"
              onClick={clear}
              className="text-[var(--mtf-text-muted)] hover:text-[var(--mtf-text)]"
            >
              Temizle
            </button>
          </div>
          {entries.length === 0 ? (
            <p className="px-1 py-2 text-[var(--mtf-text-muted)]">Henüz olay yok.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {entries.map((entry) => {
                const workspaceName = workspaces[entry.workspaceId]?.name ?? '—'
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleJump(entry.workspaceId)}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left hover:bg-[var(--mtf-hover)]"
                  >
                    <span
                      className={
                        'h-2 w-2 shrink-0 rounded-full ' +
                        (entry.kind === 'error'
                          ? 'bg-red-500'
                          : entry.kind === 'resource'
                            ? 'bg-purple-400'
                            : 'bg-amber-400')
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-[var(--mtf-text)]">
                      {entry.paneTitle}
                      <span className="text-[var(--mtf-text-muted)]"> · {workspaceName}</span>
                    </span>
                    <span className="shrink-0 text-[var(--mtf-text-muted)]">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ActivityLogButton
