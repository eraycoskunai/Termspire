import { useCallback, useEffect, useRef, useState } from 'react'
import { stripAnsi } from '../lib/ansiStrip'
import { matchStatusPattern } from '../lib/statusPatterns'

export type PaneStatus = 'starting' | 'active' | 'waiting' | 'idle' | 'error' | 'exited'

interface UsePaneStatusEngineOptions {
  onStatusChange?: (next: PaneStatus, previous: PaneStatus) => void
}

export interface PaneStatusEngine {
  status: PaneStatus
  /** pty'den her data chunk geldiğinde çağrılır (metni ANSI'den arındırıp pattern test eder). */
  reportData: (chunk: string) => void
  /** pty.create() başarıyla resolve olduğunda çağrılır. */
  markRunning: () => void
  /** pty.create() reddedilirse (shell bulunamadı vb.) çağrılır. */
  reportCreateError: () => void
  /** pty process sonlandığında çağrılır. */
  reportExit: (exitCode: number) => void
}

const ACTIVE_HOLD_MS = 2500
const WAITING_HOLD_MS = 6000
const ERROR_HOLD_MS = 6000
const TICK_MS = 500
/**
 * Sadece chunk sınırlarında bölünen pattern'leri (ör. bir istemin birden
 * fazla pty data event'ine yayılması) yakalamak için önceki chunk'tan
 * taşınan küçük bir "üst üste binme" penceresi. BÜYÜK/kalıcı bir tampon
 * KASITLI OLARAK kullanılmaz: aksi halde scrollback'te bir kez geçen zararsız
 * bir kelime (ör. bir yardım metninde "error" geçmesi), pencerede kaldığı
 * sürece her yeni veri parçasında durumu sürekli yeniden "hata"ya tetikler.
 */
const PATTERN_OVERLAP_CHARS = 500

/**
 * Bir pane'in çalışma zamanı durumunu (aktif/onay bekliyor/boşta/hata/sonlandı)
 * çıktı üzerinde pattern matching + son veri zaman damgası kombinasyonuyla hesaplar.
 * Pane arka planda/zoom dışında olsa bile bu hook interval ile çalışmaya devam eder
 * (component unmount edilmediği sürece), böylece status her zaman güncel kalır.
 */
export function usePaneStatusEngine(options: UsePaneStatusEngineOptions = {}): PaneStatusEngine {
  const [status, setStatus] = useState<PaneStatus>('starting')
  const statusRef = useRef<PaneStatus>('starting')
  const finalRef = useRef<'exited' | 'error' | null>(null)
  const lastDataAtRef = useRef(0)
  const lastWaitingAtRef = useRef(0)
  const lastErrorAtRef = useRef(0)
  const bufferRef = useRef('')
  const onStatusChangeRef = useRef(options.onStatusChange)
  onStatusChangeRef.current = options.onStatusChange

  const applyStatus = useCallback((next: PaneStatus) => {
    if (statusRef.current === next) return
    const previous = statusRef.current
    statusRef.current = next
    setStatus(next)
    onStatusChangeRef.current?.(next, previous)
  }, [])

  const reportData = useCallback((chunk: string) => {
    if (finalRef.current) return
    const now = Date.now()
    lastDataAtRef.current = now
    const cleaned = stripAnsi(chunk)
    const window = bufferRef.current + cleaned
    bufferRef.current = window.slice(-PATTERN_OVERLAP_CHARS)
    const match = matchStatusPattern(window)
    if (match === 'error') lastErrorAtRef.current = now
    else if (match === 'waiting') lastWaitingAtRef.current = now
  }, [])

  const markRunning = useCallback(() => {
    if (finalRef.current) return
    applyStatus('idle')
  }, [applyStatus])

  const reportCreateError = useCallback(() => {
    finalRef.current = 'error'
    applyStatus('error')
  }, [applyStatus])

  const reportExit = useCallback(
    (exitCode: number) => {
      const next = exitCode === 0 ? 'exited' : 'error'
      finalRef.current = next
      applyStatus(next)
    },
    [applyStatus]
  )

  useEffect(() => {
    const interval = setInterval(() => {
      if (finalRef.current || statusRef.current === 'starting') return
      const now = Date.now()
      if (now - lastErrorAtRef.current < ERROR_HOLD_MS) applyStatus('error')
      else if (now - lastWaitingAtRef.current < WAITING_HOLD_MS) applyStatus('waiting')
      else if (now - lastDataAtRef.current < ACTIVE_HOLD_MS) applyStatus('active')
      else applyStatus('idle')
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [applyStatus])

  return { status, reportData, markRunning, reportCreateError, reportExit }
}
