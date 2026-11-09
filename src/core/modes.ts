/**
 * Plan / Build modes (MODE-1, MODE-2).
 *
 * The model runs either in `plan` or `build`. In plan mode only read-only tools + `ask_user` are
 * available — there is no `write_file`, `edit_file`, `bash`, etc. Any attempt to write an error out.
 */

export type Mode = 'plan' | 'build'

export interface ToolSet {
  /** Tool names available to the model right now. */
  readonly: readonly string[]
  /** Denied tool names (from .idrix/settings.json). */
  readonly denied: readonly string[]
  /** Tools that are allowed but require approval. */
  readonly asks: readonly string[]
}

/**
 * Decide which tools the agent may call in the current mode.
 * Plan mode restricts to read-only tools; build mode is unrestricted.
 */
export function toolsForMode(mode: Mode): ToolSet {
  if (mode === 'plan') {
    return {
      readonly: [
        'read_file',
        'list_dir',
        'glob',
        'grep',
        'ask_user',
      ],
      denied: [],
      asks: [],
    }
  }
  // build
  const all: string[] = [
    'read_file',
    'write_file',
    'edit_file',
    'list_dir',
    'glob',
    'grep',
    'bash',
    'web_search',
    'screenshot',
    'todo',
    'task',
  ]
  return {
    readonly: all,
    denied: [],
    asks: ['write_file', 'edit_file', 'bash'],
  }
}

/** Can this tool be called right now in the current mode? */
export function canCall(tool: string, set: ToolSet): boolean {
  return set.readonly.includes(tool) && !set.denied.includes(tool)
}
