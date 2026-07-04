import { useEffect, useRef, useState } from 'react'
import type { FileEntry } from '@shared/types'
import type { PaneState } from '../state/useWorkspaceStore'
import type { ThemeMode } from '../state/useUiStore'
import FileEditorPanel from './FileEditorPanel'

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  const kb = size / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}

/**
 * Aşama 14: `git status --porcelain` durum kodunu kısa bir rozet harfi ve
 * renk sınıfına çevirir. `??` (untracked) -> "U", `R`ename -> "R" vb.
 */
function gitBadgeFor(code: string): { label: string; className: string } | null {
  if (!code) return null
  if (code === '??') return { label: 'U', className: 'bg-sky-500/20 text-sky-300' }
  if (code.includes('D')) return { label: 'D', className: 'bg-red-500/20 text-red-300' }
  if (code.includes('A')) return { label: 'A', className: 'bg-emerald-500/20 text-emerald-300' }
  if (code.includes('R')) return { label: 'R', className: 'bg-purple-500/20 text-purple-300' }
  if (code.includes('M')) return { label: 'M', className: 'bg-amber-500/20 text-amber-300' }
  return { label: '●', className: 'bg-neutral-500/20 text-neutral-300' }
}

function iconFor(entry: FileEntry): string {
  if (entry.isDirectory) return '📁'
  const ext = entry.name.split('.').pop()?.toLowerCase()
  if (ext && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return '🖼️'
  if (ext && ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜️'
  if (
    ext &&
    ['js', 'ts', 'tsx', 'jsx', 'json', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'cs'].includes(ext)
  )
    return '📄'
  return '📄'
}

interface InlineCreateFormProps {
  placeholder: string
  onSubmit: (name: string) => void
  onCancel: () => void
}

function InlineCreateForm({
  placeholder,
  onSubmit,
  onCancel
}: InlineCreateFormProps): React.JSX.Element {
  const [value, setValue] = useState('')
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(event) => setValue(event.target.value)}
      onBlur={onCancel}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && value.trim()) onSubmit(value.trim())
        if (event.key === 'Escape') onCancel()
      }}
      className="w-full rounded border border-blue-500 bg-[var(--mtf-bg)] px-1.5 py-1 text-xs text-[var(--mtf-text)] outline-none"
    />
  )
}

interface FileExplorerPanelProps {
  pane: PaneState | null | undefined
  homeDir: string | null
  platform: string
  theme: ThemeMode
  onClose: () => void
}

/**
 * Aşama 12: IDE tarzı dosya paneli — o an odaklanılan (seçili) pane'in
 * başlangıç dizinini gösterir. Klasör içine gezinme, klasör/dosya oluşturma,
 * silme ve OS'tan sürükle-bırak ile dosya/klasör içe aktarma desteklenir.
 * node fs erişimi tamamen main process'te (fsHandlers.ts) yapılır; bu bileşen
 * sadece IPC üzerinden konuşur.
 */
