import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useWorkspaceStore } from '../state/useWorkspaceStore'
import { usePresetStore } from '../state/usePresetStore'
import { useUiStore } from '../state/useUiStore'
import { useT } from '../hooks/useTranslation'
import { fuzzyMatch } from '../lib/fuzzyMatch'
import { getPtyInstanceId } from '../lib/ptyRegistry'
import { getPaneHandle } from '../lib/paneHandleRegistry'
import { defaultShellForPlatform } from '../lib/shellMeta'

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

interface PaletteAction {
  id: string
  icon: string
  label: string
  hint?: string
  /** Ek arama anahtar kelimeleri (görünmez, sadece filtrelemeye yardımcı olur). */
  keywords?: string
  group: string
  onRun: () => void
}

/**
 * Aşama 14: Komut Paleti (Ctrl+K). VS Code/Linear mantığında, workspace/pane/
 * preset arasında gezinmeyi, ayar aç/kapatlarını ve bir pane'e doğrudan metin
 * göndermeyi tek bir fuzzy-search arayüzünden, klavyeden çıkmadan yapılabilir
 * hale getirir. Komut listesi her açılışta canlı store durumundan türetilir —
 * ayrı bir kayıt mekanizması yok, bu yüzden yeni bir workspace/pane eklendiği
 * anda paletin bir sonraki açılışında otomatik olarak görünür.
 */
