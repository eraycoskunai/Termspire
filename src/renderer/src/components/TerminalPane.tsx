import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { HTMLAttributes } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'
import { SerializeAddon } from '@xterm/addon-serialize'
import type { PtyCreateOptions, PtyUsage } from '@shared/types'
import { getShellMeta } from '../lib/shellMeta'
import { usePaneStatusEngine, type PaneStatus } from '../hooks/usePaneStatusEngine'
import { getPtyInstanceId, registerPtyInstance, unregisterPtyInstance } from '../lib/ptyRegistry'
import { registerFlushHandler, unregisterFlushHandler } from '../lib/flushRegistry'
import { takeSoftClosedPtyInstanceId } from '../lib/softClosedPtys'
import { recordCrashAndDecide, resetCrashLoop } from '../lib/crashLoopTracker'
import type { ThemeMode } from '../state/useUiStore'
import StatusIndicator from './StatusIndicator'
import ScheduleButton from './ScheduleButton'
import SessionReplayPanel from './SessionReplayPanel'
import { useT } from '../hooks/useTranslation'
import '@xterm/xterm/css/xterm.css'

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export interface TerminalPaneHandle {
  search: (term: string) => boolean
  searchNext: (term: string) => boolean
  searchPrevious: (term: string) => boolean
  clearSearch: () => void
  /**
   * Aşama 12: pane "geri alınabilir" şekilde kapatılmadan önce çağrılır.
   * Gerçek pty process'ini ÖLDÜRMEDEN arka planda canlı bırakır (detach) ve
   * o anki canlı ptyInstanceId'yi döner — çağıran taraf bunu
   * `markSoftClosed(paneId, id)` ile kaydetmelidir ki "Geri Al" bu process'e
   * yeniden bağlanabilsin. Henüz bir pty spawn edilmemişse null döner.
   */
  prepareForSoftClose: () => string | null
  /** Aşama 14: Komut Paleti/Mission Control'den "pane'e git" — xterm'in gerçek klavye odağını alır. */
  focusTerminal: () => void
  /** Aşama 14: Mission Control'deki mini önizleme için ekranın son N satırını düz metin olarak döner. */
  getPreviewLines: (maxLines?: number) => string[]
}

export interface TerminalPaneProps {
  /** Grid/store içindeki kalıcı kimlik; aynı zamanda main process'teki pty id'sidir. */
  paneId: string
  config: PtyCreateOptions
  title: string
  color?: string
  theme?: ThemeMode
  isZoomed?: boolean
  onClose?: () => void
  onToggleZoom?: () => void
  onRestart?: () => void
  /** Status engine her değiştiğinde çağrılır — ör. workspace sekmesinde rozet göstermek için. */
  onStatusChange?: (status: PaneStatus) => void
  /** Aşama 14: CPU/RAM sürdürülebilir şekilde eşik üstüne çıktığında ("runaway process") tetiklenir. */
  onResourceAlarm?: (usage: PtyUsage) => void
  /** Aşama 12: pane'e tıklanınca/odaklanınca çağrılır — dosya paneli bu pane'in dizinine geçer. */
  onFocusPane?: () => void
  /** Aşama 10: process çökerse (exit code != 0) otomatik yeniden başlatma. */
  autoRestart?: boolean
  onToggleAutoRestart?: () => void
  /** dnd-kit useDraggable'dan gelen ref/attributes/listeners — sadece başlık alanına uygulanır. */
  dragHandleRef?: (node: HTMLElement | null) => void
  dragHandleProps?: HTMLAttributes<HTMLDivElement>
  /** Aşama 8: broadcast input. */
  showBroadcastToggle?: boolean
  isBroadcastTarget?: boolean
  onToggleBroadcastTarget?: () => void
  /** Bu pane'e yazılan verinin de gönderileceği diğer pane id'leri (broadcast grubu). */
  broadcastPeerIds?: string[]
  /** Aşama 10: pane çıktı boru hattı — bu pane'in çıktısının akıtılabileceği diğer pane'ler. */
  pipeOptions?: Array<{ id: string; title: string }>
  pipeTargetId?: string
  onSetPipeTarget?: (targetId: string | null) => void
}

const DARK_XTERM_THEME = {
  background: '#0a0b10',
  foreground: '#e5e7eb',
  cursor: '#e5e7eb',
  selectionBackground: '#3b82f680',
  black: '#0a0b10',
  brightBlack: '#4b5563'
}

