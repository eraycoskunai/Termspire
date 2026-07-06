import { useEffect, useRef, useState } from 'react'
import { basicSetup } from 'codemirror'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState, Prec, Compartment } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { unifiedMergeView } from '@codemirror/merge'
import { getLanguageExtension, isImageFile } from '../lib/codeLangForFile'
import type { ThemeMode } from '../state/useUiStore'
import { useT } from '../hooks/useTranslation'

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

interface FileEditorPanelProps {
  filePath: string
  fileName: string
  theme: ThemeMode
  onClose: () => void
  /** Ebeveyn, kaydedilmemiş değişiklik varken başka bir dosyaya geçmeden önce uyarabilsin diye. */
  onDirtyChange?: (isDirty: boolean) => void
}

const EDITOR_FONT_THEME = EditorView.theme({
  '&': { height: '100%', fontSize: '13px' },
  '.cm-scroller': {
    fontFamily: 'Cascadia Code, Cascadia Mono, Consolas, "Courier New", ui-monospace, monospace'
  }
})

/**
 * Aşama 13: dosya paneli içinde tıklanan bir dosyayı doğrudan uygulama içinde
 * görüntüleyip düzenler ("IDE mantığı") — metin/kod dosyaları CodeMirror 6 ile
 * sözdizimi vurgulu bir editörde açılır (Ctrl+S ile diske kaydedilir), görsel
 * dosyalar ise doğrudan önizlenir. İkili/çok büyük dosyalar için önizleme
 * yapılamayacağı bildirilir ve OS uygulamasıyla açma seçeneği sunulur.
 */
