# Sprite & lighting notes — `src/render/sprites.js`

Companion to `handoff/styles.css` and the screens board. Written against the current stub:
`sprites.js` exports `PALETTE` plus per-entity draw functions, all pure canvas paths, no
image files. Nothing here needs a new dependency or asset pipeline.

The reference implementation of everything below is `farm-world.js` in this design project —
it is the same drawing model (iso helper, palette object, per-entity functions) and can be
read as working pseudo-code for the changes.

---

## 1. Replace `PALETTE` wholesale

Same keys, more saturated values, plus five new ones. Drop-in:

```js
export const PALETTE = {
  // ground — pushed up in saturation (the "candy" graft) without going neon
  grass: '#8ecb36', grassLight: '#a8dc52', grassDark: '#6da828',
  grassMottleLight: 'rgba(206,238,124,0.45)', grassMottleDark: 'rgba(96,152,40,0.34)',
  flowerWhite: '#fff8ee', flowerYellow: '#ffd94d', flowerPink: '#f48ab0',   // NEW pink
  soil: '#9c6432', soilLight: '#b87c40', soilDark: '#6f4218', soilRow: 'rgba(58,37,16,0.44)',
  water: '#3fb0e0', waterLight: '#86d8f2',
  road: '#e6bd7c', roadEdge: '#a87c42', roadLight: 'rgba(255,231,178,0.72)',  // NEW
  wood: '#c08a4e', woodDark: '#7a4a18', woodLight: '#dca868',
  roof: '#e05548', roofDark: '#b83a2c', roofTop: '#a03426', roofAlt: '#4a8fd4',
  wall: '#fbeccb', window: '#7fd4f0', trimLight: '#fffaea',
  silo: '#e8dcc0', siloLight: '#fffaea', siloDark: '#bfae8c',
  gold: '#f0b52e', cream: '#fffaf0', wheatGold: '#f2c94c',
  shadow: 'rgba(58,37,16,0.26)',

  // NEW — the three that carry the whole look
  outline: '#3a2510',        // one outline colour for every sprite, matches --color-outline
  outlineWidth: 3.5,         // 3.5 at tile ≈ 104; scale with tile size, see §2
  sun: 'rgba(255,196,104,0.34)',      // golden-hour wash
  vignette: 'rgba(72,44,14,0.38)',    // corner falloff
};
```

`--color-outline` in `styles.css` is the same `#3a2510`. Keep them equal — chrome and world
sharing one outline is most of why the two read as one artefact.

## 2. Add outlines to every entity

The single highest-impact change. After filling a shape, stroke the same path:

```js
const OW = PALETTE.outlineWidth * (T / 104);   // scale with tile size
function outline(ctx) {
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = OW;
  ctx.lineJoin = 'round';
  ctx.stroke();
}
```

Rules that keep it from turning muddy:

- Outline **silhouettes only** — the body, the roof, the canopy, the animal. Never interior
  detail (plank lines, window mullions, soil rows); those stay as low-alpha strokes.
- **One width per entity**, not per part. Small props (fence posts, grains) get `OW * 0.5`.
- Canopy clusters: outline the **union**, not each circle. Fill all the circles first, then
  build one path of all the arcs and stroke once — otherwise you get a bag of overlapping rings.
- Ground and water get no outline; the pond gets one because it reads as an object.
- Keep the existing white trim on the barn/house **inside** the outline: fill → white trim
  stroke → dark outline stroke. Cream between the red and the dark line is what makes it pop.

## 3. Golden hour: one pass at the end of the frame

Two full-canvas gradients after all entities are drawn, before UI:

```js
// warm low sun from upper right
const sun = ctx.createRadialGradient(w * 0.72, -h * 0.18, 0, w * 0.72, -h * 0.18, h * 1.15);
sun.addColorStop(0, PALETTE.sun); sun.addColorStop(1, 'rgba(0,0,0,0)');
ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);

// vignette pulls the eye to the middle of the farm
const vig = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.34, w / 2, h * 0.5, h * 1.02);
vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, PALETTE.vignette);
ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);
```

