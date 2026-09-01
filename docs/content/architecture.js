/* ============================================================================
 * Farm Tycoon documentation: "Under the hood" (developer architecture).
 *
 * One article module, matching the contract in ../app.js: a single named
 * export called `article`. Every number, id and behaviour below was read out
 * of the real source tree, not from memory or from a summary document.
 *
 * Measured at commit 5a18cf7; the counts that move (test assertions, tool line
 * counts) were re-measured against a clean checkout of 7edfa26 and carry that
 * pin where they are stated. Where a count can move the article says so and
 * names the command that prints the current value, rather than pretending a
 * snapshot is permanent.
 * ========================================================================= */

export const article = {
  id: 'architecture',
  title: 'Under the hood',
  group: 'Developers',
  summary:
    'How Farm Tycoon is put together: 37 modules and what each owns, the versioned save format, ' +
    'the absolute-timestamp rule that makes offline progress work, an art pipeline with no binary ' +
    'assets, and how to run, test, extend and release it.',

  sections: [
    /* ------------------------------------------------------------------ */
    {
      id: 'constraints',
      heading: 'Four constraints, and what they buy',
      html: `
<p>
  Farm Tycoon is a browser game that also ships as a Windows desktop application. It is built
  under four rules that are easy to state and were genuinely held to, rather than aspired to.
  Everything else in this article is downstream of them.
</p>

<h3>No dependencies</h3>
<p>
  The game itself imports nothing. <code>package.json</code> lists three
  <code>devDependencies</code> (<code>electron</code>, <code>electron-builder</code> and
  <code>electron-builder-squirrel-windows</code>), and every one of them is a packaging tool
  that runs on a build machine. Not a single line of shipped game code imports a package.
  There is no framework, no state library, no physics engine, no test runner, no bundler
  plugin. The runtime dependency graph of the playable game is exactly the browser.
</p>
<p>
  The practical payoff is that the game cannot be broken by somebody else's release. There is
  no lockfile to audit for the thing a player actually runs, no transitive package that can
  quietly change behaviour, and no upgrade treadmill. The cost is that anything the platform
  does not provide has to be written here, which is why there is a hand-rolled PNG encoder in
  <code>tools/make-icon.mjs</code> and a hand-rolled assertion helper at the top of every test
  file.
</p>

<h3>No build step</h3>
<p>
  <code>index.html</code> loads <code>src/main.js</code> as a module and the browser resolves
  the rest of the graph itself. What is committed is what runs. There is no transpile, no
  bundle, no minify, no source map, no watch process, and no dist directory for the web build.
  Editing a file and reloading the page is the entire development loop.
</p>
<div class="callout callout-info">
  <p>
    <strong>The one thing this does require</strong> is an HTTP origin. ES module imports are
    subject to the same-origin rules, so opening <code>index.html</code> straight off the disk
    does not reliably work. <a href="#/architecture/running">Running it</a> covers the server.
  </p>
</div>

<h3>No framework</h3>
<p>
  The split is deliberate and absolute: <strong>the canvas draws the world, the DOM is
  everything else.</strong> <code>src/render/renderer.js</code> owns one
  <code>&lt;canvas&gt;</code> and paints the farm into it; <code>src/ui.js</code> owns every
  panel, sheet, toast, dock button and HUD readout as real DOM nodes with real accessible
  names. Nothing is virtual, nothing reconciles, and there is no component tree.
</p>
<p>
  A menu written in DOM gets focus handling, screen-reader semantics and text selection for
  free. A farm drawn in DOM would not survive four hundred nodes moving at sixty frames a
  second. Each half is doing the thing it is good at.
</p>

<h3>No binary assets</h3>
<p>
  There are no sprite sheets, no textures, no <code>.png</code> of a cow, no <code>.mp3</code>,
  no <code>.wav</code>, no font files inside the game. Every visual in the world is canvas
  drawing code in <code>src/render/sprites.js</code>, and every sound is synthesised from
  oscillators in <code>src/audio.js</code> at the moment it plays.
  <a href="#/architecture/no-assets">No binary assets</a> goes into what that actually looks
  like.
</p>

<div class="stat-row">
  <div class="stat"><div class="stat-num">37</div><div class="stat-label">modules in src/</div></div>
  <div class="stat"><div class="stat-num">0</div><div class="stat-label">runtime dependencies</div></div>
  <div class="stat"><div class="stat-num">0</div><div class="stat-label">build steps</div></div>
  <div class="stat"><div class="stat-num">0</div><div class="stat-label">image or audio files</div></div>
</div>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'module-map',
      heading: 'The module map: 37 modules and what each owns',
      html: `
<p>
  Thirty-four modules sit in <code>src/</code> and three more in <code>src/render/</code>,
  about ten thousand lines between them. Every one has a single owner and a header comment
  that states what it owns and, more usefully, <em>why it is separate from the module next to
  it</em>. Reading those headers in order is the fastest way into the codebase.
</p>
<p>
  The line counts below are from the tree as committed; they move as work lands.
  <code>npm run count</code> prints the current breakdown, including which lines were written
  by an agent and which by a person.
</p>

<h3>Core loop and state</h3>
<table>
  <thead><tr><th>Module</th><th>Lines</th><th>Owns</th></tr></thead>
  <tbody>
    <tr><td><code>main.js</code></td><td>238</td><td>Boot order, the <code>requestAnimationFrame</code> loop, autosave, the <code>window.__farmDebug</code> hook, and <code>buildWorld()</code>, the per-frame translation from state into the flat object list the renderer wants.</td></tr>
    <tr><td><code>state.js</code></td><td>326</td><td>The one live state object, new-game defaults, save, load, migrate, export, import, reset.</td></tr>
    <tr><td><code>data.js</code></td><td>1940</td><td>All content. 44 exported tables and nothing else: no logic, no imports.</td></tr>
    <tr><td><code>economy.js</code></td><td>164</td><td>Coins, XP, levelling, unlock checks, sell values, diamond skip pricing, and the multiplier provider registry.</td></tr>
    <tr><td><code>farm.js</code></td><td>160</td><td>The grid model: tiles, placement, footprints, expansion zones.</td></tr>
    <tr><td><code>production.js</code></td><td>189</td><td>Every timer that grows, feeds or crafts something.</td></tr>
  </tbody>
</table>

<h3>Selling and logistics</h3>
<table>
  <thead><tr><th>Module</th><th>Lines</th><th>Owns</th></tr></thead>
  <tbody>
    <tr><td><code>orders.js</code></td><td>216</td><td>The six-slot order board and the truck. Draws only from <code>CROPS</code> and <code>GOODS</code>, never artifacts or materials, so an order can never be unfulfillable by construction.</td></tr>
    <tr><td><code>shop.js</code></td><td>176</td><td>The roadside stand and the market stall. Cheaper listings sell faster, floored at 15 seconds.</td></tr>
    <tr><td><code>boat.js</code></td><td>95</td><td>Boat crates and the vouchers they pay.</td></tr>
    <tr><td><code>trains.js</code></td><td>242</td><td>Cargo trains and the airport: goods out, construction materials back.</td></tr>
    <tr><td><code>helicopter.js</code></td><td>156</td><td>The third transport and the fastest materials channel. Fuel regenerates on wall-clock time.</td></tr>
    <tr><td><code>islands.js</code></td><td>98</td><td>Island voyages. Split out of <code>boat.js</code> deliberately: the two share water and nothing else.</td></tr>
  </tbody>
</table>

<h3>The crafting spine</h3>
<table>
  <thead><tr><th>Module</th><th>Lines</th><th>Owns</th></tr></thead>
  <tbody>
    <tr><td><code>workshop.js</code></td><td>123</td><td>Materials into components, components into kits, kits into placed factories. Delegates the actual timers to <code>production.js</code> rather than growing a second queue system.</td></tr>
    <tr><td><code>minigames.js</code></td><td>148</td><td>26 per-factory minigames, one per production building, each doing something only that factory would plausibly do.</td></tr>
  </tbody>
</table>

<h3>Minigames and gathering</h3>
<table>
  <thead><tr><th>Module</th><th>Lines</th><th>Owns</th></tr></thead>
  <tbody>
    <tr><td><code>fishing.js</code></td><td>138</td><td>Cast, the reeling timing game, species by rarity weight, treasure chests.</td></tr>
    <tr><td><code>mine.js</code></td><td>153</td><td>Five tiered depths, ore and gem weight tables per depth, artifact drops below the surface seam.</td></tr>
    <tr><td><code>merge.js</code></td><td>219</td><td>Merge Meadow: a 7&times;9 board, three chains, energy that regenerates while the game is closed.</td></tr>
    <tr><td><code>foraging.js</code></td><td>140</td><td>Free respawning world nodes, the only activity in the game with no cost at all, which is the entire point of it.</td></tr>
  </tbody>
</table>

<h3>The town layer</h3>
<table>
  <thead><tr><th>Module</th><th>Lines</th><th>Owns</th></tr></thead>
  <tbody>
    <tr><td><code>town.js</code></td><td>124</td><td>Houses, population against a cap raised by community buildings, milestone rewards.</td></tr>
    <tr><td><code>zoo.js</code></td><td>181</td><td>Enclosures, souvenir production, visitor income scaled by town population and capped at twelve hours of accrual.</td></tr>
    <tr><td><code>decorate.js</code></td><td>180</td><td>Decorating mode and photo mode. The one declared exception to the open-from-the-world rule, because there is no building called "rearranging things".</td></tr>
  </tbody>
</table>

<h3>Research, discovery and collection</h3>
<table>
  <thead><tr><th>Module</th><th>Lines</th><th>Owns</th></tr></thead>
  <tbody>
    <tr><td><code>lab.js</code></td><td>184</td><td>Permanent research, and <code>researchedEffect()</code>, the single merge point every multiplier in the game passes through.</td></tr>
    <tr><td><code>expeditions.js</code></td><td>171</td><td>Crew hire, site launches, loot. Supplies are consumed up front so a failed run genuinely costs something.</td></tr>
    <tr><td><code>museum.js</code></td><td>74</td><td>Artifacts and exhibits. Artifacts live in <code>state.museum</code> and never in the barn.</td></tr>
    <tr><td><code>collections.js</code></td><td>146</td><td>Collection books and building mastery. Book entries are <em>derived</em> from the live data tables, never hand-listed, so a new fish joins its book automatically.</td></tr>
  </tbody>
</table>

<h3>The simulated neighbourhood</h3>
<table>
  <thead><tr><th>Module</th><th>Lines</th><th>Owns</th></tr></thead>
  <tbody>
    <tr><td><code>neighbours.js</code></td><td>141</td><td>The one pool of simulated players, generated once from <code>state.createdAt</code> and persisted forever.</td></tr>
    <tr><td><code>coop.js</code></td><td>281</td><td>Co-op membership, daily tasks, perks, and the two-directional request board.</td></tr>
    <tr><td><code>regatta.js</code></td><td>217</td><td>The weekly race. Rival scores advance on elapsed wall-clock time, not on frames the player watched.</td></tr>
    <tr><td><code>newspaper.js</code></td><td>127</td><td>Browsing neighbours' shops: free, endless, and the supply valve when one missing input blocks a recipe.</td></tr>
  </tbody>
</table>
<div class="callout callout-info">
  <p>
    Co-op, the regatta, the newspaper and the request board all read from
    <code>neighbours.js</code> and none of them generate anybody. Left to themselves each would
    have rolled its own roster, and the same neighbour would have appeared as three different
    people on three screens. Nothing here is networked; the game is offline-first and stays so.
  </p>
</div>

<h3>Presentation</h3>
<table>
  <thead><tr><th>Module</th><th>Lines</th><th>Owns</th></tr></thead>
  <tbody>
    <tr><td><code>render/renderer.js</code></td><td>370</td><td>Camera, isometric projection, depth sorting, device-pixel-ratio scaling, the frame.</td></tr>
    <tr><td><code>render/sprites.js</code></td><td>1396</td><td>47 exported draw functions. All of the art.</td></tr>
    <tr><td><code>render/effects.js</code></td><td>104</td><td>Pooled particles: coin bursts, XP floaters, sparkles, placement bounces.</td></tr>
    <tr><td><code>ui.js</code></td><td>679</td><td>Every DOM surface: HUD, dock, sheet panels, radial menu, toasts, modals.</td></tr>
    <tr><td><code>input.js</code></td><td>219</td><td>Pick, pan, zoom, drag-plant, placement ghost, and resolving a tap to a structure id.</td></tr>
    <tr><td><code>audio.js</code></td><td>100</td><td>17 synthesised sound effects over one lazily created <code>AudioContext</code>.</td></tr>
    <tr><td><code>tutorial.js</code></td><td>149</td><td>A 12-step machine over <code>TUTORIAL.steps</code>, advanced by events other modules emit.</td></tr>
    <tr><td><code>extras.js</code></td><td>366</td><td>Achievements, the daily wheel, visitors, pets, and the seasonal event calendar.</td></tr>
  </tbody>
</table>

<h3>The rule that shapes the whole thing</h3>
<p>
  <strong>Systems open by clicking their structure in the world, not from a menu.</strong>
  <code>STRUCTURES</code> in <code>data.js</code> gives each of the 22 world objects a
  footprint, a grid position, an unlock level and a panel id.
  <code>input.js</code> resolves a tap to a structure and asks <code>ui.js</code> to open that
  panel by id, so there is no giant switch statement anywhere. A structure below its unlock
  level is still drawn, still clickable, and reports what it is waiting for, which is how a
  system that opens at level 60 is discoverable at level 5.
</p>
<p>
  The dock keeps only what genuinely has no place in the world: settings, achievements, the
  co-op and regatta, and decorating mode.
</p>

<div class="callout callout-warn">
  <p>
    <strong>A stale phrase you will meet in the source.</strong> A handful of comments still
    refer to "Phase B stubs", a leftover from when the modules were API contracts with empty
    bodies. The header of <code>render/renderer.js</code> says <code>init()</code> and
    <code>drawFrame()</code> "stay stubs"; both are fully implemented. <code>ui.js</code> keeps
    a <code>renderComingSoon()</code> fallback for a panel whose backing module is not wired
    up. Treat those comments as historical, not as a description of the current tree.
  </p>
</div>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'state',
      heading: 'One state object, one save',
      html: `
<p>
  There is exactly one mutable game state object. It lives in <code>src/state.js</code> as
  <code>export let state</code>, every other module imports it by name, and it is serialised
  whole with <code>JSON.stringify</code>. No module keeps a private copy of anything that
  matters, and no module has its own persistence.
</p>
<p>
  The save is a single JSON blob in <code>localStorage</code> under the key
  <code>farm-tycoon-save</code>. Autosave runs from the game loop every
  <code>state.settings.autosaveInterval</code> seconds (default 10) and again on
  <code>beforeunload</code>.
</p>

<h3>The shape</h3>
<p>
  The header comment in <code>state.js</code> carries the authoritative shape. Its top level:
</p>
<pre>version, createdAt, lastSaved
coins, diamonds, vouchers, level, xp

farm      { objects: [{id, type, kind, x, y, ...}], unlockedZones }
silo      { capacity, items: { cropId: qty } }
barn      { capacity, items: { goodId: qty } }
production [{ objectId, recipeId, readyAt }]
orders    { board, truck, boat }
shop      { listings }
market    { dayNum, offers, bought }
pets, fishing, achievements, daily, event, stats, settings

workshop  { queue, kits }        minigames  { pending, results, played }
neighbours { roster, seed }      coop       { points, perksUnlocked, requests, ... }
regatta   { seasonId, endsAt, board, points, rivals, league, ... }
expeditions { crew, active, lastResults }
museum    { artifacts, exhibitsCompleted, claimedRewards }
lab       { built, researched, active }
helicopter { current, fuel, fuelUpdatedAt, returningAt }
islands   { voyage, unlocked }   mine   { depthUnlocked, currentDepth, digs }
town      { buildings, population, capacity, claimedMilestones }
zoo       { enclosures, lastIncomeAt, orders }
merge     { cells, energy, energyUpdatedAt }
trains    { current, returningAt, pendingMaterials }
airport   { current, returningAt, pendingMaterials, pendingBonus }
foraging  { nodes }              newspaper { issueId, generatedAt, listings }
collections { seen, claimed, mastery }
decorate  { active, selection, history, historyIndex }
photo     { frame, stickers }</pre>

<h3>Two decisions worth knowing before you read anything else</h3>
<p>
  <strong>Materials have no bucket of their own.</strong> The 23 construction materials are
  goods like any other, so they live in <code>barn.items</code> alongside recipe outputs.
  <code>barn.items</code> is keyed by any tradeable item id, not narrowly a <code>GOODS</code>
  id. That is why <code>production.js</code> routes stock with one small helper:
</p>
<pre>function isCrop(id) { return Object.prototype.hasOwnProperty.call(CROPS, id); }
function stockOf(id) { return isCrop(id) ? state.silo.items : state.barn.items; }</pre>
<p>
  Crops go in the silo. Everything else goes in the barn.
</p>
<p>
  <strong>Artifacts are the exception, and they are not in the barn.</strong> They live in
  <code>state.museum.artifacts</code>. Two reasons, both load-bearing: a full barn would
  otherwise be able to soft-lock expedition collection, and every generator that draws from
  "things the player owns" (orders, trucks, boats, the regatta) must be structurally unable
  to ask for a museum piece.
</p>

<h3>A fresh game</h3>
<p>
  <code>newGameState()</code> seeds 150 coins, 5 diamonds, level 1, six pre-placed empty field
  plots and six wheat seeds. Every expansion system's slice is seeded empty rather than left
  absent, so consumers only ever branch on whether a key <em>holds</em> anything, never on
  whether it exists.
</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'migrations',
      heading: 'Versioning and migrations: never break an existing save',
      html: `
<p>
  <code>SAVE_VERSION</code> is currently <strong>3</strong>. Every save carries its
  <code>version</code>, and <code>load()</code> is the only door in.
</p>

<h3>The load path, in order</h3>
<ol>
  <li>No stored value at all &rarr; start a new game.</li>
  <li>JSON that will not parse &rarr; start a new game. Never half-load a corrupt save.</li>
  <li>Not an object, or no numeric <code>version</code> &rarr; start a new game.</li>
  <li><code>version</code> <em>greater</em> than <code>SAVE_VERSION</code> &rarr; start a new
      game. A save written by a newer build is never guessed at.</li>
  <li><code>version</code> lower &rarr; run migrations up to the current version.</li>
  <li>Run <code>isValidSave()</code> structural validation. Anything that fails &rarr; start a
      new game.</li>
</ol>
<p>
  <code>isValidSave()</code> is not a type check; it is a shape check with invariants baked in.
  Coins, diamonds and XP must be non-negative numbers, level must be at least 1,
  <code>farm.objects</code> and <code>farm.unlockedZones</code> must be arrays, silo and barn
  must each have a numeric capacity and a non-null items object, and
  <code>production</code> must be an array. A save that fails any of those is rejected whole.
</p>

<h3>The migrations that exist</h3>
<div class="callout callout-info">
  <p>
    These are not hypothetical. Both correspond to real builds that shipped and put real saves
    on real machines.
  </p>
</div>
<table>
  <thead><tr><th>Step</th><th>What it defaults</th><th>Why the gap existed</th></tr></thead>
  <tbody>
    <tr>
      <td><code>1 &rarr; 2</code></td>
      <td><code>merge</code>, <code>trains</code>, <code>airport</code></td>
      <td>Builds up to <code>v0.1.0-build11</code> shipped version&nbsp;1 saves, before those three modules had state slices.</td>
    </tr>
    <tr>
      <td><code>2 &rarr; 3</code></td>
      <td><code>town</code>, <code>zoo</code>, <code>market</code></td>
      <td>Builds through <code>v0.1.0-build15</code> shipped version&nbsp;2 saves. Those three modules built their own slices lazily on first use instead of <code>newGameState()</code> seeding them, so a real version&nbsp;2 save can genuinely lack all three.</td>
    </tr>
  </tbody>
</table>
<p>
  Each step is keyed by the version it upgrades <em>from</em>, defaults only the newly required
  keys, and passes every other key through untouched. <code>migrate()</code> walks the chain,
  and a version with no known step forward simply stops, and the validation above then rejects it
  rather than loading a half-migrated object.
</p>

<h3>The rule this encodes</h3>
<div class="callout callout-warn">
  <p>
    <strong>Adding a key to the documented shape means bumping <code>SAVE_VERSION</code> and
    adding a migration.</strong> Skip it and an existing save loads with the new key
    <code>undefined</code>, and every consumer of that key starts branching on absence, which
    is a defect that spreads outward through the codebase one <code>if</code> at a time.
  </p>
</div>
<p>
  The migrations and <code>newGameState()</code> share their default builders
  (<code>makeEmptyMergeBoard()</code>, <code>makeEmptyTown()</code> and the rest) precisely so
  the two can never drift into disagreeing about what an empty slice looks like.
</p>

<h3>Export and import</h3>
<p>
  <code>exportSave()</code> returns the serialised state as a string.
  <code>importSave(json)</code> runs the identical parse, version, migrate and validate path
  and returns a boolean. On <em>any</em> failure it returns <code>false</code> and leaves the
  live <code>state</code> completely untouched: a rejected import never partially applies.
</p>

<h3>Running under Node</h3>
<p>
  <code>localStorage</code> is a browser global, and the game never runs anywhere else. But the
  test suites exercise <code>state.js</code> under plain Node, so the module falls back to an
  in-memory <code>Map</code> with the identical <code>getItem</code>, <code>setItem</code> and
  <code>removeItem</code> surface. The real browser code path is untouched and the test path
  needs no setup.
</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'timestamps',
      heading: 'Absolute timestamps: why offline progress needs no code',
      html: `
<p>
  This is the single most important convention in the codebase, and it is one line long:
</p>
<blockquote>
  <p>
    Every timer is stored as an absolute wall-clock <code>readyAt</code> timestamp in
    milliseconds. Never a countdown, never a remaining duration, never a tick count.
  </p>
</blockquote>

<h3>What planting actually does</h3>
<pre>const now = Date.now();
field.cropId    = cropId;
field.plantedAt = now;
field.readyAt   = now + crop.growTime * 1000;</pre>
<p>
  Wheat has <code>growTime: 120</code>, so its <code>readyAt</code> is two minutes from now.
  That number is then stored, serialised into the save, and never adjusted again.
</p>

<h3>The consequence: there is no catch-up code</h3>
<p>
  A conventional idle game decrements counters each frame and, on load, has to work out how
  long the player was away and run a simulation forward to make up the difference. That
  catch-up pass is where those games get their bugs: it double-counts, or it drifts, or it
  behaves differently from the live path.
</p>
<p>
  Here there is nothing to catch up. Every read compares a stored <code>readyAt</code> against
  the current <code>now</code>, so a timestamp from four days ago resolves correctly the first
  time it is looked at. The comment on <code>production.tick()</code> states it plainly:
</p>
<pre>Every readyAt in this game is an absolute timestamp compared against \`now\` at the
point of use, so nothing here actually needs to mutate state to "catch up" —
comparing a readyAt from days ago against the current \`now\` already resolves
correctly, offline or not.</pre>
<p>
  <code>tick()</code> therefore does not advance anything. It walks state once and returns
  <code>{ now, readyFields, readyPens, readyBuildings }</code> so the renderer and the dock do
  not each have to re-walk <code>state.farm.objects</code> and <code>state.production</code>
  themselves every frame. It is a query, not a step.
</p>

<h3>The same rule everywhere else</h3>
<p>
  It is not confined to crops. Animal pens, building queue slots, boat departure windows, train
  round trips, helicopter fuel regeneration, Merge Meadow energy, foraging node respawns,
  laboratory research, expedition trips, island voyages and regatta rival scores are all
  absolute timestamps, or a stored "last updated at" plus elapsed time. A regenerating resource
  stores <code>fuelUpdatedAt</code> and derives its current value; it does not increment on a
  timer.
</p>

<h3>Where the design deliberately bounds it</h3>
<p>
  Unbounded accrual would make a fortnight away pay a fortune, so several systems cap what can
  accumulate while the game is closed. Zoo visitor income caps at 12 hours of accrual.
  Foraging has an <code>offlineRespawnCap</code>. Helicopter fuel and merge energy have maxima.
  These are the deliberate exceptions and each is commented where it is applied.
</p>

<h3>What this protects</h3>
<p>
  The absolute-timestamp model is also the reason the 26 per-factory minigames are an optional
  bonus layer rather than a gate. Production runs to completion whether or not the player ever
  opens one. Gating a recipe behind hand-eye skill would break exactly the contract this model
  exists to keep: that the game keeps its promises while nobody is looking at it.
</p>

<div class="callout callout-ok">
  <p>
    <strong>Simulating a gap.</strong> <code>window.__farmDebug.timeSkip(ms)</code> shifts every
    stored <code>readyAt</code> backwards by <code>ms</code>. Because the model is purely
    "compare a stored absolute time against now", that single call is exactly equivalent to a
    real elapsed absence, which is what makes offline progress testable in a second rather
    than a day.
  </p>
</div>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'rendering',
      heading: 'Rendering: one canvas, an isometric camera, and a depth sort',
      html: `
<p>
  <code>src/render/renderer.js</code> owns a single canvas and paints the world into it every
  frame. Menus are not in here; they are DOM, in <code>ui.js</code>.
</p>

<h3>The projection</h3>
<p>
  Tiles are 2:1 diamonds. The base tile width is <code>TILE_BASE = 104</code> CSS pixels at
  zoom&nbsp;1, and the whole projection is four lines:
</p>
<pre>const T  = TILE_BASE * camera.zoom;
const ox = viewportW / 2      - (camera.x - camera.y) * T;
const oy = viewportH * 0.2375 - (camera.x + camera.y) * (T / 2);
return [ox + (tx - ty) * T, oy + (tx + ty) * (T / 2)];</pre>
<p>
  <code>screenToTile()</code> is its exact algebraic inverse, used by <code>input.js</code> for
  picking. Both default to a 1280&times;800 viewport so they are callable without a live
  canvas, which is what makes the camera testable under Node.
</p>

<h3>Device pixel ratio</h3>
<p>
  On resize the canvas backing store is set to <code>innerWidth * dpr</code> by
  <code>innerHeight * dpr</code>, the CSS size is pinned to the logical size, and the context
  gets <code>setTransform(dpr, 0, 0, dpr, 0, 0)</code>. Everything downstream then draws in CSS
  pixels and comes out crisp on a high-DPI display without a single call knowing about it.
</p>

<h3>Depth sorting is not optional</h3>
<p>
  Objects are sorted back to front by <code>tx + ty</code> each frame, tie-broken by
  <code>tx</code>. A fixed call order was fine while nothing overlapped, but
  <code>STRUCTURES</code> places 22 objects across a 40&times;40 grid, and the moment one
  building sits south of another a fixed order draws them in the wrong sequence.
</p>

<h3>Camera clamping is a live requirement</h3>
<p>
  At <code>T = 104</code> a 1280-pixel-wide canvas shows roughly twelve tiles.
  <code>FARM.gridSize</code> is 40. Without panning, and without clamping that pan to the
  bounding box of the start zone plus every unlocked expansion plus every placed structure,
  about half the farm is unreachable: the expansions exist in the data and the player can
  never look at them. <code>worldBounds()</code> takes the unlocked-zone list as an argument
  rather than assuming everything is unlocked, so the reachable area grows exactly as the farm
  does.
</p>
<p>
  Zoom is clamped to <code>[0.5, 2.5]</code>, and <code>tickCamera(dt)</code> eases position
  and zoom toward <code>cameraTarget</code> (which <code>input.js</code> writes) before
  clamping again.
</p>
<p>
  <code>HUD_INSET_PX = 76</code> is exported separately and deliberately kept <em>out</em> of
  the clamp arithmetic. The clamp answers "does the viewport show tile space the farm does not
  have"; <code>HUD_INSET_PX</code> answers the different question "is this particular tile
  hidden behind the fixed top rail". Folding the second into the first would let the clamp
  reveal genuine emptiness precisely where a human reviewer cannot see it happening.
</p>

<h3>Draw order</h3>
<ol>
  <li>Clear.</li>
  <li>The continuous meadow, then ground detail. The placement grid is <strong>not</strong>
      drawn during normal play, only in placement and edit mode.</li>
  <li>Every object, depth-sorted, dispatched by <code>kind</code> through a lookup table.</li>
  <li>Progress rings over anything mid-timer.</li>
  <li>World-space particles.</li>
  <li>Two full-canvas "golden hour" lighting gradients.</li>
  <li>DOM chrome, which the browser composites on top.</li>
</ol>
<p>
  The dispatch table exports <code>DISPATCH_KINDS</code> so a test can prove every kind
  <code>main.js</code> emits has a real entry. An unlisted kind falls through to a magenta
  debug circle, which is exactly how every starting field rendered before the
  <code>field</code> entry existed: a real defect, found because the fallback was loud rather
  than silent.
</p>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/34-world-zoom-out.webp" alt="A wide, zoomed-out view of the farm showing the meadow, several fields and nearby buildings together."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Zoomed out to 0.5x.</strong> The floor the camera allows, framing the widest slice of meadow, fields and structures it can hold at once.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/35-world-zoom-in.webp" alt="A close-up, zoomed-in view of a few farm fields and ground texture."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Zoomed in to 2.5x.</strong> The ceiling, close on the planted fields, with crop art and ground detail at their largest on screen.</figcaption>
  </figure>
</div>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'no-assets',
      heading: 'No binary assets: art as code, sound as synthesis',
      html: `
<h3>Every sprite is a function</h3>
<p>
  <code>src/render/sprites.js</code> is 1,396 lines and exports 47 drawing functions. There is
  no image anywhere in it. Each follows one contract:
</p>
<pre>draw&lt;Thing&gt;(ctx, x, y, size, stageOrFrame)</pre>
<p>
  where <code>(x, y)</code> is the tile anchor already resolved to screen space and
  <code>size</code> is the tile-width scale factor (1 means a full tile). Shapes are canvas
  paths, gradients and rounded rectangles; a shared <code>PALETTE</code> object at the top of
  the file holds every colour so the world stays coherent.
</p>
<p>
  <code>drawCropStage()</code> takes a growth fraction and draws the plant at that stage, so a
  crop's four visual stages are one function rather than four bitmaps. Buildings get a
  <code>drawBuilding()</code> with per-type differences; the barn, silo, order board, truck
  bay, shop stand, boat dock and the rest each have their own.
</p>

<h3>What this actually buys</h3>
<ul>
  <li><strong>It scales.</strong> Vector paths are re-drawn at the current zoom, so there is no
      resolution at which the art was authored and no blur at 2.5&times;.</li>
  <li><strong>It diffs.</strong> A change to a building's roof is a readable line in a code
      review, not an opaque binary blob.</li>
  <li><strong>It is tiny.</strong> The whole game's art is smaller than one PNG of a barn.</li>
  <li><strong>Nothing can fail to load.</strong> There is no missing-texture state, because
      there is no fetch.</li>
</ul>

<h3>The ground rule</h3>
<p>
  The world renders as a <em>continuous soft meadow</em>: a base green with low-frequency tonal
  mottling, sparse tufts and small flowers. Fields and buildings are free-standing raised slabs
  with a lighter top edge and a darker side thickness. The logical placement grid is never
  visible during normal play. This was a deliberate correction away from a chequerboard look.
</p>

<h3>Every sound is an oscillator</h3>
<p>
  <code>src/audio.js</code> is 100 lines and exports 17 sound effects over one shared
  <code>AudioContext</code>, created lazily on the first user gesture because browsers refuse
  to start one earlier. Each sound is a short synthesised blip, sweep or chord built from
  oscillators and a gain envelope:
</p>
<pre>export function click() { tone(880, { duration: 0.05, type: 'triangle', gain: 0.12 }); }
export function error() { tone(140, { duration: 0.18, type: 'sawtooth', gain: 0.1 }); }
export function reward() { chord([784, 988, 1175], { duration: 0.22, type: 'sine', gain: 0.09 }); }</pre>
<p>
  The full set covers click, open, close, plant, harvest, coin, reward, level-up, ready, place,
  error, order complete, animal, depart, merge, fish splash and achievement unlocked. All of it
  honours <code>state.settings.sound</code>.
</p>

<h3>Particles</h3>
<p>
  <code>src/render/effects.js</code> keeps coin bursts, XP floaters, harvest sparkles and
  placement bounces in a pooled array, eased and pruned when finished, with no per-frame
  allocation once warmed up. A coin burst scales its particle count logarithmically with the
  amount, so a large payout looks bigger without costing linearly more.
</p>

<div class="callout callout-info">
  <p>
    <strong>The one exception, and where it lives.</strong> The Windows application icon is a
    real <code>.ico</code> file, but it too is generated in code by
    <code>tools/make-icon.mjs</code>, which rasterises the mark with a hand-rolled
    <code>fillRect</code>, <code>fillPolygon</code> and <code>fillCircle</code> routine, encodes
    real PNGs with Node's built-in zlib, and packs 16, 32, 48, 128 and 256 pixel entries into a
    genuine multi-resolution ICO container. Nothing was downloaded or traced.
  </p>
</div>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'merge-point',
      heading: 'One merge point for every multiplier',
      html: `
<p>
  Five different systems grant bonuses: minigame results, laboratory research, building
  mastery, co-op perks and seasonal events. In a codebase where each applied its own
  multiplier at its own call site, three of them would eventually disagree about what a bonus
  means, and the fourth would be applied twice.
</p>

<h3>A closed set of effect keys</h3>
<p>
  <code>EFFECT_KEYS</code> in <code>data.js</code> is a fixed list of 36 names: the complete
  vocabulary of things a bonus is allowed to affect. A representative few:
</p>
<table>
  <thead><tr><th>Key</th><th>Affects</th></tr></thead>
  <tbody>
    <tr><td><code>cropGrowMult</code></td><td>Crop growth time</td></tr>
    <tr><td><code>productionTimeMult</code></td><td>Building queue time</td></tr>
    <tr><td><code>sellPriceMult</code></td><td>Sell value</td></tr>
    <tr><td><code>xpMult</code></td><td>XP gained</td></tr>
    <tr><td><code>siloCapBonus</code>, <code>barnCapBonus</code></td><td>Storage capacity</td></tr>
    <tr><td><code>orderPayoutMult</code></td><td>Order rewards</td></tr>
    <tr><td><code>mineYieldBonus</code>, <code>fishRareChance</code>, <code>zooIncomeMult</code></td><td>Their own systems</td></tr>
    <tr><td><code>doughStretch</code>, <code>purityChance</code>, <code>knifePrecision</code>, &hellip;</td><td>Individual factory minigames</td></tr>
  </tbody>
</table>
<p>
  A key ending in <code>Mult</code> has a neutral value of 1; every other key has a neutral
  value of 0. <code>lab.researchedEffect()</code> merges research, minigame results, mastery
  and co-op perks into one answer per key, and it is the only function that does.
</p>

<h3>How <code>economy.js</code> reaches them without importing them</h3>
<p>
  <code>economy.js</code> cannot import <code>lab.js</code> or <code>minigames.js</code>: a hard
  dependency would create an import cycle and would make the economy unable to load until every
  consumer existed. Instead it exposes a registry:
</p>
<pre>const multiplierProviders = [];
export function registerMultiplierEffect(fn) { multiplierProviders.push(fn); }

function combinedMultiplier(kind, id) {
  let mult = 1;
  for (const fn of multiplierProviders) {
    try {
      const m = fn(kind, id);
      if (typeof m === 'number' &amp;&amp; m &gt; 0) mult *= m;
    } catch { /* a broken provider must never break the economy */ }
  }
  return mult;
}</pre>
<p>
  Three properties fall out of this and all three are deliberate. With nothing registered the
  multiplier is exactly 1, so <code>economy.js</code> and its tests behave deterministically on
  their own. A provider that throws is swallowed rather than taking the economy down with it.
  And a provider returning a non-number, or zero, or a negative, is ignored rather than
  silently zeroing every reward in the game.
</p>
<p>
  The same pattern appears three more times in the same file, for the same reason:
  <code>registerStatHook()</code> for achievements, <code>onCoinsChanged()</code> for the
  coin-pop effect and <code>onXpChanged()</code> for the level-up popup. In each case the
  listener list is iterated inside a <code>try</code>, so presentation code can never break the
  model.
</p>

<h3>Caps</h3>
<p>
  Each minigame declares a <code>cap</code> bounding what a perfect run is worth: the bakery's
  <code>knead_dough</code> caps <code>bonusYield</code> at 0.3. Nothing in the game is farmable
  without limit.
</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'running',
      heading: 'Running it',
      html: `
<h3>In a browser, where all development happens</h3>
<pre>npm run serve      # a static server on port 8123
# then open http://127.0.0.1:8123</pre>
<p>
  The <code>serve</code> script is <code>python3 -m http.server 8123</code>. Any static server
  works; on a machine where the interpreter is called <code>python</code> rather than
  <code>python3</code>, substitute it, or use whatever static server you already have. There is
  no build to run first and nothing to watch: edit a file, reload.
</p>
<div class="callout callout-warn">
  <p>
    <strong>Browse to <code>127.0.0.1</code>, not <code>localhost</code>.</strong> This is a
    verified trap, not superstition. A stale server left running from an earlier session can be
    bound to a different resolution of <code>localhost</code> than your browser picks, so the
    two talk past each other (one serves the file on disk, the other an old snapshot) with no
    error from either side. If a page looks stale after an edit, suspect a second server before
    suspecting your change.
  </p>
</div>

<h3>As the desktop application</h3>
<pre>npm install
npm start          # electron .</pre>
<p>
  <code>electron/main.cjs</code> opens a 1280&times;800 window (minimum 1024&times;640) and
  loads the same <code>index.html</code> the browser loads. There is no separate desktop build
  of the game; the Electron shell is a window around the identical files.
</p>
<p>
  The renderer runs locked down: <code>contextIsolation: true</code>,
  <code>nodeIntegration: false</code>, <code>sandbox: true</code>. The preload script is
  deliberately empty and exposes nothing from Node: the game is pure web technology and does
  not need it. If a future feature wants a native save dialog, that is the file it belongs in,
  behind <code>contextBridge</code>.
</p>

<h3>The debug hook</h3>
<p>
  <code>main.js</code> installs one object on boot. It is used by the automated playtest and is
  harmless in production:
</p>
<pre>window.__farmDebug = {
  get state() { /* live reference to the real state object */ },
  timeSkip(ms),        // shift every stored readyAt back by ms
  give(itemId, qty),   // drop qty into the silo or barn, whichever owns it
};</pre>
<div class="callout callout-info">
  <p>
    <strong>For anything beyond those three, import the real module rather than reimplementing
    it.</strong> A dynamic <code>import('./src/production.js')</code> from page context resolves
    against the already-loaded module graph, so you get a live reference to the running module,
    not a copy. A probe that recomputes a growth fraction or re-derives a sell price is testing
    the probe.
  </p>
</div>

<h3>Boot order</h3>
<ol>
  <li><code>state.load()</code>, including any migration.</li>
  <li><code>renderer.init(canvas)</code>, then focus the camera on the middle of the start zone
      so the first-tier structures are in view without panning.</li>
  <li><code>ui.init()</code>, <code>input.init()</code>, <code>tutorial.init()</code>.</li>
  <li>Audio is deferred to the first user gesture.</li>
  <li>Resolve offline progress with <code>production.tick(now)</code>.</li>
  <li>Start the <code>requestAnimationFrame</code> loop.</li>
</ol>
<p>
  Each frame runs the timer ticks, then the camera ease, then <code>drawFrame()</code>, then
  <code>updateHud()</code>, and autosaves on interval. Every module call in the loop goes
  through a <code>safeCall()</code> wrapper that catches and logs, so one throwing system
  cannot stop the frame loop and blank the screen.
</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'testing',
      heading: 'Testing it',
      html: `
<pre>npm test</pre>
<p>
  That runs a content validator followed by nine suites, in order. There is no test framework:
  each file is a plain Node script using <code>node:assert/strict</code> and a fifteen-line
  <code>test()</code> helper, exiting non-zero on the first failure category and printing a
  summary either way. That is a direct consequence of the no-dependencies rule, and it costs
  about as much as it sounds like it does.
</p>

<h3>The validator runs first, deliberately</h3>
<p>
  <code>tools/validate-data.mjs</code> is 825 lines of integrity checks over
  <code>data.js</code>: that every recipe input resolves to a real crop, good or material; that
  every animal's feed is a real feed-mill recipe and its product a real good; that no id is
  duplicated; that no unlock references something that does not exist; that materials come from
  the right purpose-scoped set, so a barn upgrade cannot quietly demand expansion tools. It
  runs before anything else because a mistyped id should be caught by the thing that knows
  about ids, not by a confusing failure three suites later.
</p>
<p>
  Its summary line doubles as a content census:
</p>
<pre>data.js OK — 22 crops, 12 animals, 26 buildings, 128 recipes, 192 goods,
3 merge chains, 39 achievements, 95 levels all with unlocks,
10 weekend events + 6 mini-events + 25 fair tasks + 6 holidays,
town: 16 houses + 10 community, 14 zoo enclosures, 8 islands, 23 materials</pre>

<h3>The suites</h3>
<table>
  <thead><tr><th>Suite</th><th>Covers</th><th>Assertions</th></tr></thead>
  <tbody>
    <tr><td><code>test-camera.mjs</code></td><td>Projection, inverse projection, world bounds, clamping, focus, depth sort, structure reachability</td><td>29</td></tr>
    <tr><td><code>test-core.mjs</code></td><td><code>state</code>, <code>economy</code>, <code>farm</code>, <code>production</code></td><td>27</td></tr>
    <tr><td><code>test-logistics.mjs</code></td><td><code>orders</code>, <code>shop</code>, <code>fishing</code>, <code>boat</code></td><td>19</td></tr>
    <tr><td><code>test-crafting.mjs</code></td><td><code>workshop</code>, <code>minigames</code>, <code>mine</code>, <code>merge</code></td><td>23</td></tr>
    <tr><td><code>test-township.mjs</code></td><td><code>trains</code>, <code>town</code>, <code>zoo</code>, <code>islands</code></td><td>10</td></tr>
    <tr><td><code>test-research.mjs</code></td><td><code>lab</code>, <code>museum</code>, <code>expeditions</code>, <code>extras</code></td><td>15</td></tr>
    <tr><td><code>test-deadtime.mjs</code></td><td><code>foraging</code>, <code>newspaper</code>, <code>collections</code>, <code>decorate</code></td><td>16</td></tr>
    <tr><td><code>test-social.mjs</code></td><td><code>neighbours</code>, <code>coop</code>, <code>regatta</code>, <code>helicopter</code></td><td>24</td></tr>
    <tr><td><code>test-ui-workshop.mjs</code></td><td>The Workshop panel's kit gate: refusal, consumption, and the coin-only exceptions</td><td>8</td></tr>
    <tr><td colspan="2"><strong>Total</strong></td><td><strong>171</strong></td></tr>
  </tbody>
</table>
<div class="callout callout-info">
  <p>
    <strong>That total is a measurement, not a constant.</strong> It is 171 passing and 0
    failing across all nine suites at commit <code>7edfa26</code>, run against a clean
    checkout. It has read 147, 148, 156 and 167 at earlier commits, and this table itself
    said 156 across eight suites until the camera suite grew to 29 and
    <code>test-ui-workshop.mjs</code> was added. Whatever <code>npm test</code> prints when
    you run it is the authoritative number. Treat any figure written down, including this
    one, as a snapshot.
  </p>
</div>

<h3>The smoke playtest</h3>
<p>
  Unit suites do not prove the thing boots. The playtest procedure drives the real page
  headlessly and asserts: zero console errors on boot (a module-load failure otherwise renders
  a blank page in silence); that the HUD shows live state rather than the static placeholder
  markup <code>index.html</code> ships; plant, fast-forward with <code>timeSkip</code>,
  harvest; economy invariants; and a save, reload and deep-equal comparison of the state
  object.
</p>
<p>
  The HUD check earns its place. <code>index.html</code> ships literal placeholder text:
  <code>0</code> coins and <code>0/50</code> silo, which <code>ui.updateHud()</code> overwrites
  from real state. A page with zero console errors can still be showing unwired static markup,
  and it looks entirely correct in a screenshot.
</p>

<h3>What is not tested</h3>
<p>
  Stated plainly: there is no automated coverage of the drawn output. Sprite functions are
  exercised only in the sense that <code>drawFrame()</code> calls them without throwing.
  Nothing asserts that a cow looks like a cow. Visual checking is done by capturing the running
  application and looking at it. Similarly, DOM panel behaviour in <code>ui.js</code> is
  covered by the playtest's specific assertions rather than exhaustively.
</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'adding-content',
      heading: 'Adding content',
      html: `
<p>
  All content is data. <code>data.js</code> exports 44 tables and imports nothing, and every
  system reads them at runtime. A content addition should therefore touch
  <strong>three places at most</strong>:
</p>
<ol>
  <li>one entry in the right table in <code>src/data.js</code>;</li>
  <li>one draw function in <code>src/render/sprites.js</code>;</li>
  <li>if it is level-gated, one id in <code>LEVELS.unlocks[level]</code>.</li>
</ol>
<div class="callout callout-warn">
  <p>
    <strong>If you find yourself editing system code to add a crop, something is wrong.</strong>
    Either the data table is missing a field the new thing needs, or the system has grown a
    special case it should not have. Fix that instead of adding another one.
  </p>
</div>

<h3>The shape of an entry</h3>
<pre>// CROPS
wheat: { name: 'Wheat', unlockLevel: 1, growTime: 120, seedCost: 1, sellPrice: 4, xp: 1 },

// a recipe, inside BUILDINGS.bakery.recipes
{ id: 'bread', inputs: { wheat: 3 }, time: 300, xp: 3, unlockLevel: 3 },

// ANIMALS
cow: { name: 'Cow', pen: 'Cow Pasture', unlockLevel: 6, feed: 'cow_feed',
       produceTime: 1800, product: 'milk', penCost: 350, animalCost: 60,
       capacity: 4, xp: 3 },</pre>
<p>
  Times are seconds. Prices are coins. Ids are lowercase snake case. A recipe's
  <code>id</code> is also the id of the good it produces, so it must exist in
  <code>GOODS</code>.
</p>

<h3>Balance formulas</h3>
<table>
  <thead><tr><th>Kind</th><th>Rule of thumb</th></tr></thead>
  <tbody>
    <tr><td>Crop</td><td>Sell price roughly the seed cost plus 1.5 per minute of growth; XP roughly the sell price divided by five, minimum 1. Harvest always returns twice the planted seed.</td></tr>
    <tr><td>Recipe</td><td>Output sell price 1.6 to 2.2 times the summed sell price of its inputs, longer recipes taking the higher multiplier. XP roughly minutes divided by six, minimum 2.</td></tr>
    <tr><td>Building</td><td>Cost roughly <code>150 * 1.45^(unlockLevel - 3)</code>, rounded to something friendly.</td></tr>
    <tr><td>Unlock level</td><td>Slot into a level with few unlocks. The design goal is an unlock at <em>every</em> level, and all 95 currently have one.</td></tr>
  </tbody>
</table>

<h3>Levelling</h3>
<p>
  <code>LEVELS.maxLevel</code> is 95 and <code>xpForLevel</code> is deliberately piecewise:
</p>
<pre>xpForLevel: (n) =&gt; (n &lt;= 50
  ? Math.round(50 * Math.pow(n, 1.8))
  : Math.round(50 * Math.pow(50, 1.8) * Math.pow(n / 50, 1.65)))</pre>
<p>
  The original curve is preserved exactly below level 50, so every level the game has already
  shipped costs precisely what it did. Above 50 the exponent eases to 1.65, because at a flat
  1.8 level 95 alone would cost about 190,000 XP and levels 51 to 95 several million, an
  endgame nobody reaches. The two halves join at 50 so there is no jump at the seam.
</p>

<h3>A worked example: crafting a Dairy</h3>
<p>
  Buildings are not bought with coins. 23 of the 26 production buildings require a
  <em>kit</em>, and a kit is the end of a three-stage chain that starts with raw materials
  brought in by train, plane or helicopter. For the Dairy, whose entry carries
  <code>kit: 'kit_dairy'</code>:
</p>
<table>
  <thead><tr><th>Stage</th><th>Recipe</th><th>Inputs</th><th>Time</th></tr></thead>
  <tbody>
    <tr><td>Component</td><td><code>frame</code></td><td><code>timber</code> &times;1, <code>nails</code> &times;2</td><td>20 min</td></tr>
    <tr><td>Component</td><td><code>panel</code></td><td><code>slab</code> &times;2, <code>paint</code> &times;1</td><td>25 min</td></tr>
    <tr><td>Component</td><td><code>shingle</code></td><td><code>slab</code> &times;1, <code>nails</code> &times;1</td><td>10 min</td></tr>
    <tr><td>Kit</td><td><code>kit_dairy</code></td><td><code>frame</code> &times;2, <code>panel</code> &times;2, <code>shingle</code> &times;3</td><td>90 min</td></tr>
    <tr><td>Placement</td><td>not applicable</td><td>The kit, consumed, plus 450 coins</td><td>not applicable</td></tr>
  </tbody>
</table>
<p>
  The Building Workshop unlocks at level 6, costs 900 coins, occupies 3&times;2 tiles, has three
  queue slots and holds 31 recipes. It is an ordinary <code>BUILDINGS</code> entry, so the
  crafting timers go through <code>production.enqueue()</code> like everything else;
  <code>workshop.js</code> adds only the placement gate:
</p>
<pre>export function hasKitFor(buildingType) {
  const building = BUILDINGS[buildingType];
  if (!building || !building.kit) return true;   // e.g. feed_mill, bakery
  return (state.barn.items[building.kit] || 0) &gt;= 1;
}</pre>
<p>
  The kit is only ever decremented when a whole kit is actually held, and never on a failed
  placement.
</p>
<p>
  This is why the transport modules exist. Trains, the airport and the helicopter are the
  material channels, and without a sink for what they deliver they would be flavour. It also
  makes the late game a logistics problem rather than a coin balance.
</p>

<h3>Two invariants to check afterwards</h3>
<ul>
  <li><strong>Order generators must not request locked items.</strong> They draw only from
      unlocked content, and only from <code>CROPS</code> and <code>GOODS</code>, never
      artifacts, never materials. Verify a new high-level item does not surface in a low-level
      order.</li>
  <li><strong>Consume-then-fail must refund.</strong> <code>production.enqueue()</code> checks
      every input before consuming any of them, precisely so a failure can never leave a
      partial consumption behind.</li>
</ul>
<p>
  Then run <code>npm test</code>, run the smoke playtest, and look at the new sprite at every
  zoom level.
</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'release',
      heading: 'Building and releasing',
      html: `
<h3>The installer</h3>
<pre>npm run dist       # electron-builder --win squirrel</pre>
<p>
  The Windows installer is <strong>Squirrel.Windows</strong>. A successful package writes four
  kinds of artifact into <code>dist/squirrel-windows/</code>: a
  <code>Farm Tycoon-Setup-&lt;version&gt;.exe</code>, a <code>RELEASES</code> index, a full
  <code>.nupkg</code>, and any delta packages Squirrel generates. The packaged application id
  is <code>com.farmtycoon.game</code>, and the payload is the same
  <code>index.html</code>, <code>styles.css</code>, <code>src/</code> and
  <code>electron/</code> the browser runs.
</p>

<div class="callout callout-danger">
  <p>
    <strong>The installer is unsigned, permanently and by policy.</strong> Code signing is
    prohibited for this project. No signing certificate is requested, generated, stored or
    used, and <code>forceCodeSigning</code> is committed as <code>false</code>.
  </p>
  <p>
    The consequence is real and is stated rather than hidden: Windows will show an
    unknown-publisher or SmartScreen warning when the installer runs. Nothing about the
    artifact claims authenticity, and nothing verifies a signature, because there is not one.
  </p>
</div>

<p>
  This is not merely asserted. The release workflow reads the signature status back off the
  built executable and fails the job if it is anything other than <code>NotSigned</code>:
</p>
<pre>sig=$(powershell -NoProfile -Command "(Get-AuthenticodeSignature -LiteralPath '$f').Status")
if [ "$sig" != "NotSigned" ]; then
  echo "::error::Expected NotSigned for $f but got '$sig'."
  exit 1
fi</pre>
<p>
  The guard runs in that direction on purpose. A signed artifact escaping is the failure it is
  written to catch.
</p>

<h3>What CI does</h3>
<p>
  A single workflow runs on every push to the default branch and on manual dispatch, on
  <code>windows-latest</code> with Node 20 and a 30-minute timeout. In order it records a start
  timestamp, checks out with full history, installs, derives a unique tag, builds, verifies the
  packaging output, records an end timestamp, generates release notes, and publishes a release.
</p>
<p>
  Tags are unique by construction:
</p>
<pre>v&lt;package version&gt;-build&lt;run number&gt;+&lt;short sha&gt;
# for example: v0.1.0-build23+a7ebd77e71d3</pre>
<p>
  So no release ever recycles or overwrites another, and a tag says exactly which commit and
  which run produced it. Every release carries the setup executable, the <code>RELEASES</code>
  index and the <code>.nupkg</code> as downloadable assets, plus end-to-end workflow timing in
  its notes measured from the first job step rather than estimated.
</p>

<h3>What CI deliberately does not do</h3>
<div class="callout callout-warn">
  <p>
    <strong>No tests run in CI, and nothing gates the release on a check.</strong> The workflow
    carries the reason as a comment where the step would otherwise be: the standing policy is
    build, package, publish and attach evidence only. <code>npm test</code> is run locally,
    before a push, by whoever is making the change, never as a release gate.
  </p>
  <p>
    The trade-off, stated honestly: a release can ship from a commit whose tests would have
    failed, and the first thing to notice would be somebody running the installer. What is
    bought is that artifacts reach people quickly and unconditionally. A job fails only when the
    build, the packaging or the publication itself fails.
  </p>
</div>

<h3>Two details that came from real failures</h3>
<ul>
  <li>
    The step that records a release's code name into a ledger runs <em>after</em> the release is
    published, deliberately. It is a record <em>of</em> the release, not an input to it, so it
    must never gate the thing it records. An earlier run lost a push race and failed the whole
    job, throwing away an installer that had already built and a release that would otherwise
    have published cleanly. With that step last, even a total failure there still leaves a
    shipped, downloadable release behind. It also fetches and rebases up to three times rather
    than pushing blind, and downgrades a lost race to a warning.
  </li>
  <li>
    Artifact collection and upload both run under <code>if: always()</code> with
    <code>continue-on-error: true</code>, so a failed build still leaves its evidence (release
    notes, whatever installer files exist, and a run-context file naming the run id, the commit
    and the job status) behind for inspection. Artifact handling can never mask the original
    failure or turn a red job green.
  </li>
</ul>

<h3>Reproducing a release locally</h3>
<p>
  <code>npm run dist</code> produces the same artifacts CI does, from the same configuration.
  <code>node tools/release-notes.mjs</code> generates the notes, and
  <code>npm run count</code> prints the line-count report that accompanies them. None of those
  publish anything; building an installer and shipping one are different actions with different
  authority, and the local scripts have only the first.
</p>
`,
    },
  ],

  related: ['farming', 'crafting', 'changelog'],
};
