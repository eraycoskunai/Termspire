import { useEffect, useRef, useState } from 'react'
import { useClosedItemsStore, type ClosedItem } from '../state/useClosedItemsStore'
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

function describe(item: ClosedItem): { title: string; subtitle: string } {
  if (item.type === 'pane') {
    return { title: item.pane.title, subtitle: `Terminal · ${item.workspaceName}` }
  }
  return {
    title: item.workspace.name,
    subtitle: `Workspace · ${item.workspace.order.length} terminal`
  }
}

/**
 * Aşama 12: "yanlışlıkla kapattım" güvenlik ağı — son kapatılan pane/workspace'leri
 * listeler, tıklayınca eski konumu ve (varsa) kalan session buffer'ıyla birlikte
 * geri ekler. Tarayıcıların "son kapatılan sekmeler" menüsüyle aynı mantık.
 */
function RecentlyClosedButton(): React.JSX.Element {
  const items = useClosedItemsStore((state) => state.items)
  const removeClosedItem = useClosedItemsStore((state) => state.remove)
  const clearClosedItems = useClosedItemsStore((state) => state.clear)
  const restorePaneAt = useWorkspaceStore((state) => state.restorePaneAt)
  const restoreWorkspaceAt = useWorkspaceStore((state) => state.restoreWorkspaceAt)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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

  function handleRestore(item: ClosedItem): void {
    if (item.type === 'pane') restorePaneAt(item.pane, item.workspaceId, item.index)
    else restoreWorkspaceAt(item.workspace, item.index)
    removeClosedItem(item.id)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Kapatılanları geri al (Ctrl+Shift+T)"
        onClick={() => setIsOpen((value) => !value)}
        className={
          'relative rounded-md border px-2.5 py-1.5 text-xs font-medium ' +
          (isOpen
            ? 'border-blue-500 bg-blue-600 text-white'
            : 'border-[var(--mtf-border)] text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]')
        }
      >
        ↩️ Kapatılanlar
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-neutral-500 px-0.5 text-[9px] font-bold text-white">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-surface)] p-1.5 text-xs shadow-xl">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="font-medium text-[var(--mtf-text)]">Son kapatılanlar</span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearClosedItems}
                className="text-[var(--mtf-text-muted)] hover:text-[var(--mtf-text)]"
              >
                Temizle
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-1 py-2 text-[var(--mtf-text-muted)]">
              Kapatılan terminal/workspace yok.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {items.map((item) => {
                const { title, subtitle } = describe(item)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleRestore(item)}
                    title="Geri al"
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left hover:bg-[var(--mtf-hover)]"
                  >
                    <span className="shrink-0 text-sm">
                      {item.type === 'workspace' ? '🗂️' : '⧉'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[var(--mtf-text)]">
                      {title}
                      <span className="text-[var(--mtf-text-muted)]"> · {subtitle}</span>
                    </span>
                    <span className="shrink-0 text-[var(--mtf-text-muted)]">
                      {formatRelativeTime(item.closedAt)}
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

export default RecentlyClosedButton
