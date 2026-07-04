export interface StatusPatternConfig {
  /** Kullanıcıdan onay/giriş bekleyen prompt'lar (ör. "(y/n)", npm/claude/codex onay istemleri) */
  waiting: RegExp[]
  /** Hata/başarısızlık belirten çıktı satırları */
  error: RegExp[]
}

/**
 * Varsayılan pattern listesi. Aşama 7'de (persistence) kullanıcı ayarlarından
 * override edilebilecek/genişletilebilecek şekilde saf veri olarak tutulur.
 */
export const DEFAULT_STATUS_PATTERNS: StatusPatternConfig = {
  waiting: [
    /\(y\/n\)/i,
    /\[y\/n\]/i,
    /\[Y\/n\]/,
    /\[y\/N\]/,
    /yes\/no/i,
    /do you want to (proceed|continue)/i,
    /do you want to make this edit/i,
    /would you like (me )?to/i,
    /press (any key|enter) to continue/i,
    /overwrite .*\?/i,
    /continue\?\s*$/i,
    /allow this (action|command|tool)\??/i,
    /waiting for (approval|confirmation|input)/i,
    /confirm\s*[:?]/i,
    /^[?]\s.+/m,
    /select an option/i,
    /\btrust this (folder|workspace)\b/i
  ],
  error: [
    // "error"/"failed"/"fatal" gibi kelimeler cümle içinde/yardım metninde
    // masumca geçebildiği için ("no errors found", "error handling" vb.) bare
    // kelime eşleşmesi kullanılmaz; sadece gerçek araçların bilinen hata
    // biçimleri (satır başında "Error:"/"ERROR:", "npm ERR!", "fatal:" vb.)
    // eşleştirilir.
    /^\s*(?:npm )?err(?:or)?[:!]/im,
    /^\s*fatal:/im,
    /\bfatal error\b/i,
    /unhandled (promise )?rejection/i,
    /uncaught (exception|error)/i,
    /traceback \(most recent call last\)/i,
    /panic:\s/i,
    /segmentation fault/i,
    /command not found/i,
    /not recognized as an internal or external command/i,
    /permission denied/i,
    /cannot find (module|path)/i
  ]
}

export type PatternMatchKind = 'waiting' | 'error' | null

/** Verilen (ANSI temizlenmiş) metni pattern listelerine göre test eder; hata > waiting önceliklidir. */
export function matchStatusPattern(
  text: string,
  patterns: StatusPatternConfig = DEFAULT_STATUS_PATTERNS
): PatternMatchKind {
  for (const pattern of patterns.error) {
    if (pattern.test(text)) return 'error'
  }
  for (const pattern of patterns.waiting) {
    if (pattern.test(text)) return 'waiting'
  }
  return null
}
