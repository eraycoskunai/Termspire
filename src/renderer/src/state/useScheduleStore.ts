import { create } from 'zustand'

export interface ScheduledCommand {
  id: string
  paneId: string
  paneTitle: string
  /** "HH:MM" formatında, yerel saat. */
  time: string
  command: string
  repeatDaily: boolean
  /** Aynı gün içinde tekrar tetiklenmeyi önlemek için son ateşlenme tarihi ("YYYY-MM-DD"). */
  lastFiredDateKey?: string
}

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `schedule-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

interface ScheduleStore {
  schedules: ScheduledCommand[]
  addSchedule: (input: Omit<ScheduledCommand, 'id' | 'lastFiredDateKey'>) => void
  removeSchedule: (id: string) => void
  markFired: (id: string, dateKey: string) => void
}

/**
 * Aşama 10: zamanlanmış komut enjeksiyonu — belirli bir saatte bir pane'e
 * otomatik komut yazan basit bir zamanlayıcı (ör. her sabah "git pull").
 * Oturum boyunca bellekte tutulur, kalıcı değildir.
 */
export const useScheduleStore = create<ScheduleStore>((set) => ({
  schedules: [],
  addSchedule: (input) => {
    set((state) => ({ schedules: [...state.schedules, { ...input, id: makeId() }] }))
  },
  removeSchedule: (id) => {
    set((state) => ({ schedules: state.schedules.filter((schedule) => schedule.id !== id) }))
  },
  markFired: (id, dateKey) => {
    set((state) => ({
      schedules: state.schedules.map((schedule) =>
        schedule.id === id ? { ...schedule, lastFiredDateKey: dateKey } : schedule
      )
    }))
  }
}))
