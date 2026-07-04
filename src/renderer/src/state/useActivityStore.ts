import { create } from 'zustand'

export type ActivityKind = 'waiting' | 'error' | 'resource'

export interface ActivityEntry {
  id: string
  paneId: string
  workspaceId: string
  paneTitle: string
  kind: ActivityKind
  timestamp: number
}

const MAX_ENTRIES = 50

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

interface ActivityStore {
  entries: ActivityEntry[]
  addEntry: (entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => void
  clear: () => void
}

/**
 * Aşama 10: aktivite geçmişi — native bildirimler anlık gösterilip kaybolduğu
 * için, hangi pane'in ne zaman onay beklediğini/hata verdiğini kalıcı olmasa
 * da oturum boyunca listeleyen hafif bir günlük (kalıcı değildir, sadece bellekte).
 */
export const useActivityStore = create<ActivityStore>((set) => ({
  entries: [],
  addEntry: (entry) => {
    set((state) => ({
      entries: [{ ...entry, id: makeId(), timestamp: Date.now() }, ...state.entries].slice(
        0,
        MAX_ENTRIES
      )
    }))
  },
  clear: () => set({ entries: [] })
}))
