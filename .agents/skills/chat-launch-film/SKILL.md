---
name: chat-launch-film
description: Make a 30-45 second launch film for a product by staging it inside one persistent, neutral chat window. A user types a request, the assistant answers and calls the product as a connected tool, a progress card runs, a follow-up triggers a second tool action, and the result lands as a count-up headline number before closing on the logo, tagline and call to action. Use when you need a launch, feature or integration announcement video for something that plugs into AI assistants (a skill, MCP server, plugin, connector, CLI). Delivers a rendered 1920x1080 MP4 plus an editable single-file HyperFrames project.
---

# chat-launch-film

One chat window stays on screen for the whole film. Nothing cuts away from it until the number lands. The product is never shown as a separate UI: it appears as a tool the assistant calls, so the viewer sees the product doing the work inside a conversation they already understand.

## Inputs

Collect these before touching code. Ask only for what is missing.

| Input | Notes |
|---|---|
| Product | Name, logo file (one you own), one-line tagline, URL |
| The ask | What the user types first. A real, specific need, under ~70 characters |
| The follow-up | Short second message that triggers the second action ("Great, install it.") |
| Tool actions | Name of the search/lookup call and the action call, plus 3 short progress steps each |
| Result | The thing found or made: title and a one-line subtitle |
| Headline number | One integer that proves scale or speed, with a 3-5 word label |
| Command (optional) | A real command or call shown typing in the second tool card |
| Narration (optional) | Skip by default; the film reads fine muted |

## Workflow

1. Load `hyperframes` first, then `hyperframes-core` for the composition contract. Do not use anything from a third party's brand: the window, bubbles and tool cards are generic by design.
2. Create the project folder and copy `template/` into it (`index.html` plus `assets/`). Replace `assets/logo.svg` with the product mark (a file you have the right to use; convert to PNG or SVG and update the two `assets/logo.*` references).
3. Edit only the `C` config object and the palette variables in the CSS. Copy comes from the inputs above. Adjust the `T` timing object only if a text got longer; keep the order of beats.
4. Run `npx --yes hyperframes check`. Fix every error; lint errors turn off the layout and contrast audits, so a 0-sample result is not a pass.
5. Run `npx --yes hyperframes snapshot --at 3,9,12,20,23,28,34` and look at the contact sheet. Check each rule below against what you see.
6. Render: `npx --yes hyperframes render --workers 2 -o final.mp4`. Then extract 4-6 frames with ffmpeg and look at them again, including one frame mid-count-up and the final frame.
7. Optional audio: only a track whose license permits commercial use (or one you generate). Mix with `hyperframes-audio`. Silent is acceptable.

## Beat map (about 36 s)

| Time | Beat |
|---|---|
| 0-1 | Window rises in, empty feed, composer waiting |
| 1-4 | The ask types into the composer, send button pulses, message lands as a bubble |
| 4-7 | Three-dot thinking, then the assistant reply with a "connected" chip for the product |
| 7-12 | Tool card 1: status flips Connecting, Searching, Done; progress bar; three check rows; result card with highlighted border |
| 13-15 | Follow-up types and sends |
| 15-22 | Tool card 2: command types in a code line, bar fills, three check rows, status Installed |
| 22-25 | Final assistant line confirming the outcome |
| 25-31 | Chat fades out; headline number counts up and holds with its label |
| 31-36 | Logo, product name, tagline, command pill, URL |

## Rules that make the format work

- Persistence: the feed is one growing stack. Earlier turns scroll up under a top fade; never replace the window with a fresh card.
- The product is a tool call, not a screenshot. It gets a header (mark, name, function name, status dot), live status words and a bar, so progress is visible.
- Every card is built at its final height with its rows hidden, then revealed. The stack offset is computed from measured heights, so reveals never jump.
- Type, do not appear. Both user messages type character by character in the composer, then clear on send and arrive as bubbles.
- Show a thinking beat before the first answer, and keep each step on screen long enough to read (about 0.8 s per row).
- One accent colour, used for progress, checks, the send button and the headline number. Everything else is neutral.
- The number is the payoff: biggest type in the film, counts up with an ease-out, gets a small pulse when it lands, and the chat is gone by then so nothing competes.
- Keep text under about 70 characters per line in bubbles; two lines at most.
- Use real facts only (real commands, real counts). If you cannot verify a number, do not use it.
- Brand safety: no third-party assistant or product logos, names, icons or fonts. Fonts are system stacks (`system-ui`, `monospace`) so no font files are needed.
- Lint notes: use a CSS `background-image` for repeated logos (repeated `<img>` triggers a duplicate-media warning), keep `data-layout-allow-overflow` on the scrolling stack, and keep placeholder text at 3:1 contrast or better.

## Validation

- `check` reports 0 errors and the layout section shows real samples.
- Snapshots show: ask readable, chip present, both cards complete, final line visible, number fully counted, logo and URL on the last frame.
- Output is H.264, 1920x1080, within 30-45 s. Verify with `ffprobe`.

## Delivery

Hand over `final.mp4` and the project folder. In the message, give the path, the duration, the product facts used, and any issue left open.
