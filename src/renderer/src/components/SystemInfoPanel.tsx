import { useEffect, useRef, useState } from 'react'
import type { SysInfoSnapshot } from '@shared/types'
import { useT } from '../hooks/useTranslation'

const REFRESH_INTERVAL_MS = 2000

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}g`)
  if (hours > 0 || days > 0) parts.push(`${hours}sa`)
  parts.push(`${minutes}dk`)
  return parts.join(' ')
}

function usageBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function UsageBar({ percent }: { percent: number }): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--mtf-surface-2)]">
      <div
        className={`h-full rounded-full transition-[width] ${usageBarColor(clamped)}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

/**
 * Aşama 16: sistem bilgisi paneli — canlı CPU/RAM/disk/uptime anlık görüntüsü.
 * ActivityLogButton ile aynı "toolbar butonu + açılır panel" desenini kullanır.
 * Panel açıkken her `REFRESH_INTERVAL_MS`'de bir main process'ten yeni bir
 * örneklem çekilir (kapalıyken hiçbir polling yapılmaz — boşta CPU harcamaz).
 */
function SystemInfoPanel(): React.JSX.Element {
  const t = useT()
  const [isOpen, setIsOpen] = useState(false)
  const [snapshot, setSnapshot] = useState<SysInfoSnapshot | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    function refresh(): void {
      window.api.sysInfo.get().then((result) => {
        if (!cancelled) setSnapshot(result)
      })
    }
    refresh()
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isOpen])

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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title={t('sysInfo.title')}
        onClick={() => setIsOpen((value) => !value)}
        className={
          'rounded-md border px-2.5 py-1.5 text-xs font-medium ' +
          (isOpen
            ? 'border-blue-500 bg-blue-600 text-white'
            : 'border-[var(--mtf-border)] text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]')
        }
      >
        {t('sysInfo.short')}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-surface)] p-3 text-xs shadow-xl">
          {!snapshot ? (
            <p className="py-4 text-center text-[var(--mtf-text-muted)]">{t('sysInfo.loading')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--mtf-text)]">
                  {snapshot.hostname} · {snapshot.platform}/{snapshot.arch}
                </span>
                <span className="text-[var(--mtf-text-muted)]">
                  ⏱ {formatUptime(snapshot.uptimeSec)}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[var(--mtf-text-muted)]">
                  <span className="truncate pr-2" title={snapshot.cpuModel}>
                    CPU · {snapshot.cpuModel}
                  </span>
                  <span className="shrink-0 font-mono text-[var(--mtf-text)]">
                    {snapshot.cpuUsagePercent.toFixed(0)}%
                  </span>
                </div>
                <UsageBar percent={snapshot.cpuUsagePercent} />
                {snapshot.perCoreUsagePercent.length > 1 && (
                  <div className="mt-1 grid grid-cols-8 gap-0.5">
                    {snapshot.perCoreUsagePercent.map((core, index) => (
                      <div
                        key={index}
                        title={t('sysInfo.core', { n: index + 1, value: core.toFixed(0) })}
                        className="h-4 rounded-sm bg-[var(--mtf-surface-2)]"
                        style={{
                          background: `linear-gradient(to top, ${
                            core >= 90 ? '#ef4444' : core >= 70 ? '#f59e0b' : '#10b981'
                          } ${Math.max(4, Math.min(100, core))}%, var(--mtf-surface-2) 0)`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[var(--mtf-text-muted)]">
                  <span>
                    RAM · {formatBytes(snapshot.totalMemBytes - snapshot.freeMemBytes)} /{' '}
                    {formatBytes(snapshot.totalMemBytes)}
                  </span>
                  <span className="shrink-0 font-mono text-[var(--mtf-text)]">
                    {(
                      ((snapshot.totalMemBytes - snapshot.freeMemBytes) /
                        Math.max(1, snapshot.totalMemBytes)) *
                      100
                    ).toFixed(0)}
                    %
                  </span>
                </div>
                <UsageBar
                  percent={
                    ((snapshot.totalMemBytes - snapshot.freeMemBytes) /
                      Math.max(1, snapshot.totalMemBytes)) *
                    100
                  }
                />
              </div>

              {snapshot.disks.length > 0 && (
                <div className="flex flex-col gap-2">
                  {snapshot.disks.map((disk) => {
                    const used = disk.totalBytes - disk.freeBytes
                    const percent = (used / Math.max(1, disk.totalBytes)) * 100
                    return (
                      <div key={disk.mount} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[var(--mtf-text-muted)]">
                          <span>
                            💾 {disk.mount} · {formatBytes(used)} / {formatBytes(disk.totalBytes)}
                          </span>
                          <span className="shrink-0 font-mono text-[var(--mtf-text)]">
                            {percent.toFixed(0)}%
                          </span>
                        </div>
                        <UsageBar percent={percent} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SystemInfoPanel
