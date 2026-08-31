---
name: playtest
description: Scripted smoke playtest for Farm Tycoon — boot the game headless, fast-forward timers with the debug hook, verify economy invariants and save/reload integrity. Run before every gameplay-affecting commit.
---

# Smoke playtest

Uses the debug hook `main.js` exposes: `window.__farmDebug = { timeSkip(ms), state, give(itemId, qty) }`.
`timeSkip(ms)` shifts every stored `readyAt`/timestamp back by `ms`, simulating elapsed time.

## Procedure (Playwright against `http://localhost:8123` — see run-game skill for setup)

1. **Clean boot:** clear localStorage, load page, assert zero console errors and that
   `__farmDebug.state` exists with `coins === 150`, `level === 1`.
2. **Core loop:** plant wheat on a field (drive UI or call game functions via
   `page.evaluate`), `timeSkip(121_000)`, harvest → assert silo wheat increased by 2 per
   plot and XP > 0.
3. **Production:** give inputs (`give('wheat', 5)`), enqueue bread at the bakery,
   `timeSkip`, collect → assert barn has bread, inputs consumed.
4. **Economy invariants (assert after every step):**
   - `coins >= 0`, `diamonds >= 0`
   - silo/barn item totals ≤ capacity
   - no `production` entry references a missing object or recipe
5. **Events:** event invariants — `state.event.points` never negative; claiming a tier
   twice is a no-op; expired events settle without crash on load.
6. **Orders:** fulfill one board order with stocked goods → coins and XP increase by the
   order's stated reward.
7. **Save/reload:** trigger save, `page.reload()`, deep-compare state before/after
   (ignoring volatile fields like `lastSaved`). Offline progress: `timeSkip` while a crop
   grows, reload → crop is ready.
8. **Screenshot** the final state for a visual once-over.

Any invariant failure or console error = do not commit; fix first.
