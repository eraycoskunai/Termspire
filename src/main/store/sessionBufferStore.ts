import { app } from 'electron'
import fs from 'fs'
import path from 'path'

/**
 * Aşama 11: pane başına terminal ekran içeriği (xterm SerializeAddon çıktısı),
 * `electron-store`'un tek dosyalık JSON'ından ayrı olarak, kendi dosyasına
 * (paneId.buf) yazılır. Böylece sık aralıklı otomatik kayıt, her seferinde
 * tüm workspace/pane yapılandırmasını içeren büyük JSON'u yeniden yazmaz.
 * Konum: %APPDATA%/termspire/session-buffers/ (Windows).
 */

/** paneId'ler crypto.randomUUID() ile üretilir; yine de dosya adı olarak kullanmadan önce güvenlik için doğrulanır. */
const SAFE_ID_PATTERN = /^[a-zA-Z0-9-]+$/

function getSessionBufferDir(): string {
  return path.join(app.getPath('userData'), 'session-buffers')
}

function getBufferPath(paneId: string): string | null {
  if (!SAFE_ID_PATTERN.test(paneId)) return null
  return path.join(getSessionBufferDir(), `${paneId}.buf`)
}

export function saveSessionBuffer(paneId: string, data: string): void {
  const filePath = getBufferPath(paneId)
  if (!filePath) return
  try {
    fs.mkdirSync(getSessionBufferDir(), { recursive: true })
    fs.writeFileSync(filePath, data, 'utf-8')
  } catch {
    // Diske yazma başarısız olursa (izin, disk dolu vb.) sessizce yok say —
    // bu sadece "kaldığı yerden devam" için bir kolaylık, kritik bir işlev değil.
  }
}

export function loadSessionBuffer(paneId: string): string | null {
  const filePath = getBufferPath(paneId)
  if (!filePath) return null
  try {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

/** Artık hiçbir workspace'te var olmayan pane'lere ait "sahipsiz" tampon dosyalarını temizler. */
export function pruneSessionBuffers(keepPaneIds: string[]): void {
  const dir = getSessionBufferDir()
  try {
    if (!fs.existsSync(dir)) return
    const keepSet = new Set(keepPaneIds)
    for (const fileName of fs.readdirSync(dir)) {
      const paneId = fileName.replace(/\.buf$/, '')
      if (!keepSet.has(paneId)) {
        try {
          fs.unlinkSync(path.join(dir, fileName))
        } catch {
          // Yok sayılır.
        }
      }
    }
  } catch {
    // Yok sayılır.
  }
}
