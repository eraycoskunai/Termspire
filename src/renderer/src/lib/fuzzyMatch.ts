export interface FuzzyMatchResult {
  matched: boolean
  score: number
}

/**
 * Aşama 14: Komut Paleti için basit alt-dizi (subsequence) tabanlı fuzzy
 * eşleştirme. Sorgunun tüm karakterleri hedefte SIRAYLA (aralarında başka
 * karakter olabilir) geçiyorsa eşleşme kabul edilir; ardışık/kelime başı
 * eşleşmeler daha yüksek skor alır (VS Code komut paletindeki sezgiye yakın).
 * Harici bir bağımlılık gerektirmeden "yeterince iyi" bir sıralama sağlar.
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatchResult {
  const q = query.trim().toLowerCase()
  if (!q) return { matched: true, score: 0 }
  const t = target.toLowerCase()

  let score = 0
  let searchFrom = 0
  let previousMatchIndex = -1

  for (const char of q) {
    const index = t.indexOf(char, searchFrom)
    if (index === -1) return { matched: false, score: 0 }

    const isConsecutive = previousMatchIndex !== -1 && index === previousMatchIndex + 1
    const isWordStart = index === 0 || t[index - 1] === ' ' || t[index - 1] === '-'
    score += isConsecutive ? 12 : 6
    if (isWordStart) score += 5

    previousMatchIndex = index
    searchFrom = index + 1
  }

  // Daha kısa/daha alakalı hedefler hafifçe öne alınır.
  score -= Math.min(t.length, 40) * 0.1
  return { matched: true, score }
}
