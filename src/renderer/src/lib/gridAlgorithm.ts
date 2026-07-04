export interface GridDimensions {
  cols: number
  rows: number
}

/**
 * Verilen pane sayısı için en kare/dengeli grid düzenini hesaplar.
 * Örnekler: 2->2x1, 4->2x2, 5->3x2, 6->3x2, 9->3x3, 12->4x3.
 */
export function computeGridDimensions(paneCount: number): GridDimensions {
  if (paneCount <= 0) return { cols: 0, rows: 0 }
  const cols = Math.ceil(Math.sqrt(paneCount))
  const rows = Math.ceil(paneCount / cols)
  return { cols, rows }
}

/** Düz bir listeyi grid satırlarına (her biri en fazla `cols` eleman) böler. */
export function chunkIntoRows<T>(items: T[], cols: number): T[][] {
  if (cols <= 0) return []
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols))
  }
  return rows
}
