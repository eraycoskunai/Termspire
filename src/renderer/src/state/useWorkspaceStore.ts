import { create } from 'zustand'
import type { PaneKind, PersistedAppState, PtyCreateOptions } from '@shared/types'
import { getShellMeta } from '../lib/shellMeta'
import type { PaneStatus } from '../hooks/usePaneStatusEngine'
import { useClosedItemsStore } from './useClosedItemsStore'

export interface PaneState {
  id: string
  config: PtyCreateOptions
  title: string
  /** Başlık çubuğunun üst kenarında gösterilen opsiyonel vurgu rengi (hex). */
  color?: string
  /** TerminalPane'in React key'ine eklenir; artınca pane sıfırdan yeniden başlar. */
  restartToken: number
  /** Aşama 10: process beklenmedik şekilde (exit code != 0) sonlanırsa otomatik yeniden başlat. */
  autoRestart?: boolean
  /**
   * Aşama 16: pane türü. Belirtilmemişse (tüm eski pane'ler) 'terminal' kabul edilir
   * — GridLayout, `kind === 'web'` olan pane'leri pty tabanlı `TerminalPane` yerine
   * gömülü tarayıcı `WebPane` ile render eder.
   */
  kind?: PaneKind
  /** kind === 'web' ise gösterilecek/son gezinilen URL. */
  webUrl?: string
}

export interface WorkspaceState {
  id: string
  name: string
  panes: Record<string, PaneState>
  order: string[]
  zoomedPaneId: string | null
  /** Aşama 12: o an odaklanılan (seçili) pane — dosya paneli bunun cwd'sini gösterir. */
  focusedPaneId: string | null
}

interface WorkspaceStore {
  workspaces: Record<string, WorkspaceState>
  workspaceOrder: string[]
  activeWorkspaceId: string
  /** Aşama 8: broadcast input — kalıcı değildir (electron-store'a yazılmaz). */
  broadcastEnabled: Record<string, boolean>
  broadcastPaneIds: Record<string, string[]>
  /**
   * paneId -> son bilinen PaneStatus. TerminalPane'in kendi status engine'inden
   * beslenir (kalıcı değildir); WorkspaceTabBar bunu arka plandaki workspace
   * sekmelerinde onay/hata rozeti göstermek için okur.
   */
  paneStatuses: Record<string, PaneStatus>

  addWorkspace: (name?: string) => string
  removeWorkspace: (id: string) => void
  renameWorkspace: (id: string, name: string) => void
  setActiveWorkspace: (id: string) => void
  /** Aşama 7: electron-store'dan yüklenen kalıcı durumu store'a uygular. */
  hydrate: (persisted: PersistedAppState) => void

  addPane: (
    config: PtyCreateOptions,
    title?: string,
    color?: string,
    workspaceId?: string
  ) => string
  /** Aşama 16: gömülü tarayıcı ("web") pane'i — istenildiği kadar açılabilir. */
  addWebPane: (url: string, title?: string, color?: string, workspaceId?: string) => string
  /** Aşama 16: kullanıcı bir web pane içinde gezindiğinde son URL'i kalıcı hale getirir. */
  setPaneWebUrl: (paneId: string, url: string, workspaceId?: string) => void
  removePane: (paneId: string, workspaceId?: string) => void
  /** Aşama 12: "geri al" — kapatılan bir pane'i eski konumuyla birlikte geri ekler. */
  restorePaneAt: (pane: PaneState, workspaceId: string, index: number) => void
  /** Aşama 12: "geri al" — kapatılan bir workspace'i eski konumuyla birlikte geri ekler. */
  restoreWorkspaceAt: (workspace: WorkspaceState, index: number) => void
  /** Aşama 12: dosya paneli hangi pane'in dizinini göstereceğini bilsin diye odak takibi. */
  setFocusedPane: (paneId: string, workspaceId?: string) => void
  renamePane: (paneId: string, title: string, workspaceId?: string) => void
  swapPanes: (fromId: string, toId: string, workspaceId?: string) => void
  /** Aşama 10: bir pane'i başka bir workspace'e taşır (yeni workspace'te pty sıfırdan spawn edilir). */
  movePaneToWorkspace: (paneId: string, fromWorkspaceId: string, toWorkspaceId: string) => void
  /** Aşama 10: pane çıktı boru hattı — kaynak pane'in çıktısı hedef pane'in girdisine akıtılır. */
  pipeTargets: Record<string, string>
  setPipeTarget: (sourcePaneId: string, targetPaneId: string | null) => void
  toggleZoom: (paneId: string, workspaceId?: string) => void
  restartPane: (paneId: string, workspaceId?: string) => void
  toggleAutoRestart: (paneId: string, workspaceId?: string) => void

