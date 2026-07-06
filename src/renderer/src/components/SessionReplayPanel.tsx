import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { motion } from 'framer-motion'
import type { SessionHistoryEntryMeta } from '@shared/types'
import { useT, type TFunction } from '../hooks/useTranslation'
import { useUiStore } from '../state/useUiStore'
import '@xterm/xterm/css/xterm.css'

interface SessionReplayPanelProps {
  paneId: string
  title: string
  onClose: () => void
}

function formatTimestamp(ts: number, t: TFunction, locale: string): string {
  const date = new Date(ts)
  const time = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const diffMin = Math.round((Date.now() - ts) / 60000)
  const relative =
    diffMin < 1
      ? t('sessionReplay.now')
      : diffMin < 60
        ? t('sessionReplay.minAgo', { n: diffMin })
        : t('sessionReplay.hourAgo', { n: Math.round(diffMin / 60) })
  return `${time} · ${relative}`
}

/**
 * Aşama 14: tam oturum kaydı/replay. `sessionHistoryStore` içinde dakikada bir
 * biriken anlık görüntüler arasında bir "scrubber" (kaydırma çubuğu) ile
 * gezinmeyi sağlar. Gerçek ANSI renklerini doğru göstermek için ham metin
 * (`<pre>`) yerine salt-okunur, pty'ye bağlı OLMAYAN ikinci bir xterm.js
 * `Terminal` instance'ı kullanılır — seçilen anlık görüntü her değiştiğinde
 * `reset()` ile temizlenip yeniden yazılır.
 */
function SessionReplayPanel({
  paneId,
  title,
  onClose
}: SessionReplayPanelProps): React.JSX.Element {
  const t = useT()
  const language = useUiStore((state) => state.language)
  const locale = language === 'tr' ? 'tr-TR' : 'en-US'
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const [entries, setEntries] = useState<SessionHistoryEntryMeta[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.session.listHistory(paneId).then((list) => {
      setEntries(list)
      setSelectedIndex(list.length - 1)
      setLoading(false)
    })
  }, [paneId])

  useEffect(() => {
    if (!containerRef.current || termRef.current) return
    const term = new Terminal({
      convertEol: true,
      disableStdin: true,
      cursorBlink: false,
      fontSize: 12,
      fontFamily: 'Cascadia Code, Cascadia Mono, Consolas, "Courier New", ui-monospace, monospace',
      theme: { background: '#0a0b10', foreground: '#e5e7eb' }
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()
    termRef.current = term
    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(containerRef.current)
    return () => {
      resizeObserver.disconnect()
      term.dispose()
      termRef.current = null
    }
  }, [])

  useEffect(() => {
    const entry = entries[selectedIndex]
    const term = termRef.current
    if (!entry || !term) return
    window.api.session.readHistoryEntry(paneId, entry.index).then((data) => {
      if (!data || termRef.current !== term) return
      term.reset()
      term.write(data)
    })
  }, [paneId, entries, selectedIndex])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      className="fixed inset-0 z-[95] flex flex-col bg-black/80 p-6"
    >
      <div className="mb-3 flex shrink-0 items-center gap-3 text-white">
        <span className="text-base font-semibold">
          {t('sessionReplay.heading', { title })}
        </span>
        <span className="text-xs text-white/50">{t('sessionReplay.subtitle')}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md border border-white/20 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
        >
          {t('sessionReplay.close')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-white/10 bg-[#0a0b10] p-2">
        {loading && <p className="text-xs text-white/50">{t('sessionReplay.loading')}</p>}
        {!loading && entries.length === 0 && (
          <p className="text-xs text-white/50">{t('sessionReplay.empty')}</p>
        )}
        <div ref={containerRef} className={entries.length === 0 ? 'hidden' : 'h-full w-full'} />
      </div>

      {entries.length > 0 && (
        <div className="mt-3 flex shrink-0 items-center gap-3 text-xs text-white/80">
          <button
            type="button"
            disabled={selectedIndex <= 0}
            onClick={() => setSelectedIndex((index) => Math.max(0, index - 1))}
            className="rounded border border-white/20 px-2 py-1 disabled:opacity-30"
          >
            {t('sessionReplay.previous')}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, entries.length - 1)}
            value={selectedIndex}
            onChange={(event) => setSelectedIndex(Number(event.target.value))}
            className="flex-1"
          />
          <button
            type="button"
            disabled={selectedIndex >= entries.length - 1}
            onClick={() => setSelectedIndex((index) => Math.min(entries.length - 1, index + 1))}
            className="rounded border border-white/20 px-2 py-1 disabled:opacity-30"
          >
            {t('sessionReplay.next')}
          </button>
          <span className="w-40 shrink-0 text-right font-mono">
            {entries[selectedIndex] &&
              formatTimestamp(entries[selectedIndex].timestamp, t, locale)}
          </span>
        </div>
      )}
    </motion.div>
  )
}

export default SessionReplayPanel
