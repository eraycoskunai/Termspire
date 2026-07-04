/**
 * Aşama 14: crash-loop koruması. "Otomatik yeniden başlat" açık bir pane
 * beklenmedik şekilde (exit code != 0) art arda çökerse, sabit 1sn gecikmeyle
 * sürekli yeniden spawn etmek CPU'yu boğabilir (klasik crash-loop). Bu modül,
 * paneId başına son çökme zaman damgalarını tutup üstel backoff (1sn, 2sn,
 * 4sn, 8sn… en fazla 30sn) hesaplar; kısa bir pencerede çok fazla çökme
 * olursa otomatik yeniden başlatmayı tamamen durdurma kararı döner.
 *
 * TerminalPane, "geri al" / manuel taşıma gibi akışlarda `restartToken`
 * değiştiğinde tamamen unmount/remount olduğu için bu takip React state'i
 * DEĞİL, modül seviyesinde paneId'ye bağlı bir defter olarak tutulur —
 * aksi halde her yeniden başlatma kendi taze component instance'ında sıfırdan
 * sayacı başlatır ve backoff hiç işlemez.
 */

const CRASH_WINDOW_MS = 60_000
const MAX_CRASHES_IN_WINDOW = 5
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30_000

const crashTimestampsByPane = new Map<string, number[]>()

export interface CrashLoopDecision {
  /** Bu deneme için uygulanacak gecikme (ms). */
  backoffMs: number
  /** Son 60sn içindeki toplam çökme sayısı (bu dahil). */
  crashCount: number
  /** true ise otomatik yeniden başlatma bu pencerede durdurulmalı. */
  exceeded: boolean
}

/** Bir çökmeyi kaydeder ve bir sonraki deneme için backoff/durdurma kararını döner. */
export function recordCrashAndDecide(paneId: string): CrashLoopDecision {
  const now = Date.now()
  const recent = (crashTimestampsByPane.get(paneId) ?? []).filter(
    (ts) => now - ts < CRASH_WINDOW_MS
  )
  recent.push(now)
  crashTimestampsByPane.set(paneId, recent)
  const crashCount = recent.length
  const backoffMs = Math.min(BASE_BACKOFF_MS * 2 ** (crashCount - 1), MAX_BACKOFF_MS)
  return { backoffMs, crashCount, exceeded: crashCount > MAX_CRASHES_IN_WINDOW }
}

/** Process bir süre kesintisiz çalıştıktan sonra (gerçek bir toparlanma) sayaç sıfırlanır. */
export function resetCrashLoop(paneId: string): void {
  crashTimestampsByPane.delete(paneId)
}
