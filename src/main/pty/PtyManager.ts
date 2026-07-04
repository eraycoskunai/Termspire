import os from 'os'
import type { BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import type { IPty } from 'node-pty'
import pidusage from 'pidusage'
import { IPC, type PtyCreateOptions, type PtyReattachResult, type PtyUsage } from '@shared/types'
import { resolveShellCommand } from './shellResolver'

interface PtyRecord {
  id: string
  handle: IPty
  shellLabel: string
  /**
   * Aşama 12: "geri al" (undo close) desteği — bir pane yanlışlıkla kapatılırsa
   * process HEMEN öldürülmez, sadece bu bayrak false'a çekilir: bu süre boyunca
   * 'data' event'leri renderer'a YAYINLANMAZ (kimse dinlemiyor zaten), sadece
   * catchUpBuffer'da biriktirilir. Kullanıcı "Geri Al"a bastığında reattach()
   * bu bayrağı tekrar true'ya çekip birikeni tek seferde döner — process
   * teknik olarak hiç durmamıştır (Claude Code vb. tam olarak devam eder).
   */
  attached: boolean
}

/**
 * Main process'teki tüm gerçek pty (pseudo-terminal) process'lerini yönetir.
 * Renderer'a gönderilecek olan tüm IPC event'leri buradan tetiklenir.
 * IPC handler'lar (ipc/ptyHandlers.ts) sadece bu sınıfı çağırır; process
 * yönetiminin tamamı burada, tek bir yerde toplanır.
 */
export class PtyManager {
  private readonly ptys = new Map<string, PtyRecord>()
  /** Aşama 12: detached kaldığı sürece biriken ham çıktı (id başına, sınırlı boyutta). */
  private readonly catchUpBuffers = new Map<string, string>()
  private static readonly CATCH_UP_MAX_CHARS = 200_000

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  create(id: string, options: PtyCreateOptions): void {
    const { file, args } = resolveShellCommand(options)

    let handle: IPty
    try {
      handle = pty.spawn(file, args, {
        name: 'xterm-color',
        cols: options.cols ?? 80,
        rows: options.rows ?? 24,
        cwd: options.cwd && options.cwd.length > 0 ? options.cwd : os.homedir(),
        env: { ...process.env, ...options.env } as Record<string, string>
      })
    } catch (error) {
      throw new Error(
        `"${file}" başlatılamadı. Shell kurulu olmayabilir veya PATH üzerinde bulunamadı. (${
          (error as Error).message
        })`
      )
    }

    const record: PtyRecord = { id, handle, shellLabel: file, attached: true }
    this.ptys.set(id, record)

    handle.onData((data) => {
      this.appendCatchUp(id, data)
      if (record.attached) {
        this.getWindow()?.webContents.send(IPC.PTY_DATA, { id, data })
      }
    })

    handle.onExit(({ exitCode, signal }) => {
      this.getWindow()?.webContents.send(IPC.PTY_EXIT, { id, exitCode, signal })
      this.ptys.delete(id)
      this.catchUpBuffers.delete(id)
    })

    if (options.startupCommand && options.startupCommand.trim().length > 0) {
      handle.write(`${options.startupCommand}\r`)
    }
  }

  private appendCatchUp(id: string, data: string): void {
    const next = (this.catchUpBuffers.get(id) ?? '') + data
    this.catchUpBuffers.set(
      id,
      next.length > PtyManager.CATCH_UP_MAX_CHARS
        ? next.slice(next.length - PtyManager.CATCH_UP_MAX_CHARS)
        : next
    )
  }

  /**
   * Aşama 12: bir pane "geri alınabilir" şekilde kapatılırken çağrılır — process
   * ÖLDÜRÜLMEZ, sadece bu renderer'a yayın kesilir (kimse dinlemiyor olsa da
   * güvenlik için) ve o ana kadar biriken tampon sıfırlanır (reattach'te sadece
   * bu kapalı kaldığı süreye ait çıktı dönsün, tekrar/duplicate olmasın).
   */
  detach(id: string): void {
    const record = this.ptys.get(id)
    if (!record) return
    record.attached = false
    this.catchUpBuffers.set(id, '')
  }

  /**
   * Aşama 12: "Geri Al" ile bir pane yeniden mount edildiğinde çağrılır — process
   * sıfırdan spawn EDİLMEZ, aynı canlı process'e yeniden bağlanılır. Process bu
   * arada kendi kendine sonlanmışsa (örn. `exit` yazılmış) `ok: false` döner ve
   * çağıran taraf normal spawn akışına düşer.
   */
  reattach(id: string): PtyReattachResult {
    const record = this.ptys.get(id)
    if (!record) return { ok: false, catchUp: '' }
    const catchUp = this.catchUpBuffers.get(id) ?? ''
    this.catchUpBuffers.set(id, '')
    record.attached = true
    return { ok: true, catchUp }
  }

  write(id: string, data: string): void {
    this.ptys.get(id)?.handle.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    const record = this.ptys.get(id)
    if (!record) return
    try {
      record.handle.resize(Math.max(cols, 1), Math.max(rows, 1))
    } catch {
      // Process az önce sonlanmış olabilir; sessizce yok say.
    }
  }

  kill(id: string): void {
    const record = this.ptys.get(id)
    if (!record) return
    try {
      record.handle.kill()
    } catch {
      // Process zaten ölmüş olabilir.
    }
    this.ptys.delete(id)
    this.catchUpBuffers.delete(id)
  }

  /** Aşama 9: pane başlığında gösterilen anlık CPU/RAM göstergesi (pane vitals) için. */
  async getUsage(id: string): Promise<PtyUsage | null> {
    const record = this.ptys.get(id)
    if (!record) return null
    try {
      const stats = await pidusage(record.handle.pid)
      return { cpu: stats.cpu, memory: stats.memory }
    } catch {
      // Process az önce sonlanmış olabilir ya da bu platformda ölçüm desteklenmiyor olabilir.
      return null
    }
  }

  killAll(): void {
    for (const id of Array.from(this.ptys.keys())) {
      this.kill(id)
    }
  }

  has(id: string): boolean {
    return this.ptys.has(id)
  }

  get activeCount(): number {
    return this.ptys.size
  }
}
