import { platform, arch } from 'node:os'
import { spawnSync } from 'node:child_process'
import { join, sep } from 'node:path'

/**
 * The single OS adapter (project rule: "Put OS-specific code behind one adapter
 * and test it in CI on all three").
 *
 * Everything that differs between Windows, macOS and Linux lives here.
 */

export type Platform = 'win32' | 'darwin' | 'linux'

export function currentPlatform(): Platform {
  const p = platform()
  if (p === 'win32' || p === 'darwin') return p
  return 'linux'
}

export function currentArch(): string {
  return arch()
}

/**
 * The shell used to run commands.
 *  - Windows: PowerShell, because it ships with every supported Windows version
 *    and handles both `cmd.exe` and `.ps1` syntax.
 *  - macOS/Linux: /bin/sh.
 */
export function defaultShell(): { command: string; args: string[] } {
  if (currentPlatform() === 'win32') {
    return {
      command: windowsPowerShell(),
      args: ['-NoProfile', '-NonInteractive', '-Command'],
    }
  }
  return { command: '/bin/sh', args: ['-c'] }
}

/**
 * Absolute path to Windows PowerShell 5.1, which ships with every supported
 * Windows version. We use the full path because `powershell.exe` is not on the
 * PATH in every environment (and because `ComSpec` would give us cmd.exe, which
 * is not the shell we document).
 */
function windowsPowerShell(): string {
  const systemRoot = process.env.SystemRoot ?? process.env.windir ?? 'C:\\Windows'
  return join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

/**
 * Kill a process tree.
 *  - Windows: `taskkill /pid <pid> /T /F` kills the whole tree.
 *  - macOS/Linux: kill the process group with a negative PID. The child is
 *    spawned detached so it leads its own group.
 */
export function killProcessTree(pid: number): void {
  if (currentPlatform() === 'win32') {
    try {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      /* the process may already be gone */
    }
    return
  }
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
  }
}

/** True when the path is a Windows drive or UNC path. */
export function isWindowsPath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\')
}

/** Normalise a slash-separated path for the current platform. */
export function normalizePath(path: string): string {
  return path.split('/').join(sep)
}

/** A human-readable label for the platform, used in error messages. */
export function platformLabel(): string {
  const p = currentPlatform()
  if (p === 'win32') return 'Windows'
  if (p === 'darwin') return 'macOS'
  return 'Linux'
}
