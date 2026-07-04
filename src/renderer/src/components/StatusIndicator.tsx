import type { PaneStatus } from '../hooks/usePaneStatusEngine'

const STATUS_META: Record<PaneStatus, { color: string; label: string; pulse?: boolean }> = {
  starting: { color: 'bg-amber-500', label: 'Başlatılıyor', pulse: true },
  active: { color: 'bg-emerald-500', label: 'Aktif' },
  waiting: { color: 'bg-yellow-400', label: 'Onay/giriş bekliyor', pulse: true },
  idle: { color: 'bg-neutral-500', label: 'Boşta' },
  error: { color: 'bg-red-500', label: 'Hata' },
  exited: { color: 'bg-neutral-600', label: 'Sonlandı' }
}

interface StatusIndicatorProps {
  status: PaneStatus
}

/** Pane başlık çubuğunda gösterilen durum noktası (Aşama 5: pattern-matching status engine). */
function StatusIndicator({ status }: StatusIndicatorProps): React.JSX.Element {
  const meta = STATUS_META[status]
  return (
    <span
      title={meta.label}
      className={`h-2 w-2 shrink-0 rounded-full ${meta.color} ${meta.pulse ? 'animate-pulse' : ''}`}
    />
  )
}

export default StatusIndicator
