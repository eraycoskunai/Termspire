import { useEffect, useState } from 'react'
import type { PersistedPaneConfig } from '@shared/types'
import { usePresetStore } from '../state/usePresetStore'
import { useWorkspaceStore } from '../state/useWorkspaceStore'
import { chunkIntoRows, computeGridDimensions } from '../lib/gridAlgorithm'
import { useT } from '../hooks/useTranslation'

/** Aşama 10: preset pilinin solunda gösterilen, pane sayısı/renklerini yansıtan mini grid önizlemesi. */
function PresetThumbnail({ panes }: { panes: PersistedPaneConfig[] }): React.JSX.Element {
  const { cols } = computeGridDimensions(panes.length)
  const rows = chunkIntoRows(panes, cols)
  return (
    <div
      className="flex shrink-0 flex-col gap-[1px] rounded-[3px] border border-[var(--mtf-border)] bg-[var(--mtf-bg)] p-[2px]"
      style={{ width: 20, height: 14 }}
    >
      {rows.map((rowPanes, rowIndex) => (
        <div key={rowIndex} className="flex flex-1 gap-[1px]">
          {rowPanes.map((pane) => (
            <div
              key={pane.id}
              className="flex-1 rounded-[1px]"
              style={{ backgroundColor: pane.color || 'var(--mtf-surface-2)' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Aşama 8: preset sistemi. Aktif workspace'in o anki pane setini isimlendirip
 * kaydeder; kayıtlı presetlerden birine tıklamak, o pane setini sıfırdan
 * spawn ederek yeni bir workspace olarak açar ("tek tıkla aç").
 */
function PresetBar(): React.JSX.Element {
  const t = useT()
  const presets = usePresetStore((state) => state.presets)
  const load = usePresetStore((state) => state.load)
  const savePreset = usePresetStore((state) => state.savePreset)
  const removePreset = usePresetStore((state) => state.removePreset)

  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId)
  const activeWorkspace = useWorkspaceStore((state) => state.workspaces[state.activeWorkspaceId])
  const addWorkspace = useWorkspaceStore((state) => state.addWorkspace)
  const addPane = useWorkspaceStore((state) => state.addPane)
  const addWebPane = useWorkspaceStore((state) => state.addWebPane)

  const [isNaming, setIsNaming] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    load()
  }, [load])

  function handleSaveCurrent(): void {
    if (!activeWorkspace || activeWorkspace.order.length === 0) return
    const panes = activeWorkspace.order
      .map((id) => activeWorkspace.panes[id])
      .filter(Boolean)
      .map((pane) => ({
        id: pane.id,
        config: pane.config,
        title: pane.title,
        color: pane.color,
        kind: pane.kind,
        webUrl: pane.webUrl
      }))
    savePreset(name.trim() || activeWorkspace.name, panes)
    setName('')
    setIsNaming(false)
  }

  function handleApplyPreset(presetId: string): void {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return
    const workspaceId = addWorkspace(preset.name)
    for (const pane of preset.panes) {
      if (pane.kind === 'web') {
        addWebPane(pane.webUrl ?? 'about:blank', pane.title, pane.color, workspaceId)
      } else {
        addPane(pane.config, pane.title, pane.color, workspaceId)
      }
    }
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-2 py-1.5 text-xs">
      <span className="shrink-0 text-[var(--mtf-text-muted)]">{t('presetBar.label')}</span>
      {presets.length === 0 && !isNaming && (
        <span className="shrink-0 text-[var(--mtf-text-muted)]">{t('presetBar.none')}</span>
      )}
      {presets.map((preset) => (
        <div
          key={preset.id}
          className="group flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--mtf-border)] bg-[var(--mtf-surface)] px-2.5 py-1 text-[var(--mtf-text)]"
        >
          <PresetThumbnail panes={preset.panes} />
          <button
            type="button"
            title={t('presetBar.openHint', { name: preset.name, count: preset.panes.length })}
            onClick={() => handleApplyPreset(preset.id)}
            className="max-w-[8rem] truncate hover:text-blue-400"
          >
            {preset.name}
          </button>
          <span className="text-[var(--mtf-text-muted)]">{preset.panes.length}</span>
          <button
            type="button"
            title={t('presetBar.deleteHint')}
            onClick={() => removePreset(preset.id)}
            className="rounded px-1 text-[var(--mtf-text-muted)] opacity-0 hover:bg-red-900/60 hover:text-red-200 group-hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
      {isNaming ? (
        <div className="flex shrink-0 items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSaveCurrent()
              if (event.key === 'Escape') setIsNaming(false)
            }}
            placeholder={activeWorkspace?.name ?? t('presetBar.namePlaceholder')}
            className="w-32 rounded border border-[var(--mtf-border)] bg-[var(--mtf-surface)] px-2 py-1 text-[var(--mtf-text)] outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleSaveCurrent}
            className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-500"
          >
            {t('presetBar.save')}
          </button>
          <button
            type="button"
            onClick={() => setIsNaming(false)}
            className="rounded px-2 py-1 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]"
          >
            {t('presetBar.cancel')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          title={t('presetBar.saveCurrentHint')}
          disabled={!activeWorkspaceId || (activeWorkspace?.order.length ?? 0) === 0}
          onClick={() => setIsNaming(true)}
          className="shrink-0 rounded-full border border-dashed border-[var(--mtf-border)] px-2.5 py-1 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('presetBar.saveCurrent')}
        </button>
      )}
    </div>
  )
}

export default PresetBar
