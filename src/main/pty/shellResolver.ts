import os from 'os'
import fs from 'fs'
import { execFileSync } from 'child_process'
import type { AvailableShellInfo, PtyCreateOptions, ShellKind } from '@shared/types'

export interface ResolvedShellCommand {
  file: string
  args: string[]
}

const GIT_BASH_CANDIDATES = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe'
]

function commandAvailable(cmd: string): boolean {
  try {
    execFileSync(os.platform() === 'win32' ? 'where' : 'which', [cmd], {
      stdio: 'ignore',
      windowsHide: true
    })
    return true
  } catch {
    return false
  }
}

function findGitBashPath(): string | null {
  for (const candidate of GIT_BASH_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/** `wsl.exe -l -q` çıktısını (UTF-16LE, null-byte'lı) kurulu distro adlarına çevirir. */
export function listWslDistros(): string[] {
  if (os.platform() !== 'win32') return []
  try {
    const output = execFileSync('wsl.exe', ['-l', '-q'], {
      encoding: 'utf16le',
      windowsHide: true
    })
    return (
      output
        .split(/\r?\n/)
        // eslint-disable-next-line no-control-regex
        .map((line) => line.replace(/\u0000/g, '').trim())
        .filter((line) => line.length > 0)
    )
  } catch {
    return []
  }
}

/**
 * Bu makinede hangi shell/araçların kullanılabilir olduğunu tespit eder.
 * PaneConfigModal, kullanıcıya sadece gerçekten çalışacak seçenekleri
 * (ya da neden çalışmayacağını) göstermek için bunu kullanır.
 */
export function detectAvailableShells(): AvailableShellInfo[] {
  const platform = os.platform()
  const results: AvailableShellInfo[] = []

  if (platform === 'win32') {
    results.push({
      shell: 'powershell',
      available: commandAvailable('powershell.exe') || commandAvailable('pwsh.exe')
    })
    results.push({ shell: 'cmd', available: commandAvailable('cmd.exe') })

    const distros = listWslDistros()
    results.push({
      shell: 'wsl',
      available: distros.length > 0,
      distros,
      reason: distros.length === 0 ? 'WSL kurulu değil veya hiç distro yüklenmemiş' : undefined
    })

    const gitBashPath = findGitBashPath()
    results.push({
      shell: 'git-bash',
      available: gitBashPath !== null,
      reason: gitBashPath === null ? 'Git for Windows bulunamadı' : undefined
    })
  } else {
    results.push({ shell: 'bash', available: commandAvailable('bash') })
    results.push({
      shell: 'zsh',
      available: commandAvailable('zsh'),
      reason: commandAvailable('zsh') ? undefined : 'zsh bulunamadı'
    })
  }

  return results
}

/**
 * shell tipini + platformu gerçek bir yürütülebilir dosya/argüman listesine çevirir.
 * Hata durumunda PtyManager.create bunu yakalayıp kullanıcıya anlamlı bir mesaj gösterir.
 */
export function resolveShellCommand(options: PtyCreateOptions): ResolvedShellCommand {
  const platform = os.platform()

  if (options.executable) {
    return { file: options.executable, args: options.args ?? [] }
  }

  switch (options.shell) {
    case 'powershell':
      return { file: platform === 'win32' ? 'powershell.exe' : 'pwsh', args: options.args ?? [] }
    case 'cmd':
      return { file: 'cmd.exe', args: options.args ?? [] }
    case 'wsl': {
      const args = options.wslDistro ? ['-d', options.wslDistro] : []
      return { file: 'wsl.exe', args: [...args, ...(options.args ?? [])] }
    }
    case 'git-bash': {
      const gitBashPath = findGitBashPath()
      if (!gitBashPath) {
        throw new Error(
          'Git Bash bulunamadı. Git for Windows kurulu değil (beklenen yol: "C:\\Program Files\\Git\\bin\\bash.exe").'
        )
      }
      return { file: gitBashPath, args: options.args ?? ['--login', '-i'] }
    }
    case 'bash':
      return { file: '/bin/bash', args: options.args ?? ['-l'] }
    case 'zsh':
      return { file: '/bin/zsh', args: options.args ?? ['-l'] }
    case 'custom':
    default:
      return {
        file: platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash',
        args: options.args ?? []
      }
  }
}

export function shellLabel(shell: ShellKind): string {
  switch (shell) {
    case 'powershell':
      return 'PowerShell'
    case 'cmd':
      return 'CMD'
    case 'wsl':
      return 'WSL'
    case 'git-bash':
      return 'Git Bash'
    case 'bash':
      return 'Bash'
    case 'zsh':
      return 'Zsh'
    default:
      return 'Özel'
  }
}