Cheap and it does the work of hand-painted lighting. Two supporting details:

- **Shadows lean away from the sun.** Offset the existing ground ellipses left and down by
  `~0.10 * T` and `~0.05 * T` instead of centring them under the sprite.
- **Warm rim on the sun side.** On big structures, after the outline, stroke the upper-right
  edge only with `rgba(255,225,150,0.5)` at `OW * 0.6`. One stroke per building; skip on props.

If a day/night cycle ever lands, `sun` and `vignette` are the only two values that need to
change — which is the reason they live in `PALETTE` rather than in the draw functions.

## 4. Depth order is a hard requirement now that things overlap

Draw back-to-front, sorted by `tx + ty` (screen y). The current fixed call order breaks the
moment a building is placed south of another. Sort the placed-object list once per frame:

```js
objects.sort((a, b) => (a.ty + a.tx) - (b.ty + b.tx) || a.tx - b.tx);
```

Ground layer first (field → mottling → pond → road → tufts → plots → fences), then sorted
objects, then lighting.

## 5. New sprites the expansion needs

Each one is a placed, clickable structure, so each needs a sprite in both states. See
`farm-world.js` for `shed()`, `windmill()`, `haybale()` as the pattern — a box + a roof
polygon + one accent, ~25 lines each.

| Sprite | Shape recipe | Accent |
|---|---|---|
| Building Workshop | wide low box, shallow roof, wide dark doorway | tool on the gable |
| Helicopter pad | flat ellipse, painted H, four corner lights | rotor arc when active |
| Museum | portico: 4 columns + pediment triangle | cream stone, not wood |
| Laboratory | flask silhouette on a small pale box | cyan glow window |
| Expedition camp | tent triangle + crate + campfire | ember particles |
| Mine entrance | timber A-frame over a black arch | rail sleepers |
| Train station | long platform box + canopy on posts | blue roof (`roofAlt`) |
| Merge Meadow plot | fenced square of short grass, gate | pink flower cluster |

## 6. Derelict state

Locked structures are visible and clickable from level 1, so every structure above needs a
ruined variant. Do it with a flag on the draw call, not a second function:

```js
function drawStructure(ctx, id, x, y, { derelict = false } = {}) { … }
```

- `ctx.filter = 'saturate(0.45)'` for the whole sprite (matches `.derelict-sprite` in CSS).
- Swap roof colour for `#8a7f68`, wall for `#c9b89a`.
- Break the silhouette: notch the roofline, tilt one post ~6°, omit one window.
- Add two or three loose planks on the ground and a weed tuft at the base.
- Do **not** dim the outline — the shape must stay crisp so it still reads as clickable.

## 7. Crop stages

Four stages per crop, driven by `growProgress` (0–1), not per-crop art:

| Stage | Range | Draw |
|---|---|---|
| Planted | 0 | 6–8 dark seed dots in the furrows |
| Sprout | 0–0.5 | two small leaf ellipses per dot, `leafLight` |
| Growing | 0.5–1 | stem + closed head, 70% of final height |
| Ready | 1 | full height, head in crop colour, plus the pulsing `.plot-ready` chip in DOM |

Crop identity is the head shape and colour only — one shared stem routine. That is what makes
14 crops affordable.

## 8. Tile geometry

Keep the current iso helper. Two notes from rebuilding the scene:

- `oy` at `h * 0.17` pushes the north row under the HUD rail. `h * 0.2375` clears the 76 px
  rail at 800 px tall and still leaves room at the bottom for the sheet panels.
- At `T = 104` a 1280-wide canvas shows ~12 tiles across. With `FARM.gridSize` going to 40,
  the camera must pan and clamp to the placed-objects bounding box — worth landing before the
  extra expansions, or half the farm is unreachable.

---

## What is deliberately not here

- No spritesheet, no image files — the whole look is paths, gradients and two overlays.
- No per-crop bespoke art. Head shape + colour only.
- No town isometric art. Screen 13 on the board is town **chrome** over a flat ground; when
  the town sprites land they follow §2/§3 like everything else.