  toggleBroadcastMode: (workspaceId?: string) => void
  toggleBroadcastPane: (paneId: string, workspaceId?: string) => void

  setPaneStatus: (paneId: string, status: PaneStatus) => void
  clearPaneStatus: (paneId: string) => void
}

function makeId(prefix: string): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createEmptyWorkspace(name: string): WorkspaceState {
  return {
    id: makeId('workspace'),
    name,
    panes: {},
    order: [],
    zoomedPaneId: null,
    focusedPaneId: null
  }
}

function withWorkspace(
  workspaces: Record<string, WorkspaceState>,
  workspaceId: string,
  updater: (workspace: WorkspaceState) => WorkspaceState
): Record<string, WorkspaceState> {
  const workspace = workspaces[workspaceId]
  if (!workspace) return workspaces
  return { ...workspaces, [workspaceId]: updater(workspace) }
}

const initialWorkspace = createEmptyWorkspace('Workspace 1')

/**
 * Her workspace kendi pane setini + layout durumunu (order, zoomedPaneId) tutar.
 * Aktif olmayan workspace'ler GridLayout ağacından kaldırılmaz (App.tsx CSS ile
 * gizler); böylece arka plandaki pane'lerin pty bağlantısı ve status takibi kopmaz.
 */
export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: { [initialWorkspace.id]: initialWorkspace },
  workspaceOrder: [initialWorkspace.id],
  activeWorkspaceId: initialWorkspace.id,
  broadcastEnabled: {},
  broadcastPaneIds: {},
  paneStatuses: {},
  pipeTargets: {},

  addWorkspace: (name) => {
    const count = get().workspaceOrder.length
    const workspace = createEmptyWorkspace(name?.trim() || `Workspace ${count + 1}`)
    set((state) => ({
      workspaces: { ...state.workspaces, [workspace.id]: workspace },
      workspaceOrder: [...state.workspaceOrder, workspace.id],
      activeWorkspaceId: workspace.id
    }))
    return workspace.id
  },

  removeWorkspace: (id) => {
    const stateBefore = get()
    if (stateBefore.workspaceOrder.length <= 1) return
    const oldIndexBefore = stateBefore.workspaceOrder.indexOf(id)
    const workspaceBefore = stateBefore.workspaces[id]
    if (oldIndexBefore !== -1 && workspaceBefore) {
      // Aşama 12: "geri al" için kapatılmadan önceki tam görüntü saklanır.
      useClosedItemsStore.getState().pushClosedWorkspace({
        workspace: workspaceBefore,
        index: oldIndexBefore
      })
    }
    set((state) => {
      if (state.workspaceOrder.length <= 1) return state
      const oldIndex = state.workspaceOrder.indexOf(id)
      if (oldIndex === -1) return state
      const nextOrder = state.workspaceOrder.filter((workspaceId) => workspaceId !== id)
      const nextWorkspaces = { ...state.workspaces }
      delete nextWorkspaces[id]
      let nextActive = state.activeWorkspaceId
      if (nextActive === id) {
        const fallbackIndex = Math.min(oldIndex, nextOrder.length - 1)
        nextActive = nextOrder[fallbackIndex]
      }
      const removedWorkspace = state.workspaces[id]
      const nextPaneStatuses = { ...state.paneStatuses }
      const nextPipeTargets = { ...state.pipeTargets }
      for (const paneId of removedWorkspace?.order ?? []) {
        delete nextPaneStatuses[paneId]
        delete nextPipeTargets[paneId]
        for (const [source, target] of Object.entries(nextPipeTargets)) {
          if (target === paneId) delete nextPipeTargets[source]
        }
      }
      return {
        workspaces: nextWorkspaces,
        workspaceOrder: nextOrder,
        activeWorkspaceId: nextActive,
        paneStatuses: nextPaneStatuses,
        pipeTargets: nextPipeTargets
      }
    })
  },

  renameWorkspace: (id, name) => {
    set((state) => {
      const workspace = state.workspaces[id]
      if (!workspace || name.trim().length === 0) return state
      return { workspaces: { ...state.workspaces, [id]: { ...workspace, name: name.trim() } } }
    })
  },

  setActiveWorkspace: (id) => {
    set((state) => (state.workspaces[id] ? { activeWorkspaceId: id } : state))
  },

  hydrate: (persisted) => {
    const workspaces: Record<string, WorkspaceState> = {}
    for (const persistedWorkspace of persisted.workspaces) {
      const panes: Record<string, PaneState> = {}
      for (const persistedPane of persistedWorkspace.panes) {
        panes[persistedPane.id] = {
          id: persistedPane.id,
          config: persistedPane.config,
          title: persistedPane.title,
          color: persistedPane.color,
          restartToken: 0,
          autoRestart: persistedPane.autoRestart,
          kind: persistedPane.kind,
          webUrl: persistedPane.webUrl
        }
      }
      workspaces[persistedWorkspace.id] = {
        id: persistedWorkspace.id,
        name: persistedWorkspace.name,
        panes,
        order: persistedWorkspace.order.filter((paneId) => paneId in panes),
        zoomedPaneId: null,
        focusedPaneId: null
      }
    }
    const workspaceOrder = persisted.workspaceOrder.filter((id) => id in workspaces)
    if (workspaceOrder.length === 0) return
    const activeWorkspaceId = workspaces[persisted.activeWorkspaceId]
      ? persisted.activeWorkspaceId
      : workspaceOrder[0]
    set({ workspaces, workspaceOrder, activeWorkspaceId })
  },

  addPane: (config, title, color, workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    const id = makeId('pane')
    const pane: PaneState = {
      id,
      config,
      title: title && title.trim().length > 0 ? title : getShellMeta(config.shell).label,
      color,
      restartToken: 0
    }
    set((state) => ({
      workspaces: withWorkspace(state.workspaces, targetId, (workspace) => ({
        ...workspace,
        panes: { ...workspace.panes, [id]: pane },
        order: [...workspace.order, id]
      }))
    }))
    return id
  },

  addWebPane: (url, title, color, workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    const id = makeId('pane')
    const pane: PaneState = {
      id,
      // "config" pty tabanlı pane'ler için gereklidir; web pane'ler onu hiç
      // kullanmaz (GridLayout kind === 'web' için TerminalPane'i hiç render etmez),
      // sadece PaneState/PersistedPaneConfig şeklini terminal pane'lerle aynı tutmak
      // için zararsız bir placeholder tutulur.
      config: { shell: 'custom' },
      title: title && title.trim().length > 0 ? title : 'Web',
      color,
      restartToken: 0,
      kind: 'web',
      webUrl: url
    }
    set((state) => ({
      workspaces: withWorkspace(state.workspaces, targetId, (workspace) => ({
        ...workspace,
        panes: { ...workspace.panes, [id]: pane },
        order: [...workspace.order, id]
      }))
    }))
    return id
  },

  setPaneWebUrl: (paneId, url, workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    set((state) => ({
      workspaces: withWorkspace(state.workspaces, targetId, (workspace) => {
        const pane = workspace.panes[paneId]
        if (!pane || pane.webUrl === url) return workspace
        return { ...workspace, panes: { ...workspace.panes, [paneId]: { ...pane, webUrl: url } } }
      })
    }))
  },

  removePane: (paneId, workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    const workspaceBefore = get().workspaces[targetId]
    const paneBefore = workspaceBefore?.panes[paneId]
    const indexBefore = workspaceBefore?.order.indexOf(paneId) ?? -1
    if (workspaceBefore && paneBefore && indexBefore !== -1) {
      // Aşama 12: "geri al" için kapatılmadan önceki tam görüntü saklanır.
      useClosedItemsStore.getState().pushClosedPane({
        workspaceId: targetId,
        workspaceName: workspaceBefore.name,
        pane: paneBefore,
        index: indexBefore
      })
    }
    set((state) => {
      const nextPaneStatuses = { ...state.paneStatuses }
      delete nextPaneStatuses[paneId]
      const nextPipeTargets = { ...state.pipeTargets }
      delete nextPipeTargets[paneId]
      for (const [source, target] of Object.entries(nextPipeTargets)) {
        if (target === paneId) delete nextPipeTargets[source]
      }
      return {
        workspaces: withWorkspace(state.workspaces, targetId, (workspace) => {
          if (!(paneId in workspace.panes)) return workspace
          const nextPanes = { ...workspace.panes }
          delete nextPanes[paneId]
          return {
            ...workspace,
            panes: nextPanes,
            order: workspace.order.filter((id) => id !== paneId),
            zoomedPaneId: workspace.zoomedPaneId === paneId ? null : workspace.zoomedPaneId,
            focusedPaneId: workspace.focusedPaneId === paneId ? null : workspace.focusedPaneId
          }
        }),
        paneStatuses: nextPaneStatuses,
        pipeTargets: nextPipeTargets
      }
    })
  },

  restorePaneAt: (pane, workspaceId, index) => {
    set((state) => {
      const targetWorkspaceId = state.workspaces[workspaceId]
        ? workspaceId
        : state.activeWorkspaceId
      return {
        workspaces: withWorkspace(state.workspaces, targetWorkspaceId, (workspace) => {
          if (pane.id in workspace.panes) return workspace
          const nextOrder = [...workspace.order]
          const clampedIndex = Math.min(Math.max(index, 0), nextOrder.length)
          nextOrder.splice(clampedIndex, 0, pane.id)
          return {
            ...workspace,
            panes: { ...workspace.panes, [pane.id]: pane },
            order: nextOrder
          }
        }),
        activeWorkspaceId: targetWorkspaceId
      }
    })
  },

  restoreWorkspaceAt: (workspace, index) => {
    set((state) => {
      if (state.workspaces[workspace.id]) return state
      const nextOrder = [...state.workspaceOrder]
      const clampedIndex = Math.min(Math.max(index, 0), nextOrder.length)
      nextOrder.splice(clampedIndex, 0, workspace.id)
      return {
        workspaces: {
          ...state.workspaces,
          [workspace.id]: { ...workspace, zoomedPaneId: null, focusedPaneId: null }
        },
        workspaceOrder: nextOrder,
        activeWorkspaceId: workspace.id
      }
    })
  },

  setFocusedPane: (paneId, workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    set((state) => {
      const workspace = state.workspaces[targetId]
      if (!workspace || workspace.focusedPaneId === paneId) return state
      return {
        workspaces: withWorkspace(state.workspaces, targetId, (ws) => ({
          ...ws,
          focusedPaneId: paneId
        }))
      }
    })
  },

  renamePane: (paneId, title, workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    set((state) => ({
      workspaces: withWorkspace(state.workspaces, targetId, (workspace) => {
        const pane = workspace.panes[paneId]
        if (!pane) return workspace
        return { ...workspace, panes: { ...workspace.panes, [paneId]: { ...pane, title } } }
      })
    }))
  },

  swapPanes: (fromId, toId, workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    set((state) => ({
      workspaces: withWorkspace(state.workspaces, targetId, (workspace) => {
        const order = [...workspace.order]
        const fromIndex = order.indexOf(fromId)
        const toIndex = order.indexOf(toId)
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return workspace
        ;[order[fromIndex], order[toIndex]] = [order[toIndex], order[fromIndex]]
        return { ...workspace, order }
      })
    }))
  },

  movePaneToWorkspace: (paneId, fromWorkspaceId, toWorkspaceId) => {
    if (fromWorkspaceId === toWorkspaceId) return
    set((state) => {
      const fromWorkspace = state.workspaces[fromWorkspaceId]
      const toWorkspace = state.workspaces[toWorkspaceId]
      const pane = fromWorkspace?.panes[paneId]
      if (!fromWorkspace || !toWorkspace || !pane) return state
      const nextFromPanes = { ...fromWorkspace.panes }
      delete nextFromPanes[paneId]
      return {
        workspaces: {
          ...state.workspaces,
          [fromWorkspaceId]: {
            ...fromWorkspace,
            panes: nextFromPanes,
            order: fromWorkspace.order.filter((id) => id !== paneId),
            zoomedPaneId: fromWorkspace.zoomedPaneId === paneId ? null : fromWorkspace.zoomedPaneId
          },
          [toWorkspaceId]: {
            ...toWorkspace,
            panes: { ...toWorkspace.panes, [paneId]: pane },
            order: [...toWorkspace.order, paneId]
          }
        },
        broadcastPaneIds: {
          ...state.broadcastPaneIds,
          [fromWorkspaceId]: (state.broadcastPaneIds[fromWorkspaceId] ?? []).filter(
            (id) => id !== paneId
          )
        }
      }
    })
  },

  setPipeTarget: (sourcePaneId, targetPaneId) => {
    set((state) => {
      const next = { ...state.pipeTargets }
      if (targetPaneId) next[sourcePaneId] = targetPaneId
      else delete next[sourcePaneId]
      return { pipeTargets: next }
    })
  },

  toggleZoom: (paneId, workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    set((state) => ({
      workspaces: withWorkspace(state.workspaces, targetId, (workspace) => ({
        ...workspace,
        zoomedPaneId: workspace.zoomedPaneId === paneId ? null : paneId
      }))
    }))
  },

  restartPane: (paneId, workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    set((state) => ({
      workspaces: withWorkspace(state.workspaces, targetId, (workspace) => {
        const pane = workspace.panes[paneId]
        if (!pane) return workspace
        return {
          ...workspace,
          panes: { ...workspace.panes, [paneId]: { ...pane, restartToken: pane.restartToken + 1 } }
        }
      })
    }))
  },

  toggleAutoRestart: (paneId, workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    set((state) => ({
      workspaces: withWorkspace(state.workspaces, targetId, (workspace) => {
        const pane = workspace.panes[paneId]
        if (!pane) return workspace
        return {
          ...workspace,
          panes: { ...workspace.panes, [paneId]: { ...pane, autoRestart: !pane.autoRestart } }
        }
      })
    }))
  },

  toggleBroadcastMode: (workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    set((state) => ({
      broadcastEnabled: { ...state.broadcastEnabled, [targetId]: !state.broadcastEnabled[targetId] }
    }))
  },

  toggleBroadcastPane: (paneId, workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId
    set((state) => {
      const current = state.broadcastPaneIds[targetId] ?? []
      const next = current.includes(paneId)
        ? current.filter((id) => id !== paneId)
        : [...current, paneId]
      return { broadcastPaneIds: { ...state.broadcastPaneIds, [targetId]: next } }
    })
  },

  setPaneStatus: (paneId, status) => {
    set((state) => {
      if (state.paneStatuses[paneId] === status) return state
      return { paneStatuses: { ...state.paneStatuses, [paneId]: status } }
    })
  },

  clearPaneStatus: (paneId) => {
    set((state) => {
      if (!(paneId in state.paneStatuses)) return state
      const next = { ...state.paneStatuses }
      delete next[paneId]
      return { paneStatuses: next }
    })
  }
}))