function CommandPalette(): React.JSX.Element | null {
  const t = useT()
  const isOpen = useUiStore((state) => state.isCommandPaletteOpen)
  const close = useUiStore((state) => state.closeCommandPalette)

  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const workspaceOrder = useWorkspaceStore((state) => state.workspaceOrder)
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace)
  const setFocusedPane = useWorkspaceStore((state) => state.setFocusedPane)
  const restartPane = useWorkspaceStore((state) => state.restartPane)
  const addWorkspace = useWorkspaceStore((state) => state.addWorkspace)
  const addPane = useWorkspaceStore((state) => state.addPane)
  const addWebPane = useWorkspaceStore((state) => state.addWebPane)
  const toggleBroadcastMode = useWorkspaceStore((state) => state.toggleBroadcastMode)

  const presets = usePresetStore((state) => state.presets)
  const loadPresets = usePresetStore((state) => state.load)

  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const toggleCrtEffect = useUiStore((state) => state.toggleCrtEffect)
  const toggleKioskMode = useUiStore((state) => state.toggleKioskMode)
  const toggleFilesPanel = useUiStore((state) => state.toggleFilesPanel)
  const toggleSpotlightMode = useUiStore((state) => state.toggleSpotlightMode)
  const toggleSearch = useUiStore((state) => state.toggleSearch)
  const openMissionControl = useUiStore((state) => state.openMissionControl)
  const toggleHackerMode = useUiStore((state) => state.toggleHackerMode)

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [composeTarget, setComposeTarget] = useState<{ paneId: string; title: string } | null>(null)
  const [composeText, setComposeText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) loadPresets()
  }, [isOpen, loadPresets])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setComposeTarget(null)
      setComposeText('')
      // Overlay mount olduktan hemen sonra input'a odaklan.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen])

  function jumpToPane(paneId: string, workspaceId: string): void {
    setActiveWorkspace(workspaceId)
    setFocusedPane(paneId, workspaceId)
    close()
    setTimeout(() => getPaneHandle(paneId)?.focusTerminal(), 60)
  }

  const actions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = []

    for (const workspaceId of workspaceOrder) {
      const workspace = workspaces[workspaceId]
      if (!workspace) continue
      list.push({
        id: `ws-jump-${workspace.id}`,
        icon: '🗂️',
        label: t('palette.jumpToWorkspace', { name: workspace.name }),
        hint: t('palette.paneCountHint', { count: workspace.order.length }),
        keywords: 'workspace geç git jump',
        group: t('palette.groupNav'),
        onRun: () => {
          setActiveWorkspace(workspace.id)
          close()
        }
      })
      for (const paneId of workspace.order) {
        const pane = workspace.panes[paneId]
        if (!pane) continue
        list.push({
          id: `pane-jump-${pane.id}`,
          icon: pane.kind === 'web' ? '🌐' : '➡️',
          label: t('palette.jumpToPane', { title: pane.title }),
          hint: workspace.name,
          keywords:
            pane.kind === 'web'
              ? t('palette.webKeywords')
              : `${pane.config.shell} terminal git focus`,
          group: t('palette.groupNav'),
          onRun: () => jumpToPane(pane.id, workspace.id)
        })
        if (pane.kind !== 'web') {
          list.push({
            id: `pane-write-${pane.id}`,
            icon: '⌨️',
            label: t('palette.sendTextToPane', { title: pane.title }),
            hint: workspace.name,
            keywords: 'write yaz komut gönder send input',
            group: t('palette.groupAgentActions'),
            onRun: () => {
              setComposeTarget({ paneId: pane.id, title: pane.title })
              setComposeText('')
            }
          })
          list.push({
            id: `pane-restart-${pane.id}`,
            icon: '🔁',
            label: t('palette.restartPane', { title: pane.title }),
            hint: workspace.name,
            keywords: 'restart yeniden başlat',
            group: t('palette.groupAgentActions'),
            onRun: () => {
              restartPane(pane.id, workspace.id)
              close()
            }
          })
        }
      }
    }

    for (const preset of presets) {
      list.push({
        id: `preset-open-${preset.id}`,
        icon: '📦',
        label: t('palette.openPreset', { name: preset.name }),
        hint: t('palette.presetHint', { count: preset.panes.length }),
        keywords: 'preset aç template',
        group: t('palette.groupPresets'),
        onRun: () => {
          const workspaceId = addWorkspace(preset.name)
          for (const pane of preset.panes) {
            if (pane.kind === 'web') {
              addWebPane(pane.webUrl ?? 'about:blank', pane.title, pane.color, workspaceId)
            } else {
              addPane(pane.config, pane.title, pane.color, workspaceId)
            }
          }
          close()
        }
      })
    }

    list.push(
      {
        id: 'action-new-pane',
        icon: '+',
        label: t('palette.actionNewPane'),
        keywords: 'yeni terminal ekle add new pane',
        group: t('palette.groupActions'),
        onRun: () => {
          addPane(
            { shell: defaultShellForPlatform(window.electron.process.platform) },
            undefined,
            undefined,
            activeWorkspaceId
          )
          close()
        }
      },
      {
        id: 'action-new-web-pane',
        icon: '🌐',
        label: t('palette.actionNewWebPane'),
        keywords: 'web tarayıcı browser preview önizleme localhost ekle add',
        group: t('palette.groupActions'),
        onRun: () => {
          addWebPane('localhost:3000', undefined, undefined, activeWorkspaceId)
          close()
        }
      },
      {
        id: 'action-new-workspace',
        icon: '🗂️',
        label: t('palette.actionNewWorkspace'),
        keywords: 'yeni workspace ekle add',
        group: t('palette.groupActions'),
        onRun: () => {
          addWorkspace()
          close()
        }
      },
      {
        id: 'action-mission-control',
        icon: '🛰️',
        label: t('palette.actionMissionControl'),
        keywords: 'mission control genel bakış overview bird eye',
        group: t('palette.groupActions'),
        onRun: () => {
          close()
          openMissionControl()
        }
      },
      {
        id: 'action-global-search',
        icon: '🔍',
        label: t('palette.actionGlobalSearch'),
        keywords: 'ara search find',
        group: t('palette.groupActions'),
        onRun: () => {
          toggleSearch()
          close()
        }
      },
      {
        id: 'action-broadcast',
        icon: '⇶',
        label: t('palette.actionBroadcast'),
        keywords: 'broadcast yayın toggle',
        group: t('palette.groupActions'),
        onRun: () => {
          toggleBroadcastMode(activeWorkspaceId)
          close()
        }
      },
      {
        id: 'action-toggle-theme',
        icon: '🌙',
        label: t('palette.actionToggleTheme'),
        keywords: 'tema theme dark light',
        group: t('palette.groupView'),
        onRun: () => {
          toggleTheme()
          close()
        }
      },
      {
        id: 'action-toggle-crt',
        icon: '📺',
        label: t('palette.actionToggleCrt'),
        keywords: 'crt retro tarama efekt',
        group: t('palette.groupView'),
        onRun: () => {
          toggleCrtEffect()
          close()
        }
      },
      {
        id: 'action-toggle-spotlight',
        icon: '🔦',
        label: t('palette.actionToggleSpotlight'),
        keywords: 'spotlight odak dim karart',
        group: t('palette.groupView'),
        onRun: () => {
          toggleSpotlightMode()
          close()
        }
      },
      {
        id: 'action-toggle-kiosk',
        icon: '⛶',
        label: t('palette.actionToggleKiosk'),
        keywords: 'kiosk sunum presentation fullscreen',
        group: t('palette.groupView'),
        onRun: () => {
          toggleKioskMode()
          close()
        }
      },
      {
        id: 'action-toggle-files',
        icon: '📁',
        label: t('palette.actionToggleFiles'),
        keywords: 'dosya files panel explorer',
        group: t('palette.groupView'),
        onRun: () => {
          toggleFilesPanel()
          close()
        }
      },
      {
        id: 'action-toggle-hacker-mode',
        icon: '💀',
        label: t('palette.actionToggleHackerMode'),
        keywords: 'hacker saldırı attack matrix neon tema mod',
        group: t('palette.groupView'),
        onRun: () => {
          toggleHackerMode()
          close()
        }
      }
    )

    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces, workspaceOrder, presets, activeWorkspaceId, t])

  const filtered = useMemo(() => {
    if (!query.trim()) return actions.slice(0, 60)
    return actions
      .map((action) => ({
        action,
        result: fuzzyMatch(query, `${action.label} ${action.keywords ?? ''}`)
      }))
      .filter((entry) => entry.result.matched)
      .sort((a, b) => b.result.score - a.result.score)
      .slice(0, 60)
      .map((entry) => entry.action)
  }, [actions, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  function sendComposeText(): void {
    if (!composeTarget) return
    const ptyId = getPtyInstanceId(composeTarget.paneId)
    if (ptyId && composeText) window.api.pty.write(ptyId, `${composeText}\r`)
    close()
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (composeTarget) setComposeTarget(null)
      else close()
      return
    }
    if (composeTarget) {
      if (event.key === 'Enter') {
        event.preventDefault()
        sendComposeText()
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((index) => Math.min(index + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      filtered[selectedIndex]?.onRun()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="command-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={close}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 pt-[12vh]"
        >
          <motion.div
            key="command-palette-panel"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={handleKeyDown}
            className="flex max-h-[70vh] w-[36rem] flex-col overflow-hidden rounded-lg border border-[var(--mtf-border)] bg-[var(--mtf-surface)] text-sm shadow-2xl"
          >
            {composeTarget ? (
              <div className="flex items-center gap-2 border-b border-[var(--mtf-border)] px-3 py-2.5">
                <span className="shrink-0 text-[var(--mtf-text-muted)]">⌨️</span>
                <input
                  ref={inputRef}
                  autoFocus
                  value={composeText}
                  onChange={(event) => setComposeText(event.target.value)}
                  placeholder={t('palette.sendPlaceholder', { title: composeTarget.title })}
                  className="min-w-0 flex-1 bg-transparent text-[var(--mtf-text)] outline-none placeholder:text-[var(--mtf-text-muted)]"
                />
                <button
                  type="button"
                  onClick={sendComposeText}
                  className="shrink-0 rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500"
                >
                  {t('palette.send')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-b border-[var(--mtf-border)] px-3 py-2.5">
                <span className="shrink-0 text-[var(--mtf-text-muted)]">🔎</span>
                <input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('palette.searchPlaceholder')}
                  className="min-w-0 flex-1 bg-transparent text-[var(--mtf-text)] outline-none placeholder:text-[var(--mtf-text-muted)]"
                />
                <span className="shrink-0 rounded bg-[var(--mtf-surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--mtf-text-muted)]">
                  Esc
                </span>
              </div>
            )}
            {!composeTarget && (
              <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                {filtered.length === 0 && (
                  <p className="px-2 py-4 text-center text-[var(--mtf-text-muted)]">
                    {t('palette.noMatch')}
                  </p>
                )}
                {filtered.map((action, index) => (
                  <button
                    key={action.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => action.onRun()}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left',
                      index === selectedIndex
                        ? 'bg-blue-600 text-white'
                        : 'text-[var(--mtf-text)] hover:bg-[var(--mtf-hover)]'
                    )}
                  >
                    <span className="shrink-0">{action.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{action.label}</span>
                    {action.hint && (
                      <span
                        className={cx(
                          'shrink-0 truncate text-[10px]',
                          index === selectedIndex ? 'text-white/70' : 'text-[var(--mtf-text-muted)]'
                        )}
                      >
                        {action.hint}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default CommandPalette
