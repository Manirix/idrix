---
name: image-prompt-enhance
description: Turn vague image requests into detailed prompts for any vision model or image generator.
allowed-tools: [read_file, write_file, bash]
---

# Image Prompt Enhance

Convert a user's rough idea about an image into a structured, actionable prompt that works with any vision or image-generation model.

## Process

1. **Clarify the intent**: Ask the user what the image is for (UI mockup, presentation, documentation, design reference). Context determines what details matter.
2. **Extract tokens**: If the user supplied a reference image, use the vision model to extract: layout structure, colors, typography, spacing, iconography, spacing, hierarchy, overall style keywords.
3. **Prompt structure**: A good prompt contains: subject, style, composition, lighting, colors, details, constraints.
4. **If no reference image**: Use the categories below to build a prompt from the user's verbal description.

## Prompt Template (fill in each section)

```
[Subject]: {what the image shows — be specific}
[Style]: {art style, medium, designer, or branding cues — if none, state "flat design with intentional spacing"}
[Composition]: {framing, perspective, arrangement of elements — if vague, use "centered composition with generous margins"}
[Lighting]: {light direction, quality, shadows, mood — if none, use "soft natural light"}
[Colors]: {color palette — if none, use "neutral palette with accent #e8b04a"}
[Details]: {key visual elements — if vague, omit or say "none"}
[Constraints]: {resolution, format, forbidden elements — be specific about what to avoid}
```

## Banned Image Elements

When enhancing prompts, explicitly avoid:
- Emoji used as visual elements
- Generic gradients without purpose
- Floating blobs/ornaments
- "AI look" patterns from design-taste patterns #1-5, #7, #9, #13

## Output

After enhancing, state the completed prompt. The model should then use it for a vision or image generation task.