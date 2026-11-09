import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  editFileTool,
  globTool,
  grepTool,
  listDirTool,
  readFileTool,
  writeFileTool,
} from '../src/tools/fs.js'
import { bashTool } from '../src/tools/bash.js'
import { writeFileAtomic } from '../src/core/atomic.js'
import type { ToolContext } from '../src/tools/types.js'

let root: string
let ctx: ToolContext

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'idrix-tools-'))
  ctx = { root }
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('read_file', () => {
  it('reads a file with line numbers', async () => {
    writeFileSync(join(root, 'a.txt'), 'one\ntwo\n', 'utf8')
    const result = await readFileTool.execute({ path: 'a.txt' }, ctx)
    expect(result.type).toBe('text')
    if (result.type !== 'text') return
    expect(result.text).toContain('one')
    expect(result.text).toContain('two')
  })

  it('refuses to read outside the project root', async () => {
    let caught: unknown = null
    try {
      await readFileTool.execute({ path: '../outside.txt' }, ctx)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/outside the project root/)
  })

  it('refuses to read an absolute path outside the project root', async () => {
    let caught: unknown = null
    try {
      await readFileTool.execute({ path: '/etc/passwd' }, ctx)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/outside the project root/)
  })

  it('respects .gitignore', async () => {
    writeFileSync(join(root, '.gitignore'), 'secrets.txt\n', 'utf8')
    writeFileSync(join(root, 'secrets.txt'), 'hunter2', 'utf8')
    let caught: unknown = null
    try {
      await readFileTool.execute({ path: 'secrets.txt' }, ctx)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/ignored/)
  })

  it('reports a missing file clearly', async () => {
    let caught: unknown = null
    try {
      await readFileTool.execute({ path: 'nope.txt' }, ctx)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/File not found/)
  })
})

describe('write_file', () => {
  it('creates a file', async () => {
    const result = await writeFileTool.execute(
      { path: 'hello.ts', content: 'console.log("hi")\n' },
      ctx,
    )
    expect(result.type).toBe('text')
    expect(readFileSync(join(root, 'hello.ts'), 'utf8')).toBe('console.log("hi")\n')
  })

  it('creates missing parent directories', async () => {
    await writeFileTool.execute(
      { path: 'src/deep/nested/file.ts', content: 'x' },
      ctx,
    )
    expect(existsSync(join(root, 'src', 'deep', 'nested', 'file.ts'))).toBe(true)
  })

  it('overwrites an existing file', async () => {
    writeFileSync(join(root, 'a.txt'), 'old', 'utf8')
    await writeFileTool.execute({ path: 'a.txt', content: 'new' }, ctx)
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('new')
  })

  it('appends when asked', async () => {
    writeFileSync(join(root, 'a.txt'), 'old\n', 'utf8')
    await writeFileTool.execute({ path: 'a.txt', content: 'new\n', append: true }, ctx)
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('old\nnew\n')
  })

  it('refuses to write outside the project root', async () => {
    let caught: unknown = null
    try {
      await writeFileTool.execute({ path: '../evil.txt', content: 'x' }, ctx)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/outside the project root/)
  })

  it('snapshots the file before writing, so undo can restore it', async () => {
    writeFileSync(join(root, 'a.txt'), 'old', 'utf8')
    const snapshots: string[] = []
    const ctxWithCheckpoint: ToolContext = {
      ...ctx,
      checkpoint: (p) => snapshots.push(p),
    }
    await writeFileTool.execute({ path: 'a.txt', content: 'new' }, ctxWithCheckpoint)
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toBe(join(root, 'a.txt'))
  })
})

describe('edit_file', () => {
  it('replaces an exact string', async () => {
    writeFileSync(join(root, 'a.txt'), 'hello world', 'utf8')
    await editFileTool.execute(
      { path: 'a.txt', oldString: 'world', newString: 'there' },
      ctx,
    )
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('hello there')
  })

  it('fails when the old string is not found', async () => {
    writeFileSync(join(root, 'a.txt'), 'hello', 'utf8')
    let caught: unknown = null
    try {
      await editFileTool.execute(
        { path: 'a.txt', oldString: 'nope', newString: 'x' },
        ctx,
      )
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/not found/)
  })

  it('fails when the old string is ambiguous', async () => {
    writeFileSync(join(root, 'a.txt'), 'x x x', 'utf8')
    let caught: unknown = null
    try {
      await editFileTool.execute(
        { path: 'a.txt', oldString: 'x', newString: 'y' },
        ctx,
      )
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/appears 3 times/)
  })

  it('replaces every occurrence when replaceAll is set', async () => {
    writeFileSync(join(root, 'a.txt'), 'x x x', 'utf8')
    await editFileTool.execute(
      { path: 'a.txt', oldString: 'x', newString: 'y', replaceAll: true },
      ctx,
    )
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('y y y')
  })
})

describe('list_dir', () => {
  it('lists files', async () => {
    writeFileSync(join(root, 'a.txt'), 'x', 'utf8')
    mkdirSync(join(root, 'sub'))
    const result = await listDirTool.execute({}, ctx)
    expect(result.type).toBe('text')
    if (result.type !== 'text') return
    expect(result.text).toContain('a.txt')
    expect(result.text).toContain('sub/')
  })
})

describe('glob', () => {
  it('finds files by pattern', async () => {
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'a.ts'), 'x', 'utf8')
    writeFileSync(join(root, 'src', 'b.js'), 'x', 'utf8')
    const result = await globTool.execute({ pattern: '**/*.ts' }, ctx)
    expect(result.type).toBe('text')
    if (result.type !== 'text') return
    expect(result.text).toContain('src/a.ts')
    expect(result.text).not.toContain('src/b.js')
  })
})

describe('grep', () => {
  it('finds matching lines', async () => {
    writeFileSync(join(root, 'a.ts'), 'const needle = 1\nconst other = 2\n', 'utf8')
    const result = await grepTool.execute({ pattern: 'needle' }, ctx)
    expect(result.type).toBe('text')
    if (result.type !== 'text') return
    expect(result.text).toContain('a.ts:1')
  })

  it('reports an invalid regex clearly', async () => {
    let caught: unknown = null
    try {
      await grepTool.execute({ pattern: '([' }, ctx)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/Invalid regular expression/)
  })
})

describe('bash', () => {
  it('runs a command and returns its output', async () => {
    const result = await bashTool.execute({ command: 'echo idrix-works' }, ctx)
    expect(result.type).toBe('text')
    if (result.type !== 'text') return
    expect(result.text).toContain('idrix-works')
  })

  it('reports a non-zero exit code', async () => {
    const result = await bashTool.execute({ command: 'exit 3' }, ctx)
    expect(result.type).toBe('text')
    if (result.type !== 'text') return
    expect(result.text).toContain('exit code 3')
  })
})

describe('writeFileAtomic', () => {
  it('leaves no temp files behind', () => {
    const target = join(root, 'atomic.txt')
    writeFileAtomic(target, 'hello')
    expect(readFileSync(target, 'utf8')).toBe('hello')
    const leftovers = readdirSync(root).filter((n) => n.includes('idrix-tmp'))
    expect(leftovers).toEqual([])
  })

  it('never leaves a partially written file when interrupted', () => {
    const target = join(root, 'atomic.txt')
    writeFileAtomic(target, 'complete original')

    // Simulate an interruption during the write: the temp file is written but
    // the rename never happens. The target must still hold the old content.
    writeFileSync(join(root, '.atomic.txt.idrix-tmp-1'), 'partial garbage', 'utf8')

    expect(readFileSync(target, 'utf8')).toBe('complete original')
  })
})
