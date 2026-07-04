/**
 * Aşama 12: "geri al" (undo close) — bir pane kapatıldığında gerçek process
 * öldürülmez; bu modül hangi paneId'nin hangi CANLI ptyInstanceId'ye ait
 * olduğunu tutar. Pane yeniden mount edildiğinde (Geri Al) bu kayıt okunup
 * temizlenir ve sıfırdan spawn yerine reattach yapılır. React state DEĞİLDİR —
 * ptyRegistry ile aynı desende, modül seviyesinde tutulan imperatif bir defter.
 */
const softClosedPtys = new Map<string, string>()

export function markSoftClosed(paneId: string, ptyInstanceId: string): void {
  softClosedPtys.set(paneId, ptyInstanceId)
}

/** Reattach için okur ve kaydı siler (bir pane sadece bir kez reattach edilebilir). */
export function takeSoftClosedPtyInstanceId(paneId: string): string | undefined {
  const id = softClosedPtys.get(paneId)
  softClosedPtys.delete(paneId)
  return id
}

/**
 * Geri alınmadan tamamen "unutulan" (Kapatılanlar listesinden atılan/Temizle
 * edilen) bir pane için gerçek kill'i tetikler — bellekte sonsuza kadar canlı
 * process biriktirmemek için (bkz. useClosedItemsStore).
 */
export function finalizeSoftClosedPty(paneId: string): void {
  const id = takeSoftClosedPtyInstanceId(paneId)
  if (id) window.api.pty.kill(id)
}
