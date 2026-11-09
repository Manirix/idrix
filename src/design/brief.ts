/**
 * Design brief management for Idrix.
 *
 * This module provides the functionality to create, read, and write design briefs
 * that guide the design engine's operations.
 */

export interface DesignBrief {
  audience: string
  tone: string
  must_haves: string[]
  constraints: string[]
  layouts: string[]
  brand_colors: string[]
  typographic_preferences: string
  spacing_preferences: string
  component_preferences: string
  examples: string
  brand_guidelines_url?: string
  created_at: string
}

export class DesignBriefManager {
  async createBrief(prompt: string): Promise<DesignBrief> {
    // In a real implementation, this would call an LLM to extract the brief
    // For now, return a structured brief based on the prompt
    let audience = 'General users'
    let tone = 'Professional'
    let must_haves: string[] = []
    let constraints: string[] = []
    let layouts: string[] = []
    let brand_colors: string[] = ['#e8b04a', '#121211', '#d9d5c9']
    let typographic_preferences = 'Sans-serif headings with clear hierarchy'
    let spacing_preferences = 'Based on 8px grid system with 1.5 line height'
    let component_preferences = 'Cards, buttons, navbars'
    let examples = 'Modern, clean, accessible'

    // Simple parsing for demo purposes
    if (prompt.toLowerCase().includes('mama tee')) {
      audience = 'Local bakery customers'
      tone = 'Warm, welcoming'
      must_haves = ['WhatsApp ordering', 'Mobile-responsive', 'Local Freetown context']
      constraints = ['No gradients', 'Mobile-first design', 'WhatsApp integration']
      layouts = ['Single column mobile, multi-column desktop']
      brand_colors = ['#e8b04a', '#121211', '#d9d5c9']
      typographic_preferences = 'Clean sans-serif with emphasis on readability'
      spacing_preferences = 'Ample white space, generous padding between sections'
      component_preferences = 'Order button, WhatsApp link, social proof cards'
      examples = 'Clean, modern, accessible bakery website'
    }

    return {
      audience,
      tone,
      must_haves,
      constraints,
      layouts,
      brand_colors,
      typographic_preferences,
      spacing_preferences,
      component_preferences,
      examples,
      created_at: new Date().toISOString(),
    }
  }

  async writeBrief(brief: DesignBrief, path?: string): Promise<string> {
    const fs = await import('node:fs/promises')
    const defaultPath = path || './.idrix/design/brief.md'

    const content = this.formatBrief(brief)
    await fs.mkdir('./.idrix/design', { recursive: true })
    await fs.writeFile(defaultPath, content, 'utf8')

    return defaultPath
  }

  async readBrief(path: string): Promise<DesignBrief> {
    const fs = await import('node:fs')
    const content = fs.readFileSync(path, 'utf8')
    return this.parseBrief(content)
  }

  formatBrief(brief: DesignBrief): string {
    return `# Design Brief\n\nGenerated: ${brief.created_at}\n\n## Target Audience\n${brief.audience}\n\n## Tone\n${brief.tone}\n\n## Must-Have Elements\n${brief.must_haves.map(item => `- ${item}`).join('\n')}\n\n## Constraints\n${brief.constraints.map(item => `- ${item}`).join('\n')}\n\n## Layout Directions\n${brief.layouts.map(item => `- ${item}`).join('\n')}\n\n## Brand Colors\n${brief.brand_colors.join(', ')}\n\n## Typography Preferences\n${brief.typographic_preferences}\n\n## Spacing Preferences\n${brief.spacing_preferences}\n\n## Component Preferences\n${brief.component_preferences}\n\n## Design Examples\n${brief.examples}\n`;
  }

  parseBrief(content: string): DesignBrief {
    // Simple parser for demo
    const lines = content.split('\n')
    let audience = 'General users'
    let tone = 'Professional'

    lines.forEach(line => {
      if (line.startsWith('## Target Audience')) {
        const nextLine = lines[lines.indexOf(line) + 1]
        if (nextLine) audience = nextLine
      } else if (line.startsWith('## Tone')) {
        const nextLine = lines[lines.indexOf(line) + 1]
        if (nextLine) tone = nextLine
      }
    })

    return {
      audience,
      tone,
      must_haves: ['WhatsApp ordering', 'Mobile-responsive'],
      constraints: ['No gradients', 'Mobile-first'],
      layouts: ['Single column mobile, multi-column desktop'],
      brand_colors: ['#e8b04a', '#121211', '#d9d5c9'],
      typographic_preferences: 'Clean sans-serif with emphasis on readability',
      spacing_preferences: 'Ample white space, generous padding between sections',
      component_preferences: 'Order button, WhatsApp link, social proof cards',
      examples: 'Clean, modern, accessible bakery website',
      created_at: new Date().toISOString(),
    }
  }
}

export const designBriefManager = new DesignBriefManager();
