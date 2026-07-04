import { useEffect, useMemo, useRef, useState } from 'react'
import { findPaneOwner, useWorkspaceStore } from '../state/useWorkspaceStore'
import type { PaneStatus } from '../hooks/usePaneStatusEngine'
import { getAllPtyInstanceIds } from '../lib/ptyRegistry'
import { generateBootLines } from '../lib/hackerBootLines'
import { playHackerBreachAlertSound } from '../lib/hackerSound'

const HUD_MESSAGES = [
  'Güvenlik duvarı aşılıyor…',
  'Kernel şifreleri kırılıyor…',
  'Root erişimi kazanıldı.',
  'Exploit zinciri derleniyor…',
  'Uplink bağlantısı stabilize ediliyor…',
  'Sızma modülü aktif.',
  'Ajan süreçleri izleniyor…',
  'Bellek adresleri taranıyor…',
  'Paket enjeksiyonu tamamlandı.',
  'Şifreleme katmanı devre dışı.',
  'Üretim hızı kritik seviyede.',
  'Geri dönüş yok — kodlamaya mahkumsun.'
]

const MATRIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#%&*+-/=<>{}[]ﾊﾋﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾘﾙﾚﾛﾜ'

const FONT_SIZE = 15

interface RainDrop {
  y: number
  speed: number
}

interface TrailPoint {
  x: number
  y: number
  life: number
}

interface BreachAlert {
  paneTitle: string
}

const BOOT_LINE_INTERVAL_MS = 150
const BOOT_HOLD_MS = 550
const GLITCH_BURST_DURATION_MS = 220
const BREACH_ALERT_DURATION_MS = 2600
const STATS_REFRESH_MS = 2500

/**
 * Aşama 15: "Saldırı Modu" (Hacker Attack Mode) aktifken tüm ekranın üzerine
 * binen ambient katman. İki fazı vardır:
 * 1. `boot` — açılışta ~2 sn süren sahte "hackleme" boot sekansı (rastgele
 *    IP/hash/port satırları hızlıca akar).
 * 2. `live` — canvas tabanlı matrix-yağmuru, imleç ışık izi, sabit bir HUD
 *    durum kutusu (döngülü sahte sızma logları + GERÇEK canlı istatistikler:
 *    aktif pane sayısı, toplam CPU/RAM, bekleyen/hatalı pane sayısı), nadir
 *    ekran "glitch" patlamaları ve — bir pane GERÇEKTEN hata durumuna
 *    geçtiğinde — kırmızı bir "İHLAL ALARMI" (siren sesi + ekran titremesi).
 * Tamamı `pointer-events-none` olduğundan alttaki gerçek terminal
 * etkileşimini asla bloklamaz — sadece atmosferi değiştirir.
 */
