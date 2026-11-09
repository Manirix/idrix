import React from 'react'
import { render } from 'ink'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { App } from './app.js'
import { version } from './version.js'

/**
 * Idrix CLI entry point.
 *
 *   idrix                    launch the TUI
 *   idrix -p "prompt"        headless mode: run one prompt, print, exit
 *   idrix --version          print the version
 *   idrix --help             print usage
 */

interface ParsedArgs {
  headlessPrompt?: string
  showVersion: boolean
  showHelp: boolean
  root: string
}

export function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    showVersion: false,
    showHelp: false,
    root: process.cwd(),
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--version' || arg === '-v') {
      parsed.showVersion = true
    } else if (arg === '--help' || arg === '-h') {
      parsed.showHelp = true
    } else if (arg === '-p' || arg === '--print') {
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('-')) {
        parsed.headlessPrompt = next
        i++
      }
    } else if (arg.startsWith('--print=')) {
      parsed.headlessPrompt = arg.slice('--print='.length)
    } else if (!arg.startsWith('-')) {
      // A bare argument is treated as the prompt in headless usage.
      if (parsed.headlessPrompt === undefined) parsed.headlessPrompt = arg
    }
  }

  return parsed
}

const HELP = `idrix ${version}

Usage:
  idrix                     Launch the interactive terminal UI
  idrix -p "prompt"         Headless mode: run one prompt, print the result, exit
  idrix --version           Print the version
  idrix --help              Show this help

In the TUI:
  shift+tab                 Switch between PLAN and BUILD mode
  esc                       Interrupt the current turn
  /help                     List every command
`

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv)

  if (args.showVersion) {
    process.stdout.write(`idrix ${version}\n`)
    return
  }

  if (args.showHelp) {
    process.stdout.write(HELP)
    return
  }

  const { waitUntilExit } = render(
    React.createElement(App, {
      root: args.root,
      version,
      headlessPrompt: args.headlessPrompt,
    }),
  )

  await waitUntilExit()
}

/**
 * True when this file is the process entry point.
 * ESM has no `require.main`, so we compare the resolved entry path with ours.
 */
function isEntryPoint(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return resolve(entry) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (isEntryPoint()) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`idrix: ${message}\n`)
    process.exitCode = 1
  })
}
