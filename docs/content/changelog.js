/* ---------------------------------------------------------------------------
 * Project record — history, verification state, and what is deliberately open.
 *
 * Every number in this article was derived from the repository itself: from the
 * commit history, from the committed test suites run against a clean throwaway
 * checkout, from the capture manifest, or by reading the module that implements
 * the behaviour. Nothing here is quoted from another document without being
 * re-checked, because several of those documents have drifted from the code and
 * the drift is itself recorded below.
 *
 * Every claim about the code is pinned to commit 89e0c72, which is what "the
 * verified commit" means throughout; the repository-wide counts are current as
 * of a368e45, whose src/ and tools/ trees are byte-identical to 89e0c72's, so
 * nothing derived from the code moved between the two. The repository is under
 * active repair; a claim here that no longer holds is a claim somebody fixed.
 * ------------------------------------------------------------------------ */

export const article = {
  id: 'changelog',
  title: 'Project record',
  group: 'Project record',
  summary:
    'The whole history in one place: what shipped, what is genuinely verified, which earlier ' +
    'conclusions turned out wrong, and what is still open on purpose.',

  sections: [
    /* ------------------------------------------------------------------ */
    {
      id: 'where-it-stands',
      heading: 'Where it stands today',
      html: `
<div class="stat-row">
  <div class="stat"><div class="stat-num">100</div><div class="stat-label">commits</div></div>
  <div class="stat"><div class="stat-num">37</div><div class="stat-label">source modules</div></div>
  <div class="stat"><div class="stat-num">167</div><div class="stat-label">passing assertions</div></div>
  <div class="stat"><div class="stat-num">47</div><div class="stat-label">captures of the real build</div></div>
  <div class="stat"><div class="stat-num">17</div><div class="stat-label">published releases</div></div>
</div>

<p><em>Measured at commit <code>a368e45</code>. Every claim about the code below
is pinned to <code>89e0c72</code>, whose source and tool trees are byte-identical
to it — so nothing derived from the code moved between the two. Where a number
here disagrees with a document elsewhere in the repository, the disagreement is
itself recorded under <a href="#/changelog/corrections">corrections</a> rather
than quietly reconciled.</em></p>

<p>Farm Tycoon went from an empty repository to a packaged, published Windows
application inside a single working day. Every commit is dated 31 August 2026 or
the hours immediately after it, and the whole arc — scaffold, content,
implementation, visual overhaul, a hostile audit and its repairs, packaging, a
capture pass, and this documentation site — sits inside that window.</p>

<p>What exists is easy to state honestly, and the honesty matters more than the
summary. There is a complete content set. There is a complete gameplay-logic
implementation with a real test suite behind it. There is a working Windows
installer, published as a genuine release built from a named commit. And there is
an interaction layer that reaches <strong>only part</strong> of what the logic
underneath it can already do.</p>

<div class="callout callout-warn">
  <p><strong>The gap in one line.</strong> Twenty-one of the thirty-seven source
  modules are reachable from the application's entry point. Sixteen — about 2,589
  lines of implemented, tested code — are not imported by anything the running
  game loads. They pass their tests because the test tools import them directly.
  <a href="#/changelog/reachable">The reachability section</a> names every one of
  them.</p>
</div>

<h3>Layer by layer</h3>

<table>
  <thead>
    <tr><th>Layer</th><th>State</th><th>How that is known</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Content tables</td>
      <td>Complete and structurally validated</td>
      <td>The content validator passes: 22 crops, 12 animals, 26 buildings, 128 recipes, 192 goods, 23 materials, 95 levels each carrying an unlock</td>
    </tr>
    <tr>
      <td>Gameplay logic</td>
      <td>Implemented; no stub markers remain anywhere</td>
      <td>A search for the scaffold's stub marker returns nothing across all 37 files</td>
    </tr>
    <tr>
      <td>Test suites</td>
      <td>Nine suites plus the content validator, all green</td>
      <td>167 passed, 0 failed, exit code 0, against a clean checkout of the verified commit</td>
    </tr>
    <tr>
      <td>Rendering</td>
      <td>Working; two rendering defects found and fixed after the first capture pass</td>
      <td>Settled by sampling real canvas pixels, not by reading source</td>
    </tr>
    <tr>
      <td>Interaction layer</td>
      <td><strong>Partial.</strong> 5 of 22 world structures open a real panel; 17 show a placeholder</td>
      <td>The panel dispatch has nine cases; the structure table declares 22 panel ids</td>
    </tr>
    <tr>
      <td>Packaging and release</td>
      <td>Shipped. A Squirrel.Windows installer, published, unsigned by policy</td>
      <td>Release assets listed and checked directly, not inferred from a green workflow badge</td>
    </tr>
    <tr>
      <td>Screenshots</td>
      <td>47 captures of the real packaged executable, including its defects at the time</td>
      <td>Driven over the developer-tools protocol against the built application, with a manifest recording every surface that could not be reached and why</td>
    </tr>
  </tbody>
</table>

<h3>Who wrote it, and how much</h3>

<p>The committed line counter reports 19,393 lines across the counted project
areas (17,486 non-blank), attributed per <em>surviving</em> line rather than by
summing additions — churn is not authorship, and a line written then deleted
belongs to nobody. Of those, 24 lines are human-authored and 19,369 are
agent-authored. The counter checks its own arithmetic and refuses to print a
total that disagrees with its own attribution split.</p>

<table>
  <thead>
    <tr><th>Area</th><th>Files</th><th>Lines</th><th>Non-blank</th></tr>
  </thead>
  <tbody>
    <tr><td>Game source</td><td>37</td><td>10,130</td><td>9,254</td></tr>
    <tr><td>Tests and tools</td><td>15</td><td>6,740</td><td>6,099</td></tr>
    <tr><td>Documentation</td><td>12</td><td>1,722</td><td>1,421</td></tr>
    <tr><td>Styles and markup</td><td>2</td><td>551</td><td>503</td></tr>
    <tr><td>Desktop wrapper</td><td>2</td><td>34</td><td>30</td></tr>
    <tr><td>Root configuration</td><td>3</td><td>216</td><td>179</td></tr>
    <tr><td><strong>Project total</strong></td><td><strong>71</strong></td><td><strong>19,393</strong></td><td><strong>17,486</strong></td></tr>
  </tbody>
</table>

<p>Vendored fonts, the generated icon, the dependency lockfile and the checked-in
design reference are counted separately and excluded, each with its reason
printed beside it. The counter also reports its own blind spot: 82 tracked files
match no area rule and land in neither column. That is listed under
<a href="#/changelog/open">the open items</a> rather than rounded away.</p>

<p>Of the 100 commits, 17 are automated release-ledger commits and one is the
repository's initial commit by a person. The remaining 82 were written by an
agent.</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'shipped',
      heading: 'What has shipped',
      html: `
<p>The project was planned in two phases: a scaffold that establishes every
module's public contract, then a single implementation pass that fills all of
them in. Both happened. Several things not in the original plan happened too — a
content expansion, a visual overhaul, an adversarial audit and its repairs, a
capture pass, and this site.</p>

<h3>Phase A — the scaffold</h3>

<p>The first commits establish the shape of the thing before any of it works: a
full repository skeleton, every module present with its exported signatures and
documentation but a stub body, the desktop wrapper, and the design documents. The
point of a scaffold is that the contracts get argued about while they are still
cheap to change.</p>

<table>
  <thead><tr><th>Commit</th><th>What landed</th></tr></thead>
  <tbody>
    <tr><td><code>59326db</code></td><td>The scaffold itself: design documents, content data, module contracts, desktop wrapper</td></tr>
    <tr><td><code>82b53b7</code></td><td>Merge Meadow added as a design, a data table and a module contract</td></tr>
    <tr><td><code>020c99a</code>, <code>33853e9</code></td><td>The visual direction settles: a continuous meadow rather than a visible grid, fields as raised slabs</td></tr>
    <tr><td><code>aebce0d</code></td><td>The event system designed in full — weekend events, mini-events, the fair, holidays</td></tr>
    <tr><td><code>3939127</code></td><td>The town layer: town, materials, trains, airport, zoo, islands, market</td></tr>
  </tbody>
</table>

<h3>The content expansion</h3>

<p>Nine commits roughly doubled the game before a line of it ran. The two
mechanics that separate this from the games it draws on arrived here — as data
and contracts rather than as behaviour: <strong>buildings are crafted from
materials rather than bought with coins</strong>, and <strong>every production
building has its own minigame, with an effect only that building has</strong>.</p>

<table>
  <thead><tr><th></th><th>Before</th><th>After</th></tr></thead>
  <tbody>
    <tr><td>Crops / animals</td><td>14 / 7</td><td>22 / 12</td></tr>
    <tr><td>Buildings / recipes</td><td>15 / 52</td><td>26 / 128</td></tr>
    <tr><td>Goods / materials</td><td>85 / 9</td><td>192 / 23</td></tr>
    <tr><td>Town houses / community buildings</td><td>10 / 6</td><td>16 / 10</td></tr>
    <tr><td>Zoo enclosures / islands</td><td>8 / 4</td><td>14 / 8</td></tr>
    <tr><td>Levels / achievements</td><td>50 / 21</td><td>95 / 39</td></tr>
  </tbody>
</table>

<h3>The audit, and the repairs it forced</h3>

<p>Before implementation began, an adversarial pass ran <strong>99 mutation
probes</strong> against the content validator: break one invariant at a time on
purpose and see whether the guard notices. <strong>51 guards fired
correctly.</strong> What it exposed was worse than what it confirmed, and every
finding was reproduced independently before anything was changed.</p>

<ul>
  <li><strong>Nine of twenty-three materials had no source anywhere in the
  data.</strong> Trains, the airport and the helicopter each declared how many
  materials a trip returns while naming no pool to draw them from. Every land
  expansion and every storage upgrade was therefore unbuyable — and since
  expansions are how land is granted, the farm could never grow past its opening
  twelve squares. Fixed in <code>895e7a6</code>.</li>
  <li><strong>Not one of the twenty-two structures stood on land the player
  owns.</strong> The barn and the silo sat on a row belonging to an expansion
  that unlocks at level 13, so a new player could not reach their own barn. Fixed
  in <code>5b56e2e</code> — all 22 were misplaced, not the four the audit
  originally named.</li>
  <li><strong>The guard covering the first defect lied.</strong> Its comment
  claimed to check both the spend side and the earn side of the material economy;
  only the spend side had ever been written. This is recorded as the most
  instructive finding of the three, and is revisited under
  <a href="#/changelog/corrections">corrections</a>.</li>
</ul>

<h3>Phase B — the implementation pass</h3>

<p>Fourteen commits, in dependency order, each carrying its own tests. The
implementation was supposed to land on a branch behind a draft pull request. It
did not: every commit went straight to the default branch, the same way the
scaffold had. That divergence is recorded rather than tidied away.</p>

<table>
  <thead><tr><th>Commit</th><th>Lane</th></tr></thead>
  <tbody>
    <tr><td><code>04c74c3</code></td><td>Sprite art, particle effects and the canvas render loop</td></tr>
    <tr><td><code>62f4439</code></td><td>Save, load, import and export, with migration and validation</td></tr>
    <tr><td><code>c38e19a</code></td><td>Order board, truck, boat, roadside shop, fishing</td></tr>
    <tr><td><code>dedcdcf</code></td><td>Building Workshop, per-factory minigames, mine, Merge Meadow</td></tr>
    <tr><td><code>05532ed</code>, <code>060ba95</code>, <code>90300bf</code>, <code>82f699a</code></td><td>Trains and airport, town, zoo, island voyages</td></tr>
    <tr><td><code>be38c95</code></td><td>Foraging, newspaper, collections and mastery, decorating</td></tr>
    <tr><td><code>6cf7650</code></td><td>Laboratory, museum, expeditions, events and extras</td></tr>
    <tr><td><code>2330789</code></td><td>The simulated-neighbour pool, and co-op, regatta and helicopter on top of it</td></tr>
    <tr><td><code>ee6d8b0</code></td><td>The interaction layer: interface, input, tutorial, audio, boot</td></tr>
    <tr><td><code>013509a</code></td><td>Every subsystem key seeded at new-game time; save format raised to version 3</td></tr>
  </tbody>
</table>

<h3>Packaging, and then the captures</h3>

<p>The installer target moved to Squirrel.Windows in <code>2c1963b</code>, along
with an application icon generated in code rather than downloaded — consistent
with the project's rule that no binary art is ever committed. The two design
typefaces were vendored locally in <code>dc74374</code>, which also fixed a
pre-existing defect: the game's own page had been loading fonts over the network
since the scaffold, against the project's own no-remote-request rule.</p>

<p>The capture pass landed in <code>a7ebd77</code>: 47 screenshots of the real
packaged executable, driven over the developer-tools protocol on an off-screen
desktop. Not a development server, not a mock-up. It covers boot and tutorial,
seven locked structures across the unlock curve, all four crop growth stages, the
plant and harvest menus, a built animal pen fed and collected, every one of the
22 structure panels, the dock panels and the reset confirmation, both zoom
extremes, and a narrow layout against a wide one.</p>

<div class="callout callout-info">
  <p>The capture run carries a hand-written list of required surfaces and fails
  loudly if any of them is neither captured nor explicitly recorded as
  unreachable. That is deliberate. A harness that quietly records a missing
  surface as a gap lets a real defect through a green run: the gap lands in a
  manifest nobody opens while the badge everybody reads stays green.</p>
</div>

<h3>What the captures caused</h3>

<p>Photographing the shipped build rather than a development server is what
turned two defects into fixes. Both were invisible to the entire test suite,
because no test drove the surface either one lived on.</p>

<ul>
  <li><strong>Fields drew as magenta placeholder circles</strong> — fixed in
  <code>1c117c5</code>, described in detail under
  <a href="#/changelog/verified">verification</a>.</li>
  <li><strong>The camera could not reach the starting fields</strong> — the first
  half fixed in <code>556fe8f</code>, the second half still bounded by a ceiling
  that is honestly reported rather than claimed closed.</li>
  <li><strong>The Workshop sold buildings for coins</strong> instead of running
  the kit-crafting chain the project cites as its defining mechanic. Captured
  as-is rather than patched around, then wired properly in <code>2b33dec</code>
  with a regression suite of its own.</li>
  <li><strong>The building queue showed numbered cards with question-mark
  icons</strong>, from a single wrong assumption about a data shape. Also
  captured as-is, also since repaired.</li>
</ul>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'verified',
      heading: 'What is verified, and how',
      html: `
<p>A tick in this project means a claim somebody checked, not a claim somebody
made. This section says exactly what the checking consists of, because the
difference between "the suite passes" and "the feature works when you click it"
is where most of the remaining honest work in this project lives.</p>

<h3>The test suites</h3>

<p>The test command runs the content validator followed by nine gameplay suites.
The run below was made against a clean throwaway checkout of the verified commit,
deliberately, because the shared working copy had unrelated in-flight edits at
the time — and a result read off a modified tree is a result about a tree that
does not exist.</p>

<table>
  <thead><tr><th>Suite</th><th>Assertions</th><th>What it exercises</th></tr></thead>
  <tbody>
    <tr><td>Content validator</td><td>structural</td><td>Every content table: ids, cross-references, unlock ordering, recipe margins, material sourcing, grid geometry</td></tr>
    <tr><td>Camera</td><td>25</td><td>Pan, clamp arithmetic, corner reachability at both zoom extremes, boot framing, and a completeness guard over the renderer's dispatch table</td></tr>
    <tr><td>Core</td><td>27</td><td>Planting and harvesting through the real tick, offline catch-up, economy invariants, save round-trips</td></tr>
    <tr><td>Logistics</td><td>19</td><td>Order board, truck, boat crates, roadside shop, fishing</td></tr>
    <tr><td>Crafting</td><td>23</td><td>Workshop kit chain, per-factory minigames, mine depths, the merge board</td></tr>
    <tr><td>Township</td><td>10</td><td>Train and airport cycles, town population, zoo income, island voyages</td></tr>
    <tr><td>Research</td><td>15</td><td>Laboratory research, museum artifacts, expeditions</td></tr>
    <tr><td>Dead time</td><td>16</td><td>Foraging respawn, newspaper, collections and mastery, decorating and photo mode</td></tr>
    <tr><td>Social</td><td>24</td><td>The simulated-neighbour roster, co-op requests and perks, the weekly regatta, helicopter fuel</td></tr>
    <tr><td>Workshop interface</td><td>8</td><td>That the Workshop panel actually drives the crafting module rather than placing buildings for coins</td></tr>
    <tr><td><strong>Total</strong></td><td><strong>167</strong></td><td><strong>0 failed, exit code 0</strong></td></tr>
  </tbody>
</table>

<p>These are not shape checks over the data. They import the real modules and
drive them: a crop is planted, time is advanced, the harvest is taken, the state
is saved, reloaded and compared. The validator's own summary reports what it
walked:</p>

<pre><code>data.js OK — 22 crops, 12 animals, 26 buildings, 128 recipes, 192 goods,
3 merge chains, 39 achievements, 95 levels all with unlocks, 10 weekend events
+ 6 mini-events + 25 fair tasks + 6 holidays, town: 16 houses + 10 community,
14 zoo enclosures, 8 islands, 23 materials</code></pre>

<h3>Two things verified by looking at real pixels</h3>

<p>Both rendering defects fixed late in the project were invisible to every test,
and both were settled by measurement rather than by reading code.</p>

<h4>Fields drew as magenta placeholder circles</h4>

<p>Every unplanted field carries the kind <code>field</code>, and the renderer's
dispatch table had no entry for that kind — only crop, animal, pen, building,
structure, forage, decoration and pet. All six fields at a fresh boot fell
through to the placeholder fallback, which is a magenta circle with the word
"field" stamped inside it, sitting on top of an otherwise correct meadow.</p>

<p>The fix was one dispatch entry. The interesting part is the verification: the
live renderer was imported into the running page, a real crop was planted, and
the canvas pixel colour was sampled across the growth window — soil brown through
early growth, green-gold at mid-growth, golden at and past ready, clamped rather
than overshooting, and measurably distinct from the placeholder's own colour. A
completeness guard was added at the same time, asserting that every object kind
the world builder emits has a dispatch entry, and it was <em>broken on
purpose</em> and watched go red before it was trusted to pass.</p>

<h4>The camera clamp treated north and south as symmetric</h4>

<p>They are not. The camera target is placed near the top of the screen so the
interface has room, which means only a sliver of the viewport sits north of it
and most of it sits south. One averaged half-extent overstated the north margin —
so the camera could never pan far enough north to bring the starting fields into
view — and understated the south margin, so panning toward the far edge could
leak real emptiness past the world bounds, which no existing test caught.</p>

<p>The fix derives both half-extents from the projection's own algebra. Every new
assertion was checked red against the old formula and green against the new one,
and the result was confirmed live: the camera settles at a measurably different
position at boot, pulling the starting fields about 57 pixels further into frame,
exactly matching the predicted arithmetic.</p>

<div class="callout callout-ok">
  <p><strong>The pattern worth keeping.</strong> A guard nobody has watched fail
  proves nothing. Both fixes above were trusted only after their guard was broken
  deliberately, seen to go red, restored, and seen to go green. It costs one
  command, and it is the whole difference between a check and a decoration.</p>
</div>

<h3>Structure placement and save migration</h3>

<p>All 22 world structures were independently re-verified rather than trusted
from the suite: each resolves to itself from its own tile, across 101 occupied
tiles, with zero overlaps and every panel id unique. Twenty of the twenty-two are
locked at level 1 and still present and clickable — the barn and the silo are the
two that open immediately. Locked structures render as derelict but stay in the
world from the first minute, so the map itself is the roadmap.</p>

<p>The save format is at version 3, with two migrations that were read rather
than assumed: version 1 to 2 supplies defaults for the merge board, trains and
airport for a save that predates them; version 2 to 3 does the same for the town,
zoo and market. Both leave every other key untouched, and a save claiming a newer
version than the code understands is refused rather than half-loaded.</p>

<h3>The release, checked as an artifact</h3>

<p>The published release was verified by listing its actual assets rather than by
reading the workflow's own success label: a real installer executable, the full
package, and a release index, all targeting the exact commit the workflow built
from, marked neither draft nor prerelease. The installer reports as
<strong>not signed</strong>, which is this project's permanent policy rather than
a missing credential. See <a href="#/download">Download</a> for what that means
when you run it.</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'reachable',
      heading: 'Implemented is not the same as reachable',
      html: `
<p>This is the most important section in the article, and it is the one no
document in the repository stated plainly before this site existed. The gameplay
logic is finished and tested. The interface that would let a player touch most of
it is not. A reader who takes the test count at face value will form a picture of
this project that is more finished than the truth.</p>

<h3>Sixteen modules the running game never loads</h3>

<p>Walking the import graph outward from the application's entry point reaches
<strong>21 of the 37 source modules</strong>. The other sixteen — about
<strong>2,589 lines</strong> — are never imported by anything the game loads.
They pass their tests because the test tools import them directly, which is a
real and useful thing to know about them, and is not the same thing as their
being part of the game.</p>

<table>
  <thead><tr><th>Module</th><th>Lines</th><th>What it implements</th></tr></thead>
  <tbody>
    <tr><td>Co-op</td><td>282</td><td>Membership, daily tasks, perks, the request board</td></tr>
    <tr><td>Merge Meadow</td><td>220</td><td>The merge board: chains, energy, claims</td></tr>
    <tr><td>Regatta</td><td>218</td><td>The weekly race against simulated crews</td></tr>
    <tr><td>Laboratory</td><td>185</td><td>Permanent research and its multiplier merge point</td></tr>
    <tr><td>Decorating</td><td>181</td><td>Decorating mode and photo mode</td></tr>
    <tr><td>Expeditions</td><td>172</td><td>Crew hire, site launches, loot routed to the museum</td></tr>
    <tr><td>Helicopter</td><td>157</td><td>The third transport and fastest materials channel</td></tr>
    <tr><td>Mine</td><td>154</td><td>Tiered digs, ore and gem yields, artifact drops</td></tr>
    <tr><td>Minigames</td><td>149</td><td>Per-factory minigames — one of the two defining mechanics</td></tr>
    <tr><td>Collections</td><td>147</td><td>Collection books and building mastery</td></tr>
    <tr><td>Neighbours</td><td>142</td><td>The shared simulated-player pool</td></tr>
    <tr><td>Foraging</td><td>141</td><td>Free respawning world nodes</td></tr>
    <tr><td>Fishing</td><td>139</td><td>The cast-and-reel minigame and its chests</td></tr>
    <tr><td>Newspaper</td><td>128</td><td>Browsing neighbours' shops</td></tr>
    <tr><td>Islands</td><td>99</td><td>Island voyages</td></tr>
    <tr><td>Museum</td><td>75</td><td>Artifacts and exhibit completion</td></tr>
  </tbody>
</table>

<p>The Building Workshop used to sit on that list too — which meant the mechanic
the project describes as its main departure from its sources was implemented,
tested, and not connected to anything. It was wired to its panel in
<code>2b33dec</code>, with a dedicated regression suite added so it cannot
silently come loose again. The per-factory minigames, the other defining
mechanic, are still on the list.</p>

<h3>Five of twenty-two structure panels do something</h3>

<p>Systems in this game are meant to open by clicking their building in the
world — never from a menu, so that the map doubles as the roadmap. The world has
22 structures and each names a panel. The interface's dispatch has nine cases,
five of which correspond to a structure.</p>

<table>
  <thead><tr><th>Opens a real panel</th><th>Opens a placeholder</th></tr></thead>
  <tbody>
    <tr>
      <td>
        Barn · Silo · Order Board · Roadside Shop · Building Workshop
        <br><em>(plus the building queue, achievements, decorate and settings, which are not world structures)</em>
      </td>
      <td>
        Truck Bay · Boat Dock · Fishing Lake · Mine Entrance · Merge Meadow ·
        Market Stall · Train Station · Airport · Helicopter Pad · Museum ·
        Laboratory · Expedition Camp · Road to Town · Road to the Zoo ·
        Mailbox · Collections Shelf · Camera Tripod
      </td>
    </tr>
  </tbody>
</table>

<p>The seventeen on the right open, are correctly titled, and display a
"coming soon" body. The structure is clickable, the panel appears, and there is
nothing inside it. In most cases the module that would fill it is finished and
tested — it is simply not connected to the panel.</p>

<h3>The camera ceiling, reported rather than claimed closed</h3>

<p>This one is worth spelling out because it is a good example of a partial fix
described accurately instead of optimistically.</p>

<p>The camera clamps against a domain. At boot, that domain used to default to a
bare padded rectangle around the starting zone — so small that, verified
directly, exactly one of the 22 structures could ever be centred on screen, and
nine of them sat entirely outside it. A structure meant to loom derelict on the
map from level 5 as a preview of a level-90 system was, in practice, not
reachable by panning at all.</p>

<p>Commit <code>c1b74e4</code> widened the domain the boot sequence computes: it
now unions every structure's real position and footprint, plus the save's real
unlocked expansions, instead of a hard-coded empty list. Measured through the
focus routine directly, that takes reachability to <strong>17 of 22 structures at
boot zoom and all 22 once the player zooms in</strong>.</p>

<p>And then it says why that is not the end of it. The per-frame camera tick ends
with an unconditional clamp that takes <em>no</em> bounds argument, so it falls
back to the bare starting-zone domain on every single frame — before any pixel is
painted, confirmed out to 300 frames. Whatever richer domain the boot sequence
computes therefore survives only for the instant between boot and the first
frame. Dragging to pan does mutate the camera target, and the next tick clamps it
straight back.</p>

<p>The honest summary of that work: the worst-placed starting field moved from
226 pixels off-canvas, to 24, to 8 — real, measured improvement — and four of the
six starting fields are clear rather than six. That was reported as four, not as
six, and the remaining ceiling was named and left for the module that owns
it.</p>

<h3>Two more things the capture run recorded as unreachable</h3>

<ul>
  <li><strong>The co-op and regatta dock button never appears.</strong> It carries
  a hidden attribute in the markup and nothing in the source ever clears it. No
  interaction in that build reveals it.</li>
  <li><strong>There is no dark theme.</strong> The game ships exactly one visual
  palette. This documentation site has both; the game does not.</li>
</ul>

<div class="callout callout-info">
  <p>Everything in this section is pinned to the verified commit, and repair is
  actively in flight — two items that were in an earlier draft of this very
  section were fixed while it was being written. A claim here that no longer
  holds is a claim somebody closed, which is exactly the outcome the section
  exists to encourage.</p>
</div>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'corrections',
      heading: 'Corrections on the record',
      html: `
<p>Several conclusions reached earlier in this project turned out to be wrong.
They are kept here in full, with the reasoning rather than just the corrected
number, because the reasoning is the part that stops the same mistake being made
a fourth time. A record that quietly deletes its errors teaches nobody
anything.</p>

<h3>Three balance conclusions that were wrong because the metric was wrong</h3>

<ol>
  <li>
    <p><strong>A claimed twenty-times mid-game grind wall.</strong> An artefact of
    weighting one crop field the same as one building slot. Recomputed properly,
    the three progression bands come out at roughly 129, 721 and 1,883 hours — an
    ordinary curve, not a wall. No values needed changing; the measurement
    did.</p>
  </li>
  <li>
    <p><strong>The piecewise experience curve was sold as making the endgame
    reachable.</strong> It saves about 5%. The number of levels dominates the
    total, not the exponent. The curve stays because it is harmless, but it was
    not the fix it was claimed to be — and describing it as one would have sent
    the next person tuning the wrong dial.</p>
  </li>
  <li>
    <p><strong>"Spamming the cheapest crop breaks the late crops."</strong> True
    only for a player tapping every two minutes. At any realistic check-in cadence
    the late crops win by four to fourteen times. No values were changed; the
    reasoning now sits directly above the crop table in the source so it is not
    re-derived wrongly a fourth time.</p>
  </li>
</ol>

<div class="callout callout-warn">
  <p><strong>One correction cannot be applied where the error is.</strong> The
  commit that extended progression to level 95 still carries the wrong
  twenty-times figure in its message. Rewriting a commit message means rewriting
  history and force-pushing, which this project does not do to tidy up its own
  mistakes. The message stays wrong; this paragraph is the correction, and it
  travels with the documentation instead.</p>
</div>

<h3>A guard that claimed a safety property nobody had written</h3>

<p>The guard covering unsourced materials carried a comment reading, in effect,
"a material with no source is a wall" — while only the spend side had ever been
implemented. The earn side did not exist.</p>

<p>This is recorded as the most instructive finding of the whole audit, because
it is worse than having no guard at all. A comment asserting a check tells the
next reader the check exists, so they stop looking — and it does so most
effectively for the careful reader, the one who read the comment precisely
because they were being thorough. It was the second time in this project a
comment promised a safety property nobody wrote.</p>

<p>The earn-side guard now exists, and was itself verified by removing a material
from one of its two pools and confirming the guard is not fooled.</p>

<h3>A measurement that was counting something else</h3>

<p>The audit reported "70 recipes unlockable before their inputs". That number
was measuring a structural problem which is now closed: every recipe carries its
own unlock level, and the validator rejects any recipe whose unlock sits before
the true earliest availability of its inputs — zero violations on the current
data, and structurally guarded now rather than fixed once. What survives from that
finding is a much narrower point about two specific buildings, which is
<a href="#/changelog/open">still open</a> and is not the same problem.</p>

<h3>Documents that had drifted from the code</h3>

<table>
  <thead><tr><th>Claim</th><th>Where it appears</th><th>Correction</th></tr></thead>
  <tbody>
    <tr>
      <td>"147 passing assertions"</td>
      <td>The repository readme, the roadmap, the handoff</td>
      <td><strong>167 at the verified commit.</strong> Four commits added assertions after those documents were written: a dispatch-completeness guard, nine camera regression tests, more camera work, and a workshop interface suite. The count went 147, 148, 156, 167.</td>
    </tr>
    <tr>
      <td>"There are no screenshots or recordings"</td>
      <td>The repository readme, the roadmap</td>
      <td><strong>47 captures exist</strong> and are committed, with a manifest recording the method and every surface that could not be reached.</td>
    </tr>
    <tr>
      <td>The Windows installer uses NSIS</td>
      <td>The original plan document</td>
      <td>NSIS was never shipped. The installer is, and always was, Squirrel.Windows. Corrected in the plan itself.</td>
    </tr>
    <tr>
      <td>The implementation lands on a branch behind a draft pull request</td>
      <td>The original plan document</td>
      <td>It did not. Every implementation commit went directly to the default branch. Recorded so nobody goes looking for a branch that does not exist.</td>
    </tr>
    <tr>
      <td>"as of commit 013509a"</td>
      <td>The handoff document</td>
      <td>Written accurately, then overtaken by more than a dozen commits, several of which fixed visible defects. The handoff is a snapshot; this article is the moving record.</td>
    </tr>
    <tr>
      <td>The Workshop panel runs the kit-crafting chain</td>
      <td>Implied by the project's own description of its defining mechanic</td>
      <td>It did not until <code>2b33dec</code>. Until then it sold buildings for coins — performing the exact mechanic the crafting chain was designed to replace.</td>
    </tr>
  </tbody>
</table>

<h3>Two verification lessons that produce false confidence</h3>

<p>Both came out of the font vendoring work, and both are the same shape: a green
result about the wrong thing.</p>

<ul>
  <li>The browser's own font-availability check returned true for all eight
  weights while <strong>zero</strong> faces were actually registered. It cannot be
  trusted on its own.</li>
  <li>A probe reported a network error that looked like a genuine loading failure.
  The filename had been guessed rather than read off disk. The tool was right; the
  input was wrong.</li>
</ul>

<p>The same shape recurs throughout this project's history. A green result about
the wrong thing costs far more than a red result about the right one, because
nobody goes looking for it.</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'open',
      heading: 'Deliberately open',
      html: `
<p>The items below are known, bounded, and unaddressed on purpose. Each says what
would settle it. Nothing here is a surprise waiting to be discovered.</p>

<h3>Content and balance</h3>

<h4>Two buildings open before they can do anything</h4>

<p>The tea house unlocks at level 56; its earliest usable recipe unlocks at 62.
The oil press unlocks at 52; its earliest recipe at 55. A six-level and a
three-level gap in which the building exists, can be entered, and does nothing.
Both were re-derived directly from the current content tables rather than taken
from an older note.</p>

<p>No validator guard covers this, which is why it persists. The guard that does
exist checks that a recipe's inputs are available before the recipe is — not that
a building has at least one usable recipe on the day it opens. Those are different
invariants, and only one of them is written down as code.</p>

<h4>Multi-hop crafting arbitrage: reduced, not proven eliminated</h4>

<p>The original concern was that a player could craft workshop components at a
loss and sell the resulting kit at a large profit. The single-hop check now
passes cleanly: <strong>0 of 128 recipes have a non-positive margin</strong>
among non-sink recipes, down from 45. The 41 workshop component and kit recipes
are explicitly tagged as sinks — goods meant to be consumed rather than resold —
and exempted from the margin check by design. Checked directly against a
single-hop comparison, 40 of those 41 cost more to craft than they would fetch
sold; one, a roof shingle, still nets a small surplus of 5 coins.</p>

<p><strong>What has not been done</strong> is re-simulating the full chain end to
end — raw materials through components to a finished kit, summing real material
cost rather than component resale price. The original scenario specifically was
not re-run. This is reported as <em>very likely closed</em> and <em>not proven
closed</em>, and those are different claims.</p>

<h4>Numbers taken from secondary sources</h4>

<p>The regatta league reward tables, the town's community buildings past level 70,
and the per-expansion land costs were sourced from community wiki text and images
and taken at face value. They were never independently re-derived. They are
plausible and internally consistent; they are not verified.</p>

<h3>Interface</h3>

<p>Everything in <a href="#/changelog/reachable">the reachability section</a>
belongs here too and is not repeated: sixteen unwired modules, seventeen
placeholder panels, the per-frame camera clamp that discards the wider domain the
boot sequence computes, the hidden co-op button, and the absent dark theme. That
section is the detailed version; this is the pointer to it.</p>

<h3>Tooling</h3>

<h4>The line counter has a blind spot, and reports it</h4>

<p>Eighty-two tracked files match no area rule in the committed counter and are
therefore in neither the project total nor the excluded list — including this
documentation site's own application code, its vendored fonts, and the release
workflow. The counter prints that fact and names the first twenty of them, which
is the right behaviour for a tool that cannot classify something. The rules
themselves have not been extended to cover them. A total with a silent omission
would be worse; a total with a named omission is still incomplete.</p>

<h4>Design directions kept as reference</h4>

<p>Three alternative interface directions and an interactive prototype remain in
the design folder, reference-only by intent. One direction shipped; the others
were never meant to ship alongside it. This is recorded so the folder does not
read as unfinished work to whoever finds it next.</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'releases',
      heading: 'The release record',
      html: `
<p>Every push to the default branch builds and publishes a Windows release. The
pipeline does not run the test suite, and that is a deliberate standing policy
rather than an oversight: the workflow builds, packages and publishes, while the
test suite is the local gate run before every push. It is written into the
workflow as a comment so nobody helpfully adds one back.</p>

<p>The trade is worth stating plainly rather than glossing. With no gate in the
pipeline, a release can be published from a commit whose tests would have failed.
In exchange, an artifact reaches people on every push, unconditionally, and a
bookkeeping failure can never withhold a build that already succeeded.</p>

<h3>What a run does</h3>

<ol>
  <li>Records a start timestamp, checks out, installs, and determines a unique
  release tag — so no prior release is ever recycled or overwritten.</li>
  <li>Builds the Squirrel.Windows installer, then <strong>verifies the packaging
  output is unsigned</strong>. Code signing is permanently prohibited on this
  project, so that check exists to catch a signer being invoked, not to catch one
  being missing.</li>
  <li>Generates release notes and publishes a non-draft release with the
  installer, the package and the release index attached.</li>
  <li>Only then commits the code-name ledger. The order matters: the ledger is a
  record <em>of</em> the release, never an input to it, so a transient failure in
  the bookkeeping step can no longer prevent a release that already built from
  existing. It used to run the other way round.</li>
  <li>Collects and uploads artifacts unconditionally, including on failure, so a
  failed run still leaves evidence behind rather than only a red mark.</li>
</ol>

<h3>Named releases</h3>

<p>Each release takes a dim sum code name, used once per project so a name never
becomes ambiguous between two builds. The ledger records seventeen, spanning
build 2 through build 26. Eight build numbers in that range have no entry —
pushes whose run never reached the ledger step, including the earliest ones,
fixed by the two workflow repairs described below.</p>

<table>
  <thead><tr><th>Commit</th><th>Code name</th></tr></thead>
  <tbody>
    <tr><td><code>2c8fb95</code></td><td>Classic Har Gow · 蝦餃</td></tr>
    <tr><td><code>01a1cac</code></td><td>Scallop Har Gow · 帶子蝦餃</td></tr>
    <tr><td><code>62f4439</code></td><td>Bamboo Shoot Har Gow · 筍尖蝦餃</td></tr>
    <tr><td><code>4047c07</code></td><td>Crab Roe Har Gow · 蟹籽蝦餃</td></tr>
    <tr><td><code>2c5a3eb</code></td><td>Chive Shrimp Dumpling · 韭菜蝦餃</td></tr>
    <tr><td><code>d12ce45</code></td><td>Spinach Shrimp Dumpling · 菠菜蝦餃</td></tr>
    <tr><td><code>aad59b3</code></td><td>Pea Shoot Shrimp Dumpling · 豆苗蝦餃</td></tr>
    <tr><td><code>ee6d8b0</code></td><td>Lobster Dumpling · 龍蝦餃</td></tr>
    <tr><td><code>013509a</code></td><td>Dried Scallop Shrimp Dumpling · 瑤柱蝦餃</td></tr>
    <tr><td><code>375952d</code></td><td>Cuttlefish Shrimp Dumpling · 墨魚蝦餃</td></tr>
    <tr><td><code>05fb31f</code></td><td>Classic Siu Mai · 燒賣</td></tr>
    <tr><td><code>1c117c5</code></td><td>Crab Roe Siu Mai · 蟹籽燒賣</td></tr>
    <tr><td><code>556fe8f</code></td><td>Quail Egg Siu Mai · 鵪鶉蛋燒賣</td></tr>
    <tr><td><code>a7ebd77</code></td><td>Scallop Siu Mai · 帶子燒賣</td></tr>
    <tr><td><code>5a18cf7</code></td><td>Beef Siu Mai · 牛肉燒賣</td></tr>
    <tr><td><code>2b33dec</code></td><td>Chicken Siu Mai · 雞肉燒賣</td></tr>
    <tr><td><code>c1b74e4</code></td><td>Mushroom Siu Mai · 北菇燒賣</td></tr>
  </tbody>
</table>

<h3>Two workflow repairs worth remembering</h3>

<p>The first attempts at the pipeline failed for reasons that had nothing to do
with the build. One had literal backslash-n text where line breaks were meant,
breaking two multi-line shell commands. The other had Windows line endings
breaking a shell line continuation. Both look entirely correct when read and fail
only at run time, which is the category of defect that costs the most attempts to
diagnose and the least effort to fix.</p>

<div class="callout callout-warn">
  <p><strong>The installer is unsigned, permanently.</strong> Not a missing
  certificate, not a to-do item. Windows will show an unknown-publisher warning
  when you run it, and that warning is expected and correct. Nothing about the
  installer is signed, verified for authenticity, or claimed to be. See
  <a href="#/download">Download</a> for the details.</p>
</div>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'record-keeping',
      heading: 'How this record is kept',
      html: `
<p>Six rules govern everything above. They are written down because the value of
a project record is entirely in whether a reader can trust it without checking
it, and that trust is built by the boring cases rather than the dramatic
ones.</p>

<h3>A tick is a verified claim</h3>

<p>An item is marked done when somebody checked it — by running the suite, by
loading the running application, or by reading the code that implements it — not
when it was written and assumed to work. Work that exists but is unverified stays
unticked, with its real state named beside it. A checklist full of optimistic
ticks is worse than no checklist, because it is the one document a new reader
trusts to tell them what is left.</p>

<h3>Corrections stay on the record</h3>

<p>A wrong conclusion is corrected in place, with the reasoning that produced it
preserved. Deleting an error removes the only evidence of why it was convincing,
and the next person then finds it convincing too. Three balance conclusions, a
guard comment that lied, a misinterpreted count and a plan that did not survive
contact with reality are all still here for exactly that reason.</p>

<h3>Some things cannot be corrected where they went wrong</h3>

<p>A commit message is immutable without rewriting history, and this project does
not force-push to tidy its own mistakes. Where a message is wrong, it stays wrong
and the correction lives in the documentation instead. That is the honest trade
rather than the tidy one.</p>

<h3>Defects are captured, not patched around</h3>

<p>The screenshot pass photographed the shipped build's real behaviour, including
two defects it deliberately did not fix first — and photographing them is what
got them fixed. A capture matrix that quietly avoids the broken surfaces is a
marketing gallery. The manifest also records every surface that could
<em>not</em> be reached, with the exact reason, so an absence reads as a recorded
fact rather than an oversight.</p>

<h3>Claims are pinned to a commit</h3>

<p>A verdict binds to the exact commit it was measured at. Where a document says
"as of" some commit, that is a snapshot and it will drift. This article is
written to be the moving record: it is refreshed against the working tree rather
than against the other documents, and where the two disagree, the code
decides.</p>

<h3>Everything a reader needs is in the site</h3>

<p>The plan, the handoff, the roadmap, the changelog, the audit findings and the
release history are all rendered here rather than linked to a code host. The only
links that leave this site are the installer downloads.</p>

<p>Nothing on any page of it is fetched from another origin — no content delivery
network, no remote fonts, no analytics, no third-party anything. The typefaces
are vendored into the site's own folder, which is why there are 27 font files
rather than two: a single family query returns 27 faces across weights and
character-range subsets, and hand-picking "two fonts" would have shipped two
files and silently dropped every non-Latin subset.</p>
`,
    },
  ],

  related: ['architecture', 'getting-started', 'download'],
};

export default article;
