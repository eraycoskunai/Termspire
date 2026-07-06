import { useEffect, useRef, useState } from 'react'
import type { WebviewTag } from 'electron'
import { useT } from '../hooks/useTranslation'

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** Kullanıcının "localhost:3000" gibi kısayollar yazabilmesi için basit bir URL normalize edici. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'about:blank'
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || trimmed.startsWith('about:')) return trimmed
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`
  }
  return `https://${trimmed}`
}

export interface WebPaneProps {
  paneId: string
  title: string
  color?: string
  /** Pane oluşturulurken/kalıcı depodan yüklenirken gösterilecek ilk URL. */
  url: string
  isZoomed: boolean
  onUrlChange: (url: string) => void
  onClose: () => void
  onToggleZoom: () => void
  onFocusPane: () => void
  dragHandleRef: (element: HTMLElement | null) => void
  dragHandleProps: Record<string, unknown>
}

/**
 * Aşama 16: "web" pane — Electron `<webview>` etiketiyle gömülü, istenildiği kadar
 * açılabilen bir tarayıcı sekmesi. `npm run dev` gibi bir sunucunun canlı çıktısını
 * terminalin yanında önizlemek, ya da herhangi bir web sayfasını grid içinde
 * tutmak için kullanılır. Zoom/sürükleme davranışı TerminalPane ile aynı
 * (GridLayout'taki sarmalayıcı motion.div tarafından yönetilir) — bu bileşen
 * sadece kendi içeriğini (adres çubuğu + webview) render eder.
 */
