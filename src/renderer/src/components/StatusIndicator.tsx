import type { PaneStatus } from '../hooks/usePaneStatusEngine'
import { useT, type TranslationKey } from '../hooks/useTranslation'

const STATUS_META: Record<PaneStatus, { color: string; labelKey: TranslationKey; pulse?: boolean }> = {
  starting: { color: 'bg-amber-500', labelKey: 'status.starting', pulse: true },
  active: { color: 'bg-emerald-500', labelKey: 'status.active' },
  waiting: { color: 'bg-yellow-400', labelKey: 'status.waiting', pulse: true },
  idle: { color: 'bg-neutral-500', labelKey: 'status.idle' },
  error: { color: 'bg-red-500', labelKey: 'status.error' },
  exited: { color: 'bg-neutral-600', labelKey: 'status.exited' }
}

interface StatusIndicatorProps {
  status: PaneStatus
}

/** Pane başlık çubuğunda gösterilen durum noktası (Aşama 5: pattern-matching status engine). */
function StatusIndicator({ status }: StatusIndicatorProps): React.JSX.Element {
  const t = useT()
  const meta = STATUS_META[status]
  return (
    <span
      title={t(meta.labelKey)}
      className={`h-2 w-2 shrink-0 rounded-full ${meta.color} ${meta.pulse ? 'animate-pulse' : ''}`}
    />
  )
}

export default StatusIndicator
