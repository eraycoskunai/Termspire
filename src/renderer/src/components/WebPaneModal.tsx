import { useState } from 'react'
import { COLOR_SWATCHES } from '../lib/colorSwatches'

export interface WebPaneModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (url: string, title: string, color: string) => void
}

const QUICK_URLS = ['localhost:3000', 'localhost:5173', 'localhost:8080', 'localhost:4200']

/**
 * Aşama 16: "web" pane'i oluşturma diyaloğu — istenilen kadar açılabilen, `npm run dev`
 * gibi bir sunucunun canlı çıktısını `<webview>` içinde önizleyen gömülü tarayıcı pane'i.
 */
function WebPaneModal({ isOpen, onClose, onSubmit }: WebPaneModalProps): React.JSX.Element | null {
  const [url, setUrl] = useState('localhost:3000')
  const [name, setName] = useState('')
  const [color, setColor] = useState('')

  if (!isOpen) return null

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    if (!url.trim()) return
    onSubmit(url.trim(), name.trim(), color)
    setUrl('localhost:3000')
    setName('')
    setColor('')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-[var(--mtf-border)] bg-[var(--mtf-surface)] p-5 text-sm text-[var(--mtf-text)] shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--mtf-text)]">🌐 Yeni Web Pane</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
          >
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--mtf-text-muted)]">URL</span>
          <input
            autoFocus
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="localhost:3000"
            className="rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-2 py-1.5 font-mono text-xs text-[var(--mtf-text)] outline-none focus:border-blue-500"
          />
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {QUICK_URLS.map((quick) => (
              <button
                key={quick}
                type="button"
                onClick={() => setUrl(quick)}
                className="rounded border border-[var(--mtf-border)] px-1.5 py-0.5 text-[10px] text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
              >
                {quick}
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--mtf-text-muted)]">İsim (opsiyonel)</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Web"
            className="rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-2 py-1.5 text-[var(--mtf-text)] outline-none focus:border-blue-500"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--mtf-text-muted)]">Renk etiketi</span>
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
            İptal
          </button>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
          >
            Oluştur
          </button>
        </div>
      </form>
    </div>
  )
}

export default WebPaneModal