function FileEditorPanel({
  filePath,
  fileName,
  theme,
  onClose,
  onDirtyChange
}: FileEditorPanelProps): React.JSX.Element {
  const t = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const originalContentRef = useRef<string>('')
  const saveRef = useRef<() => void>(() => {})
  /** Aşama 14: diff modu — `@codemirror/merge`'ün unifiedMergeView'ini açıp kapatmak için. */
  const diffCompartmentRef = useRef(new Compartment())
  const headContentRef = useRef<string>('')

  const isImage = isImageFile(fileName)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  /** Diskten okunan ham metin — CodeMirror instance'ı ayrı bir effect'te,
   * container div DOM'a kesin olarak monte olduktan SONRA bundan kurulur. */
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [diffAvailable, setDiffAvailable] = useState(false)
  const [showDiff, setShowDiff] = useState(false)

  async function handleSave(): Promise<void> {
    const view = viewRef.current
    if (!view) return
    const content = view.state.doc.toString()
    if (content === originalContentRef.current) return
    setSaveStatus('saving')
    const result = await window.api.fs.writeTextFile(filePath, content)
    if (result.ok) {
      originalContentRef.current = content
      setIsDirty(false)
      onDirtyChange?.(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((current) => (current === 'saved' ? 'idle' : current)), 1500)
    } else {
      setSaveStatus('idle')
      window.alert(t('fileEditor.saveFailed', { error: result.error ?? '' }))
    }
  }
  saveRef.current = handleSave

  useEffect(() => {
    let disposed = false
    setLoading(true)
    setError(null)
    setIsDirty(false)
    setImageDataUrl(null)
    setPendingText(null)
    setSaveStatus('idle')
    setDiffAvailable(false)
    setShowDiff(false)
    headContentRef.current = ''
    diffCompartmentRef.current = new Compartment()
    viewRef.current?.destroy()
    viewRef.current = null

    // Aşama 14: diff modu — bu dosyanın git HEAD'deki içeriği arka planda
    // alınır (editör yüklenmesini bloklamaz). Dizin bir git deposu değilse
    // "Diff" butonu hiç gösterilmez.
    if (!isImageFile(fileName)) {
      window.api.git.showHead(filePath).then((result) => {
        if (disposed) return
        if (result.ok) {
          headContentRef.current = result.content ?? ''
          setDiffAvailable(true)
        }
      })
    }

    if (isImageFile(fileName)) {
      window.api.fs.readDataUrl(filePath).then((result) => {
        if (disposed) return
        setLoading(false)
        if (result.ok && result.dataUrl) setImageDataUrl(result.dataUrl)
        else setError(result.error ?? t('fileEditor.imageLoadFailed'))
      })
      return () => {
        disposed = true
      }
    }

    window.api.fs.readTextFile(filePath).then((result) => {
      if (disposed) return
      setLoading(false)
      if (!result.ok || result.content === undefined) {
        setError(result.error ?? t('fileEditor.textOpenFailed'))
        return
      }
      originalContentRef.current = result.content
      // Editör instance'ı burada DOĞRUDAN kurulmuyor: `loading` henüz bu satırda
      // `false`'a işlenmedi, dolayısıyla container `<div>` (`!loading` koşuluna
      // bağlı) DOM'a henüz monte olmamış olabilir — `containerRef.current` bu
      // noktada `null` olabilir (React state güncellemeleri bir sonraki render'da
      // işlenir). Bu, editörün bazı dosyalarda zamanlamaya bağlı olarak hiç
      // oluşturulmamasına ("boş görünen dosya" hatası) yol açıyordu. Bunun yerine
      // içeriği state'e koyup gerçek kurulumu, container kesinlikle mount
      // olduktan SONRA çalışacak aşağıdaki effect'e bırakıyoruz.
      setPendingText(result.content)
    })

    return () => {
      disposed = true
    }
    // `t` kasıtlı olarak bağımlılıklara eklenmiyor: dil değişiminde bu effect'in
    // yeniden çalışması dosyayı diskten sıfırdan okur ve kaydedilmemiş
    // değişiklikleri sessizce kaybettirirdi — sadece dosya değiştiğinde çalışmalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, fileName])

  // Container div, `pendingText` set edildiği render'da (loading=false, error=null,
  // !isImage) DOM'a monte edilmiş olacağı GARANTİ altında olduğundan (effect'ler
  // her zaman commit sonrası çalışır), CodeMirror instance'ını burada güvenle
  // kurabiliriz.
  useEffect(() => {
    if (pendingText === null) return
    if (!containerRef.current) return

    const saveKeymap = Prec.highest(
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            void saveRef.current()
            return true
          }
        }
      ])
    )
    const languageExtension = getLanguageExtension(fileName)
    const state = EditorState.create({
      doc: pendingText,
      extensions: [
        basicSetup,
        saveKeymap,
        ...(languageExtension ? [languageExtension] : []),
        ...(theme === 'dark' ? [oneDark] : []),
        EDITOR_FONT_THEME,
        diffCompartmentRef.current.of([]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return
          const dirty = update.state.doc.toString() !== originalContentRef.current
          setIsDirty(dirty)
          onDirtyChange?.(dirty)
        })
      ]
    })
    viewRef.current = new EditorView({ state, parent: containerRef.current })
    // Tema değişimi bilinçli olarak editörü yeniden kurmuyor — sadece yeni
    // içerik geldiğinde (yeni dosya) kurulum yapılır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingText])

  useEffect(() => {
    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [])

  // Aşama 14: diff modu aç/kapa — mevcut editör state'ini yeniden kurmadan
  // (imleç/undo geçmişi kaybolmadan) `unifiedMergeView` uzantısını
  // Compartment üzerinden takar/söker. Diff, editördeki O ANKİ (kaydedilmemiş
  // olsa da) içerik ile git HEAD'deki içerik arasında canlı olarak hesaplanır.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: diffCompartmentRef.current.reconfigure(
        showDiff
          ? [
              unifiedMergeView({
                original: headContentRef.current,
                mergeControls: false,
                highlightChanges: true,
                gutter: true
              })
            ]
          : []
      )
    })
  }, [showDiff, loading])

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col border-l border-[var(--mtf-border)] bg-[var(--mtf-bg)]">
      <div className="flex items-center gap-1.5 border-b border-[var(--mtf-border)] bg-[var(--mtf-surface)] px-2 py-1.5 text-xs">
        <span className="shrink-0">{isImage ? '🖼️' : '📝'}</span>
        <span
          className="min-w-0 flex-1 truncate font-medium text-[var(--mtf-text)]"
          title={filePath}
        >
          {fileName}
        </span>
        {isDirty && (
          <span title={t('fileEditor.dirty')} className="shrink-0 text-amber-400">
            ●
          </span>
        )}
        {saveStatus === 'saving' && (
          <span className="shrink-0 text-[var(--mtf-text-muted)]">{t('fileEditor.saving')}</span>
        )}
        {saveStatus === 'saved' && (
          <span className="shrink-0 text-emerald-400">{t('fileEditor.saved')}</span>
        )}
        {!isImage && !error && diffAvailable && (
          <button
            type="button"
            title={t('fileEditor.diffTitle')}
            onClick={() => setShowDiff((value) => !value)}
            className={cx(
              'shrink-0 rounded px-2 py-0.5 text-[11px] font-medium',
              showDiff
                ? 'bg-purple-600 text-white hover:bg-purple-500'
                : 'bg-[var(--mtf-surface-2)] text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)]'
            )}
          >
            {t('fileEditor.diff')}
          </button>
        )}
        {!isImage && !error && (
          <button
            type="button"
            title={t('fileEditor.saveTitle')}
            onClick={() => void handleSave()}
            disabled={!isDirty}
            className={cx(
              'shrink-0 rounded px-2 py-0.5 text-[11px] font-medium',
              isDirty
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'cursor-not-allowed bg-[var(--mtf-surface-2)] text-[var(--mtf-text-muted)]'
            )}
          >
            {t('fileEditor.save')}
          </button>
        )}
        <button
          type="button"
          title={t('fileEditor.revealInOs')}
          onClick={() => void window.api.fs.reveal(filePath)}
          className="shrink-0 rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
        >
          📂
        </button>
        <button
          type="button"
          title={t('fileEditor.close')}
          onClick={onClose}
          className="shrink-0 rounded px-1.5 py-0.5 text-[var(--mtf-text-muted)] hover:bg-red-900/60 hover:text-red-200"
        >
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {loading && (
          <div className="flex h-full items-center justify-center text-xs text-[var(--mtf-text-muted)]">
            {t('fileEditor.loading')}
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-[var(--mtf-text-muted)]">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void window.api.fs.openPath(filePath)}
              className="rounded bg-[var(--mtf-surface-2)] px-3 py-1.5 text-[var(--mtf-text)] hover:bg-[var(--mtf-hover)]"
            >
              {t('fileEditor.openWithOs')}
            </button>
          </div>
        )}
        {!loading && !error && isImage && imageDataUrl && (
          <div className="flex h-full w-full items-center justify-center overflow-auto bg-[var(--mtf-surface)] p-4">
            <img
              src={imageDataUrl}
              alt={fileName}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
        {!loading && !error && !isImage && (
          <div ref={containerRef} className="h-full w-full overflow-auto" />
        )}
      </div>
    </div>
  )
}

export default FileEditorPanel
