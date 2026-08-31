# 🚜 Farm Tycoon

A cozy Hay Day-style farm management game — plant crops, raise animals, run production
buildings, fill orders, fish, dig for gold, and grow from a wheat patch to a farming empire.
Built with vanilla JS + Canvas (pure vector art, zero asset files), packaged for **Windows**
with Electron, and playable in any modern browser.

> **Status: scaffold (Phase A).** The full design lives in [`PLAN.md`](PLAN.md); content
> data is final in [`src/data.js`](src/data.js); gameplay implementation is Phase B.
> UI design handoff: [`DESIGN_BRIEF.md`](DESIGN_BRIEF.md).

## The game

- 🌾 **14 crops** from 2-minute wheat to 12-hour grapes — harvest returns double seeds
- 🐄 **7 animals** fed from your own Feed Mill: eggs, milk, bacon, wool, honey and more
- 🏭 **13 production buildings, ~45 recipes** — bakeries, dairies, looms, jam makers, a smelter
- 📋 **Orders**: rotating order board, periodic truck requests, and big boat shipments
- 🏪 **Roadside shop** — price your goods and watch them sell
- 🎣 **Fishing pond** with a timing minigame, 8 species, and treasure chests
- ⛏️ **Mine** for silver, gold, platinum and gems
- 🧩 **Merge Meadow** — a Township-style merge-board minigame whose rewards feed your farm
- 💎 Diamonds, achievements, a daily prize wheel, pets, seasonal events, land expansion,
  decorations — and **40 levels** with something new at every one

## Run it

```bash
# Browser (no install needed)
npm run serve          # then open http://localhost:8123

# Windows desktop
npm install
npm start              # run in Electron
npm run dist           # build the Windows installer (NSIS) into dist/
```

Progress saves automatically (localStorage) and continues while the game is closed —
crops keep growing.

## Repo guide

| Path | What |
|---|---|
| `PLAN.md` | full game design document |
| `DESIGN_BRIEF.md` | UI design contract (tokens, components, screens) |
| `CLAUDE.md` | guide for AI agents working on this codebase |
| `src/data.js` | every crop, animal, recipe, level and tuning number |
| `src/` | game modules (documented API contracts) |
| `electron/` | Windows wrapper |
| `.claude/skills/` | agent skills: run-game, add-content, playtest |
