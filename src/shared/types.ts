// Main <-> renderer arasında paylaşılan tipler.
// (WorkspaceConfig, PaneStatus vb. sonraki aşamalarda buraya eklenecek.)

export type ShellKind = 'powershell' | 'cmd' | 'wsl' | 'git-bash' | 'bash' | 'zsh' | 'custom'

/** Aşama 16: bir pane'in türü. Belirtilmemişse (eski kayıtlar) 'terminal' kabul edilir. */
export type PaneKind = 'terminal' | 'web'

export interface PtyCreateOptions {
  /** Hangi shell/araç kullanılacağı */
  shell: ShellKind
  /** shell 'custom' ise veya varsayılan yürütülebilir dosya yolu geçersiz kılınacaksa */
  executable?: string
  /** shell 'wsl' ise distro adı (örn. "Ubuntu") */
  wslDistro?: string
  /** Shell açıldıktan sonra çalıştırılacak opsiyonel başlangıç komutu (örn. "claude", "npm run dev") */
  startupCommand?: string
  /** Ek argümanlar (ileri seviye kullanım) */
  args?: string[]
  /** Başlangıç çalışma dizini */
  cwd?: string
  cols?: number
  rows?: number
  env?: Record<string, string>
}

export interface PtyCreateResult {
  id: string
}

export interface PtyDataPayload {
  id: string
  data: string
}

export interface PtyExitPayload {
  id: string
  exitCode: number
  signal?: number
}

export interface PtyErrorPayload {
  id: string
  message: string
}

/** Aşama 12: "geri al" ile yeniden bağlanma sonucu — canlı process bulunamazsa `ok: false`. */
export interface PtyReattachResult {
  ok: boolean
  /** Detach edildiği süre boyunca process'in ürettiği, henüz gösterilmemiş ham çıktı. */
  catchUp: string
}

/** Pane başlığında gösterilen anlık kaynak kullanımı (Aşama 9: pane vitals). */
export interface PtyUsage {
  /** Yüzde olarak CPU kullanımı (100 = bir çekirdek tam dolu). */
  cpu: number
  /** Bayt cinsinden bellek kullanımı (RSS). */
  memory: number
}

/** Bir shell tipinin bu makinede kullanılabilir olup olmadığı (Aşama 5: PaneConfigModal). */
export interface AvailableShellInfo {
  shell: ShellKind
  available: boolean
  /** shell === 'wsl' ise kurulu distro adları */
  distros?: string[]
  /** Kullanılamıyorsa kullanıcıya gösterilecek kısa gerekçe */
  reason?: string
}

export interface NotificationPayload {
  title: string
  body: string
}

/** Aşama 7 (persistence): tek bir pane'in electron-store'a yazılan yapılandırması. */
export interface PersistedPaneConfig {
  id: string
  config: PtyCreateOptions
  title: string
  color?: string
  /** Aşama 10: process çökerse otomatik yeniden başlatma tercihi. */
  autoRestart?: boolean
  /** Aşama 16: pane türü — belirtilmemişse 'terminal' kabul edilir (eski kayıtlarla uyumluluk). */
  kind?: PaneKind
  /** kind === 'web' ise son gezinilen/gösterilen URL. */
  webUrl?: string
}

/** Bir workspace'in kalıcı hale getirilen pane seti + sırası. */
export interface PersistedWorkspace {
  id: string
  name: string
  order: string[]
  panes: PersistedPaneConfig[]
}

/** Uygulamanın tamamının kalıcı durumu (açılışta pane'ler sıfırdan bu config'lerle yeniden spawn edilir). */
export interface PersistedAppState {
  version: 1
  workspaceOrder: string[]
  activeWorkspaceId: string
  workspaces: PersistedWorkspace[]
}

/** Aşama 8: bir pane grubunu tek tıkla yeni workspace olarak açılabilen şablon. */
export interface Preset {
  id: string
  name: string
  panes: PersistedPaneConfig[]
}

/** Aşama 12: IDE tarzı dosya paneli — bir dizindeki tek bir girdi (dosya/klasör). */
export interface FileEntry {
  name: string
  isDirectory: boolean
  /** Bayt cinsinden boyut (klasörler için 0). */
  size: number
  modifiedAt: number
}

export interface FsListResult {
  path: string
  entries: FileEntry[]
}

/** Basit main-process fs işlemlerinin ortak sonuç şekli (hata mesajı ile). */
export interface FsOpResult {
  ok: boolean
  error?: string
}

export interface FsImportResult {
  ok: boolean
  errors: string[]
}

/**
 * Aşama 13: dosya paneli içi editör — bir dosyayı metin olarak okuma sonucu.
 * `ok: false` durumu, dosyanın ikili (binary)/çok büyük olması ya da okuma
 * hatası (izin vb.) gibi "metin olarak açılamaz" durumlarını kapsar.
 */
