import type { ShellKind } from '@shared/types'

interface ShellMeta {
  label: string
  badge: string
}

const SHELL_META: Record<ShellKind, ShellMeta> = {
  powershell: { label: 'PowerShell', badge: 'PS' },
  cmd: { label: 'CMD', badge: 'CMD' },
  wsl: { label: 'WSL', badge: 'WSL' },
  'git-bash': { label: 'Git Bash', badge: 'GIT' },
  bash: { label: 'Bash', badge: 'SH' },
  zsh: { label: 'Zsh', badge: 'ZSH' },
  custom: { label: 'Özel', badge: '...' }
}

export function getShellMeta(shell: ShellKind): ShellMeta {
  return SHELL_META[shell] ?? SHELL_META.custom
}

export function defaultShellForPlatform(platform: string): ShellKind {
  return platform === 'win32' ? 'powershell' : 'bash'
}
