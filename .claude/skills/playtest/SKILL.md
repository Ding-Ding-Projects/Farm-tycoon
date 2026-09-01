---
name: playtest
description: Scripted smoke playtest for Farm Tycoon — boot the game headless, fast-forward timers with the debug hook, verify economy invariants and save/reload integrity. Run before every gameplay-affecting commit.
---

# Smoke playtest

The game is complete and playable (37 modules, all `data.js` content final, `npm test` green
across the data validator + 8 suites). This procedure has been run for real against it —
every step below is a verified route, not a plan.

**Prerequisite:** `npm run serve`, then drive `http://127.0.0.1:8123` — not `localhost`; see
the `run-game` skill for the stale-server trap that name difference guards against.

## The general lesson

**Drive the real exported function; do not reimplement its logic in your probe.** A hand-rolled
"is this field ready" check tests your arithmetic, not `production.growthStage()`. Every step
below calls into the real module via `import()` from page context (see `run-game` for why that
gives live references, not copies) or the `window.__farmDebug` hook `main.js` installs on boot.

## Step 0 — bootstrap the module bridge

```js
const [{ state: liveState }, production, economy, data] = await page.evaluate(async () => {
  const mods = await Promise.all([
    './src/state.js', './src/production.js', './src/economy.js', './src/data.js',
  ].map((s) => import(s)));
  return mods; // Playwright serializes the return value; re-import per-call below instead
});
```

In practice it is simpler to keep everything inside one `page.evaluate(async () => { ... })`
per step (module objects don't survive serialization back to Node) — import fresh each time,
it's cheap and the module graph is already loaded.

## Step 1 — clean boot

Clear `localStorage`, load the page, assert:
- zero console errors / pageerrors (a module-load failure renders a blank page silently
  otherwise — see `run-game`);
- `window.__farmDebug` exists.

## Step 2 — HUD shows real state, not static markup

**This is the one that catches a boot that "looks fine" but never wired anything up.**
`index.html` ships static placeholder text: `#coins-value` = `0`, `#diamonds-value` = `0`,
`#silo-value` = `0/50`. `ui.updateHud()` overwrites those from live state. A page with zero
console errors can still be showing the unwired static markup.

Assert the real new-game values, verified against `NEW_GAME` in `data.js`:

```js
const coins = await page.textContent('#coins-value');   // '150'
const diamonds = await page.textContent('#diamonds-value'); // '5'
const silo = await page.textContent('#silo-value');     // '6/50'  (NEW_GAME.seeds.wheat = 6)
```

If any of these read `0` / `0/50`, the UI is not wired to state — stop, this is a bug, not a
timing issue.

## Step 3 — plant / skip / harvest round trip

Drive the real production functions, not a UI click simulation (that belongs to a visual
capture pass, not a smoke test). Two shapes are easy to get backwards — get them right:

- `production.growthStage(field, now)` takes the **field object**, not a field id. Passing an
  id silently returns `-1`, which reads exactly like "empty plot" — no error, wrong answer.
- `production.plant(fieldId, cropId)` and `production.harvest(fieldId, now)` **do** take the
  field **id** (a string like `'field_1'`). The starting fields are `field_1` through
  `field_6` (`NEW_GAME.fields = 6`).

```js
const result = await page.evaluate(async () => {
  const production = await import('./src/production.js');
  const ok = production.plant('field_1', 'wheat');           // consumes 1 seed
  window.__farmDebug.timeSkip(4 * 60 * 60 * 1000);            // wheat growTime is 120s; 4h is plenty
  const before = window.__farmDebug.state.xp;
  const harvest = production.harvest('field_1');              // fieldId, not the field object
  return { ok, harvest, xpGain: window.__farmDebug.state.xp - before };
});
// Verified: harvest === { cropId: 'wheat', qty: 2 } (seedCost 1 -> 2x on harvest), xpGain === 1
```

Optionally exercise `growthStage` correctly along the way (plant a second field, don't skip
time, read the object mid-growth):

```js
const stage = await page.evaluate(async () => {
  const production = await import('./src/production.js');
  const s = window.__farmDebug.state;
  production.plant('field_2', 'wheat');
  const field = s.farm.objects.find((o) => o.id === 'field_2'); // the object, not 'field_2'
  return production.growthStage(field);  // 0 right after planting
});
```

## Step 4 — production building round trip (optional, when a recipe changed)

**Trap:** a recipe's output item id is its own `id` field — there is no `output` key. A probe
written to look for `recipe.output` silently matches zero of the 128 recipes and reports
"nothing produced" for a system that's working fine.

```js
const recipe = data.BUILDINGS.bakery.recipes.find((r) => r.id === 'bread'); // not r.output
```

## Step 5 — economy invariants (assert after every step above)

- `coins >= 0`, `diamonds >= 0`
- silo/barn item totals ≤ their `capacity`
- no `production` entry references a missing farm object or a recipe id that isn't in its
  building's `recipes` array
- construction materials never negative; a building consumes exactly its listed materials
- town population ≤ capacity

## Step 6 — events (if the change touches `extras.js` / the event system)

- `state.event.points` never negative
- claiming a reward tier twice is a no-op, not a double payout
- an expired event settles cleanly on load, no crash

## Step 7 — orders (if the change touches `orders.js`)

Fulfill one board order with stocked goods (`orders.fulfillOrder(orderId)` on an order that
`orders.canFulfill(order)` already reports true for) → assert coins and XP increase by exactly
the order's stated reward, and the consumed goods leave the barn/silo.

## Step 8 — save / reload

Trigger a save (state.js persists to `localStorage`), `page.reload()`, deep-compare state
before/after — ignore genuinely volatile fields (last-saved timestamp) but nothing else.
Offline progress: `timeSkip` while a crop is growing, *then save*, reload → the crop reads as
ready without needing another tick (this is the same code path real elapsed wall-clock time
takes on load).

## Step 9 — screenshot the final state

Save your own capture outside `screenshots/` — that directory belongs to the built-artifact
capture pass (see `release-ops`); a smoke-test screenshot writing there will collide with it.
Use the scratchpad or a Playwright temp path instead.

---

Any invariant failure, console error, or a HUD still reading static-placeholder values =
do not commit; fix first.