function FileExplorerPanel({
  pane,
  homeDir,
  platform,
  theme,
  onClose
}: FileExplorerPanelProps): React.JSX.Element {
  const sep = platform === 'win32' ? '\\' : '/'
  const rootPath = pane?.config.cwd || homeDir || null

  const [pathStack, setPathStack] = useState<string[]>(rootPath ? [rootPath] : [])
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Aşama 14: `git status` sonucu — anahtar `currentPath`'e göre relatif dosya yolu. */
  const [gitStatuses, setGitStatuses] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState<'folder' | 'file' | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const lastRootRef = useRef<string | null>(null)

  // Aşama 13: dosyaya tıklayınca IDE tarzı editör/önizleme açılır.
  const [openFile, setOpenFile] = useState<{ path: string; name: string } | null>(null)
  const isEditorDirtyRef = useRef(false)

  const currentPath = pathStack[pathStack.length - 1] ?? null

  /** Editörde kaydedilmemiş değişiklik varken dosya değiştirmeden/paneli kapatmadan önce onay ister. */
  function confirmDiscardDirtyEditor(): boolean {
    if (!isEditorDirtyRef.current) return true
    return window.confirm('Bu dosyada kaydedilmemiş değişiklikler var. Yine de kapatılsın mı?')
  }

  function openFileInEditor(fullPath: string, name: string): void {
    if (openFile?.path === fullPath) return
    if (!confirmDiscardDirtyEditor()) return
    isEditorDirtyRef.current = false
    setOpenFile({ path: fullPath, name })
  }

  function closeFileEditor(): void {
    if (!confirmDiscardDirtyEditor()) return
    isEditorDirtyRef.current = false
    setOpenFile(null)
  }

  // Odaklanılan pane değiştiğinde (farklı bir terminale tıklandığında) o
  // pane'in kendi başlangıç dizinine dönülür ve açık editör (varsa) kapatılır.
  useEffect(() => {
    if (rootPath && rootPath !== lastRootRef.current) {
      lastRootRef.current = rootPath
      setPathStack([rootPath])
      setOpenFile(null)
      isEditorDirtyRef.current = false
    }
  }, [rootPath])

  function refresh(): void {
    if (!currentPath) return
    setLoading(true)
    setError(null)
    window.api.fs.list(currentPath).then((result) => {
      setLoading(false)
      if ('error' in result) {
        setError(result.error)
        setEntries([])
      } else {
        setEntries(result.entries)
      }
    })
    // Aşama 14: git-farkında dosya paneli — bu dizin bir git deposu değilse
    // (veya git kurulu değilse) `ok: false` döner, rozet göstermeden sessizce
    // yok sayılır (dosya paneli git'e bağımlı değildir).
    window.api.git.status(currentPath).then((result) => {
      setGitStatuses(result.ok ? result.entries : {})
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath])

  function joinPath(base: string, name: string): string {
    return base.endsWith(sep) ? `${base}${name}` : `${base}${sep}${name}`
  }

  function navigateInto(name: string): void {
    if (!currentPath) return
    setPathStack((stack) => [...stack, joinPath(currentPath, name)])
  }

  function navigateUp(): void {
    setPathStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack))
  }

  function handleOpenEntry(entry: FileEntry): void {
    if (entry.isDirectory) {
      navigateInto(entry.name)
      return
    }
    if (currentPath) void window.api.fs.openPath(joinPath(currentPath, entry.name))
  }

  async function handleDelete(entry: FileEntry): Promise<void> {
    if (!currentPath) return
    const confirmed = window.confirm(
      `"${entry.name}" ${entry.isDirectory ? 'klasörü (içeriğiyle birlikte)' : 'dosyası'} silinsin mi?`
    )
    if (!confirmed) return
    const result = await window.api.fs.delete(currentPath, entry.name)
    if (!result.ok) window.alert(`Silinemedi: ${result.error}`)
    if (openFile?.path === joinPath(currentPath, entry.name)) {
      isEditorDirtyRef.current = false
      setOpenFile(null)
    }
    refresh()
  }

  async function handleCreate(kind: 'folder' | 'file', name: string): Promise<void> {
    if (!currentPath) return
    const result =
      kind === 'folder'
        ? await window.api.fs.createFolder(currentPath, name)
        : await window.api.fs.createFile(currentPath, name)
    if (!result.ok) window.alert(`Oluşturulamadı: ${result.error}`)
    setCreating(null)
    refresh()
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault()
    setIsDraggingOver(false)
    if (!currentPath || event.dataTransfer.files.length === 0) return
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.api.fs.getDroppedPath(file))
      .filter((path): path is string => Boolean(path))
    if (paths.length === 0) return
    const result = await window.api.fs.importPaths(currentPath, paths)
    if (!result.ok) window.alert(`Bazı öğeler kopyalanamadı:\n${result.errors.join('\n')}`)
    refresh()
  }

  function handleClosePanel(): void {
    if (!confirmDiscardDirtyEditor()) return
    isEditorDirtyRef.current = false
    setOpenFile(null)
    onClose()
  }

  return (
    <div
      className="flex h-full shrink-0"
      style={{ width: openFile ? 'min(64rem, 70vw)' : '18rem' }}
    >
      <div className="flex h-full w-72 shrink-0 flex-col border-l border-[var(--mtf-border)] bg-[var(--mtf-surface)] text-xs">
        <div className="flex items-center gap-1.5 border-b border-[var(--mtf-border)] px-2 py-1.5">
          <span className="font-medium text-[var(--mtf-text)]">📁 Dosyalar</span>
          {pane && (
            <span className="min-w-0 flex-1 truncate text-[var(--mtf-text-muted)]">
              · {pane.title}
            </span>
          )}
          <button
            type="button"
            title="Kapat"
            onClick={handleClosePanel}
            className="ml-auto shrink-0 rounded px-1 text-[var(--mtf-text-muted)] hover:bg-red-900/60 hover:text-red-200"
          >
            ✕
          </button>
        </div>

        {!pane || !currentPath ? (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-[var(--mtf-text-muted)]">
            Bir terminale tıklayın; dizini burada görünecek.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 border-b border-[var(--mtf-border)] px-1.5 py-1">
              <button
                type="button"
                title="Üst dizin"
                disabled={pathStack.length <= 1}
                onClick={navigateUp}
                className="rounded px-1.5 py-1 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)] disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ↑
              </button>
              <span
                title={currentPath}
                className="min-w-0 flex-1 truncate rounded bg-[var(--mtf-surface-2)] px-1.5 py-1 font-mono text-[10px] text-[var(--mtf-text-muted)]"
              >
                {currentPath}
              </span>
              <button
                type="button"
                title="Yenile"
                onClick={refresh}
                className="rounded px-1.5 py-1 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
              >
                ⟳
              </button>
              <button
                type="button"
                title="OS dosya gezgininde göster"
                onClick={() => void window.api.fs.reveal(currentPath)}
                className="rounded px-1.5 py-1 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
              >
                📂
              </button>
            </div>
            <div className="flex items-center gap-1 border-b border-[var(--mtf-border)] px-1.5 py-1">
              <button
                type="button"
                title="Yeni klasör"
                onClick={() => setCreating('folder')}
                className="rounded px-1.5 py-1 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
              >
                📁+
              </button>
              <button
                type="button"
                title="Yeni dosya"
                onClick={() => setCreating('file')}
                className="rounded px-1.5 py-1 text-[var(--mtf-text-muted)] hover:bg-[var(--mtf-hover)] hover:text-[var(--mtf-text)]"
              >
                📄+
              </button>
              <span className="ml-auto text-[10px] text-[var(--mtf-text-muted)]">
                {entries.length} öğe
              </span>
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault()
                setIsDraggingOver(true)
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(event) => void handleDrop(event)}
              className={cx(
                'min-h-0 flex-1 overflow-y-auto p-1',
                isDraggingOver && 'bg-blue-500/10 ring-2 ring-inset ring-blue-500'
              )}
            >
              {creating && (
                <div className="px-1 py-0.5">
                  <InlineCreateForm
                    placeholder={creating === 'folder' ? 'klasör adı' : 'dosya adı'}
                    onSubmit={(name) => void handleCreate(creating, name)}
                    onCancel={() => setCreating(null)}
                  />
                </div>
              )}
              {loading && entries.length === 0 && (
                <p className="px-1.5 py-2 text-[var(--mtf-text-muted)]">Yükleniyor…</p>
              )}
              {error && <p className="px-1.5 py-2 text-red-400">Hata: {error}</p>}
              {!loading && !error && entries.length === 0 && !creating && (
                <p className="px-1.5 py-2 text-[var(--mtf-text-muted)]">Bu dizin boş.</p>
              )}
              {entries.map((entry) => {
                const directCode = gitStatuses[entry.name]
                const nestedDirty =
                  entry.isDirectory &&
                  !directCode &&
                  Object.keys(gitStatuses).some((relPath) => relPath.startsWith(`${entry.name}/`))
                const badge = gitBadgeFor(directCode ?? (nestedDirty ? 'M' : ''))
                return (
                  <div
                    key={entry.name}
                    onClick={() => {
                      if (!entry.isDirectory && currentPath) {
                        openFileInEditor(joinPath(currentPath, entry.name), entry.name)
                      }
                    }}
                    onDoubleClick={() => handleOpenEntry(entry)}
                    title={
                      entry.isDirectory
                        ? entry.name
                        : `${entry.name} — tıkla: uygulama içinde aç, çift tık: OS uygulamasıyla aç`
                    }
                    className={cx(
                      'group flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-[var(--mtf-hover)]',
                      openFile?.path === (currentPath ? joinPath(currentPath, entry.name) : '') &&
                        'bg-blue-500/15 ring-1 ring-inset ring-blue-500/50'
                    )}
                  >
                    <span className="shrink-0">{iconFor(entry)}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--mtf-text)]">
                      {entry.name}
                    </span>
                    {badge && (
                      <span
                        title={`git: ${directCode ?? 'alt öğelerde değişiklik'}`}
                        className={cx(
                          'shrink-0 rounded px-1 font-mono text-[9px] font-bold',
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    )}
                    {!entry.isDirectory && (
                      <span className="shrink-0 text-[10px] text-[var(--mtf-text-muted)]">
                        {formatBytes(entry.size)}
                      </span>
                    )}
                    <button
                      type="button"
                      title="Sil"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDelete(entry)
                      }}
                      className="shrink-0 rounded px-1 text-[var(--mtf-text-muted)] opacity-0 hover:bg-red-900/60 hover:text-red-200 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
              {isDraggingOver && (
                <div className="pointer-events-none py-4 text-center text-blue-300">
                  Bırak — bu dizine kopyalanacak
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {openFile && (
        <FileEditorPanel
          filePath={openFile.path}
          fileName={openFile.name}
          theme={theme}
          onClose={closeFileEditor}
          onDirtyChange={(dirty) => {
            isEditorDirtyRef.current = dirty
          }}
        />
      )}
    </div>
  )
}

export default FileExplorerPanel
