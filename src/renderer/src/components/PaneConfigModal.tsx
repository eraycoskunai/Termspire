import { useEffect, useState } from 'react'
import type { AvailableShellInfo, PtyCreateOptions, ShellKind } from '@shared/types'
import { getShellMeta } from '../lib/shellMeta'
import { COLOR_SWATCHES } from '../lib/colorSwatches'
import { useT } from '../hooks/useTranslation'

const SHELL_ORDER: ShellKind[] = ['powershell', 'cmd', 'wsl', 'git-bash', 'bash', 'zsh']

export interface PaneConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (config: PtyCreateOptions, title: string, color: string) => void
}

/**
 * Aşama 5: pane oluşturma/yapılandırma diyaloğu. Shell tipi (gerçek zamanlı
 * kullanılabilirlik + WSL distro listesiyle birlikte), başlangıç komutu,
 * çalışma dizini, görünen isim ve vurgu rengi seçilebilir.
 */
function PaneConfigModal({
  isOpen,
  onClose,
  onSubmit
}: PaneConfigModalProps): React.JSX.Element | null {
  const t = useT()
  const [shells, setShells] = useState<AvailableShellInfo[]>([])
  const [shell, setShell] = useState<ShellKind>('powershell')
  const [wslDistro, setWslDistro] = useState('')
  const [startupCommand, setStartupCommand] = useState('')
  const [cwd, setCwd] = useState('')
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [loadingShells, setLoadingShells] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoadingShells(true)
    window.api.system
      .detectShells()
      .then((result) => setShells(result))
      .finally(() => setLoadingShells(false))
  }, [isOpen])

  if (!isOpen) return null

  const shellInfo = shells.find((info) => info.shell === shell)
  const wslInfo = shells.find((info) => info.shell === 'wsl')
  const isShellUnavailable = shellInfo ? !shellInfo.available : false

  function handleChooseDirectory(): void {
    window.api.system.chooseDirectory().then((path) => {
      if (path) setCwd(path)
    })
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    const config: PtyCreateOptions = {
      shell,
      wslDistro: shell === 'wsl' ? wslDistro || undefined : undefined,
      startupCommand: startupCommand.trim() || undefined,
      cwd: cwd.trim() || undefined
    }
    onSubmit(config, name.trim(), color)
    setName('')
    setStartupCommand('')
    setCwd('')
    setColor('')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-[var(--mtf-border)] bg-[var(--mtf-surface)] p-5 text-sm text-[var(--mtf-text)] shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--mtf-text)]">{t('paneConfig.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
          >
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--mtf-text-muted)]">{t('paneConfig.shell')}</span>
          <select
            value={shell}
            onChange={(event) => setShell(event.target.value as ShellKind)}
            className="rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-2 py-1.5 text-[var(--mtf-text)] outline-none focus:border-blue-500"
          >
            {SHELL_ORDER.map((kind) => {
              const info = shells.find((s) => s.shell === kind)
              return (
                <option key={kind} value={kind} disabled={info ? !info.available : false}>
                  {getShellMeta(kind).label}
                  {info && !info.available ? t('paneConfig.shellNotFound') : ''}
                </option>
              )
            })}
          </select>
          {loadingShells && (
            <span className="text-[11px] text-[var(--mtf-text-muted)]">
              {t('paneConfig.scanningShells')}
            </span>
          )}
          {!loadingShells && isShellUnavailable && (
            <span className="text-[11px] text-amber-400">
              {shellInfo?.reason ?? t('paneConfig.shellUnavailable')}
            </span>
          )}
        </label>

        {shell === 'wsl' && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--mtf-text-muted)]">{t('paneConfig.wslDistro')}</span>
            <select
              value={wslDistro}
              onChange={(event) => setWslDistro(event.target.value)}
              className="rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-2 py-1.5 text-[var(--mtf-text)] outline-none focus:border-blue-500"
            >
              <option value="">{t('paneConfig.wslDefaultDistro')}</option>
              {(wslInfo?.distros ?? []).map((distro) => (
                <option key={distro} value={distro}>
                  {distro}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--mtf-text-muted)]">
            {t('paneConfig.startupCommand')}
          </span>
          <input
            value={startupCommand}
            onChange={(event) => setStartupCommand(event.target.value)}
            placeholder={t('paneConfig.startupCommandPlaceholder')}
            className="rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-2 py-1.5 font-mono text-xs text-[var(--mtf-text)] outline-none focus:border-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--mtf-text-muted)]">{t('paneConfig.cwd')}</span>
          <div className="flex gap-2">
            <input
              value={cwd}
              onChange={(event) => setCwd(event.target.value)}
              placeholder={t('paneConfig.cwdPlaceholder')}
              className="min-w-0 flex-1 rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-2 py-1.5 font-mono text-xs text-[var(--mtf-text)] outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleChooseDirectory}
              className="shrink-0 rounded-md border border-[var(--mtf-border)] px-2 py-1.5 text-xs text-[var(--mtf-text)] hover:bg-[var(--mtf-hover)]"
            >
              {t('paneConfig.browse')}
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--mtf-text-muted)]">{t('paneConfig.nameOptional')}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={getShellMeta(shell).label}
            className="rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-2 py-1.5 text-[var(--mtf-text)] outline-none focus:border-blue-500"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--mtf-text-muted)]">{t('paneConfig.colorLabel')}</span>
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch.value || 'none'}
                type="button"
                title={swatch.label}
                onClick={() => setColor(swatch.value)}
                className={
                  'h-6 w-6 rounded-full border-2 ' +
                  (color === swatch.value ? 'border-[var(--mtf-text)]' : 'border-transparent')
                }
                style={{ backgroundColor: swatch.value || 'var(--mtf-surface-2)' }}
              />
            ))}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--mtf-border)] px-3 py-1.5 text-xs text-[var(--mtf-text)] hover:bg-[var(--mtf-hover)]"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
          >
            {t('common.create')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default PaneConfigModal
