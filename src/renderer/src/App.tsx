import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import GridLayout from './components/GridLayout'
import Toolbar from './components/Toolbar'
import WorkspaceTabBar, { WORKSPACE_TAB_DROP_PREFIX } from './components/WorkspaceTabBar'
import PresetBar from './components/PresetBar'
import CommandPalette from './components/CommandPalette'
import MissionControl from './components/MissionControl'
import ApprovalOrchestratorBar from './components/ApprovalOrchestratorBar'
import HackerModeOverlay from './components/HackerModeOverlay'
import {
  findPaneOwner,
  serializeWorkspaceState,
  useWorkspaceStore
} from './state/useWorkspaceStore'
import { useUiStore } from './state/useUiStore'
import { useScheduleStore } from './state/useScheduleStore'
import { useClosedItemsStore } from './state/useClosedItemsStore'
import { defaultShellForPlatform } from './lib/shellMeta'
import { getPtyInstanceId } from './lib/ptyRegistry'
import { flushAllPaneBuffers } from './lib/flushRegistry'
import { playHackerActivateSound, playHackerDeactivateSound } from './lib/hackerSound'

const SCHEDULE_TICK_MS = 20000

const SAVE_DEBOUNCE_MS = 400

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

function App(): React.JSX.Element {
  const workspaceOrder = useWorkspaceStore((state) => state.workspaceOrder)
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId)
  const addPane = useWorkspaceStore((state) => state.addPane)
  const hydrate = useWorkspaceStore((state) => state.hydrate)
  const swapPanes = useWorkspaceStore((state) => state.swapPanes)
  const movePaneToWorkspace = useWorkspaceStore((state) => state.movePaneToWorkspace)
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const toggleSearch = useUiStore((state) => state.toggleSearch)
  const crtEffect = useUiStore((state) => state.crtEffect)
  const kioskMode = useUiStore((state) => state.kioskMode)
  const toggleKioskMode = useUiStore((state) => state.toggleKioskMode)
  const openCommandPalette = useUiStore((state) => state.openCommandPalette)
  const toggleMissionControl = useUiStore((state) =>
    state.isMissionControlOpen ? state.closeMissionControl : state.openMissionControl
  )
  const hackerMode = useUiStore((state) => state.hackerMode)
  const toggleHackerMode = useUiStore((state) => state.toggleHackerMode)
  const initialized = useRef(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [rootShaking, setRootShaking] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Aşama 15: Saldırı Modu her aç/kapa geçişinde kısa bir ekran sarsıntısı +
  // sentezlenmiş bir sweep sesi tetikler ("güç veriliyor/kesiliyor" hissi).
  // İlk mount'ta (hackerMode henüz hiç değişmediğinde) tetiklenmemesi için
  // önceki değeri bir ref'te takip ediyoruz.
  const prevHackerModeRef = useRef(hackerMode)
  useEffect(() => {
    if (prevHackerModeRef.current === hackerMode) return
    prevHackerModeRef.current = hackerMode
    if (hackerMode) playHackerActivateSound()
    else playHackerDeactivateSound()
    setRootShaking(true)
    const timer = setTimeout(() => setRootShaking(false), 520)
    return () => clearTimeout(timer)
  }, [hackerMode])

  // Aşama 7: açılışta electron-store'daki kayıtlı workspace/pane yapılandırmasını
  // yükleyip pane'leri sıfırdan bu config'lerle yeniden spawn eder. Kayıt yoksa
  // (ilk çalıştırma) boş grid görmemek için tek bir varsayılan pane eklenir.
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    window.api.config.load().then((persisted) => {
      if (persisted && persisted.workspaces.length > 0) {
        hydrate(persisted)
        // Aşama 11: artık hiçbir workspace'te var olmayan pane'lere ait
        // "kaldığın yerden devam et" tampon dosyalarını temizle.
        const knownPaneIds = persisted.workspaces.flatMap((workspace) =>
          workspace.panes.map((pane) => pane.id)
        )
        window.api.session.pruneOrphans(knownPaneIds)
      } else {
        addPane({ shell: defaultShellForPlatform(window.electron.process.platform) })
      }
    })
  }, [addPane, hydrate])

  // Aşama 11: uygulama gerçekten kapanmadan hemen önce (tepsideki "Çıkış" veya
  // OS kapanışı) main process bu sinyali gönderir; tüm canlı pane'lerin ekran
  // içeriği son bir kez diske yazılır.
  useEffect(() => {
    return window.api.appLifecycle.onBeforeQuit(() => {
      flushAllPaneBuffers()
    })
  }, [])

  // Workspace/pane yapılandırması her değiştiğinde (ekleme/kaldırma/yeniden
  // adlandırma/sıra/aktif sekme) debounce'lu şekilde electron-store'a yazılır.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = useWorkspaceStore.subscribe((state) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        window.api.config.save(serializeWorkspaceState(state))
      }, SAVE_DEBOUNCE_MS)
    })
    return () => {
      if (timeout) clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  // Aşama 8: Ctrl+Shift+F ile global arama çubuğunu aç/kapat.
  // Aşama 10: Ctrl+Shift+K (veya F11) ile sunum/kiosk modunu aç/kapat.
  // Aşama 12: Ctrl+Shift+T ile en son kapatılan pane/workspace'i geri al
  // (tarayıcıların "kapatılan sekmeyi yeniden aç" kısayoluyla aynı mantık).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyF') {
        event.preventDefault()
        toggleSearch()
      }
      if ((event.ctrlKey && event.shiftKey && event.code === 'KeyK') || event.code === 'F11') {
        event.preventDefault()
        toggleKioskMode()
      }
      // Aşama 14: Ctrl+K (Shift'siz) komut paletini açar — VS Code/Linear alışkanlığı.
      if (event.ctrlKey && !event.shiftKey && event.code === 'KeyK') {
        event.preventDefault()
        openCommandPalette()
      }
      // Aşama 14: Ctrl+Shift+O — Mission Control (tüm workspace/pane kuşbakışı).
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyO') {
        event.preventDefault()
        toggleMissionControl()
      }
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyT') {
        event.preventDefault()
        const { items, remove } = useClosedItemsStore.getState()
        const lastItem = items[0]
        if (!lastItem) return
        const { restorePaneAt, restoreWorkspaceAt } = useWorkspaceStore.getState()
        if (lastItem.type === 'pane') {
          restorePaneAt(lastItem.pane, lastItem.workspaceId, lastItem.index)
        } else {
          restoreWorkspaceAt(lastItem.workspace, lastItem.index)
        }
        remove(lastItem.id)
      }
      // Aşama 15: Ctrl+Shift+H — "Saldırı Modu" (Hacker Attack Mode) aç/kapat.
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyH') {
        event.preventDefault()
        toggleHackerMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSearch, toggleKioskMode, openCommandPalette, toggleMissionControl, toggleHackerMode])

  // Aşama 10: zamanlanmış komut enjeksiyonu — dakikada bir mevcut saati kontrol
  // edip eşleşen zamanlayıcıları ilgili pane'e yazar. Artık var olmayan pane'lere
  // ait "sahipsiz" zamanlayıcılar da burada temizlenir.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`
      const dateKey = now.toISOString().slice(0, 10)
      const { schedules, markFired, removeSchedule } = useScheduleStore.getState()
      const currentWorkspaces = useWorkspaceStore.getState().workspaces
      for (const schedule of schedules) {
        if (!findPaneOwner(currentWorkspaces, schedule.paneId)) {
          removeSchedule(schedule.id)
          continue
        }
        if (schedule.time !== currentTime || schedule.lastFiredDateKey === dateKey) continue
        const ptyInstanceId = getPtyInstanceId(schedule.paneId)
        if (ptyInstanceId) window.api.pty.write(ptyInstanceId, `${schedule.command}\r`)
        markFired(schedule.id, dateKey)
        if (!schedule.repeatDaily) removeSchedule(schedule.id)
      }
    }, SCHEDULE_TICK_MS)
    return () => clearInterval(interval)
  }, [])

  // Aşama 10: workspace'ler arası pane sürükleme. DndContext, tüm workspace
  // sekmelerini ve grid'leri saran tek bir ortak bağlam olduğu için, bir pane
  // aktif grid'den başka bir workspace sekmesinin üzerine sürüklenebilir.
  function handleDragStart(event: DragStartEvent): void {
    setActiveDragId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveDragId(null)
    const paneId = event.active.id as string
    const overId = event.over?.id as string | undefined
    if (!overId) return
    const owner = findPaneOwner(workspaces, paneId)
    if (!owner) return
    if (overId.startsWith(WORKSPACE_TAB_DROP_PREFIX)) {
      const targetWorkspaceId = overId.slice(WORKSPACE_TAB_DROP_PREFIX.length)
      if (targetWorkspaceId !== owner.workspaceId) {
        movePaneToWorkspace(paneId, owner.workspaceId, targetWorkspaceId)
      }
      return
    }
    if (overId !== paneId) swapPanes(paneId, overId, owner.workspaceId)
  }

  const draggedPane = activeDragId ? findPaneOwner(workspaces, activeDragId)?.pane : undefined

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className={cx(
          'flex h-screen w-screen flex-col bg-[var(--mtf-bg)]',
          rootShaking && 'mtf-hacker-shake'
        )}
      >
        {crtEffect && <div className="mtf-crt-overlay" aria-hidden="true" />}
        {!kioskMode && (
          <>
            <Toolbar />
            <WorkspaceTabBar />
            <PresetBar />
          </>
        )}
        {kioskMode && (
          <div className="group fixed right-0 top-0 z-50 h-6 w-40">
            <button
              type="button"
              title="Sunum modundan çık (Ctrl+Shift+K / F11)"
              onClick={toggleKioskMode}
              className="absolute right-2 top-2 rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-surface)] px-2.5 py-1 text-xs text-[var(--mtf-text-muted)] opacity-0 shadow-lg transition-opacity hover:text-[var(--mtf-text)] group-hover:opacity-100"
            >
              ⤢ Sunum modundan çık
            </button>
          </div>
        )}
        <div className="relative min-h-0 flex-1 p-2">
          {workspaceOrder.map((workspaceId) => (
            <div
              key={workspaceId}
              // Aktif olmayan workspace'ler unmount edilmez, sadece gizlenir —
              // böylece pane'lerin pty bağlantısı ve status takibi arka planda kopmaz.
              className={cx('h-full w-full', workspaceId !== activeWorkspaceId && 'hidden')}
            >
              <GridLayout workspaceId={workspaceId} />
            </div>
          ))}
        </div>
        {!kioskMode && <ApprovalOrchestratorBar />}
      </div>
      {hackerMode && <HackerModeOverlay />}
      <CommandPalette />
      <MissionControl />
      <DragOverlay>
        {draggedPane && (
          <div className="rounded-md border border-blue-500 bg-neutral-900/95 px-3 py-1.5 text-xs text-neutral-200 shadow-xl">
            {draggedPane.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

export default App
