import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import { globalDir } from './config.js'
import { redactSecrets } from './redact.js'

/**
 * Session history (HIST-1).
 *
 * A session is an append-only JSONL file: <~/.idrix/sessions>/<id>.jsonl.
 * Append-only means a crash can lose the last line but never corrupt the rest.
 *
 * Secrets are redacted before anything is written (PROV-5).
 */

export interface SessionMessage {
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  /** ISO timestamp. */
  ts: string
  /** Tool name, when role is 'tool'. */
  tool?: string
  /** Extra structured data (e.g. todo list state). */
  meta?: Record<string, unknown>
}

export interface SessionMeta {
  id: string
  /** Absolute path of the project the session belongs to. */
  root: string
  createdAt: string
  updatedAt: string
  /** First user message, used as the session title. */
  title: string
}

export interface SessionSummary {
  id: string
  title: string
  updatedAt: string
  root: string
  messageCount: number
}

export function sessionsDir(): string {
  return join(globalDir(), 'sessions')
}

export function sessionPath(id: string): string {
  return join(sessionsDir(), `${id}.jsonl`)
}

/** Generate a session id: date + short random suffix. */
export function newSessionId(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${stamp}-${rand}`
}

export class Session {
  readonly id: string
  readonly root: string
  readonly createdAt: string
  private title: string
  private updatedAt: string
  private messageCount = 0

  constructor(meta: SessionMeta, title?: string, updatedAt?: string, messageCount = 0) {
    this.id = meta.id
    this.root = meta.root
    this.createdAt = meta.createdAt
    this.title = title ?? meta.title
    this.updatedAt = updatedAt ?? meta.updatedAt
    this.messageCount = messageCount
  }

  static create(root: string, firstMessage: string): Session {
    const now = new Date()
    const id = newSessionId(now)
    const meta: SessionMeta = {
      id,
      root,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      title: firstMessage.slice(0, 80),
    }
    const session = new Session(meta)
    const dir = sessionsDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    // Create the file so `/resume` can list an empty session too.
    writeFileSync(sessionPath(id), '', 'utf8')
    return session
  }

  /** Load an existing session from disk. */
  static load(id: string): Session {
    const path = sessionPath(id)
    if (!existsSync(path)) {
      throw new Error(`Idrix: no session with id "${id}".`)
    }
    const messages = readSessionMessages(id)
    const first = messages.find((m) => m.role === 'user')
    const meta: SessionMeta = {
      id,
      root: '',
      createdAt: messages[0]?.ts ?? new Date().toISOString(),
      updatedAt: messages[messages.length - 1]?.ts ?? new Date().toISOString(),
      title: first?.content.slice(0, 80) ?? '(empty session)',
    }
    const session = new Session(
      meta,
      meta.title,
      meta.updatedAt,
      messages.length,
    )
    return session
  }

  /** Append a message. The content is redacted before it touches the disk. */
  append(message: Omit<SessionMessage, 'ts'> & { ts?: string }): void {
    const ts = message.ts ?? new Date().toISOString()
    const safe: SessionMessage = {
      role: message.role,
      content: redactSecrets(message.content),
      ts,
      ...(message.tool !== undefined ? { tool: message.tool } : {}),
      ...(message.meta !== undefined ? { meta: message.meta } : {}),
    }
    const line = JSON.stringify(safe)
    const dir = sessionsDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    appendFileSync(sessionPath(this.id), `${line}\n`, 'utf8')
    this.updatedAt = ts
    this.messageCount++
    if (safe.role === 'user' && this.title === '') {
      this.title = safe.content.slice(0, 80)
    }
  }

  /** Read every message in this session. */
  messages(): SessionMessage[] {
    return readSessionMessages(this.id)
  }

  get meta(): SessionMeta {
    return {
      id: this.id,
      root: this.root,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      title: this.title,
    }
  }
}

/** Read the messages of a session from its JSONL file. */
export function readSessionMessages(id: string): SessionMessage[] {
  const path = sessionPath(id)
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf8')
  const out: SessionMessage[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    try {
      out.push(JSON.parse(trimmed) as SessionMessage)
    } catch {
      // A partially-written last line after a crash — skip it.
    }
  }
  return out
}

/** List all sessions, newest first. */
export function listSessions(): SessionSummary[] {
  const dir = sessionsDir()
  if (!existsSync(dir)) return []
  const out: SessionSummary[] = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.jsonl')) continue
    const id = name.replace(/\.jsonl$/, '')
    const messages = readSessionMessages(id)
    const first = messages.find((m) => m.role === 'user')
    out.push({
      id,
      title: first?.content.slice(0, 80) ?? '(empty session)',
      updatedAt: messages[messages.length - 1]?.ts ?? '',
      root: '',
      messageCount: messages.length,
    })
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
