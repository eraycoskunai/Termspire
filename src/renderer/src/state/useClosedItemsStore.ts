import { create } from 'zustand'
import type { PaneState, WorkspaceState } from './useWorkspaceStore'
import { finalizeSoftClosedPty } from '../lib/softClosedPtys'

/**
 * Aşama 12: "yanlışlıkla kapattım, geri al" — kapatılan pane/workspace'lerin
 * tam anlık görüntüsünü (config, isim, konum) bir yığında tutar. Sadece
 * oturum boyunca bellekte tutulur (activityStore/scheduleStore ile aynı
 * desen); uygulama yeniden başlatıldığında sıfırlanır.
 */
export type ClosedItem =
  | {
      id: string
      type: 'pane'
      closedAt: number
      workspaceId: string
      workspaceName: string
      pane: PaneState
      /** Kapatılmadan önceki sıradaki konumu — geri alınca aynı yere döner. */
      index: number
    }
  | {
      id: string
      type: 'workspace'
      closedAt: number
      workspace: WorkspaceState
      /** Kapatılmadan önceki sekme sırasındaki konumu. */
      index: number
    }

const MAX_ENTRIES = 20

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `closed-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * Aşama 12: bir ClosedItem listeden kalıcı olarak atılırken (kapasite dolduğu
 * için en eskisi düşürüldüğünde veya "Temizle"ye basıldığında) çağrılır.
 * Kapatılırken canlı bırakılmış (soft-close) pty'ler varsa artık gerçekten
 * öldürülür — aksi halde bir daha asla reattach edilemeyecek "hayalet"
 * process'ler sonsuza kadar bellekte/CPU'da kalır.
 */
function finalizeItem(item: ClosedItem): void {
  if (item.type === 'pane') {
    finalizeSoftClosedPty(item.pane.id)
  } else {
    for (const paneId of item.workspace.order) finalizeSoftClosedPty(paneId)
  }
}

interface ClosedItemsStore {
  items: ClosedItem[]
  pushClosedPane: (input: {
    workspaceId: string
    workspaceName: string
    pane: PaneState
    index: number
  }) => void
  pushClosedWorkspace: (input: { workspace: WorkspaceState; index: number }) => void
  remove: (id: string) => void
  clear: () => void
}

export const useClosedItemsStore = create<ClosedItemsStore>((set, get) => ({
  items: [],
  pushClosedPane: (input) => {
    const item: ClosedItem = {
      id: makeId(),
      type: 'pane',
      closedAt: Date.now(),
      workspaceId: input.workspaceId,
      workspaceName: input.workspaceName,
      pane: input.pane,
      index: input.index
    }
    const next = [item, ...get().items]
    const evicted = next.slice(MAX_ENTRIES)
    for (const evictedItem of evicted) finalizeItem(evictedItem)
    set({ items: next.slice(0, MAX_ENTRIES) })
  },
  pushClosedWorkspace: (input) => {
    const item: ClosedItem = {
      id: makeId(),
      type: 'workspace',
      closedAt: Date.now(),
      workspace: input.workspace,
      index: input.index
    }
    const next = [item, ...get().items]
    const evicted = next.slice(MAX_ENTRIES)
    for (const evictedItem of evicted) finalizeItem(evictedItem)
    set({ items: next.slice(0, MAX_ENTRIES) })
  },
  remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  clear: () => {
    for (const item of get().items) finalizeItem(item)
    set({ items: [] })
  }
}))
