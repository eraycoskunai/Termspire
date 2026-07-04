/**
 * Aşama 11: uygulama gerçekten kapanmadan hemen önce (bkz. main'deki
 * before-quit -> IPC.APP_BEFORE_QUIT) her canlı TerminalPane'in ekran
 * içeriğini son bir kez diske yazmasını sağlayan hafif bir kayıt defteri.
 * ptyRegistry ile aynı desen: React state DEĞİLDİR, modül seviyesinde tutulur.
 */
const registry = new Map<string, () => void>()

export function registerFlushHandler(paneId: string, handler: () => void): void {
  registry.set(paneId, handler)
}

export function unregisterFlushHandler(paneId: string): void {
  registry.delete(paneId)
}

export function flushAllPaneBuffers(): void {
  for (const handler of registry.values()) handler()
}
