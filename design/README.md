# Design reference — visual overhaul

Checked-in output of the Claude Design pass for Farm Tycoon's visual overhaul. It lives here
rather than only in the hosted design project so it appears in code review, in the diff and in
`git blame`, and so it is readable offline by whoever implements it.

**These files are a reference, not the product.** Nothing here is loaded by the game. The
runtime is `index.html` + `src/`; this folder is what that runtime is being built to match.

## What is here

| File | What it is |
|---|---|
| `HUD-A-Sunlit-Homestead.dc.html` | HUD direction A — the one the sprite notes are written against |
| `HUD-B-Storybook-Linen.dc.html` | HUD direction B, softer and paler |
| `HUD-C-Candy-Harvest.dc.html` | HUD direction C, highest saturation |
| `HUD-D-Brass-Evening.dc.html` | HUD direction D, warm dusk palette |
| `Farm-Tycoon-Screens.dc.html` | The screen board: core loop, storage, logistics, town, new subsystems, progression, onboarding |
| `Farm-Tycoon-Prototype.dc.html` | Interactive prototype |
| `Farm-Tycoon-Current-UI.dc.html` | The interface as it stood before the overhaul, for comparison |
| `farm-world.js` | **Reference renderer.** Working implementation of the iso helper, palette and per-entity draw functions that `src/render/sprites.js` is being rewritten to match. Read it as executable pseudo-code, do not import it. |
| `support.js` | The design tool's own runtime for the `.dc.html` boards. Not ours, not used by the game. |
| `handoff/SPRITE-NOTES.md` | **Read this first.** The implementation brief: palette, outlines, golden-hour lighting, depth sorting, crop stages, derelict states, and the eight new structure sprites. |
| `handoff/styles.css` | The overhauled stylesheet, intended to replace `styles.css` at the repository root. |
| `handoff/farm-icons.svg` | 43-icon sheet for DOM chrome. |

## Known gaps in the handoff

Recorded here so they are not rediscovered.

- **`handoff/styles.css` names two fonts it does not ship.** It sets `--font-display: 'Baloo 2'`
  and `--font-ui: 'Nunito'` with no `@font-face` and no font files. On a machine without them
  installed the page silently falls back to `system-ui` — no error, no warning, every layout
  intact, and the whole interface merely slightly wrong. The fonts must be vendored locally
  (the project forbids CDN assets) and verified with `document.fonts.check` against the running
  page, never by reading the CSS.
- **The `.dc.html` boards load Google Fonts over the network.** That is the design tool's
  preview wrapper, not the deliverable, and it is why the boards look correct while the handoff
  CSS alone would not. Do not copy that `<link>` into the game.
- **`farm-icons.svg` is an asset file**, which sits against the project convention that all art
  is canvas vector code. It is text rather than binary, and it is DOM chrome rather than world
  art, so it is accepted — but as a named deviation, not silently.

## Where it disagreed with the content plan, and how that resolved

The design's HUD dock carried barn, orders, shop and truck buttons. The interaction rule is
that any system with a physical presence opens by clicking its structure in the world, so those
four moved to world objects and the dock keeps only placeless surfaces. The stylesheet already
contains a `.world-pin` class, so the hook for this was supplied by the design itself.

Everything else agreed: the sprite notes independently describe each new system as "a placed,
clickable structure", specify the derelict-but-clickable state for locked buildings, and assume
`FARM.gridSize` is 40.
