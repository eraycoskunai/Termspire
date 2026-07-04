/**
 * Bir pane'in kalıcı UI id'sini o an çalışan gerçek pty instance id'sine eşler.
 * Broadcast input (Aşama 8), bir pane'e yazılan veriyi diğer seçili pane'lere
 * yönlendirebilmek için bu haritayı kullanır. React state DEĞİLDİR — sık
 * güncellenen imperative bir kayıt defteri olduğu için modül seviyesinde tutulur.
 */
const registry = new Map<string, string>()

export function registerPtyInstance(paneId: string, ptyInstanceId: string): void {
  registry.set(paneId, ptyInstanceId)
}

export function unregisterPtyInstance(paneId: string): void {
  registry.delete(paneId)
}

export function getPtyInstanceId(paneId: string): string | undefined {
  return registry.get(paneId)
}

/** Aşama 15: Saldırı Modu HUD'u toplam CPU/RAM göstermek için tüm canlı pty instance id'lerini gezer. */
export function getAllPtyInstanceIds(): string[] {
  return Array.from(registry.values())
}
