import type { TerminalPaneHandle } from '../components/TerminalPane'

/**
 * Aşama 12: paneId -> canlı TerminalPaneHandle eşlemesi. GridLayout zaten kendi
 * lokal `paneHandles` ref'ini tutuyor (global arama için), ama workspace'i
 * kapatma işlemi (WorkspaceTabBar) o GridLayout instance'ına erişemiyor.
 * Bu global defter, "kapatılan her pane'in process'ini geri alınabilir şekilde
 * canlı tut" mantığının GridLayout dışından da (workspace kapatma gibi)
 * tetiklenebilmesini sağlar. React state DEĞİLDİR — ptyRegistry ile aynı desen.
 */
const handles = new Map<string, TerminalPaneHandle>()

export function registerPaneHandle(paneId: string, handle: TerminalPaneHandle | null): void {
  if (handle) handles.set(paneId, handle)
  else handles.delete(paneId)
}

export function getPaneHandle(paneId: string): TerminalPaneHandle | undefined {
  return handles.get(paneId)
}