function WebPane({
  paneId,
  title,
  color,
  url,
  onUrlChange,
  onClose,
  onToggleZoom,
  onFocusPane,
  dragHandleRef,
  dragHandleProps
}: WebPaneProps): React.JSX.Element {
  const t = useT()
  const webviewElRef = useRef<HTMLWebViewElement | null>(null)
  const [addressInput, setAddressInput] = useState(url)
  const [isLoading, setIsLoading] = useState(true)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  function getTag(): WebviewTag | null {
    return webviewElRef.current as unknown as WebviewTag | null
  }

  useEffect(() => {
    const maybeWebview = getTag()
    if (!maybeWebview) return
    const webview: WebviewTag = maybeWebview

    function handleStartLoading(): void {
      setIsLoading(true)
      setLoadError(null)
    }
    function handleStopLoading(): void {
      setIsLoading(false)
      const currentUrl = webview.getURL()
      if (currentUrl) {
        setAddressInput(currentUrl)
        onUrlChange(currentUrl)
      }
      setCanGoBack(webview.canGoBack())
      setCanGoForward(webview.canGoForward())
    }
    function handleFailLoad(event: Electron.DidFailLoadEvent): void {
      // -3 = ERR_ABORTED — genelde kullanıcı hızlı art arda yönlendirdiğinde/durdurduğunda
      // oluşur, gerçek bir hata değildir.
      if (event.errorCode === -3 || !event.isMainFrame) return
      setIsLoading(false)
      setLoadError(`${event.errorDescription} (${event.errorCode})`)
    }

    webview.addEventListener('did-start-loading', handleStartLoading)
    webview.addEventListener('did-stop-loading', handleStopLoading)
    webview.addEventListener('did-fail-load', handleFailLoad)
    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading)
      webview.removeEventListener('did-stop-loading', handleStopLoading)
      webview.removeEventListener('did-fail-load', handleFailLoad)
    }
    // paneId'nin ömrü boyunca webview elementi sabittir; `url` kasıtlı olarak
    // burada dinlenmiyor (yalnızca ilk mount'ta `src` ile veriliyor, sonrası
    // kullanıcının kendi gezinmesiyle sürer — prop güncellemesiyle yeniden
    // yüklenmesi istenmiyor).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleBack(): void {
    getTag()?.goBack()
  }
  function handleForward(): void {
    getTag()?.goForward()
  }
  function handleReloadOrStop(): void {
    const webview = getTag()
    if (!webview) return
    if (isLoading) webview.stop()
    else webview.reload()
  }
  function handleAddressSubmit(event: React.FormEvent): void {
    event.preventDefault()
    const target = normalizeUrl(addressInput)
    setAddressInput(target)
    getTag()?.loadURL(target)
  }
  function handleOpenExternal(): void {
    const target = getTag()?.getURL() || url
    if (/^https?:\/\//i.test(target)) window.api.system.openExternal(target)
  }

  return (
    <div
      data-pane-id={paneId}
      onMouseDownCapture={onFocusPane}
      style={color ? { borderTopColor: color, borderTopWidth: 2 } : undefined}
      className="flex h-full w-full flex-col overflow-hidden rounded-md border border-[var(--mtf-border)] bg-[var(--mtf-bg)]"
    >
      <div className="flex items-center gap-2 border-b border-[var(--mtf-border)] bg-[var(--mtf-surface)] px-2 py-1.5 text-xs text-[var(--mtf-text)]">
        <div
          ref={dragHandleRef}
          {...dragHandleProps}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 active:cursor-grabbing"
          onDoubleClick={onToggleZoom}
        >
          <span className="shrink-0 rounded bg-[var(--mtf-surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--mtf-text-muted)]">
            🌐 WEB
          </span>
          <span className="truncate font-medium">{title}</span>
          {isLoading && (
            <span className="shrink-0 animate-pulse text-[10px] text-[var(--mtf-text-muted)]">
              {t('webPane.loading')}
            </span>
          )}
        </div>
        <button
          type="button"
          title={t('webPane.openExternal')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={handleOpenExternal}
          className="shrink-0 rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
        >
          🡵
        </button>
        <button
          type="button"
          title={t('webPane.zoomHint')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleZoom}
          className="shrink-0 rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
        >
          ⤢
        </button>
        <button
          type="button"
          title={t('webPane.close')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          className="shrink-0 rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-red-900/60 hover:text-red-200"
        >
          ✕
        </button>
      </div>
      <form
        onSubmit={handleAddressSubmit}
        className="flex items-center gap-1 border-b border-[var(--mtf-border)] bg-[var(--mtf-surface)] px-1.5 py-1"
      >
        <button
          type="button"
          disabled={!canGoBack}
          onClick={handleBack}
          title={t('webPane.back')}
          className="shrink-0 rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ‹
        </button>
        <button
          type="button"
          disabled={!canGoForward}
          onClick={handleForward}
          title={t('webPane.forward')}
          className="shrink-0 rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ›
        </button>
        <button
          type="button"
          onClick={handleReloadOrStop}
          title={isLoading ? t('webPane.stop') : t('webPane.reload')}
          className="shrink-0 rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]"
        >
          {isLoading ? '✕' : '⟳'}
        </button>
        <input
          value={addressInput}
          onChange={(event) => setAddressInput(event.target.value)}
          onFocus={(event) => event.target.select()}
          placeholder={t('webPane.addressPlaceholder')}
          className="min-w-0 flex-1 rounded border border-[var(--mtf-border)] bg-[var(--mtf-bg)] px-2 py-1 font-mono text-[11px] text-[var(--mtf-text)] outline-none focus:border-blue-500"
        />
      </form>
      <div className="relative min-h-0 flex-1 bg-white">
        {loadError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--mtf-bg)] p-4 text-center text-xs text-[var(--mtf-text-muted)]">
            <span>{t('webPane.loadFailed')}</span>
            <span className="max-w-full break-all font-mono text-[10px]">{loadError}</span>
            <button
              type="button"
              onClick={handleReloadOrStop}
              className="rounded border border-[var(--mtf-border)] px-2 py-1 hover:bg-[var(--mtf-hover)]"
            >
              {t('webPane.retry')}
            </button>
          </div>
        )}
        <webview ref={webviewElRef} src={url} className={cx('h-full w-full')} />
      </div>
    </div>
  )
}

export default WebPane
