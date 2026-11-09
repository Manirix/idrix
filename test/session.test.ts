import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { FileCheckpointStore } from '../src/core/checkpoints.js'

describe('FileCheckpointStore', () => {
  let root: string
  let store: FileCheckpointStore

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'idrix-ckpt-'))
    store = new FileCheckpointStore(root, 'session-1')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('records the previous content of a file', () => {
    const file = join(root, 'a.txt')
    writeFileSync(file, 'original', 'utf8')
    const cp = store.snapshot(file)
    expect(cp.didNotExist).toBe(false)
    expect(cp.previousContent).toBe('original')
  })

  it('records that a file did not exist', () => {
    const cp = store.snapshot(join(root, 'new.txt'))
    expect(cp.didNotExist).toBe(true)
    expect(cp.previousContent).toBeUndefined()
  })

  it('restores the previous content', () => {
    const file = join(root, 'a.txt')
    writeFileSync(file, 'original', 'utf8')
    const cp = store.snapshot(file)
    writeFileSync(file, 'changed', 'utf8')
    expect(store.restore(cp)).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe('original')
  })

  it('removes a file that did not exist before, restoring the old state', () => {
    const file = join(root, 'new.txt')
    const cp = store.snapshot(file)
    writeFileSync(file, 'created', 'utf8')
    expect(existsSync(file)).toBe(true)
    expect(store.restore(cp)).toBe(true)
    expect(existsSync(file)).toBe(false)
  })

  it('survives a process restart: checkpoints are on disk', () => {
    const file = join(root, 'a.txt')
    writeFileSync(file, 'original', 'utf8')
    store.snapshot(file)

    // A brand-new store, as if the process restarted.
    const reopened = new FileCheckpointStore(root, 'session-1')
    const all = reopened.list('session-1')
    expect(all).toHaveLength(1)
    expect(all[0]?.previousContent).toBe('original')
  })

  it('lists checkpoints oldest first', () => {
    const a = join(root, 'a.txt')
    const b = join(root, 'b.txt')
    writeFileSync(a, 'a', 'utf8')
    writeFileSync(b, 'b', 'utf8')
    store.snapshot(a)
    store.snapshot(b)
    const all = store.list('session-1')
    expect(all).toHaveLength(2)
    expect(all[0]?.filePath).toBe(a)
    expect(all[1]?.filePath).toBe(b)
  })

  it('returns undefined for the latest checkpoint of an empty session', () => {
    expect(store.latest('never-used')).toBeUndefined()
  })
})