/** Aşama 10: bir paneId'nin hangi workspace'e ait olduğunu bulur (cross-workspace sürükleme için). */
export function findPaneOwner(
  workspaces: Record<string, WorkspaceState>,
  paneId: string
): { workspaceId: string; pane: PaneState } | null {
  for (const workspace of Object.values(workspaces)) {
    const pane = workspace.panes[paneId]
    if (pane) return { workspaceId: workspace.id, pane }
  }
  return null
}

/** Aşama 7: canlı store durumunu electron-store'a yazılabilecek serileştirilmiş forma çevirir. */
export function serializeWorkspaceState(state: {
  workspaces: Record<string, WorkspaceState>
  workspaceOrder: string[]
  activeWorkspaceId: string
}): PersistedAppState {
  return {
    version: 1,
    workspaceOrder: state.workspaceOrder,
    activeWorkspaceId: state.activeWorkspaceId,
    workspaces: state.workspaceOrder
      .map((id) => state.workspaces[id])
      .filter((workspace): workspace is WorkspaceState => Boolean(workspace))
      .map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        order: workspace.order,
        panes: workspace.order
          .map((paneId) => workspace.panes[paneId])
          .filter((pane): pane is PaneState => Boolean(pane))
          .map((pane) => ({
            id: pane.id,
            config: pane.config,
            title: pane.title,
            color: pane.color,
            autoRestart: pane.autoRestart,
            kind: pane.kind,
            webUrl: pane.webUrl
          }))
      }))
  }
}
