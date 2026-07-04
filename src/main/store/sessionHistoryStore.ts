import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { SessionHistoryEntryMeta } from '@shared/types'

/**
 * Aşama 14: tam oturum kaydı/replay. `sessionBufferStore.ts`'in tek dosyalık
 * "en son ekran görüntüsü" mantığından farklı olarak, bu modül paneId başına
 * append-only bir JSONL dosyasında ({ts, data} satırları) ZAMAN İÇİNDE bir
 * dizi anlık görüntü tutar. Böylece bir pane'in geçmişinde ileri/geri
 * "scrub" edilebilir — ör. bir ajanın 40 dakika önce ne yaptığını tekrar
 * izlemek. Dosya sınırsız büyümesin diye en fazla MAX_HISTORY_ENTRIES kayıt
 * tutulur; her ekleme HIZLI bir append, budama (rewrite) sadece her
 * PRUNE_EVERY_N_APPENDS eklemede bir yapılır.
 */

const SAFE_ID_PATTERN = /^[a-zA-Z0-9-]+$/
const MAX_HISTORY_ENTRIES = 150
const PRUNE_EVERY_N_APPENDS = 10

interface HistoryEntry {
  ts: number
  data: string
}

const appendCountSincePrune = new Map<string, number>()

function getHistoryDir(): string {
  return path.join(app.getPath('userData'), 'session-history')
}

function getHistoryPath(paneId: string): string | null {
  if (!SAFE_ID_PATTERN.test(paneId)) return null
  return path.join(getHistoryDir(), `${paneId}.history.jsonl`)
}

function readAllEntries(filePath: string): HistoryEntry[] {
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf-8')
  const entries: HistoryEntry[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line) as Partial<HistoryEntry>
      if (typeof parsed.ts === 'number' && typeof parsed.data === 'string') {
        entries.push({ ts: parsed.ts, data: parsed.data })
      }
    } catch {
      // Bozuk/yarım kalmış satır sessizce atlanır.
    }
  }
  return entries
}

function pruneIfNeeded(paneId: string, filePath: string): void {
  const count = (appendCountSincePrune.get(paneId) ?? 0) + 1
  if (count < PRUNE_EVERY_N_APPENDS) {
    appendCountSincePrune.set(paneId, count)
    return
  }
  appendCountSincePrune.set(paneId, 0)
  const entries = readAllEntries(filePath)
  if (entries.length <= MAX_HISTORY_ENTRIES) return
  const trimmed = entries.slice(entries.length - MAX_HISTORY_ENTRIES)
  try {
    fs.writeFileSync(
      filePath,
      trimmed.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
      'utf-8'
    )
  } catch {
    // Yok sayılır.
  }
}

export function appendHistoryEntry(paneId: string, data: string): void {
  const filePath = getHistoryPath(paneId)
  if (!filePath) return
  try {
    fs.mkdirSync(getHistoryDir(), { recursive: true })
    fs.appendFileSync(filePath, `${JSON.stringify({ ts: Date.now(), data })}\n`, 'utf-8')
    pruneIfNeeded(paneId, filePath)
  } catch {
    // Diske yazma başarısız olursa (izin, disk dolu vb.) sessizce yok say —
    // replay geçmişi kritik bir işlev değil, sadece bir kolaylık.
  }
}

export function listHistoryEntries(paneId: string): SessionHistoryEntryMeta[] {
  const filePath = getHistoryPath(paneId)
  if (!filePath) return []
  return readAllEntries(filePath).map((entry, index) => ({ index, timestamp: entry.ts }))
}

export function readHistoryEntry(paneId: string, index: number): string | null {
  const filePath = getHistoryPath(paneId)
  if (!filePath) return null
  const entries = readAllEntries(filePath)
  return entries[index]?.data ?? null
}

/** Artık hiçbir workspace'te var olmayan pane'lere ait "sahipsiz" geçmiş dosyalarını temizler. */
export function pruneOrphanHistory(keepPaneIds: string[]): void {
  const dir = getHistoryDir()
  try {
    if (!fs.existsSync(dir)) return
    const keepSet = new Set(keepPaneIds)
    for (const fileName of fs.readdirSync(dir)) {
      const paneId = fileName.replace(/\.history\.jsonl$/, '')
      if (!keepSet.has(paneId)) {
        try {
          fs.unlinkSync(path.join(dir, fileName))
        } catch {
          // Yok sayılır.
        }
        appendCountSincePrune.delete(paneId)
      }
    }
  } catch {
    // Yok sayılır.
  }
}
