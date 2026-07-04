import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import { IPC, type GitShowHeadResult, type GitStatusResult } from '@shared/types'

const execFileAsync = promisify(execFile)
const EXEC_OPTIONS = { maxBuffer: 16 * 1024 * 1024 }

/** Bir dizinin ait olduğu git deposunun kök dizinini bulur; git deposu değilse null döner. */
async function getGitRepoRoot(dirPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      ...EXEC_OPTIONS,
      cwd: dirPath
    })
    return stdout.trim()
  } catch {
    return null
  }
}

/**
 * `git status --porcelain=v1` çıktısındaki tek bir satırı `[durum kodu, dosya yolu]`
 * çiftine çevirir. Yeniden adlandırma satırları ("R  eski -> yeni") için yeni yol
 * alınır; alıntılanmış (özel karakterli) yollardaki tırnaklar temizlenir.
 */
function parsePorcelainLine(line: string): [string, string] | null {
  if (line.length < 4) return null
  const code = line.slice(0, 2).trim()
  let filePath = line.slice(3)
  const arrowIndex = filePath.indexOf(' -> ')
  if (arrowIndex !== -1) filePath = filePath.slice(arrowIndex + 4)
  if (filePath.startsWith('"') && filePath.endsWith('"')) {
    filePath = filePath.slice(1, -1)
  }
  return [code, filePath]
}

/**
 * Aşama 14: git-farkında dosya paneli. Uygulama zaten node-pty ile shell
 * çalıştırdığı için sistemde git kurulu olduğu varsayılabilir; kurulu
 * değilse veya dizin bir git deposu değilse `execFileAsync` hata fırlatır ve
 * bu sessizce `{ ok: false }` olarak ele alınır (dosya paneli rozet
 * göstermeden normal şekilde çalışmaya devam eder).
 */
export function registerGitHandlers(): void {
  ipcMain.handle(IPC.GIT_STATUS, async (_event, dirPath: string): Promise<GitStatusResult> => {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['status', '--porcelain=v1', '--untracked-files=normal'],
        { ...EXEC_OPTIONS, cwd: dirPath }
      )
      const entries: Record<string, string> = {}
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue
        const parsed = parsePorcelainLine(line)
        if (parsed) entries[parsed[1]] = parsed[0]
      }
      return { ok: true, entries }
    } catch (error) {
      return { ok: false, entries: {}, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    IPC.GIT_SHOW_HEAD,
    async (_event, filePath: string): Promise<GitShowHeadResult> => {
      const root = await getGitRepoRoot(path.dirname(filePath))
      if (!root) return { ok: false, error: 'Bu dizin bir git deposu değil.' }
      const relativePath = path.relative(root, filePath).split(path.sep).join('/')
      try {
        const { stdout } = await execFileAsync('git', ['show', `HEAD:${relativePath}`], {
          ...EXEC_OPTIONS,
          cwd: root
        })
        return { ok: true, content: stdout }
      } catch {
        // Dosya HEAD'de yok (yeni/untracked dosya ya da henüz commit yapılmamış) —
        // tüm içerik "eklenmiş" gösterilecek şekilde boş orijinal kabul edilir.
        return { ok: true, content: '' }
      }
    }
  )
}
