import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'

/**
 * File checkpoints (HIST-2).
 *
 * Before Idrix edits a file, the previous content is stored on disk. `/undo`
 * restores the most recent checkpoint. Checkpoints survive a process restart.
 *
 * Layout: <root>/.idrix/history/<sessionId>/<n>-<encodedPath>.snap
 */

export interface Checkpoint {
  id: string
  /** Absolute path of the file that was snapshotted. */
  filePath: string
  /** True when the file did not exist before the edit. */
  didNotExist: boolean
  /** Previous content (undefined when the file did not exist). */
  previousContent?: string
  /** When the checkpoint was taken. */
  timestamp: number
}

export interface CheckpointStore {
  /** Save the current state of a file. */
  snapshot(filePath: string): Checkpoint
  /** All checkpoints for a session, oldest first. */
  list(sessionId: string): Checkpoint[]
  /** The most recent checkpoint for a session, or undefined. */
  latest(sessionId: string): Checkpoint | undefined
  /** Restore a checkpoint. Returns true when the file was restored. */
  restore(checkpoint: Checkpoint): boolean
}

function encodePath(filePath: string): string {
  return filePath.replace(/[:/\\]/g, '_')
}

/** A checkpoint store backed by the filesystem, living under <root>/.idrix/history. */
export class FileCheckpointStore implements CheckpointStore {
  constructor(
    private readonly root: string,
    private readonly sessionId: string,
  ) {}

  private get sessionDir(): string {
    return join(this.root, '.idrix', 'history', this.sessionId)
  }

  snapshot(filePath: string): Checkpoint {
    if (!existsSync(this.sessionDir)) {
      mkdirSync(this.sessionDir, { recursive: true })
    }

    const existed = existsSync(filePath)
    const previousContent = existed ? readFileSync(filePath, 'utf8') : undefined
    const timestamp = Date.now()

    const id = `${this.nextIndex()}-${encodePath(filePath)}`
    const snapshotPath = join(this.sessionDir, `${id}.snap`)

    const payload = JSON.stringify({
      id,
      filePath,
      didNotExist: !existed,
      previousContent: previousContent ?? null,
      timestamp,
    })

    // Write atomically so a crash cannot corrupt the history.
    const tmp = `${snapshotPath}.tmp`
    writeFileSync(tmp, payload, 'utf8')
    renameSync(tmp, snapshotPath)

    return { id, filePath, didNotExist: !existed, previousContent, timestamp }
  }

  list(sessionId: string): Checkpoint[] {
    const dir = join(this.root, '.idrix', 'history', sessionId)
    if (!existsSync(dir)) return []
    const out: Checkpoint[] = []
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.snap')) continue
      try {
        const raw = readFileSync(join(dir, name), 'utf8')
        const parsed = JSON.parse(raw) as {
          id: string
          filePath: string
          didNotExist: boolean
          previousContent: string | null
          timestamp: number
        }
        out.push({
          id: parsed.id,
          filePath: parsed.filePath,
          didNotExist: parsed.didNotExist,
          previousContent: parsed.previousContent ?? undefined,
          timestamp: parsed.timestamp,
        })
      } catch {
        // Skip unreadable checkpoints rather than failing the session.
      }
    }
    return out.sort((a, b) => a.timestamp - b.timestamp)
  }

  latest(sessionId: string): Checkpoint | undefined {
    const all = this.list(sessionId)
    return all[all.length - 1]
  }

  restore(checkpoint: Checkpoint): boolean {
    if (checkpoint.didNotExist) {
      // The file did not exist before → remove it to restore the old state.
      if (existsSync(checkpoint.filePath)) {
        unlinkSync(checkpoint.filePath)
      }
      return true
    }
    if (checkpoint.previousContent === undefined) return false
    const dir = dirname(checkpoint.filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(checkpoint.filePath, checkpoint.previousContent, 'utf8')
    return true
  }

  private nextIndex(): number {
    if (!existsSync(this.sessionDir)) return 1
    const indices = readdirSync(this.sessionDir)
      .filter((n) => n.endsWith('.snap'))
      .map((n) => Number.parseInt(n.split('-')[0] ?? '0', 10))
      .filter((n) => Number.isFinite(n))
    return indices.length === 0 ? 1 : Math.max(...indices) + 1
  }

  /** A short, human-readable description of a checkpoint. */
  describe(checkpoint: Checkpoint): string {
    const rel = relative(this.root, checkpoint.filePath)
    return checkpoint.didNotExist ? `created ${rel}` : `modified ${rel}`
  }
}
