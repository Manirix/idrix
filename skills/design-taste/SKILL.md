---
name: design-taste
description: Anti-"AI look" rulebook — 14 banned patterns from §5.6.1 with replacement guidance. Applied when writing UI code.
allowed-tools: [read_file, write_file, edit_file]
---

# Design Taste

Apply the anti-"AI look" rulebook when writing front-end code for websites, landing pages, and apps. Every AI-generated website must avoid these 14 patterns (PRD §5.6.1).

## Rule

**Design process:** brief → real references → original design → render → critique → fix. You do NOT ship the first idea. Research first, write code last, then iterate against a living critique.

## Banned Patterns (default list; user-editable)

| # | Pattern | Replacement |
|---|---|---|
| 1 | Purple/blue/pink default gradients (backgrounds, text, buttons) | Use flat colors or single-hue schemes only. Pick one brand color, stick to it. |
| 2 | Any gradient used as decoration without a design reason | Remove. Gradients on backgrounds or text serve no legitimate purpose. |
| 3 | Glassmorphism / `backdrop-blur` cards everywhere | Use solid fills with subtle shadows. If you must blur, use it once intentionally, not in every card. |
| 4 | Neon glow shadows and glowing borders | Flat shadow (`0 2px 8px rgba(0,0,0,0.15)`). Glow is decorative and banned. |
| 5 | Emoji used as icons or section markers | Text labels or simple line icons. Emoji = low effort = banned look. |
| 6 | Identical three-column icon + title + text card grids | Mix layouts — grids vary, cards stack, use sidebar + main column, not all three-column. |
| 7 | Floating blobs/orbs/blurred circles as decoration | Flat geometric shapes. One accent shape maximum. No clones of a stock pattern. |
| 8 | Centered hero with gradient headline and two stacked CTA buttons by default | Layout variety: asymmetric, left-aligned headings, single-button primary actions, no stacking two CTAs. |
| 9 | "New" / "Introducing" pill badge above hero headline by default | Drop badgeed headlines entirely. Use date, version, audience context instead. |
| 10 | Marketing filler: "Elevate", "Unleash", "Seamless", "Revolutionize", "Cutting-edge", "All-in-one" | Real copy tied to the product's purpose. Filler signals thin content. |
| 11 | Lorem ipsum or "Your text here" placeholder | Real copy. If you haven't written real copy, you haven't finished design. |
| 12 | Default Inter + default framework-blue buttons with no type or colour decision | Pick one font family and one button color. Document the choice. Framework blue defaults to #2563eb only if you have evidence that reads well; otherwise pick your own. |
| 13 | Everything `rounded-2xl` with the same soft shadow | Vary radius: `rounded`, `rounded-md`, `rounded-lg`. Shadow styles must differ per component type. |
| 14 | Text-only pages with no interaction, imagery or rhythm | Add at least one visual element per section. Contrast matters even in dense info pages. |

## How to Apply

1. **Brief**: Read the brief (if present in `.idrix/design/brief.md`) or gather constraints yourself — target audience, tone, must-haves, brand colors, content the user owns vs. generated.
2. **Real references**: Look at at least 3 references. Save screenshots if possible. Identify what makes each look real (color choices, spacing, rhythm) and reject the patterns in #1-5, #7, #9, #13 above.
3. **Original design**: Sketch 2 layout directions. Choose the one with the best readability and the strongest visual interest for this brief. Build the HTML/CSS/TSX directly — don't copy from frameworks' default templates.
4. **Render**: Write the code. Then screenshot or open live preview. Do not call this done until something looks like it was designed with care.
5. **Critique**: Run the linter below mentally — does your code trigger any of the 14 patterns? Common culprits: gradients in `<style>`, `rounded-2xl` everywhere, emoji in `<Icon/>` components, filler copy strings, glassmorphism cards.
6. **Fix**: Address whatever the critique found. If more than one pattern triggers, fix all of them in one pass. Iterate up to twice after the initial render if needed.

## Output

After shipping, state: how many banned patterns remain — should be 0. If not, list them and state which you fixed.

## Linter Quick Check (when coding)

While writing each component or style block, scan for:
- Gradients on backgrounds/text/buttons without a documented reason
- `border-radius: 1rem` or larger used identically on every component
- Emoji characters in inline components or section dividers
- Filler marketing words in copy strings
- `Lorem ipsum` or generic placeholders
- `backdrop-blur` cards

If any scan finds a hit, fix before you move on.