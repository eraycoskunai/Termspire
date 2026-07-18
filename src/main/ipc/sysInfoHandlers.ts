import { ipcMain } from 'electron'
import * as os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { IPC, type SysInfoDisk, type SysInfoSnapshot } from '@shared/types'

const execAsync = promisify(exec)
const DISK_CACHE_TTL_MS = 30_000

/**
 * Aşama 16: sistem bilgisi paneli — CPU kullanım yüzdesi, os.cpus()'un döndürdüğü
 * kümülatif zamanlar arasında (bu çağrı - önceki çağrı) delta alınarak hesaplanır
 * (htop'un yaptığına benzer şekilde). İlk çağrıda referans nokta olmadığından 0
 * döner; renderer periyodik olarak çağırdığı için bir sonraki örneklemede gerçek
 * değeri gösterir.
 */
let previousCpus: os.CpuInfo[] | null = null

function computeCpuUsage(currentCpus: os.CpuInfo[]): { total: number; perCore: number[] } {
  if (!previousCpus || previousCpus.length !== currentCpus.length) {
    previousCpus = currentCpus
    return { total: 0, perCore: currentCpus.map(() => 0) }
  }
  const perCore: number[] = []
  let totalUsage = 0
  for (let i = 0; i < currentCpus.length; i++) {
    const prev = previousCpus[i].times
    const curr = currentCpus[i].times
    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq
    const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq
    const totalDelta = currTotal - prevTotal
    const idleDelta = curr.idle - prev.idle
    const usage =
      totalDelta > 0 ? Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)) : 0
    perCore.push(usage)
    totalUsage += usage
  }
  previousCpus = currentCpus
  return { total: currentCpus.length > 0 ? totalUsage / currentCpus.length : 0, perCore }
}

interface WindowsDiskRow {
  DeviceID?: string
  Size?: number | string
  FreeSpace?: number | string
}

async function readDisksWindows(): Promise<SysInfoDisk[]> {
  const { stdout } = await execAsync(
    'powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk -Filter \'DriveType=3\' | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json"',
    { timeout: 5000 }
  )
  const trimmed = stdout.trim()
  if (!trimmed) return []
  const parsed = JSON.parse(trimmed) as WindowsDiskRow | WindowsDiskRow[]
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  return rows
    .filter((row) => row && row.Size)
    .map((row) => ({
      mount: String(row.DeviceID ?? '?'),
      totalBytes: Number(row.Size) || 0,
      freeBytes: Number(row.FreeSpace) || 0
    }))
}

async function readDisksPosix(): Promise<SysInfoDisk[]> {
  const { stdout } = await execAsync('df -k', { timeout: 5000 })
  const lines = stdout.trim().split('\n').slice(1)
  const disks: SysInfoDisk[] = []
  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 6) continue
    const totalKb = Number(parts[1])
    const availKb = Number(parts[3])
    const mount = parts[5]
    if (!Number.isFinite(totalKb) || !mount) continue
    // Docker/overlay/tmpfs gürültüsünü ele — sadece gerçek bağlama noktalarını göster.
    if (!mount.startsWith('/') || mount.startsWith('/sys') || mount.startsWith('/proc')) continue
    disks.push({ mount, totalBytes: totalKb * 1024, freeBytes: availKb * 1024 })
  }
  return disks.slice(0, 6)
}

async function readDisks(): Promise<SysInfoDisk[]> {
  try {
    return process.platform === 'win32' ? await readDisksWindows() : await readDisksPosix()
  } catch {
    // Disk sorgusu bulunamayan bir komuta bağlıysa veya izin hatası verirse
    // panel sessizce disk bölümünü boş gösterir; CPU/RAM bilgisi hâlâ döner.
    return []
  }
}

let diskCache: { value: SysInfoDisk[]; expiresAt: number } | null = null
let inFlightDiskRead: Promise<SysInfoDisk[]> | null = null

async function readDisksCached(): Promise<SysInfoDisk[]> {
  const now = Date.now()
  if (diskCache && now < diskCache.expiresAt) return diskCache.value
  if (inFlightDiskRead) return inFlightDiskRead
  inFlightDiskRead = readDisks()
    .then((value) => {
      diskCache = { value, expiresAt: Date.now() + DISK_CACHE_TTL_MS }
      return value
    })
    .finally(() => {
      inFlightDiskRead = null
    })
  return inFlightDiskRead
}

export function registerSysInfoHandlers(): void {
  ipcMain.handle(IPC.SYS_INFO, async (): Promise<SysInfoSnapshot> => {
    const cpus = os.cpus()
    const { total, perCore } = computeCpuUsage(cpus)
    const disks = await readDisksCached()
    return {
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      hostname: os.hostname(),
      uptimeSec: os.uptime(),
      cpuModel: cpus[0]?.model?.trim() ?? 'Bilinmiyor',
      cpuCount: cpus.length,
      cpuUsagePercent: total,
      perCoreUsagePercent: perCore,
      totalMemBytes: os.totalmem(),
      freeMemBytes: os.freemem(),
      loadAvg: os.loadavg() as [number, number, number],
      disks
    }
  })
}