export interface FsReadTextResult {
  ok: boolean
  content?: string
  error?: string
}

/** Görsel dosyaları önizlemek için `data:` URL'i döner (base64 gömülü). */
export interface FsReadDataUrlResult {
  ok: boolean
  dataUrl?: string
  error?: string
}

/**
 * Aşama 14: git-farkında dosya paneli. `entries`, dizin (git repo kökünden
 * DEĞİL, sorgulanan dizinden itibaren relatif) yolları -> `git status --porcelain`
 * durum kodlarına (ör. "M", "A", "D", "??", "R") eşler. Sorgulanan dizin bir
 * git deposu değilse veya git kurulu değilse `ok: false` döner (bu durumda
 * UI sessizce rozet göstermez, hata diyaloğu açmaz).
 */
export interface GitStatusResult {
  ok: boolean
  entries: Record<string, string>
  error?: string
}

/**
 * Bir dosyanın HEAD'deki (son commit) içeriğini döner — dosya paneli içi
 * editördeki "diff modu" için orijinal karşılaştırma metni. Dosya HEAD'de
 * yoksa (yeni/untracked) `ok: true, content: ''` döner (tüm içerik "eklenmiş"
 * gösterilir); dizin hiç bir git deposu değilse `ok: false` döner.
 */
export interface GitShowHeadResult {
  ok: boolean
  content?: string
  error?: string
}

/** Aşama 14: tam oturum kaydı/replay — bir pane geçmişindeki tek bir anlık görüntünün metaverisi. */
export interface SessionHistoryEntryMeta {
  index: number
  timestamp: number
}

/** Aşama 16: sistem bilgisi paneli — bir disk bölümünün anlık kullanım durumu. */
export interface SysInfoDisk {
  mount: string
  totalBytes: number
  freeBytes: number
}

/**
 * Aşama 16: sistem bilgisi paneli — OS/CPU/RAM/disk anlık görüntüsü. `cpuUsagePercent`
 * ve `perCoreUsagePercent`, önceki çağrıya göre hesaplanan bir delta'dır; bu yüzden
 * ilk çağrıda (henüz önceki örnek yokken) 0 döner, sonraki çağrılarda gerçek değeri gösterir.
 */
export interface SysInfoSnapshot {
  platform: string
  arch: string
  release: string
  hostname: string
  uptimeSec: number
  cpuModel: string
  cpuCount: number
  cpuUsagePercent: number
  perCoreUsagePercent: number[]
  totalMemBytes: number
  freeMemBytes: number
  loadAvg: [number, number, number]
  disks: SysInfoDisk[]
}

export const IPC = {
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  PTY_ERROR: 'pty:error',
  PTY_USAGE: 'pty:usage',
  PTY_DETACH: 'pty:detach',
  PTY_REATTACH: 'pty:reattach',
  SHELLS_DETECT: 'shells:detect',
  DIALOG_CHOOSE_DIRECTORY: 'dialog:choose-directory',
  NOTIFICATION_SHOW: 'notification:show',
  CONFIG_LOAD: 'config:load',
  CONFIG_SAVE: 'config:save',
  PRESETS_LOAD: 'presets:load',
  PRESETS_SAVE: 'presets:save',
  SESSION_SAVE_BUFFER: 'session:save-buffer',
  SESSION_LOAD_BUFFER: 'session:load-buffer',
  SESSION_PRUNE: 'session:prune',
  SESSION_APPEND_HISTORY: 'session:append-history',
  SESSION_LIST_HISTORY: 'session:list-history',
  SESSION_READ_HISTORY_ENTRY: 'session:read-history-entry',
  APP_BEFORE_QUIT: 'app:before-quit',
  FS_LIST: 'fs:list',
  FS_HOME_DIR: 'fs:home-dir',
  FS_CREATE_FOLDER: 'fs:create-folder',
  FS_CREATE_FILE: 'fs:create-file',
  FS_DELETE: 'fs:delete',
  FS_RENAME: 'fs:rename',
  FS_IMPORT_PATHS: 'fs:import-paths',
  FS_OPEN_PATH: 'fs:open-path',
  FS_REVEAL: 'fs:reveal',
  FS_READ_TEXT_FILE: 'fs:read-text-file',
  FS_READ_DATA_URL: 'fs:read-data-url',
  FS_WRITE_TEXT_FILE: 'fs:write-text-file',
  GIT_STATUS: 'git:status',
  GIT_SHOW_HEAD: 'git:show-head',
  SYSTEM_OPEN_EXTERNAL: 'system:open-external',
  SYS_INFO: 'sys:info'
} as const
