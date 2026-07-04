import { ipcMain, shell } from 'electron'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  IPC,
  type FileEntry,
  type FsImportResult,
  type FsListResult,
  type FsOpResult,
  type FsReadDataUrlResult,
  type FsReadTextResult
} from '@shared/types'

/** Aşama 13: dosya paneli içi editör/önizleme için boyut sınırları (bellek/UI güvenliği). */
const MAX_TEXT_FILE_BYTES = 4 * 1024 * 1024
const MAX_PREVIEW_IMAGE_BYTES = 20 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon'
}

/** Bir Buffer'ın metin olarak açılabilir olup olmadığını kabaca tespit eder (NUL byte = binary). */
function looksBinary(buffer: Buffer): boolean {
  const sampleSize = Math.min(buffer.length, 8000)
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

/**
 * Aşama 12: IDE tarzı dosya paneli — seçili pane'in başlangıç dizinini
 * listeler, klasör/dosya oluşturma, silme ve OS'tan sürükle-bırak ile
 * dosya/klasör kopyalamayı destekler. Uygulama zaten node-pty ile tam
 * kullanıcı yetkisiyle shell çalıştırdığı için, burada ekstra bir sandbox
 * kısıtı gerekmiyor — kullanıcı zaten terminalden aynı dosyalara erişebiliyor.
 */
export function registerFsHandlers(): void {
  ipcMain.handle(IPC.FS_HOME_DIR, (): string => os.homedir())

  ipcMain.handle(
    IPC.FS_LIST,
    async (_event, dirPath: string): Promise<FsListResult | { error: string }> => {
      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true })
        const entries: FileEntry[] = []
        for (const item of items) {
          try {
            const stats = await fs.stat(path.join(dirPath, item.name))
            entries.push({
              name: item.name,
              isDirectory: item.isDirectory(),
              size: stats.size,
              modifiedAt: stats.mtimeMs
            })
          } catch {
            // Erişilemeyen girdi (izin/kırık sembolik link vb.) sessizce atlanır.
          }
        }
        entries.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        })
        return { path: dirPath, entries }
      } catch (error) {
        return { error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    IPC.FS_CREATE_FOLDER,
    async (_event, dirPath: string, name: string): Promise<FsOpResult> => {
      try {
        await fs.mkdir(path.join(dirPath, name))
        return { ok: true }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    IPC.FS_CREATE_FILE,
    async (_event, dirPath: string, name: string): Promise<FsOpResult> => {
      try {
        // 'wx' bayrağı: dosya zaten varsa hata verir (yanlışlıkla üzerine yazmayı önler).
        await fs.writeFile(path.join(dirPath, name), '', { flag: 'wx' })
        return { ok: true }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    IPC.FS_RENAME,
    async (_event, dirPath: string, oldName: string, newName: string): Promise<FsOpResult> => {
      try {
        await fs.rename(path.join(dirPath, oldName), path.join(dirPath, newName))
        return { ok: true }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    IPC.FS_DELETE,
    async (_event, dirPath: string, name: string): Promise<FsOpResult> => {
      try {
        await fs.rm(path.join(dirPath, name), { recursive: true, force: false })
        return { ok: true }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    IPC.FS_IMPORT_PATHS,
    async (_event, destDir: string, sourcePaths: string[]): Promise<FsImportResult> => {
      const errors: string[] = []
      for (const sourcePath of sourcePaths) {
        try {
          const name = path.basename(sourcePath)
          await fs.cp(sourcePath, path.join(destDir, name), { recursive: true })
        } catch (error) {
          errors.push(`${path.basename(sourcePath)}: ${(error as Error).message}`)
        }
      }
      return { ok: errors.length === 0, errors }
    }
  )

  ipcMain.handle(IPC.FS_OPEN_PATH, async (_event, targetPath: string): Promise<FsOpResult> => {
    const error = await shell.openPath(targetPath)
    return error ? { ok: false, error } : { ok: true }
  })

  ipcMain.handle(IPC.FS_REVEAL, (_event, targetPath: string): FsOpResult => {
    shell.showItemInFolder(targetPath)
    return { ok: true }
  })

  // Aşama 13: dosya paneli içi editör — bir dosyayı doğrudan uygulama içinde
  // görüntüleyip düzenleyebilmek için.
  ipcMain.handle(
    IPC.FS_READ_TEXT_FILE,
    async (_event, filePath: string): Promise<FsReadTextResult> => {
      try {
        const stats = await fs.stat(filePath)
        if (stats.size > MAX_TEXT_FILE_BYTES) {
          return {
            ok: false,
            error: 'Dosya çok büyük (4 MB üzeri metin önizlemesi desteklenmiyor).'
          }
        }
        const buffer = await fs.readFile(filePath)
        if (looksBinary(buffer)) {
          return {
            ok: false,
            error: 'Bu bir ikili (binary) dosya gibi görünüyor, metin olarak açılamıyor.'
          }
        }
        return { ok: true, content: buffer.toString('utf-8') }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    IPC.FS_READ_DATA_URL,
    async (_event, filePath: string): Promise<FsReadDataUrlResult> => {
      try {
        const stats = await fs.stat(filePath)
        if (stats.size > MAX_PREVIEW_IMAGE_BYTES) {
          return { ok: false, error: 'Dosya çok büyük (20 MB üzeri önizleme desteklenmiyor).' }
        }
        const ext = path.extname(filePath).slice(1).toLowerCase()
        const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'
        const buffer = await fs.readFile(filePath)
        return { ok: true, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    IPC.FS_WRITE_TEXT_FILE,
    async (_event, filePath: string, content: string): Promise<FsOpResult> => {
      try {
        await fs.writeFile(filePath, content, 'utf-8')
        return { ok: true }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )
}
