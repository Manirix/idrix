import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, basename, join } from 'node:path'

/**
 * Atomic file write.
 *
 * Write to a temp file in the *same directory* (so the rename stays on one
 * filesystem and is therefore atomic), then rename over the target.
 *
 * On interruption (Ctrl+C) the target file is either fully old or fully new —
 * never half-written (CORE-3).
 */
export function writeFileAtomic(
  target: string,
  content: string,
  encoding: BufferEncoding = 'utf8',
): void {
  const dir = dirname(target)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  // Same directory as the target so the rename is atomic.
  const tmp = join(dir, `.${basename(target)}.idrix-tmp-${process.pid}-${Date.now()}`)

  let fd: number | undefined
  try {
    fd = openSync(tmp, 'wx')
    writeFileSync(fd, content, { encoding })
    // Flush to disk before the rename so a crash cannot leave a truncated file.
    try {
      fsyncSync(fd)
    } catch {
      // fsync is best-effort; not supported on every platform/filesystem.
    }
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd)
      } catch {
        /* already closed */
      }
    }
  }

  try {
    renameSync(tmp, target)
  } catch (err) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp)
    } catch {
      /* best effort cleanup */
    }
    throw err
  }
}
