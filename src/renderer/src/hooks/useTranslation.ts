import { useCallback } from 'react'
import { useUiStore } from '../state/useUiStore'
import { translate, type TranslationKey } from '../lib/i18n'

export type { TranslationKey }
export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string

/**
 * Aşama 17: aktif dile göre çeviri döndüren `t()` fonksiyonunu verir. Dil
 * `useUiStore`'dan okunur — dil değiştiğinde bu hook'u kullanan tüm
 * bileşenler otomatik olarak yeniden render olur.
 */
export function useT(): TFunction {
  const language = useUiStore((state) => state.language)
  return useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(language, key, vars),
    [language]
  )
}
