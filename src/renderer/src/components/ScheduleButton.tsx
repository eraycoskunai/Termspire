import { useEffect, useMemo, useRef, useState } from 'react'
import { useScheduleStore } from '../state/useScheduleStore'
import { useT } from '../hooks/useTranslation'

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

interface ScheduleButtonProps {
  paneId: string
  paneTitle: string
}

/**
 * Aşama 10: pane başlığındaki "⏰" butonu — belirli bir saatte bu pane'e otomatik
 * bir komut enjekte edecek zamanlayıcılar eklemeyi/silmeyi sağlayan açılır panel.
 * Gerçek tetikleme App.tsx'teki global ticker tarafından yapılır.
 */
function ScheduleButton({ paneId, paneTitle }: ScheduleButtonProps): React.JSX.Element {
  const t = useT()
  // Not: seçicinin doğrudan `.filter()` sonucu döndürmesi, her state değişiminde
  // (hatta başka bir pane'e ait olsa bile) yeni bir array referansı üretir; bu da
  // React 18'in useSyncExternalStore'unda sonsuz render döngüsüne ("Maximum
  // update depth exceeded") yol açar. Bu yüzden ham diziyi seçip filtrelemeyi
  // ayrı bir useMemo'ya taşıyoruz.
  const allSchedules = useScheduleStore((state) => state.schedules)
  const schedules = useMemo(
    () => allSchedules.filter((schedule) => schedule.paneId === paneId),
    [allSchedules, paneId]
  )
  const addSchedule = useScheduleStore((state) => state.addSchedule)
  const removeSchedule = useScheduleStore((state) => state.removeSchedule)
  const [isOpen, setIsOpen] = useState(false)
  const [time, setTime] = useState('09:00')
  const [command, setCommand] = useState('')
  const [repeatDaily, setRepeatDaily] = useState(true)
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

  function handleAdd(): void {
    if (!command.trim()) return
    addSchedule({ paneId, paneTitle, time, command: command.trim(), repeatDaily })
    setCommand('')
  }

  return (
    <div ref={containerRef} className="relative" onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        title={t('schedule.title')}
        onClick={() => setIsOpen((value) => !value)}
        className={cx(
          'rounded px-1.5 py-0.5 hover:bg-[var(--mtf-hover)]',
          schedules.length > 0
            ? 'text-blue-400 hover:text-blue-300'
            : 'text-[var(--mtf-text-muted)] hover:text-[var(--mtf-text)]'
        )}
      >
        ⏰{schedules.length > 0 && <span className="ml-0.5 text-[9px]">{schedules.length}</span>}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-60 rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-surface)] p-2 text-xs shadow-xl">
          <p className="mb-1.5 truncate font-medium text-[var(--mtf-text)]">
            {t('schedule.heading', { title: paneTitle })}
          </p>
          {schedules.length > 0 && (
            <div className="mb-2 max-h-32 space-y-1 overflow-y-auto">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between gap-1 rounded bg-[var(--mtf-surface-2)] px-1.5 py-1"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[var(--mtf-text)]">
                    {schedule.time} {schedule.repeatDaily ? '↻' : ''} {schedule.command}
                  </span>
                  <button
                    type="button"
                    title={t('schedule.delete')}
                    onClick={() => removeSchedule(schedule.id)}
                    className="shrink-0 text-[var(--mtf-text-muted)] hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="rounded border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-1 py-0.5 text-[var(--mtf-text)] outline-none focus:border-blue-500"
            />
            <label className="flex items-center gap-1 text-[var(--mtf-text-muted)]">
              <input
                type="checkbox"
                checked={repeatDaily}
                onChange={(event) => setRepeatDaily(event.target.checked)}
                className="h-3 w-3 accent-blue-500"
              />
              {t('schedule.repeatDaily')}
            </label>
          </div>
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleAdd()
            }}
            placeholder={t('schedule.commandPlaceholder')}
            className="mt-1.5 w-full rounded border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-1.5 py-1 text-[var(--mtf-text)] outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="mt-1.5 w-full rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-500"
          >
            {t('schedule.add')}
          </button>
        </div>
      )}
    </div>
  )
}

export default ScheduleButton
