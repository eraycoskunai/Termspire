import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useWorkspaceStore, type WorkspaceState } from '../state/useWorkspaceStore'
import type { PaneStatus } from '../hooks/usePaneStatusEngine'
import StatusIndicator from './StatusIndicator'
import { getPaneHandle } from '../lib/paneHandleRegistry'
import { markSoftClosed } from '../lib/softClosedPtys'
import { useT, type TFunction } from '../hooks/useTranslation'

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** Aşama 10: workspace sekmelerinin dnd-kit droppable id'lerinde kullandığı önek. */
export const WORKSPACE_TAB_DROP_PREFIX = 'workspace-tab-'

/** Bir workspace'in sekmede gösterilecek özet durumu: içindeki pane'lerden en "acil" olanı. */
function getWorkspaceBadge(
  workspace: WorkspaceState,
  paneStatuses: Record<string, PaneStatus>
): 'error' | 'waiting' | null {
  let hasWaiting = false
  for (const paneId of workspace.order) {
    const status = paneStatuses[paneId]
    if (status === 'error') return 'error'
    if (status === 'waiting') hasWaiting = true
  }
  return hasWaiting ? 'waiting' : null
}

interface WorkspaceTabProps {
  workspace: WorkspaceState
  isActive: boolean
  badge: 'error' | 'waiting' | null
  canClose: boolean
  editingId: string | null
  editValue: string
  onEditValueChange: (value: string) => void
  onSelect: () => void
  onStartRename: () => void
  onCommitRename: () => void
  onCancelRename: () => void
  onClose: () => void
  t: TFunction
}

/** Tek bir workspace sekmesi — cross-workspace pane sürükleme için droppable alan. */
function WorkspaceTab({
  workspace,
  isActive,
  badge,
  canClose,
  editingId,
  editValue,
  onEditValueChange,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onClose,
  t
}: WorkspaceTabProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: `${WORKSPACE_TAB_DROP_PREFIX}${workspace.id}`
  })
  const isEditing = editingId === workspace.id

  return (
    <div
      ref={setNodeRef}
      role="tab"
      aria-selected={isActive}
      onClick={onSelect}
      onDoubleClick={onStartRename}
      title={!isActive ? t('workspaceTab.dropHint') : undefined}
      className={cx(
        'group flex shrink-0 cursor-pointer items-center gap-2 rounded-t-md border-b-2 px-3 py-1.5 text-xs transition-colors',
        isActive
          ? 'border-blue-500 bg-[var(--mtf-surface)] text-[var(--mtf-text)]'
          : 'border-transparent text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]',
        isOver && !isActive && 'bg-blue-500/20 ring-2 ring-blue-500'
      )}
    >
      {badge && <StatusIndicator status={badge} />}
      {isEditing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(event) => onEditValueChange(event.target.value)}
          onBlur={onCommitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onCommitRename()
            if (event.key === 'Escape') onCancelRename()
          }}
          onClick={(event) => event.stopPropagation()}
          className="w-24 rounded border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-1 py-0.5 text-xs text-[var(--mtf-text)] outline-none"
        />
      ) : (
        <span className="max-w-[10rem] truncate">{workspace.name}</span>
      )}
      <span className="text-[10px] text-[var(--mtf-text-muted)]">{workspace.order.length}</span>
      {canClose && (
        <button
          type="button"
          title={t('workspaceTab.close')}
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
          className="rounded px-1 text-[var(--mtf-text-muted)] opacity-0 hover:bg-red-900/60 hover:text-red-200 group-hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  )
}

/**
 * Aşama 6: workspace sekmeleri. Her workspace kendi pane setini/layout'unu
 * korur; sekme değişimi sadece `activeWorkspaceId`'i günceller — pane'ler
 * unmount edilmez (bkz. App.tsx'teki CSS tabanlı gizleme).
 */
function WorkspaceTabBar(): React.JSX.Element {
  const t = useT()
  const workspaceOrder = useWorkspaceStore((state) => state.workspaceOrder)
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace)
  const addWorkspace = useWorkspaceStore((state) => state.addWorkspace)
  const removeWorkspace = useWorkspaceStore((state) => state.removeWorkspace)
  const renameWorkspace = useWorkspaceStore((state) => state.renameWorkspace)
  const paneStatuses = useWorkspaceStore((state) => state.paneStatuses)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  function startRename(id: string, currentName: string): void {
    setEditingId(id)
    setEditValue(currentName)
  }

  function commitRename(): void {
    if (editingId) renameWorkspace(editingId, editValue)
    setEditingId(null)
  }

  /**
   * Aşama 12: workspace kapatılırken içindeki tüm pane'lerin gerçek pty
   * process'leri ÖLDÜRÜLMEZ — her biri tek tek "geri alınabilir" şekilde
   * detach edilir. Workspace "Geri Al" ile geri geldiğinde her pane kendi
   * mount effect'inde bu process'e otomatik yeniden bağlanır.
   */
  function handleCloseWorkspace(workspaceId: string): void {
    const workspace = workspaces[workspaceId]
    if (workspace) {
      for (const paneId of workspace.order) {
        const handle = getPaneHandle(paneId)
        const livePtyInstanceId = handle?.prepareForSoftClose() ?? null
        if (livePtyInstanceId) markSoftClosed(paneId, livePtyInstanceId)
      }
    }
    removeWorkspace(workspaceId)
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-2 py-1">
      {workspaceOrder.map((id) => {
        const workspace = workspaces[id]
        if (!workspace) return null
        const isActive = id === activeWorkspaceId
        const badge = !isActive ? getWorkspaceBadge(workspace, paneStatuses) : null
        return (
          <WorkspaceTab
            key={id}
            workspace={workspace}
            isActive={isActive}
            badge={badge}
            canClose={workspaceOrder.length > 1}
            editingId={editingId}
            editValue={editValue}
            onEditValueChange={setEditValue}
            onSelect={() => setActiveWorkspace(id)}
            onStartRename={() => startRename(id, workspace.name)}
            onCommitRename={commitRename}
            onCancelRename={() => setEditingId(null)}
            onClose={() => handleCloseWorkspace(id)}
            t={t}
          />
        )
      })}
      <button
        type="button"
        title={t('workspaceTab.new')}
        onClick={() => addWorkspace()}
        className="shrink-0 rounded-md px-2 py-1 text-sm leading-none text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
      >
        +
      </button>
    </div>
  )
}

export default WorkspaceTabBar