const LIGHT_XTERM_THEME = {
  background: '#ffffff',
  foreground: '#18181b',
  cursor: '#18181b',
  selectionBackground: '#3b82f640',
  black: '#f4f4f5',
  brightBlack: '#a1a1aa'
}

function getXtermTheme(theme: ThemeMode): typeof DARK_XTERM_THEME {
  return theme === 'light' ? LIGHT_XTERM_THEME : DARK_XTERM_THEME
}

/** Aşama 9: pane'in başlığındaki CPU/RAM rozetini biçimlendirir (ör. "3% · 42 MB"). */
function formatUsage(usage: PtyUsage): string {
  const cpu = Math.round(usage.cpu)
  const mb = usage.memory / (1024 * 1024)
  const memoryLabel = mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
  return `${cpu}% · ${memoryLabel}`
}

/** Aşama 11: "kaldığın yerden devam et" için diske yazılan scrollback kaç satırla sınırlı olsun. */
const SCROLLBACK_SAVE_LINES = 1000
/** Periyodik otomatik tampon kaydı aralığı — gerçek çıkışta ayrıca anlık flush da tetiklenir. */
const BUFFER_SAVE_INTERVAL_MS = 15000
/** Aşama 14: tam oturum kaydı/replay — geçmiş anlık görüntüsü için scrollback/aralık. */
const HISTORY_SNAPSHOT_LINES = 300
const HISTORY_SNAPSHOT_INTERVAL_MS = 60000
/**
 * Container boyutu değiştiğinde (kiosk modu aç/kapa, pane zoom, pencere
 * yeniden boyutlandırma vb.) fit()+pty resize uygulanmadan önce beklenen
 * "sessizlik" penceresi. Aynı anda birçok pane resize olduğunda tekrarlanan
 * SIGWINCH/redraw döngülerini tek bir uygulamaya indirger, görsel titremeyi azaltır.
 */
const RESIZE_DEBOUNCE_MS = 80
/**
 * Aşama 14: crash-loop koruması — process bu kadar süre kesintisiz çalışırsa
 * önceki çökme sayacı sıfırlanır (gerçek bir toparlanma kabul edilir).
 */
const STABILITY_RESET_MS = 20000
/** Aşama 14: kaynak alarmı eşikleri — "runaway process" tespiti için. */
const RESOURCE_ALARM_RAM_BYTES = 1.5 * 1024 * 1024 * 1024
const RESOURCE_ALARM_CPU_PERCENT = 180
const RESOURCE_ALARM_STREAK_REQUIRED = 3

/** Aşama 9: durum bazlı ambient "nabız" efekti — pane'in ne durumda olduğunu kenarlıktan da hissettirir. */
const STATUS_GLOW_CLASS: Partial<Record<PaneStatus, string>> = {
  waiting: 'animate-pane-glow-waiting',
  error: 'animate-pane-glow-error',
  active: 'animate-pane-glow-active'
}

/**
 * Tek bir gerçek terminal oturumunu (xterm.js render + node-pty backend)
 * temsil eden component. Grid/workspace mantığı bilmez; paneId'sini sabit
 * bir kimlik olarak kullanıp kendi pty process'ini yönetir. Status hesaplama
 * (aktif/onay bekliyor/boşta/hata) ve bildirim tetikleme usePaneStatusEngine'de.
 * Global arama (Aşama 8) için forwardRef ile search API'si dışa açılır.
 */