function HackerModeOverlay(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trailCanvasRef = useRef<HTMLCanvasElement>(null)
  const activatedAtRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState('00:00')
  const [hudIndex, setHudIndex] = useState(0)
  const [flashVisible, setFlashVisible] = useState(true)

  const [bootLines] = useState(() => generateBootLines())
  const [phase, setPhase] = useState<'boot' | 'live'>('boot')
  const [visibleBootLines, setVisibleBootLines] = useState(0)

  const [glitching, setGlitching] = useState(false)
  const [breach, setBreach] = useState<BreachAlert | null>(null)
  const breachTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevStatusesRef = useRef<Record<string, PaneStatus>>({})

  const [stats, setStats] = useState({ cpu: 0, memoryBytes: 0 })

  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const paneStatuses = useWorkspaceStore((state) => state.paneStatuses)
  const paneCount = useMemo(
    () => Object.values(workspaces).reduce((sum, workspace) => sum + workspace.order.length, 0),
    [workspaces]
  )
  const alertCount = useMemo(
    () => Object.values(paneStatuses).filter((s) => s === 'waiting' || s === 'error').length,
    [paneStatuses]
  )

  useEffect(() => {
    const flashTimer = setTimeout(() => setFlashVisible(false), 550)
    return () => clearTimeout(flashTimer)
  }, [])

  // Boot sekansı: satırları teker teker "yazdırır", sonunda `live` fazına geçer.
  useEffect(() => {
    if (phase !== 'boot') return
    if (visibleBootLines >= bootLines.length) {
      const timer = setTimeout(() => setPhase('live'), BOOT_HOLD_MS)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setVisibleBootLines((count) => count + 1), BOOT_LINE_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [phase, visibleBootLines, bootLines.length])

  // Nadir, kısa "glitch" ekran patlamaları — kendi kendini yeniden zamanlayan
  // bir zincir olduğu için (state'e bağlı değil) diğer re-render'lardan etkilenmez.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    let burstTimeoutId: ReturnType<typeof setTimeout>
    function scheduleNext(): void {
      const delay = 14000 + Math.random() * 14000
      timeoutId = setTimeout(() => {
        setGlitching(true)
        burstTimeoutId = setTimeout(() => setGlitching(false), GLITCH_BURST_DURATION_MS)
        scheduleNext()
      }, delay)
    }
    scheduleNext()
    return () => {
      clearTimeout(timeoutId)
      clearTimeout(burstTimeoutId)
    }
  }, [])

  // Gerçek pane durumu izleme: bir pane YENİ olarak 'error' durumuna geçtiğinde
  // (önceden error DEĞİLKEN) kırmızı bir "İHLAL ALARMI" tetikler. Zamanlayıcı
  // manuel bir ref'te tutulur ki alarmın ekranda kalma süresi, ilgisiz bir
  // pane durum güncellemesiyle (effect cleanup) erken kesilmesin.
  useEffect(() => {
    const previous = prevStatusesRef.current
    let newlyErroredPaneId: string | null = null
    for (const [paneId, status] of Object.entries(paneStatuses)) {
      if (status === 'error' && previous[paneId] !== 'error') {
        newlyErroredPaneId = paneId
        break
      }
    }
    prevStatusesRef.current = paneStatuses
    if (!newlyErroredPaneId) return
    const owner = findPaneOwner(workspaces, newlyErroredPaneId)
    setBreach({ paneTitle: owner?.pane.title ?? 'Bilinmeyen pane' })
    playHackerBreachAlertSound()
    if (breachTimeoutRef.current) clearTimeout(breachTimeoutRef.current)
    breachTimeoutRef.current = setTimeout(() => setBreach(null), BREACH_ALERT_DURATION_MS)
  }, [paneStatuses, workspaces])

  useEffect(() => {
    return () => {
      if (breachTimeoutRef.current) clearTimeout(breachTimeoutRef.current)
    }
  }, [])

  // Gerçek toplam CPU/RAM — tüm canlı pty instance'larından periyodik olarak
  // "pull" edilir (Mission Control'ün önizleme mekanizmasıyla aynı felsefe).
  useEffect(() => {
    let disposed = false
    function refresh(): void {
      const ids = getAllPtyInstanceIds()
      Promise.all(ids.map((id) => window.api.pty.getUsage(id))).then((results) => {
        if (disposed) return
        let cpu = 0
        let memoryBytes = 0
        for (const usage of results) {
          if (!usage) continue
          cpu += usage.cpu
          memoryBytes += usage.memory
        }
        setStats({ cpu, memoryBytes })
      })
    }
    refresh()
    const interval = setInterval(refresh, STATS_REFRESH_MS)
    return () => {
      disposed = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const diffSec = Math.floor((Date.now() - activatedAtRef.current) / 1000)
      const mm = String(Math.floor(diffSec / 60)).padStart(2, '0')
      const ss = String(diffSec % 60).padStart(2, '0')
      setElapsed(`${mm}:${ss}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setHudIndex((current) => (current + 1) % HUD_MESSAGES.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // `canvas` elemanı yalnızca `live` fazında render edilir (bkz. JSX) — bu
    // effect'in `phase`'e bağlı olması ŞART, aksi halde `boot` fazındaki ilk
    // mount'ta `canvasRef.current` null olur ve `[]` bağımlılığıyla effect bir
    // daha hiç çalışmadığından yağmur asla başlamaz (FileEditorPanel'deki
    // container-mount race condition'ıyla aynı hata sınıfı).
    if (phase !== 'live') return
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    // Kapatılan closure'lar (setup/draw) içinde TS'in null narrowing'i koruması
    // için kesin (non-null) tipli yeni yerel referanslara alıyoruz.
    const canvasEl: HTMLCanvasElement = canvas
    const ctx: CanvasRenderingContext2D = context

    let width = window.innerWidth
    let height = window.innerHeight
    let drops: RainDrop[] = []

    function setup(): void {
      width = window.innerWidth
      height = window.innerHeight
      canvasEl.width = width
      canvasEl.height = height
      const columns = Math.max(1, Math.floor(width / FONT_SIZE))
      drops = Array.from({ length: columns }, () => ({
        y: Math.random() * height,
        speed: 2 + Math.random() * 4
      }))
    }
    setup()

    function handleResize(): void {
      setup()
    }
    window.addEventListener('resize', handleResize)

    let rafId = 0
    let lastFrameAt = 0
    function draw(timestamp: number): void {
      rafId = requestAnimationFrame(draw)
      // ~24fps yeterli — matrix yağmuru için daha yükseği CPU'ya gereksiz yük bindirir.
      if (timestamp - lastFrameAt < 42) return
      lastFrameAt = timestamp
      ctx.fillStyle = 'rgba(3, 10, 6, 0.16)'
      ctx.fillRect(0, 0, width, height)
      ctx.font = `${FONT_SIZE}px "Cascadia Mono", Consolas, monospace`
      drops.forEach((drop, index) => {
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
        const x = index * FONT_SIZE
        ctx.fillStyle = Math.random() > 0.975 ? '#e8fff2' : 'rgba(34, 255, 130, 0.85)'
        ctx.fillText(char, x, drop.y)
        drop.y += drop.speed
        if (drop.y > height && Math.random() > 0.975) drop.y = 0
      })
    }
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [phase])

  // İmleç ışık izi: fare hareket ettikçe kısa ömürlü, sönümlenen neon
  // parçacıklar bırakır. Ayrı, hafif bir canvas — matrix yağmuru canvas'ından
  // bağımsız temizlenir (clearRect), tam ekran yeniden çizim yapmaz.
  useEffect(() => {
    if (phase !== 'live') return
    const canvas = trailCanvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const canvasEl: HTMLCanvasElement = canvas
    const ctx: CanvasRenderingContext2D = context

    function resize(): void {
      canvasEl.width = window.innerWidth
      canvasEl.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let points: TrailPoint[] = []
    function handleMouseMove(event: MouseEvent): void {
      points.push({ x: event.clientX, y: event.clientY, life: 1 })
      if (points.length > 40) points.shift()
    }
    window.addEventListener('mousemove', handleMouseMove)

    let rafId = 0
    function draw(): void {
      rafId = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
      for (const point of points) {
        ctx.beginPath()
        ctx.fillStyle = `rgba(34, 255, 130, ${(point.life * 0.55).toFixed(2)})`
        ctx.arc(point.x, point.y, 5 * point.life + 1, 0, Math.PI * 2)
        ctx.fill()
        point.life -= 0.045
      }
      points = points.filter((point) => point.life > 0)
    }
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [phase])

  if (phase === 'boot') {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black"
        aria-hidden="true"
      >
        <div className="w-full max-w-xl px-6 font-mono text-[13px] leading-relaxed text-emerald-400">
          {bootLines.slice(0, visibleBootLines).map((line, index) => (
            <div
              key={index}
              className={index === bootLines.length - 1 ? 'font-bold text-emerald-300' : undefined}
            >
              {line}
            </div>
          ))}
          {visibleBootLines < bootLines.length && (
            <span className="animate-pulse text-emerald-300">▌</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-[0.17] mix-blend-screen"
      />
      <canvas ref={trailCanvasRef} className="absolute inset-0 h-full w-full" />
      <div className="mtf-hacker-frame" />
      {breach && <div className="mtf-hacker-breach" />}
      {glitching && (
        <>
          <div className="mtf-hacker-glitch-layer mtf-hacker-glitch-red" />
          <div className="mtf-hacker-glitch-layer mtf-hacker-glitch-cyan" />
        </>
      )}
      {flashVisible && <div className="mtf-hacker-flash" />}
      <div
        className={
          'absolute left-3 top-3 min-w-[240px] rounded border px-3 py-2 font-mono text-[11px] transition-colors ' +
          (breach
            ? 'border-red-500/60 bg-black/80 shadow-[0_0_18px_rgba(239,68,68,0.55)]'
            : 'border-emerald-500/40 bg-black/70 shadow-[0_0_18px_rgba(16,255,130,0.35)]')
        }
      >
        <div
          className={
            'mtf-hacker-glitch-text font-bold tracking-widest ' +
            (breach ? 'text-red-400' : 'text-emerald-300')
          }
        >
          {breach ? '⚠ İHLAL TESPİT EDİLDİ ⚠' : '⚠ SALDIRI MODU AKTİF ⚠'}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-emerald-400/80">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          SÜRE: {elapsed}
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-emerald-400/70">
          <span>PANE: {paneCount}</span>
          <span>UYARI: {alertCount}</span>
          <span>CPU: %{stats.cpu.toFixed(0)}</span>
          <span>RAM: {(stats.memoryBytes / (1024 * 1024)).toFixed(0)} MB</span>
        </div>
        <div
          className={
            'mt-1.5 max-w-[260px] ' +
            (breach ? 'font-semibold text-red-300' : 'text-emerald-400/70')
          }
        >
          {breach ? `"${breach.paneTitle}" pane'inde hata tespit edildi!` : HUD_MESSAGES[hudIndex]}
        </div>
      </div>
    </div>
  )
}

export default HackerModeOverlay