const TerminalPane = forwardRef<TerminalPaneHandle, TerminalPaneProps>(function TerminalPane(
  {
    paneId,
    config,
    title,
    color,
    theme = 'dark',
    isZoomed,
    onClose,
    onToggleZoom,
    onRestart,
    onStatusChange,
    onResourceAlarm,
    onFocusPane,
    autoRestart,
    onToggleAutoRestart,
    dragHandleRef,
    dragHandleProps,
    showBroadcastToggle,
    isBroadcastTarget,
    onToggleBroadcastTarget,
    broadcastPeerIds,
    pipeOptions,
    pipeTargetId,
    onSetPipeTarget
  },
  ref
) {
  const t = useT()
  const tRef = useRef(t)
  tRef.current = t
  const containerRef = useRef<HTMLDivElement>(null)
  const shellMeta = getShellMeta(config.shell)
  const titleRef = useRef(title)
  titleRef.current = title
  const termRef = useRef<Terminal | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const broadcastPeerIdsRef = useRef<string[]>(broadcastPeerIds ?? [])
  broadcastPeerIdsRef.current = broadcastPeerIds ?? []
  const pipeTargetIdRef = useRef<string | undefined>(pipeTargetId)
  pipeTargetIdRef.current = pipeTargetId
  /** Aktif pty process kimliği; effect dışından (hızlı onay butonları) yazma yapabilmek için ref'te tutulur. */
  const ptyInstanceIdRef = useRef<string | null>(null)
  /** Aşama 12: true ise unmount'ta pty ÖLDÜRÜLMEZ (geri alınabilir "soft close"). */
  const softCloseRequestedRef = useRef(false)
  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange
  const autoRestartRef = useRef(autoRestart)
  autoRestartRef.current = autoRestart
  const onRestartRef = useRef(onRestart)
  onRestartRef.current = onRestart
  const onToggleAutoRestartRef = useRef(onToggleAutoRestart)
  onToggleAutoRestartRef.current = onToggleAutoRestart
  const onResourceAlarmRef = useRef(onResourceAlarm)
  onResourceAlarmRef.current = onResourceAlarm
  /** Aşama 14: kaynak alarmı — eşik üstünde kaç ardışık ölçüm var / zaten bildirim gönderildi mi. */
  const resourceAlarmStreakRef = useRef(0)
  const resourceAlarmFiredRef = useRef(false)
  const onFocusPaneRef = useRef(onFocusPane)
  onFocusPaneRef.current = onFocusPane
  const [isFocused, setIsFocused] = useState(false)
  const [usage, setUsage] = useState<PtyUsage | null>(null)
  const [isResourceAlarm, setIsResourceAlarm] = useState(false)
  const [isReplayOpen, setIsReplayOpen] = useState(false)

  const { status, reportData, markRunning, reportCreateError, reportExit } = usePaneStatusEngine({
    onStatusChange: (next) => {
      onStatusChangeRef.current?.(next)
      if (next === 'waiting') {
        window.api.notifications.show({
          title: tRef.current('terminalPane.waitingNotifTitle', { title: titleRef.current }),
          body: tRef.current('terminalPane.waitingNotifBody')
        })
      } else if (next === 'error') {
        window.api.notifications.show({
          title: tRef.current('terminalPane.errorNotifTitle', { title: titleRef.current }),
          body: tRef.current('terminalPane.errorNotifBody')
        })
      }
    }
  })

  /** Onay bekleyen pane'in başlığındaki hızlı aksiyon butonlarından pty'ye direkt veri yazar. */
  function sendQuickInput(text: string): void {
    const id = ptyInstanceIdRef.current
    if (!id) return
    window.api.pty.write(id, text)
    termRef.current?.focus()
  }

  useImperativeHandle(
    ref,
    () => ({
      search: (term: string) => searchAddonRef.current?.findNext(term) ?? false,
      searchNext: (term: string) => searchAddonRef.current?.findNext(term) ?? false,
      searchPrevious: (term: string) => searchAddonRef.current?.findPrevious(term) ?? false,
      clearSearch: () => searchAddonRef.current?.clearDecorations(),
      prepareForSoftClose: () => {
        const id = ptyInstanceIdRef.current
        if (!id) return null
        softCloseRequestedRef.current = true
        window.api.pty.detach(id)
        return id
      },
      focusTerminal: () => termRef.current?.focus(),
      getPreviewLines: (maxLines = 6) => {
        const term = termRef.current
        if (!term) return []
        const buffer = term.buffer.active
        const lines: string[] = []
        const start = Math.max(0, buffer.length - maxLines)
        for (let i = start; i < buffer.length; i++) {
          const line = buffer.getLine(i)
          if (line) lines.push(line.translateToString(true))
        }
        return lines
      }
    }),
    []
  )

  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = getXtermTheme(theme)
  }, [theme])

  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Cascadia Code, Cascadia Mono, Consolas, "Courier New", ui-monospace, monospace',
      scrollback: 5000,
      theme: getXtermTheme(theme)
    })
    termRef.current = term
    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const serializeAddon = new SerializeAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(searchAddon)
    term.loadAddon(serializeAddon)
    searchAddonRef.current = searchAddon
    term.open(containerRef.current)
    fitAddon.fit()

    // Aşama 9: GPU hızlandırmalı WebGL renderer — ağır çıktılarda (log tail,
    // npm install vb.) belirgin şekilde daha akıcı kaydırma sağlar. WebGL
    // kullanılamıyorsa (sürücü/donanım desteği yok) xterm otomatik olarak
    // varsayılan DOM renderer'a düşer; hatayı sessizce yutmak yeterli.
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => webglAddon.dispose())
      term.loadAddon(webglAddon)
    } catch {
      // WebGL desteklenmiyor; varsayılan renderer ile devam edilir.
    }

    // paneId, pane'in kalıcı UI kimliğidir (React key vb.); ptyInstanceId ise
    // main process'teki GERÇEK pty process'inin kimliğidir ve her effect
    // çalıştığında yeniden üretilir. Bunları ayrı tutmak, React 18
    // StrictMode'un dev modunda effect'i mount->cleanup->mount şeklinde iki kez
    // çalıştırmasında, ilk (öldürülen) instance'ın gecikmiş "exit" IPC
    // event'inin ikinci (asıl canlı) instance ile karışmasını engeller.
    // Aşama 12: bu pane az önce "geri alınabilir" şekilde kapatılmışsa (undo),
    // onun canlı ptyInstanceId'si burada bulunur — sıfırdan üretilen bir id
    // yerine AYNI id kullanılır ki aşağıdaki onData/onExit dinleyicileri
    // (ve reattach çağrısı) doğru process'e bağlansın.
    const reattachPtyInstanceId = takeSoftClosedPtyInstanceId(paneId)
    const ptyInstanceId = reattachPtyInstanceId ?? crypto.randomUUID()
    ptyInstanceIdRef.current = ptyInstanceId
    registerPtyInstance(paneId, ptyInstanceId)

    /** Aşama 11: mevcut ekran içeriğini ("kaldığın yerden devam et") diske yazar. */
    function flushBuffer(): void {
      try {
        const data = serializeAddon.serialize({ scrollback: SCROLLBACK_SAVE_LINES })
        window.api.session.saveBuffer(paneId, data)
      } catch {
        // Terminal henüz tam hazır değilse (ör. çok erken çağrı) sessizce yok say.
      }
    }

    /**
     * Aşama 14: tam oturum kaydı/replay — "kaldığın yerden devam et" tamponundan
     * (tek bir en son görüntü) farklı olarak, ZAMAN İÇİNDE bir dizi anlık görüntü
     * append-only bir geçmişe eklenir. Daha az sıklıkta (dakikada bir) ve daha
     * kısa bir scrollback ile çalışır ki disk kullanımı makul kalsın.
     */
    function appendHistorySnapshot(): void {
      try {
        const data = serializeAddon.serialize({ scrollback: HISTORY_SNAPSHOT_LINES })
        window.api.session.appendHistory(paneId, data)
      } catch {
        // Sessizce yok sayılır — replay geçmişi kritik bir işlev değil.
      }
    }
    registerFlushHandler(paneId, flushBuffer)

    // Aşama 11: yeni bir pty spawn etmeden önce, bu pane için daha önce diske
    // kaydedilmiş bir ekran görüntüsü var mı diye bakılır (uygulama kapanıp
    // yeniden açıldığında veya pane başka bir workspace'e taşındığında). Varsa
    // önce o yazılır + net bir ayraç eklenir, ardından süreç normal şekilde
    // sıfırdan başlatılır — böylece hem bağlam korunur hem de gerçek process
    // her zaman taze başlar.
    // Aşama 14: crash-loop koruması — process bir süre (STABILITY_RESET_MS)
    // kesintisiz çalışırsa bu gerçek bir toparlanma sayılır ve backoff sayacı
    // sıfırlanır; aksi halde tek bir uzun ömürlü ama sürekli art arda çöken
    // process, "otomatik yeniden başlatma"yı sonsuza kadar geciktirilmiş ama
    // hâlâ etkin tutabilirdi.
    let stabilityTimer: ReturnType<typeof setTimeout> | null = null
    function scheduleStabilityReset(): void {
      if (stabilityTimer) clearTimeout(stabilityTimer)
      stabilityTimer = setTimeout(() => {
        if (!disposed) resetCrashLoop(paneId)
      }, STABILITY_RESET_MS)
    }

    async function initPane(): Promise<void> {
      const savedBuffer = await window.api.session.loadBuffer(paneId)
      if (disposed) return
      if (savedBuffer) term.write(savedBuffer)

      // Aşama 12: "Geri Al" ile açılan bir pane — process hiç öldürülmemişti,
      // sıfırdan spawn ETMEDEN aynı canlı process'e yeniden bağlanılır. Claude
      // Code gibi etkileşimli bir süreç tam olarak nerede kaldıysa oradan
      // devam eder (sadece ekranı kısa süreliğine "izlenmiyordu").
      if (reattachPtyInstanceId) {
        try {
          const result = await window.api.pty.reattach(reattachPtyInstanceId)
          if (disposed) return
          if (result.ok) {
            if (result.catchUp) term.write(result.catchUp)
            term.write(`\r\n\x1b[2m${tRef.current('terminalPane.reattached')}\x1b[0m\r\n`)
            markRunning()
            scheduleStabilityReset()
            return
          }
        } catch {
          // IPC başarısız oldu; aşağıda normal spawn akışına düşülür.
        }
        term.write(
          `\r\n\x1b[33m${tRef.current('terminalPane.reattachFailedRestarting')}\x1b[0m\r\n`
        )
      } else if (savedBuffer) {
        term.write(`\r\n\x1b[2m${tRef.current('terminalPane.resumingSession')}\x1b[0m\r\n`)
      }

      try {
        await window.api.pty.create(ptyInstanceId, { ...config, cols: term.cols, rows: term.rows })
        if (disposed) return
        markRunning()
        scheduleStabilityReset()
      } catch (error) {
        if (disposed) return
        reportCreateError()
        term.write(
          `\r\n\x1b[31m${tRef.current('terminalPane.createError', { message: (error as Error).message })}\x1b[0m\r\n`
        )
      }
    }
    void initPane()

    const offData = window.api.pty.onData((payload) => {
      if (payload.id !== ptyInstanceId) return
      term.write(payload.data)
      reportData(payload.data)
      // Aşama 10: pane çıktı boru hattı — bu pane bir hedefe bağlıysa, aldığı
      // her çıktı parçası hedefin girdisine de aynen yazılır.
      const pipeTargetPaneId = pipeTargetIdRef.current
      if (pipeTargetPaneId) {
        const targetPtyId = getPtyInstanceId(pipeTargetPaneId)
        if (targetPtyId) window.api.pty.write(targetPtyId, payload.data)
      }
    })

    const offExit = window.api.pty.onExit((payload) => {
      if (payload.id !== ptyInstanceId || disposed) return
      if (stabilityTimer) clearTimeout(stabilityTimer)
      reportExit(payload.exitCode)
      term.write(
        `\r\n\r\n${tRef.current('terminalPane.exitedWithCode', { code: payload.exitCode })}\r\n`
      )
      // Aşama 10/14: "otomatik yeniden başlat" açıksa ve process beklenmedik
      // şekilde (exit code != 0) sonlandıysa pane yeniden başlatılır. Art arda
      // çöken bir process için sabit 1sn gecikme yerine üstel backoff (1-2-4-
      // 8...30sn) uygulanır; kısa bir pencerede çok fazla çökme tespit
      // edilirse (crash-loop) otomatik yeniden başlatma tamamen durdurulup
      // kullanıcı bilgilendirilir — aksi halde CPU'yu boğan sonsuz bir
      // spawn/crash döngüsü oluşabilirdi.
      if (payload.exitCode !== 0 && autoRestartRef.current) {
        const decision = recordCrashAndDecide(paneId)
        if (decision.exceeded) {
          term.write(`\x1b[31m${tRef.current('terminalPane.crashLoopStopped')}\x1b[0m\r\n`)
          window.api.notifications.show({
            title: tRef.current('terminalPane.crashLoopNotifTitle', { title: titleRef.current }),
            body: tRef.current('terminalPane.crashLoopNotifBody')
          })
          onToggleAutoRestartRef.current?.()
        } else {
          const backoffLabel =
            decision.backoffMs >= 1000
              ? `${(decision.backoffMs / 1000).toFixed(decision.backoffMs % 1000 === 0 ? 0 : 1)}${tRef.current('common.secondsShort')}`
              : `${decision.backoffMs}ms`
          term.write(
            `\x1b[33m${tRef.current('terminalPane.autoRestarting', { delay: backoffLabel, count: decision.crashCount })}\x1b[0m\r\n`
          )
          setTimeout(() => onRestartRef.current?.(), decision.backoffMs)
        }
      }
    })

    // Windows Terminal davranışı: Ctrl+Shift+C/V her zaman kopyala/yapıştır;
    // düz Ctrl+C, bir seçim varsa SIGINT yerine kopyalar (seçim yoksa normal
    // şekilde pty'ye iletilip interrupt sinyali üretir).
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true
      const key = event.code
      if (event.ctrlKey && event.shiftKey && key === 'KeyC') {
        const selection = term.getSelection()
        if (selection) void navigator.clipboard.writeText(selection)
        return false
      }
      if (event.ctrlKey && event.shiftKey && key === 'KeyV') {
        navigator.clipboard.readText().then((text) => {
          if (text) window.api.pty.write(ptyInstanceId, text)
        })
        return false
      }
      if (
        event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        key === 'KeyC' &&
        term.hasSelection()
      ) {
        void navigator.clipboard.writeText(term.getSelection())
        return false
      }
      return true
    })

    term.onData((data) => {
      window.api.pty.write(ptyInstanceId, data)
      for (const peerId of broadcastPeerIdsRef.current) {
        const peerPtyId = getPtyInstanceId(peerId)
        if (peerPtyId) window.api.pty.write(peerPtyId, data)
      }
    })

    // Kiosk moduna girip çıkma veya bir pane'i büyütme (zoom) gibi işlemler,
    // görünür TÜM pane'lerin container'ını aynı anda birkaç kez art arda
    // (birden fazla reflow adımıyla) boyutlandırabilir. ResizeObserver'ı
    // debounce'lamadan her tetiklenişte fit() + gerçek pty resize (SIGWINCH)
    // çağırmak, hem gereksiz CPU/GPU yüküne hem de shell'in yeniden çizim
    // (redraw) döngüsüne birden çok kez girip görsel olarak "takılma/bozulma"
    // hissi vermesine yol açıyordu. Son boyut değişiminden sonra kısa bir
    // sessizlik penceresi bekleyip TEK bir fit+resize uygulamak bu titremeyi
    // büyük ölçüde ortadan kaldırır.
    let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null
    const applyResize = (): void => {
      resizeDebounceTimer = null
      fitAddon.fit()
      window.api.pty.resize(ptyInstanceId, term.cols, term.rows)
    }
    const resizeObserver = new ResizeObserver(() => {
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer)
      resizeDebounceTimer = setTimeout(applyResize, RESIZE_DEBOUNCE_MS)
    })
    resizeObserver.observe(containerRef.current)

    // Hangi pane'e şu an yazıldığını görsel olarak vurgulamak için xterm'in
    // dahili textarea'sının odak durumunu container üzerinden (bubbling) izleriz.
    const containerEl = containerRef.current
    const handleFocusIn = (): void => {
      setIsFocused(true)
      onFocusPaneRef.current?.()
    }
    const handleFocusOut = (): void => setIsFocused(false)
    containerEl.addEventListener('focusin', handleFocusIn)
    containerEl.addEventListener('focusout', handleFocusOut)

    // Aşama 10: Ctrl+Scroll ile anlık font boyutu değiştirme (tarayıcı/VS Code alışkanlığı).
    const handleWheelZoom = (event: WheelEvent): void => {
      if (!event.ctrlKey) return
      event.preventDefault()
      const current = term.options.fontSize ?? 13
      const next = Math.min(32, Math.max(8, current + (event.deltaY < 0 ? 1 : -1)))
      if (next === current) return
      term.options.fontSize = next
      fitAddon.fit()
      window.api.pty.resize(ptyInstanceId, term.cols, term.rows)
    }
    containerEl.addEventListener('wheel', handleWheelZoom, { passive: false })

    // Aşama 9: pane vitals — başlıkta gösterilen anlık CPU/RAM göstergesi.
    const usageInterval = setInterval(() => {
      window.api.pty.getUsage(ptyInstanceId).then((next) => {
        if (disposed) return
        setUsage(next)
        // Aşama 14: kaynak alarmı — RAM veya CPU eşiği tek bir anlık zirvede
        // değil, ~7.5sn (3 ardışık ölçüm) sürdürüldüğünde "runaway process"
        // kabul edilir; tek seferlik bildirim gönderilir, eşik altına
        // dönüldüğünde sayaç/bayrak sıfırlanır (bir sonraki gerçek olayda
        // tekrar bildirim gidebilsin diye).
        const overThreshold =
          next !== null &&
          (next.memory > RESOURCE_ALARM_RAM_BYTES || next.cpu > RESOURCE_ALARM_CPU_PERCENT)
        if (overThreshold) {
          resourceAlarmStreakRef.current += 1
          if (
            resourceAlarmStreakRef.current >= RESOURCE_ALARM_STREAK_REQUIRED &&
            !resourceAlarmFiredRef.current &&
            next
          ) {
            resourceAlarmFiredRef.current = true
            setIsResourceAlarm(true)
            const memoryMb = Math.round(next.memory / (1024 * 1024))
            window.api.notifications.show({
              title: tRef.current('terminalPane.resourceAlarmTitle', { title: titleRef.current }),
              body: tRef.current('terminalPane.resourceAlarmBody', {
                cpu: Math.round(next.cpu),
                memory: memoryMb
              })
            })
            onResourceAlarmRef.current?.(next)
          }
        } else {
          resourceAlarmStreakRef.current = 0
          if (resourceAlarmFiredRef.current) setIsResourceAlarm(false)
          resourceAlarmFiredRef.current = false
        }
      })
    }, 2500)

    // Aşama 11: "kaldığın yerden devam et" — ekran içeriği periyodik olarak
    // diske yazılır (gerçek çıkışta ayrıca App.tsx üzerinden anlık flush da
    // tetiklenir; bkz. flushRegistry).
    const bufferSaveInterval = setInterval(flushBuffer, BUFFER_SAVE_INTERVAL_MS)
    // Aşama 14: tam oturum kaydı/replay geçmişi (ayrı, daha seyrek aralık).
    const historySnapshotInterval = setInterval(appendHistorySnapshot, HISTORY_SNAPSHOT_INTERVAL_MS)

    return () => {
      disposed = true
      offData()
      offExit()
      resizeObserver.disconnect()
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer)
      if (stabilityTimer) clearTimeout(stabilityTimer)
      clearInterval(usageInterval)
      clearInterval(bufferSaveInterval)
      clearInterval(historySnapshotInterval)
      // Unmount anı (pane taşındı, workspace kapandı vb.) en taze görüntüyü
      // yakalamak için son bir kez kaydedilir.
      flushBuffer()
      unregisterFlushHandler(paneId)
      containerEl.removeEventListener('focusin', handleFocusIn)
      containerEl.removeEventListener('focusout', handleFocusOut)
      containerEl.removeEventListener('wheel', handleWheelZoom)
      unregisterPtyInstance(paneId)
      // Aşama 12: soft-close talep edilmişse (kullanıcı ✕'e bastı, undo ile
      // geri gelebilir) process ÖLDÜRÜLMEZ — arka planda canlı bırakılır.
      // Aksi halde (yeniden başlatma, workspace'ler arası taşıma, kalıcı silme,
      // uygulama kapanışı) davranış tamamen eskisi gibidir.
      if (!softCloseRequestedRef.current) {
        window.api.pty.kill(ptyInstanceId)
      }
      ptyInstanceIdRef.current = null
      term.dispose()
      termRef.current = null
      searchAddonRef.current = null
    }
    // paneId/config bu effect'in ömrü boyunca sabit kabul edilir; yeniden
    // başlatma GridLayout'ta component key'i değiştirilerek tetiklenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      data-pane-id={paneId}
      onMouseDownCapture={() => onFocusPaneRef.current?.()}
      style={color ? { borderTopColor: color, borderTopWidth: 2 } : undefined}
      className={cx(
        'flex h-full w-full flex-col overflow-hidden rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-bg)] transition-shadow',
        STATUS_GLOW_CLASS[status],
        isFocused && 'ring-2 ring-blue-500/70'
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--mtf-border)] bg-[var(--mtf-surface)] px-2 py-1.5 text-xs text-[var(--mtf-text)]">
        <div
          ref={dragHandleRef}
          {...dragHandleProps}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 active:cursor-grabbing"
          onDoubleClick={onToggleZoom}
        >
          <StatusIndicator status={status} />
          <span className="shrink-0 rounded bg-[var(--mtf-surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--mtf-text-muted)]">
            {shellMeta.badge}
          </span>
          <span className="truncate font-medium">{title}</span>
          {usage && (
            <span
              title={
                isResourceAlarm
                  ? t('terminalPane.usageAlarmTitle')
                  : t('terminalPane.usageTitle')
              }
              className={cx(
                'shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]',
                isResourceAlarm
                  ? 'animate-pulse bg-red-500/20 text-red-300'
                  : 'bg-[var(--mtf-surface-2)] text-[var(--mtf-text-muted)]'
              )}
            >
              {isResourceAlarm && '⚠ '}
              {formatUsage(usage)}
            </span>
          )}
        </div>
        {status === 'waiting' && (
          <div
            title={t('terminalPane.quickReplyHint')}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex shrink-0 items-center gap-1"
          >
            <button
              type="button"
              title={t('terminalPane.approveTitle')}
              onClick={() => sendQuickInput('\r')}
              className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/25"
            >
              {t('terminalPane.approve')}
            </button>
            <button
              type="button"
              title={t('terminalPane.yesTitle')}
              onClick={() => sendQuickInput('y\r')}
              className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/25"
            >
              y
            </button>
            <button
              type="button"
              title={t('terminalPane.noTitle')}
              onClick={() => sendQuickInput('n\r')}
              className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/25"
            >
              n
            </button>
          </div>
        )}
        {pipeOptions && pipeOptions.length > 0 && (
          <select
            title={t('terminalPane.pipeTitle')}
            value={pipeTargetId ?? ''}
            onChange={(event) => onSetPipeTarget?.(event.target.value || null)}
            onPointerDown={(event) => event.stopPropagation()}
            className={cx(
              'max-w-[6rem] shrink-0 rounded border bg-[var(--mtf-surface-2)] px-1 py-0.5 text-[10px] outline-none',
              pipeTargetId
                ? 'border-blue-500 text-blue-300'
                : 'border-[var(--mtf-border)] text-[var(--mtf-text-muted)]'
            )}
          >
            <option value="">{t('terminalPane.pipeNone')}</option>
            {pipeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                🔗 {option.title}
              </option>
            ))}
          </select>
        )}
        {showBroadcastToggle && (
          <label
            title={t('terminalPane.broadcastIncludeHint')}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex shrink-0 items-center gap-1 rounded px-1 text-[10px] text-[var(--mtf-text-muted)]"
          >
            <input
              type="checkbox"
              checked={Boolean(isBroadcastTarget)}
              onChange={onToggleBroadcastTarget}
              className="h-3 w-3 accent-blue-500"
            />
            {t('terminalPane.broadcastLabel')}
          </label>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <ScheduleButton paneId={paneId} paneTitle={title} />
          <button
            type="button"
            title={t('terminalPane.replayHint')}
            onClick={() => setIsReplayOpen(true)}
            className="rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
          >
            🕐
          </button>
          {onToggleAutoRestart && (
            <button
              type="button"
              title={
                autoRestart
                  ? t('terminalPane.autoRestartOn')
                  : t('terminalPane.autoRestartOff')
              }
              onClick={onToggleAutoRestart}
              className={cx(
                'rounded px-1.5 py-0.5 hover:bg-[var(--mtf-hover)]',
                autoRestart
                  ? 'text-emerald-400 hover:text-emerald-300'
                  : 'text-[var(--mtf-text-muted)] hover:text-[var(--mtf-text)]'
              )}
            >
              🔁
            </button>
          )}
          {onRestart && (
            <button
              type="button"
              title={t('terminalPane.restart')}
              onClick={onRestart}
              className="rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
            >
              ⟳
            </button>
          )}
          {onToggleZoom && (
            <button
              type="button"
              title={isZoomed ? t('terminalPane.zoomOut') : t('terminalPane.zoomIn')}
              onClick={onToggleZoom}
              className="rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
            >
              {isZoomed ? '⤡' : '⤢'}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              title={t('terminalPane.close')}
              onClick={onClose}
              className="rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-red-900/60 hover:text-red-200"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 px-2 py-1" />
      {isReplayOpen && (
        <SessionReplayPanel paneId={paneId} title={title} onClose={() => setIsReplayOpen(false)} />
      )}
    </div>
  )
})

export default TerminalPane
