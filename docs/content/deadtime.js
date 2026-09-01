/* ---------------------------------------------------------------------------
 * Between Timers — foraging, collections, decorating, achievements, the daily
 * wheel, visitors, pets and the whole event calendar.
 *
 * Every figure in this article was read out of src/data.js, src/foraging.js,
 * src/collections.js, src/decorate.js and src/extras.js rather than from any
 * design document, and simulated results are stated as simulations.
 *
 * Content counts come from ./data-counts.js, a generated module — never typed here.
 * ------------------------------------------------------------------------ */

import { COUNTS } from './data-counts.js';

export const article = {
  id: 'deadtime',
  title: 'Between Timers',
  group: 'Downtime',
  summary:
    'Everything the farm gives you to do while the crops, the ovens and the trains are all still counting down: free forage nodes, collection books, decorating, achievements, the daily wheel, visitors, pets and the event calendar.',

  sections: [
    {
      id: 'why',
      heading: 'The problem: everything is a timer',
      html: `
<p>A farm game is a machine for making you wait. Wheat takes minutes, bread takes
longer, a train takes longer still, and the moment you have set every timer running
there is genuinely nothing left to press. That gap is the whole design problem this
part of the game exists to solve, and it is not one gap but several of very
different lengths.</p>

<p>The systems on this page are the answer, and they are deliberately spread across
those lengths. None of them gate progress. You can ignore every single one and still
finish the level curve; what you cannot do is enjoy the two minutes between opening
the app and the first oven finishing, which is exactly the moment most people close
a farm game for good.</p>

<h3>The gap taxonomy</h3>

<table>
  <caption>Which filler is aimed at which gap, and what it costs</caption>
  <thead>
    <tr><th>Gap</th><th>System</th><th>Cost to the player</th><th>Module</th></tr>
  </thead>
  <tbody>
    <tr><td>Seconds — you just opened the app</td><td>Forage nodes</td><td>Nothing at all</td><td><code>src/foraging.js</code></td></tr>
    <tr><td>Seconds — once a day</td><td>Daily wheel, feeding a pet</td><td>Nothing; the pet costs 2,000 coins once</td><td><code>src/extras.js</code></td></tr>
    <tr><td>A minute or two</td><td>Newspaper browsing, a visitor offer</td><td>Coins, if you buy</td><td><code>src/newspaper.js</code>, <code>src/extras.js</code></td></tr>
    <tr><td>An evening</td><td>Weekend and mini events</td><td>Nothing beyond what you were doing anyway</td><td><code>src/extras.js</code></td></tr>
    <tr><td>A week</td><td>The Farm Fair</td><td>Nothing; the tasks track what you already do</td><td><code>src/extras.js</code></td></tr>
    <tr><td>Months</td><td>Collection books, building mastery, achievements</td><td>Nothing; they observe play</td><td><code>src/collections.js</code>, <code>src/extras.js</code></td></tr>
    <tr><td>Unbounded</td><td>Decorating and photo mode</td><td>Coins for the decorations you buy</td><td><code>src/decorate.js</code></td></tr>
  </tbody>
</table>

<p>The last row is the important one. Decorating is the only filler here that never
runs out, because the player supplies the goal rather than the game. Everything
above it eventually exhausts itself: you find every fish, you master every building,
you unlock the last achievement. A farm you are still rearranging at level 95 is a
farm you are still opening.</p>

<div class="callout callout-info">
<p><strong>A shared rule.</strong> Every system on this page stores its deadlines as
absolute wall-clock <code>readyAt</code> timestamps in milliseconds, never as
countdowns. A forage bush that respawns in twenty minutes stores the instant it will
be ready, so closing the game and coming back tomorrow resolves correctly with no
catch-up loop. The same convention holds across the whole codebase.</p>
</div>

<h3>Two things dead time is not allowed to be</h3>

<p><strong>It is not a second economy.</strong> Foraging pays out in ordinary goods
that go into the ordinary barn and sell for their ordinary price. The wheel pays
coins, diamonds and construction materials you could obtain elsewhere. Nothing here
mints a currency of its own, so nothing here can inflate the game it sits inside.</p>

<p><strong>It is not a tax.</strong> There is no forage node that rots, no pet that
sulks, no streak whose loss costs you something you had. The daily wheel streak
resets to 1 and the wheel still spins. Missing a Farm Fair costs you a ribbon you
never had. Punishing absence is how a filler turns into an obligation, and an
obligation is not a filler.</p>
`,
    },

    {
      id: 'foraging',
      heading: 'Foraging: the one thing that is free',
      html: `
<p>Free is the entire point. Every other activity in the game has a price at the
door: the mine wants tools, Merge Meadow wants energy, fishing has cast times and
per-spot cooldowns, the shop wants stock. That left a player with two idle minutes
holding nothing they could actually spend them on. Forage nodes cost nothing, need
nothing, and are simply tapped.</p>

<p>They are ordinary world objects — a wildflower patch, a berry bush, a driftwood
pile — that appear on open tiles inside your unlocked land, sit there until you pick
them, and then start their own respawn timer. <code>FORAGING.unlockLevel</code> is
<strong>1</strong>, so the first two node types are available from the very first
minute of a new farm, before the order board, before the shop, before anything.</p>

<h3>The nodes</h3>

<table>
  <caption>Every forage node, its respawn, and what it is worth. Expected coin values
  are computed from the yield weights and the base sell prices in <code>GOODS</code>;
  they ignore any sell-price multiplier.</caption>
  <thead>
    <tr>
      <th>Node</th><th>Level</th><th>Respawn</th><th>Max active</th>
      <th>Yields (chance)</th><th>Coins per pick</th><th>Coins per hour at cap</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><code>wildflower_patch</code><br>Wildflower Patch</td><td>1</td><td>20 min</td><td>3</td><td>Wildflower x1–3 (70%)<br>Wild Berries x1–2 (30%)</td><td>30.5</td><td>275</td></tr>
    <tr><td><code>berry_bush</code><br>Berry Bush</td><td>1</td><td>30 min</td><td>3</td><td>Wild Berries x1–3 (80%)<br>Wildflower x1 (20%)</td><td>32.0</td><td>192</td></tr>
    <tr><td><code>driftwood_pile</code><br>Driftwood</td><td>4</td><td>60 min</td><td>2</td><td>Driftwood x1–2 (85%)<br>Mushroom x1 (15%)</td><td>31.9</td><td>64</td></tr>
    <tr><td><code>mushroom_ring</code><br>Mushroom Ring</td><td>9</td><td>90 min</td><td>2</td><td>Mushroom x1–3 (90%)<br>Wild Honey x1 (10%)</td><td>51.6</td><td>69</td></tr>
    <tr><td><code>birds_nest</code><br>Bird's Nest</td><td>14</td><td>150 min</td><td>2</td><td>Down Feather x1–2 (75%)<br>Egg x1 (25%)</td><td>40.8</td><td>33</td></tr>
    <tr><td><code>wild_hive</code><br>Wild Hive</td><td>23</td><td>240 min</td><td>1</td><td>Wild Honey x1–2 (80%)<br>Honey x1 (20%)</td><td>69.2</td><td>17</td></tr>
  </tbody>
</table>

<p>Read the last column carefully, because it is the balance decision that keeps
foraging honest. The <em>rarest</em> node is worth the most per pick and the
<em>least</em> per hour. A Wild Hive pays about 69 coins but returns once every four
hours and only one can exist, so it contributes roughly 17 coins an hour; three
wildflower patches on a twenty-minute cycle contribute about 275. Foraging pays you
for showing up often, not for owning the good nodes, which is precisely the
behaviour a short-gap filler wants to reward.</p>

<p>Two of the yields are not wild produce at all. A Bird's Nest can drop an ordinary
<code>egg</code> and a Wild Hive an ordinary <code>honey</code> — the same items the
chicken coop and the beehive make. That is deliberate: it gives the hedgerows a
faint chance of unblocking a recipe you are one ingredient short on.</p>

<h3>How a pick actually resolves</h3>

<p><code>collectNode(nodeId, now)</code> in <code>src/foraging.js</code> does five
things in order:</p>

<ol>
  <li>Refuses if the node does not exist, or if <code>readyAt</code> is still in the
      future. There is no partial or early pick.</li>
  <li>Rolls the yield table by weight. The weights are relative, not percentages —
      the wildflower patch's 70 and 30 sum to 100 by coincidence, and
      <code>weightedPick</code> divides by whatever they actually sum to.</li>
  <li>Rolls a quantity inside the yield's range, inclusive at both ends, then
      <strong>clamps it to the free space left in the barn</strong>.</li>
  <li>Pays <code>FORAGING.xpPerPickup</code>, which is <strong>1</strong>.</li>
  <li>Sets <code>readyAt = now + respawn * 1000</code>.</li>
</ol>

<div class="callout callout-warn">
<p><strong>Picking into a full barn burns the node.</strong> Step 3 clamps the
quantity to the room available, and if that clamp reaches zero the item is simply not
added — but steps 4 and 5 still run, so you get the 1 XP and the node resets its timer
with nothing to show for it. This differs from the newspaper, where
<code>buy()</code> refuses a purchase outright when the barn cannot take it. Worth
knowing before you tap a Wild Hive with a full barn.</p>
</div>

<p>Everything foraged goes to the <strong>barn</strong>, not the silo. The silo holds
crops and seeds; wild berries, mushrooms, driftwood, down feathers, wildflowers and
wild honey are all barn goods.</p>

<h3>Where nodes appear, and how many</h3>

<p><code>tick(now)</code> is the spawner. For each unlocked node type that is below
its own <code>maxActive</code>, it looks for a free tile and places one. A tile is
free when it is inside your start zone or an unlocked expansion, holds no farm
object, is not covered by one of the fixed world structures, and has no other node on
it already. The search is a bounded random probe — up to 200 attempts — rather than
an exhaustive scan, because it only ever needs to find one tile and the farm grid is
large.</p>

<p>Three separate ceilings apply:</p>

<ul>
  <li><code>FORAGING.globalMaxActive</code> is <strong>8</strong>: the total number of
      nodes that can exist at once, across all types.</li>
  <li>Each type's own <code>maxActive</code>, which sum to 13 — deliberately more than
      the global cap, so the global cap is the one that binds. The data validator
      asserts this ordering, refusing a <code>globalMaxActive</code> larger than the
      node table could ever produce.</li>
  <li><code>FORAGING.offlineRespawnCap</code> is <strong>3</strong>, which stops a
      single call placing more than three nodes.</li>
</ul>

<div class="callout callout-info">
<p><strong>An honest note on that third cap.</strong> Its name suggests it bounds how
much accrues while you are away, and in practice it does not quite do that: it caps
one <em>call</em>, and the tick function is designed to be called from the game loop,
so a few consecutive frames refill the board to the global maximum anyway. The thing
that genuinely stops a fortnight's absence carpeting the farm in free goods is
<code>globalMaxActive</code> plus the per-type caps — you come back to at most eight
nodes however long you were gone. The test suite's assertions reflect this: they check
the global and per-type ceilings still hold after thirty consecutive ticks.</p>
</div>

<h3>At level 1, and later</h3>

<p>A brand-new farm has only <code>wildflower_patch</code> and
<code>berry_bush</code> unlocked, so at most six nodes can exist. The board fills out
as you level: driftwood at 4, mushroom rings at 9, nests at 14, and the single wild
hive at 23. By 23 the global cap of eight is doing real work — the node types could
support thirteen between them, so which eight you are actually holding depends on the
order the spawner got to them.</p>
`,
    },

    {
      id: 'collections',
      heading: 'Collection books, derived rather than listed',
      html: `
<p>Five books, unlocked at level 10 from the Collections Shelf in the world. Each one
tracks which members of some family of things you have encountered, and pays out a
reward every few entries. They are the long-gap counterpart to foraging: nothing you
do for them, everything you notice afterwards.</p>

<p>The single most important thing about them is architectural rather than mechanical.
<strong>A book's entries are derived from the live data tables at read time, never
hand-listed.</strong> <code>src/collections.js</code> holds a small
<code>SOURCES</code> map of functions, and <code>bookEntries(bookId)</code> calls the
one its book names:</p>

<pre><code>const SOURCES = {
  crops:     () =&gt; Object.keys(CROPS),
  recipes:   () =&gt; every recipe id across every building,
  fish:      () =&gt; [...FISHING.species],
  forage:    () =&gt; every item any forage node can yield,
  artifacts: () =&gt; every artifact listed by a museum exhibit,
};</code></pre>

<p>Add a twenty-third crop to <code>CROPS</code> and the Crop Almanac has twenty-three
entries that afternoon, with no second edit anywhere. This is the same reasoning that
governs the rest of the content pipeline: content lives in one table and every system
reads it, so nothing can quietly drift out of date.</p>

<h3>The five books</h3>

<table>
  <caption>Book sizes are the live derived counts at the commit this article
  documents; they move whenever the underlying table does.</caption>
  <thead>
    <tr><th>Book</th><th>Source table</th><th>Entries today</th><th>Reward every</th><th>Reward</th><th>Full-book payout</th></tr>
  </thead>
  <tbody>
    <tr><td><code>crop_almanac</code><br>Crop Almanac</td><td><code>CROPS</code></td><td>22</td><td>4 entries</td><td>4,000 coins + 1 diamond</td><td>5 tiers — 20,000 coins, 5 diamonds</td></tr>
    <tr><td><code>recipe_book</code><br>Recipe Book</td><td>every building recipe</td><td>128</td><td>10 entries</td><td>8,000 coins + 2 diamonds</td><td>12 tiers — 96,000 coins, 24 diamonds</td></tr>
    <tr><td><code>fish_book</code><br>Fishing Log</td><td><code>FISHING.species</code></td><td>14</td><td>3 entries</td><td>6,000 coins + 2 diamonds</td><td>4 tiers — 24,000 coins, 8 diamonds</td></tr>
    <tr><td><code>forage_journal</code><br>Forage Journal</td><td>forage node yields</td><td>8</td><td>2 entries</td><td>3,000 coins + 1 diamond</td><td>4 tiers — 12,000 coins, 4 diamonds</td></tr>
    <tr><td><code>relic_catalogue</code><br>Relic Catalogue</td><td>museum exhibit artifacts</td><td>24</td><td>4 entries</td><td>20,000 coins + 5 diamonds</td><td>6 tiers — 120,000 coins, 30 diamonds</td></tr>
  </tbody>
</table>

<p>Note that the Forage Journal has eight entries, not six — it counts the distinct
<em>items</em> the nodes can yield, and the six node types share items between them
while two of them can drop farm produce. Its two-entry reward tier makes it the
fastest book to see a payout from, which suits a book you fill by tapping bushes.</p>
<figure class="shot">
  <img src="./screenshots/32-panel-bookshelf.webp" alt="A sliding panel titled Collections reading that the Collections Shelf is being built — check back soon."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>The Collections Shelf.</strong> The collections module was implemented at that commit, and this panel opened on the placeholder.</figcaption>
</figure>
`,
    },

    {
      id: 'claiming',
      heading: 'Filling a book, and claiming its tiers',
      html: `
<p>There are no per-entry rewards. A book pays by <em>tier</em>, and a tier is
<code>rewardPer</code> entries found:</p>

<pre><code>tiersEarned = floor(found.length / rewardPer)
claimable   = max(0, tiersEarned - alreadyClaimed)</code></pre>

<p><code>claim(bookId)</code> pays every outstanding tier at once and adds that count
to <code>claimed</code>. A worked example with the Crop Almanac, whose
<code>rewardPer</code> is 4:</p>

<ul>
  <li>You have grown 11 distinct crops. <code>tiersEarned</code> is
      <code>floor(11 / 4)</code> = 2. You have claimed none, so
      <code>claimable</code> is 2.</li>
  <li>Claiming pays 4,000 x 2 = <strong>8,000 coins</strong> and 1 x 2 =
      <strong>2 diamonds</strong>, and sets <code>claimed</code> to 2.</li>
  <li>The twelfth crop makes <code>tiersEarned</code> 3, so one more tier becomes
      claimable. Claiming again with nothing outstanding returns 0 and pays
      nothing.</li>
</ul>

<p><code>record(bookId, entryId)</code> is idempotent by construction: it refuses an
unknown book, refuses an entry the book cannot contain, and returns
<code>false</code> without touching anything if the entry is already recorded. Your
fortieth trout changes nothing.</p>

<h3>What the validator guarantees</h3>

<p>Two failure modes here are invisible rather than loud, so the data validator in
<code>tools/validate-data.mjs</code> hunts them specifically:</p>

<ul>
  <li><strong>A book that derives nothing.</strong> A typo in <code>source</code>, or
      a source table that has been emptied, would render as a blank page with no error
      anywhere in the game. The validator fails the build.</li>
  <li><strong>A first reward that can never be reached.</strong> If
      <code>rewardPer</code> exceeds the number of entries the source can derive, the
      book advertises a reward nobody can earn. The validator fails on that too.</li>
</ul>

<p>One small inconsistency worth recording honestly: the module derives the relic
catalogue from the artifacts listed by <code>MUSEUM.exhibits</code>, while the
validator derives it from the keys of <code>ARTIFACTS</code>. Both produce the same 24
entries at present, and nothing asserts that they must keep agreeing. If an artifact
were ever added to <code>ARTIFACTS</code> without being placed in an exhibit, the
validator would see it and the book would not.</p>
`,
    },

    {
      id: 'mastery',
      heading: 'Building mastery',
      html: `
<p>Mastery is the reward for repetition. Every completed production run on a building
counts toward that building's own star tier, and the tiers shave a permanent
percentage off how long that kind of production takes. It is the quietest progression
in the game — you never do anything for it — and over hundreds of hours it is one of
the larger multipliers you accumulate.</p>

<table>
  <caption>The four mastery tiers, from <code>MASTERY.tiers</code></caption>
  <thead>
    <tr><th>Star</th><th>Completed makes</th><th>Bonus</th><th>Meaning</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>50</td><td>0.98</td><td>2% faster</td></tr>
    <tr><td>2</td><td>200</td><td>0.96</td><td>4% faster</td></tr>
    <tr><td>3</td><td>600</td><td>0.93</td><td>7% faster</td></tr>
    <tr><td>4</td><td>1,500</td><td>0.90</td><td>10% faster</td></tr>
  </tbody>
</table>

<p>The effect key is <code>productionTimeMult</code>, which is a multiplier
<em>below</em> one — a stronger tier is a smaller number. That inversion is exactly the
sort of thing that gets written backwards once and never noticed, so the validator
asserts both directions: <code>makes</code> must ascend from tier to tier, and
<code>bonus</code> must strictly decrease.</p>

<h3>Why the merge is multiplicative across buildings</h3>

<p><code>masteryEffect()</code> returns a complete object over the shared
<code>EFFECT_KEYS</code> set with every key neutral at 1, and moves only
<code>MASTERY.effect</code>. Its value is the product of every mastered building's
current bonus:</p>

<pre><code>merged = 1;
for (const buildingId of Object.keys(state.collections.mastery)) {
  merged *= masteryOf(buildingId).bonus;
}</code></pre>

<p>So a farm with the bakery at star 2, the dairy at star 2 and the feed mill at star 1
carries 0.96 x 0.96 x 0.98 = <strong>0.9032</strong> — very nearly 10% off, from three
buildings none of which has reached its own best tier. A wide, well-worn farm
compounds. An unmastered building contributes exactly 1 and never
<code>undefined</code>, which is what lets callers merge this object blindly without
branching on missing keys.</p>

<p>That completeness matters because mastery is not the only thing producing an effect
object. Laboratory research and the per-factory minigames produce the same shape over
the same closed key set, and they all meet at one merge point rather than three.
Adding a new effect means adding one member to <code>EFFECT_KEYS</code>; the validator
refuses a <code>MASTERY.effect</code> that is not in that set.</p>

<p><code>masteryOf(buildingId)</code> also reports the road ahead —
<code>makes</code>, the current <code>star</code>, the live <code>bonus</code>, and a
<code>nextTier</code> carrying the star, its make count and how many remain — so a
mastery display never has to recompute the tier boundaries itself.</p>
`,
    },

    {
      id: 'decorating',
      heading: 'Decorating: the filler that never runs out',
      html: `
<p>Every other system on this page ends. You catch the last fish, you master the last
building, the fair hands out its last ribbon. Decorating does not end, because the goal
is not in the data — it is whatever the player has decided their farm should look like.
That is the whole justification for building it properly rather than shipping a drag
handle and calling it done.</p>

<div class="callout callout-info">
<p><strong>The one declared exception to a house rule.</strong> Everywhere else in this
game, a system opens by clicking its structure in the world: the shelf opens the
collection books, the tripod opens photo mode, the mailbox opens the newspaper.
Decorating has no structure because it is a <em>mode over the whole world</em>, not a
place in it — there is no building called "rearranging things" — so it is the one
system that toggles from the dock instead. The exception is written down in both the
data table and the module header so nobody later reads it as an oversight.</p>
</div>

<h3>What the mode does</h3>

<p><code>DECORATE</code> declares <code>gridSnap</code>, four <code>rotations</code>,
an <code>undoDepth</code> of <strong>50</strong> and a <code>multiSelectMax</code> of
<strong>40</strong>. The module implements enter and exit, additive selection, a
tile-delta move, rotation, and full undo and redo.</p>

<p><strong>Moves are atomic across the whole selection.</strong> This is the reason
<code>decorate.js</code> carries its own footprint and rectangle-free helpers rather
than reusing the single-object placement check in <code>farm.js</code>: a multi-select
move has to validate every object against a world in which <em>all</em> of the moved
objects are ignored at once. Drag a row of four fences one tile left and each one lands
where its neighbour used to be; checking them one at a time would reject the whole move
on a collision that will not exist by the time the move completes. So the implementation
computes every target first, tests each against the world minus the entire selection,
and refuses the whole move if any single target is invalid.</p>

<h3>Undo and redo</h3>

<p>History is a list of entries, each of which is a set of per-object
<code>{ before, after }</code> snapshots of <code>x</code>, <code>y</code> and
<code>rotation</code>. A move or a rotation pushes one entry containing every affected
object, so undo restores the whole gesture rather than one fence at a time.</p>

<ul>
  <li><code>pushHistory</code> truncates anything after the current index before
      pushing, which is the standard behaviour: doing something new after an undo
      discards the redo branch.</li>
  <li>Past <code>undoDepth</code> the oldest entry is shifted off and the index
      adjusted, so the list stays bounded at ${COUNTS.decorateUndoDepth} gestures.</li>
  <li>A refused move pushes nothing at all, so an invalid drag never leaves a no-op
      step in the history for you to undo twice.</li>
</ul>

<h3>Three honest limits</h3>

<p>The module and its data table do not quite agree in three places, none of which
breaks anything, all of which are worth knowing:</p>

<ul>
  <li><strong><code>multiSelectMax</code> is declared but not enforced.</strong>
      <code>select(objectId, true)</code> appends without consulting it, so a selection
      can exceed ${COUNTS.decorateMultiSelectMax} objects. The cap is a stated intent waiting for the selection
      interface to honour it.</li>
  <li><strong><code>gridSnap</code> is not read.</strong> It is true by construction
      rather than by policy: <code>move(dx, dy)</code> takes integer tile deltas, so
      there is no sub-tile position for it to snap.</li>
  <li><strong>Rotation is presentational.</strong> <code>rotate()</code> advances
      <code>obj.rotation</code> by ninety degrees and pushes history, but the footprint
      helper ignores rotation entirely — a 3x1 orchard row still occupies 3x1 after a
      quarter turn, and the rotation is not re-validated for fit. If rotation is ever
      made to swap width and height, that check has to be added in the same change.</li>
</ul>

<p>One more: <code>enter()</code> and <code>exit()</code> set and clear
<code>state.decorate.active</code>, but <code>move</code>, <code>rotate</code>,
<code>undo</code> and <code>redo</code> do not check the flag. They work whether the
mode is on or not. The flag is for the interface to read, not a guard the module
enforces on itself.</p>

<h3>The decoration catalogue</h3>

<p><code>DECORATIONS</code> holds <strong>${COUNTS.decorations}</strong> entries, and the interesting rule
about them is not what they look like but how you are allowed to get one. Every
decoration must have <strong>exactly one</strong> route:</p>

<table>
  <caption>How the ${COUNTS.decorations} decorations are obtained</caption>
  <thead><tr><th>Route</th><th>Count</th><th>Examples</th></tr></thead>
  <tbody>
    <tr><td>Coins, always available</td><td>${COUNTS.decorationsCoinAlways}</td><td>Wooden Fence 30, Windmill 3,000, Hedge Maze 6,800</td></tr>
    <tr><td>Coins, but only in season</td><td>${COUNTS.decorationsCoinSeasonal}</td><td>Snowman 600, Pumpkin Pile 450, Red Lanterns 480</td></tr>
    <tr><td>Boat vouchers</td><td>${COUNTS.decorationsVoucher}</td><td>Topiary Horse 15, Koi Pond 30, Glass House 38</td></tr>
    <tr><td>Event rewards</td><td>${COUNTS.decorationsEventOnly}</td><td>Bunting Fence, Festival Tent, the three Fair trophies</td></tr>
    <tr><td>Subsystem flags</td><td>${COUNTS.decorationsSubsystem}</td><td>Co-op Flagpole, Regatta Buoy, Relic Plinth, Fossil Display</td></tr>
  </tbody>
</table>

<p>The validator counts those routes and rejects both a decoration with none of them —
unobtainable by any path — and a decoration with two, where it is genuinely unclear
which price applies. The earn flags are checked against a closed list rather than
"any truthy flag", so a typo such as <code>coopOnly2: true</code> is caught as an
unobtainable decoration instead of silently becoming one.</p>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/07-dock-decorate-off.webp" alt="A sliding bottom sheet panel titled Decorate with a single &quot;Enter Decorate Mode&quot; button."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Decorate, off.</strong> Opened from the paintbrush button on the dock, showing the toggle in its default state.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/07b-dock-decorate-on.webp" alt="The Decorate panel closed with an info toast reading that decorate mode is on and the player can drag decorations to arrange the farm, though no such dragging exists yet."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Decorate, on.</strong> The toggle flips and a toast confirms it, and that is still the whole of it: nothing in the renderer, the input layer or the farm module reads the flag, so there is no drag-to-arrange yet.</figcaption>
  </figure>
</div>
`,
    },

    {
      id: 'photo',
      heading: 'Photo mode',
      html: `
<p>Photo mode is decorating's natural end point: having arranged the farm, you want a
picture of it. It opens from the Camera Tripod in the world at level 15.</p>

<p>The whole surface is small and deliberately so. <code>PHOTO</code> declares five
frames and a sticker limit:</p>

<table>
  <caption>Photo mode configuration</caption>
  <thead><tr><th>Field</th><th>Value</th></tr></thead>
  <tbody>
    <tr><td><code>unlockLevel</code></td><td>15</td></tr>
    <tr><td><code>frames</code></td><td><code>frame_none</code>, <code>frame_wood</code>, <code>frame_linen</code>, <code>frame_brass</code>, <code>frame_gold</code></td></tr>
    <tr><td><code>maxStickers</code></td><td>8</td></tr>
  </tbody>
</table>

<p>Three functions cover it. <code>setFrame(frameId)</code> validates against the frame
list and refuses an unknown id rather than storing it — a frame the renderer cannot
draw would show as no frame at all, with nothing anywhere saying why.
<code>addSticker(id, x, y)</code> refuses once the composition already holds
<code>maxStickers</code>. <code>capture()</code> returns a plain snapshot of the frame,
a copy of the sticker list and the capture instant.</p>

<p><code>capture()</code> returns the <em>composition</em>, not an image. Turning that
description plus the current camera into actual pixels is the renderer's job; the photo
module deliberately knows nothing about canvases. That separation is what lets the whole
thing be tested without a browser.</p>

<p>The default frame on a new farm is <code>frame_none</code> and the sticker list is
empty, so photo mode starts as an unadorned view of the farm rather than as a
pre-decorated template.</p>
<figure class="shot">
  <img src="./screenshots/33-panel-tripod.webp" alt="A sliding panel titled Photo Mode reading that the Camera Tripod is being built — check back soon."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>The Camera Tripod.</strong> Photo mode had fields in the decorating module at that commit and no panel case, so the tripod opens on the placeholder.</figcaption>
</figure>
`,
    },

    {
      id: 'achievements',
      heading: 'Achievements, and the single stat hook',
      html: `
<p>${COUNTS.achievements} achievements, paying <strong>${COUNTS.achievementDiamondsTotal} diamonds</strong> in total across the
life of a farm. They are pure observation — you never go and do an achievement, you
simply find you have done one — which makes them the cheapest possible long-gap content
and also the easiest to get architecturally wrong.</p>

<h3>One hook, not ${COUNTS.achievements} checks</h3>

<p>The wrong version of this feature sprinkles achievement checks through every system
that could advance one. The version here registers exactly two callbacks at the bottom
of <code>src/extras.js</code>:</p>

<pre><code>economy.registerStatHook((stat, _total, delta) =&gt; {
  addEventPoints(stat, delta);
  checkAchievements();
});
economy.onXpChanged(() =&gt; checkAchievements());</code></pre>

<p>Every lifetime counter in the game moves through one function,
<code>economy.trackStat(stat, amount)</code>, which increments
<code>state.stats[stat]</code> and then calls every registered hook. So harvesting a
crop, filling a boat crate and sending a train all reach the achievement check by the
same road, and a new system gets achievements for free the moment it calls
<code>trackStat</code>. The hook loop is wrapped so a throwing listener can never break
the economy — a broken achievement must not cost you a harvest.</p>

<p>The XP callback exists because three achievements test <code>level</code>, which is
not a member of <code>state.stats</code> at all. <code>statValue()</code> special-cases
it and reads <code>state.level</code> directly; without the second hook, reaching level
25 would not be noticed until some unrelated stat happened to move.</p>

<h3>The full list</h3>

<table>
  <caption>All ${COUNTS.achievements} achievements, in table order. Every one pays diamonds; the validator
  requires a positive target and a positive diamond reward, and rejects a duplicate
  id.</caption>
  <thead>
    <tr><th>Id</th><th>Name</th><th>Requirement</th><th>Stat</th><th>Target</th><th>Diamonds</th></tr>
  </thead>
  <tbody>
<tr><td><code>first_harvest</code></td><td>Green Thumb</td><td>Harvest your first crop</td><td><code>cropsHarvested</code></td><td>1</td><td>1</td></tr>
<tr><td><code>harvest_100</code></td><td>Field Hand</td><td>Harvest 100 crops</td><td><code>cropsHarvested</code></td><td>100</td><td>3</td></tr>
<tr><td><code>harvest_1000</code></td><td>Harvest Master</td><td>Harvest 1,000 crops</td><td><code>cropsHarvested</code></td><td>1,000</td><td>8</td></tr>
<tr><td><code>orders_10</code></td><td>Reliable</td><td>Fulfill 10 board orders</td><td><code>ordersFulfilled</code></td><td>10</td><td>2</td></tr>
<tr><td><code>orders_50</code></td><td>Order Machine</td><td>Fulfill 50 board orders</td><td><code>ordersFulfilled</code></td><td>50</td><td>5</td></tr>
<tr><td><code>orders_200</code></td><td>Merchant Prince</td><td>Fulfill 200 board orders</td><td><code>ordersFulfilled</code></td><td>200</td><td>10</td></tr>
<tr><td><code>trucks_25</code></td><td>Keep on Truckin</td><td>Complete 25 truck orders</td><td><code>trucksCompleted</code></td><td>25</td><td>5</td></tr>
<tr><td><code>boats_10</code></td><td>Harbor Master</td><td>Fill 10 boats completely</td><td><code>boatsCompleted</code></td><td>10</td><td>8</td></tr>
<tr><td><code>coins_10k</code></td><td>Piggy Bank</td><td>Earn 10,000 coins lifetime</td><td><code>coinsEarned</code></td><td>10,000</td><td>3</td></tr>
<tr><td><code>coins_100k</code></td><td>Tycoon</td><td>Earn 100,000 coins lifetime</td><td><code>coinsEarned</code></td><td>100,000</td><td>8</td></tr>
<tr><td><code>coins_1m</code></td><td>Farm Mogul</td><td>Earn 1,000,000 coins lifetime</td><td><code>coinsEarned</code></td><td>1,000,000</td><td>20</td></tr>
<tr><td><code>goods_100</code></td><td>Artisan</td><td>Produce 100 goods</td><td><code>goodsProduced</code></td><td>100</td><td>3</td></tr>
<tr><td><code>goods_1000</code></td><td>Factory Farm</td><td>Produce 1,000 goods</td><td><code>goodsProduced</code></td><td>1,000</td><td>8</td></tr>
<tr><td><code>fish_all</code></td><td>Compleat Angler</td><td>Catch every fish species</td><td><code>uniqueFishCaught</code></td><td>8</td><td>6</td></tr>
<tr><td><code>fish_100</code></td><td>Gone Fishing</td><td>Catch 100 fish</td><td><code>fishCaught</code></td><td>100</td><td>5</td></tr>
<tr><td><code>mine_50</code></td><td>Prospector</td><td>Dig 50 times in the mine</td><td><code>mineDigs</code></td><td>50</td><td>5</td></tr>
<tr><td><code>animals_500</code></td><td>Animal Whisperer</td><td>Collect 500 animal products</td><td><code>animalCollections</code></td><td>500</td><td>6</td></tr>
<tr><td><code>shop_100</code></td><td>Shopkeeper</td><td>Sell 100 shop listings</td><td><code>shopSales</code></td><td>100</td><td>5</td></tr>
<tr><td><code>level_10</code></td><td>Rising Star</td><td>Reach level 10</td><td><code>level</code></td><td>10</td><td>3</td></tr>
<tr><td><code>level_25</code></td><td>Seasoned Farmer</td><td>Reach level 25</td><td><code>level</code></td><td>25</td><td>8</td></tr>
<tr><td><code>level_40</code></td><td>Legend of the Farm</td><td>Reach level 40</td><td><code>level</code></td><td>40</td><td>25</td></tr>
<tr><td><code>forager</code></td><td>Forager</td><td>Gather 250 forage finds</td><td><code>foraged</code></td><td>250</td><td>8</td></tr>
<tr><td><code>gleaner</code></td><td>Gleaner</td><td>Gather 1,500 forage finds</td><td><code>foraged</code></td><td>1,500</td><td>18</td></tr>
<tr><td><code>fitter</code></td><td>Fitter</td><td>Craft 100 build components</td><td><code>componentsCrafted</code></td><td>100</td><td>10</td></tr>
<tr><td><code>master_builder</code></td><td>Master Builder</td><td>Craft 600 build components</td><td><code>componentsCrafted</code></td><td>600</td><td>24</td></tr>
<tr><td><code>pathfinder</code></td><td>Pathfinder</td><td>Complete 25 expeditions</td><td><code>expeditionsCompleted</code></td><td>25</td><td>12</td></tr>
<tr><td><code>far_traveller</code></td><td>Far Traveller</td><td>Complete 120 expeditions</td><td><code>expeditionsCompleted</code></td><td>120</td><td>28</td></tr>
<tr><td><code>relic_hunter</code></td><td>Relic Hunter</td><td>Find 20 artifacts</td><td><code>artifactsFound</code></td><td>20</td><td>14</td></tr>
<tr><td><code>curator</code></td><td>Curator</td><td>Complete 3 museum exhibits</td><td><code>exhibitsCompleted</code></td><td>3</td><td>20</td></tr>
<tr><td><code>chief_curator</code></td><td>Chief Curator</td><td>Complete all 6 exhibits</td><td><code>exhibitsCompleted</code></td><td>6</td><td>40</td></tr>
<tr><td><code>researcher</code></td><td>Researcher</td><td>Complete 8 research projects</td><td><code>researchCompleted</code></td><td>8</td><td>12</td></tr>
<tr><td><code>professor</code></td><td>Professor</td><td>Complete 24 research projects</td><td><code>researchCompleted</code></td><td>24</td><td>30</td></tr>
<tr><td><code>good_neighbour</code></td><td>Good Neighbour</td><td>Help with 100 requests</td><td><code>coopHelps</code></td><td>100</td><td>10</td></tr>
<tr><td><code>pillar</code></td><td>Pillar of the Co-op</td><td>Help with 500 requests</td><td><code>coopHelps</code></td><td>500</td><td>26</td></tr>
<tr><td><code>crew_hand</code></td><td>Crew Hand</td><td>Score 20,000 regatta points</td><td><code>regattaPoints</code></td><td>20,000</td><td>16</td></tr>
<tr><td><code>commodore</code></td><td>Commodore</td><td>Score 100,000 regatta points</td><td><code>regattaPoints</code></td><td>100,000</td><td>34</td></tr>
<tr><td><code>pilot</code></td><td>Pilot</td><td>Send 150 helicopter flights</td><td><code>helicopterFlights</code></td><td>150</td><td>12</td></tr>
<tr><td><code>stationmaster</code></td><td>Stationmaster</td><td>Send 80 trains</td><td><code>trainsCompleted</code></td><td>80</td><td>14</td></tr>
<tr><td><code>zookeeper</code></td><td>Zookeeper</td><td>Collect 400 zoo souvenirs</td><td><code>zooSouvenirs</code></td><td>400</td><td>22</td></tr>
  </tbody>
</table>

<div class="callout callout-warn">
<p><strong>One target is out of step with its own description.</strong>
<code>fish_all</code> is called Compleat Angler and reads "Catch every fish species",
but its target is <strong>${COUNTS.fishAllAchievementTarget}</strong> unique species while <code>FISHING.species</code>
now lists <strong>${COUNTS.fishSpecies}</strong>. The species list grew with the expansion content and this
target did not follow, so the achievement fires at ${COUNTS.fishAllAchievementTarget} of ${COUNTS.fishSpecies}. Nothing is broken
— the validator only checks that the target is positive — but the name currently
promises more than the number asks for.</p>
</div>
<figure class="shot">
  <img src="./screenshots/08-dock-achievements-panel.webp" alt="A sliding bottom sheet panel titled Achievements reading &quot;0 achievements unlocked so far.&quot;"
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>Achievements.</strong> The star button on the dock opens the count summary. Zero unlocked, on the fresh save these captures were taken from.</figcaption>
</figure>
`,
    },

    {
      id: 'wheel',
      heading: 'The daily wheel',
      html: `
<p>One free spin per calendar day, from the very first login. There is no unlock level,
which makes the wheel the earliest earning surface in the entire game — and that is not
an accident of ordering, it is doing a specific job.</p>

<h3>Why the wheel carries construction materials</h3>

<p>The Building Workshop opens at level 6, and it is the gateway to crafted buildings:
materials become components, components become a kit, the kit places a factory. The
first system that reliably supplies construction materials is the train station, and
that does not open until level 21. Without a bridge, a player would unlock the Workshop
and then stare at an inert building for fifteen levels.</p>

<p>The wheel is that bridge. <strong>Ten of its eighteen segments are construction
materials</strong>, in small quantities, once a day. It is not a supply line — it is
enough to start banking toward the earliest kits while the real material systems are
still locked.</p>

<table>
  <caption>All 18 wheel segments. Each is equally likely; the streak column shows the
  value at a maximum five-day streak.</caption>
  <thead><tr><th>#</th><th>Kind</th><th>Prize</th><th>At streak 5</th></tr></thead>
  <tbody>
<tr><td>1</td><td>coins</td><td>100 coins</td><td>140</td></tr>
<tr><td>2</td><td>coins</td><td>250 coins</td><td>350</td></tr>
<tr><td>3</td><td>diamonds</td><td>1 diamond</td><td>no change</td></tr>
<tr><td>4</td><td>coins</td><td>500 coins</td><td>700</td></tr>
<tr><td>5</td><td>item</td><td>pickaxe x1</td><td>no change</td></tr>
<tr><td>6</td><td>coins</td><td>1,000 coins</td><td>1,400</td></tr>
<tr><td>7</td><td>diamonds</td><td>3 diamonds</td><td>no change</td></tr>
<tr><td>8</td><td>coins</td><td>2,500 coins</td><td>3,500</td></tr>
<tr><td>9</td><td>material</td><td>nails x2</td><td>no change</td></tr>
<tr><td>10</td><td>material</td><td>slab x2</td><td>no change</td></tr>
<tr><td>11</td><td>material</td><td>timber x1</td><td>no change</td></tr>
<tr><td>12</td><td>material</td><td>brick x2</td><td>no change</td></tr>
<tr><td>13</td><td>material</td><td>paint x1</td><td>no change</td></tr>
<tr><td>14</td><td>material</td><td>hammer x1</td><td>no change</td></tr>
<tr><td>15</td><td>material</td><td>wire x1</td><td>no change</td></tr>
<tr><td>16</td><td>material</td><td>rope x1</td><td>no change</td></tr>
<tr><td>17</td><td>material</td><td>glass x1</td><td>no change</td></tr>
<tr><td>18</td><td>material</td><td>cement x1</td><td>no change</td></tr>
  </tbody>
</table>

<div class="stat-row">
  <div class="stat"><div class="stat-num">18</div><div class="stat-label">segments, equally weighted</div></div>
  <div class="stat"><div class="stat-num">10</div><div class="stat-label">of them construction materials</div></div>
  <div class="stat"><div class="stat-num">242</div><div class="stat-label">expected coins per spin at streak 1</div></div>
  <div class="stat"><div class="stat-num">1.4x</div><div class="stat-label">maximum streak multiplier</div></div>
</div>

<h3>The streak, exactly</h3>

<p>The multiplier is <code>1 + 0.1 * (streak - 1)</code>, and the streak is capped at 5
— so a perfect week is worth 40% more, and a perfect fortnight is worth exactly the same
40% as the perfect week. There is no reward for a hundred-day streak, which is a
deliberate refusal to turn a filler into an obligation.</p>

<p>Two details that are easy to get wrong and are worth stating precisely:</p>

<ul>
  <li><strong>The streak only touches coin segments.</strong> The multiplier is applied
      inside the coin branch. Diamonds, the pickaxe and all ten material segments pay a
      flat amount however long your streak. With five coin segments out of eighteen, a
      maxed streak improves only about 28% of outcomes.</li>
  <li><strong>Spinning twice in one day is refused, not merely unrewarded.</strong>
      <code>canSpin()</code> compares calendar days, and <code>spin()</code> returns
      <code>null</code> if it is not available. Without that, a streak could be farmed by
      spinning twice rather than by coming back.</li>
</ul>

<div class="callout callout-info">
<p><strong>An edge case in the streak rule.</strong> Continuation is decided by two
tests: the last spin was less than 48 hours ago, and it was not on today's calendar
date. That is nearly the same as "yesterday", but not exactly. Spin at 23:00 on Monday
and again at 01:00 on Wednesday — 26 hours apart, different days — and the streak
increments even though Tuesday was missed entirely. The failure is in the generous
direction, which is the right direction for a streak to be wrong in.</p>
</div>
`,
    },

    {
      id: 'visitors-pets',
      heading: 'Visitors and pets',
      html: `
<p>Two very small systems that exist for the same reason: to make opening the app worth
a moment even when nothing is ready.</p>

<h3>Visitors</h3>

<p>An occasional passer-by offers to buy something you already have, at a premium. The
constants live at the top of the visitor block in <code>src/extras.js</code> rather
than in <code>data.js</code>, because they are behavioural rather than content:</p>

<table>
  <caption>Visitor offer parameters</caption>
  <thead><tr><th>Constant</th><th>Value</th><th>Effect</th></tr></thead>
  <tbody>
    <tr><td><code>VISITOR_CHANCE_PER_TICK</code></td><td>0.02</td><td>2% chance per tick that a visitor appears</td></tr>
    <tr><td><code>VISITOR_PREMIUM</code></td><td>1.5</td><td>Offer price is 1.5x the item's sell value</td></tr>
    <tr><td>Offer quantity</td><td>1 to 3</td><td>Clamped to how many you actually own</td></tr>
    <tr><td>Offer lifetime</td><td>5 minutes</td><td><code>expiresAt = now + 5 * 60 * 1000</code></td></tr>
  </tbody>
</table>

<p>The item is drawn at random from what your barn actually holds, so the offer is
always for something you can supply. If the barn is empty, no visitor appears at all.
Only one visitor exists at a time. <code>resolveVisitor(accept)</code> re-reads the
owned quantity at the moment you accept and clamps again, so selling the goods elsewhere
between the offer and the acceptance cannot create items out of nothing. Declining costs
nothing and clears the offer.</p>

<div class="callout callout-warn">
<p><strong>A wiring hazard for whoever connects this.</strong> The constant is named
<code>PER_TICK</code>, and the game loop in <code>src/main.js</code> ticks every
animation frame — roughly sixty times a second. A 2% chance per frame is a visitor about
every 0.8 seconds. The number is clearly written for a much slower cadence, so whatever
ends up calling <code>maybeSpawnVisitor</code> needs its own throttle, or the constant
needs rescaling to the real tick rate. Reading it as "2% per minute" would be wrong by a
factor of about 3,600.</p>
</div>

<h3>Pets</h3>

<p>Two of them, both unlocked at level 10 alongside the pig:</p>

<table>
  <caption>The pet table in full</caption>
  <thead><tr><th>Pet</th><th>Unlock level</th><th>Cost</th><th>XP per feed</th></tr></thead>
  <tbody>
    <tr><td>Dog</td><td>10</td><td>2,000 coins</td><td>15</td></tr>
    <tr><td>Cat</td><td>10</td><td>2,000 coins</td><td>15</td></tr>
  </tbody>
</table>

<p><code>buyPet</code> refuses an unknown pet, a pet you already own, a level you have
not reached and a price you cannot afford, in that order, and only then charges you.
<code>feedPet</code> pays <code>feedXp</code> and is limited to once per calendar day per
pet, using the same calendar-day comparison the wheel uses.</p>

<p><strong>The XP is deliberately tiny, and the arithmetic makes that clear.</strong>
Owning both pets and feeding both every day is 30 XP a day. Going from level 10 to 11
costs 3,155 XP, so pets alone would take about 105 days to buy that single level; from
level 25 to 26 costs 16,416 XP, or about 547 days. Foraging is the same story at 1 XP
per pick. Neither is a progression tap. They are reasons to open the app, and the design
is honest about which of those two things it is doing.</p>
`,
    },

    {
      id: 'events',
      heading: 'The weekly event calendar',
      html: `
<p>The game is single-player and entirely offline, which rules out the usual way events
work — a server deciding what is running this weekend. Instead the whole schedule is
<strong>computed from the device's own calendar</strong>, deterministically. The ISO
week number picks which event runs, so the schedule is predictable, identical across a
reinstall, and needs nothing to be online.</p>

<h3>The shape of a week</h3>

<table>
  <caption>What runs on each day, from <code>weekendWindow</code> and
  <code>miniWindow</code> in <code>src/extras.js</code></caption>
  <thead><tr><th>Day</th><th>Event</th></tr></thead>
  <tbody>
    <tr><td>Monday</td><td>Nothing</td></tr>
    <tr><td>Tuesday, Wednesday</td><td>Mini-event, Tue 00:00 to Thu 00:00 local</td></tr>
    <tr><td>Thursday</td><td>Nothing</td></tr>
    <tr><td>Friday, Saturday, Sunday</td><td>Weekend event, Fri 00:00 to Mon 00:00 local</td></tr>
  </tbody>
</table>

<p>Two quiet days a week, and they are quiet on purpose. An event that is always running
is not an event.</p>

<p><code>tickEvents(now)</code> is the whole scheduler. It clears an event whose
<code>endsAt</code> has passed, then — if nothing is running — checks whether the current
instant falls inside this week's weekend window, and failing that, this week's mini
window. Ten weekend events rotate on the week number modulo 10 and six mini-events on
the week number modulo 6, so the two cycles drift against each other and the same
pairing does not recur weekly.</p>

<div class="callout callout-warn">
<p><strong>Unclaimed tiers are lost when an event ends.</strong> The expiry line sets the
event to <code>null</code> with no settlement. Reaching gold on Sunday evening and not
claiming it means gold is gone on Monday. This matches the genre convention it is
modelled on, and it is stated in the source comment rather than left to be
discovered.</p>
</div>

<h3>The ten weekend events</h3>

<table>
  <caption>Weekend rotation. Thresholds are base values before level scaling.</caption>
  <thead>
    <tr><th>Event</th><th>Scores</th><th>Passive effect</th><th>Bronze / silver / gold</th><th>Rewards</th></tr>
  </thead>
  <tbody>
<tr><td><code>harvest_event</code><br>Harvest Event</td><td>1 per <code>cropsHarvested</code></td><td>cropXpMult=2</td><td>120 / 400 / 1000</td><td>500 coins<br>1500 coins, 2 diamonds<br>4000 coins, 5 diamonds, Bunting Fence</td></tr>
<tr><td><code>production_event</code><br>Production Event</td><td>2 per <code>goodsProduced</code></td><td>productionXpMult=2</td><td>100 / 320 / 800</td><td>600 coins<br>1800 coins, 2 diamonds<br>4500 coins, 5 diamonds, Festival Tent</td></tr>
<tr><td><code>fishing_frenzy</code><br>Fishing Frenzy</td><td>5 per <code>fishCaught</code></td><td>fishDouble=true</td><td>60 / 200 / 500</td><td>500 coins<br>1500 coins, 2 diamonds<br>4000 coins, 5 diamonds, dynamite x3</td></tr>
<tr><td><code>mining_madness</code><br>Mining Madness</td><td>8 per <code>mineDigs</code></td><td>mineDouble=true</td><td>64 / 200 / 480</td><td>800 coins<br>2400 coins, 3 diamonds<br>6000 coins, 6 diamonds, Prize Trophy</td></tr>
<tr><td><code>truck_bonanza</code><br>Truck Bonanza</td><td>10 per <code>truckBundles</code></td><td>truckCoinMult=1.5</td><td>60 / 180 / 420</td><td>700 coins<br>2000 coins, 2 diamonds<br>5000 coins, 5 diamonds, Balloon Cluster</td></tr>
<tr><td><code>boat_race</code><br>Boat Race</td><td>12 per <code>boatCrates</code></td><td>boatVoucherBonus=3</td><td>48 / 144 / 360</td><td>900 coins<br>2600 coins, 3 diamonds<br>6500 coins, 6 diamonds, 12 vouchers</td></tr>
<tr><td><code>merge_mania</code><br>Merge Mania</td><td>3 per <code>merges</code></td><td>mergeEnergyRegenMult=2</td><td>60 / 210 / 540</td><td>500 coins<br>1500 coins, 2 diamonds<br>4000 coins, 6 diamonds</td></tr>
<tr><td><code>expedition_week</code><br>Expedition Week</td><td>60 per <code>expeditionsCompleted</code><br>120 per <code>artifactsFound</code></td><td>string, see below</td><td>180 / 480 / 900</td><td>30,000 coins<br>12 diamonds<br>gem x3</td></tr>
<tr><td><code>research_sprint</code><br>Research Sprint</td><td>200 per <code>researchCompleted</code><br>25 per <code>componentsCrafted</code></td><td>string, see below</td><td>200 / 520 / 1000</td><td>35,000 coins<br>14 diamonds<br>Clock Tower</td></tr>
<tr><td><code>sky_freight</code><br>Sky Freight</td><td>30 per <code>helicopterFlights</code><br>90 per <code>planesCompleted</code></td><td>string, see below</td><td>150 / 400 / 780</td><td>28,000 coins<br>10 diamonds<br>Weather Vane</td></tr>
  </tbody>
</table>

<p>The <code>pointsFor</code> multipliers are what make the thresholds comparable across
wildly different activities. A crop harvest is worth 1 point and a boat crate 12, because
you fill far fewer crates than you harvest crops. An event's difficulty is the threshold
divided by the points per action, not the threshold alone.</p>

<div class="callout callout-info">
<p><strong>Three events declare their effect as a string, and it does nothing.</strong>
Seven of the ten weekend events carry <code>effect</code> as an object such as
<code>{ cropXpMult: 2 }</code>. Expedition Week, Research Sprint and Sky Freight instead
carry a bare string. <code>activeEventEffect()</code> merges an effect only when it is an
object, so those three strings are silently ignored and those three events currently run
with no passive buff. Their descriptions happen not to promise one, so nothing visible
lies to the player — but the intent in the data is not reaching the code. Converting them
to objects over the existing <code>EFFECT_KEYS</code> set is the fix.</p>
</div>

<h3>Level scaling, and why it is captured at the start</h3>

<p>Thresholds in the table are base values. At claim time they are multiplied by
<code>0.5 + level / 20</code>, so an early player is asked for less and a long-established
one for more:</p>

<table>
  <caption>Harvest Event's 120 / 400 / 1000 thresholds, scaled by level</caption>
  <thead><tr><th>Level</th><th>Scale</th><th>Bronze</th><th>Silver</th><th>Gold</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>0.55</td><td>66</td><td>220</td><td>550</td></tr>
    <tr><td>10</td><td>1.00</td><td>120</td><td>400</td><td>1,000</td></tr>
    <tr><td>20</td><td>1.50</td><td>180</td><td>600</td><td>1,500</td></tr>
    <tr><td>30</td><td>2.00</td><td>240</td><td>800</td><td>2,000</td></tr>
    <tr><td>50</td><td>3.00</td><td>360</td><td>1,200</td><td>3,000</td></tr>
    <tr><td>95</td><td>5.25</td><td>630</td><td>2,100</td><td>5,250</td></tr>
  </tbody>
</table>

<p>Since Harvest Event scores one point per crop, gold at level 95 is 5,250 harvests in a
weekend — a serious ask, and the highest tier is meant to be. Rewards do not scale with
the thresholds, so the coins per point fall steadily as you level; the gold-tier
decoration, which is the thing you cannot buy, stays the real prize.</p>

<p><code>startWeekendEvent</code> stores <code>levelScaleAt</code> on the event when it
begins, and <code>claimEventTier</code> prefers that stored value over recomputing. This
is a small kindness with a real effect: <strong>levelling up mid-event does not move the
goalposts you have been playing toward.</strong></p>

<h3>The six mini-events</h3>

<table>
  <caption>Tuesday and Wednesday rotation. Single tier, single reward.</caption>
  <thead><tr><th>Event</th><th>Description</th><th>Scores</th><th>Threshold</th><th>Reward</th></tr></thead>
  <tbody>
<tr><td><code>egg_hunt</code><br>Egg Hunt</td><td>Collect 30 animal products for a bonus</td><td>1 per <code>animalCollections</code></td><td>30</td><td>800 coins, 1 diamond</td></tr>
<tr><td><code>bake_off</code><br>Bake-Off</td><td>Bake 15 bakery goods for a bonus</td><td>1 per <code>goodsProduced</code></td><td>15</td><td>900 coins, 1 diamond</td></tr>
<tr><td><code>order_rush</code><br>Order Rush</td><td>Fulfill 10 board orders for a bonus</td><td>1 per <code>ordersFulfilled</code></td><td>10</td><td>1,000 coins, 1 diamond</td></tr>
<tr><td><code>forage_dash</code><br>Forage Dash</td><td>Gather everything the hedgerows offer</td><td>10 per <code>foraged</code></td><td>300</td><td>9,000 coins</td></tr>
<tr><td><code>deep_dig</code><br>Deep Dig</td><td>Work the lower seams</td><td>40 per <code>mineDigs</code></td><td>400</td><td>gem x2</td></tr>
<tr><td><code>neighbourly</code><br>Neighbourly</td><td>Fill requests from the board</td><td>60 per <code>coopHelps</code></td><td>360</td><td>11,000 coins</td></tr>
  </tbody>
</table>

<p>Note how the thresholds pair with the multipliers: Forage Dash asks for 300 points at
10 per pick, which is 30 forage pickups; Deep Dig is 400 at 40 per dig, which is 10 digs.
Reading the threshold alone would badly misjudge both.</p>

<div class="callout callout-warn">
<p><strong>Two mini-event gaps, stated plainly.</strong></p>
<ul>
  <li><code>claimEventTier</code> returns <code>false</code> unless the running event's
      <code>kind</code> is <code>weekend</code>. Mini-events set <code>mini</code>, so
      their points accumulate correctly and their rewards currently have no code path
      that pays them out. The tier names it looks up also come from
      <code>EVENTS.weekend.tiers</code>, which a single-tier mini-event does not use.</li>
  <li>Bake-Off carries <code>buildingFilter: 'bakery'</code>, and nothing reads it.
      <code>addEventPoints</code> looks only at <code>pointsFor[stat]</code>, so Bake-Off
      currently scores for <em>any</em> good produced anywhere, not only bakery goods. Its
      description says bakery goods.</li>
</ul>
</div>
`,
    },

    {
      id: 'fair',
      heading: 'The Farm Fair',
      html: `
<p>The week-long one. It runs the first full week of each month from level ${COUNTS.fairUnlockLevel}, hands you
${COUNTS.fairTasksPerFair} tasks drawn from a pool of ${COUNTS.fairTasks}, asks you to finish any
${COUNTS.fairTasksToComplete}, and pays a
bronze, silver or gold ribbon according to the points those completed tasks were
worth.</p>

<h3>Scheduling without a server</h3>

<p><code>firstFullFairWeek(now)</code> finds the first Monday on or after the first of
the month and runs seven days from there. The "on or after" matters: if the 1st is itself
a Monday, the fair starts on the 1st. The worst case is a month beginning on a Tuesday,
which pushes the start to the 7th and the end to the 14th — so the window never spans two
months, in any month, February included.</p>

<p>The nine tasks are drawn by a small linear congruential generator seeded with
<code>year * 100 + month</code>, drawing without replacement from the pool. Same month,
same nine tasks, on every device and after every reinstall, with nothing online. Each
drawn task also records <code>startValue</code>, the lifetime stat at the moment the fair
opened, so progress is measured as a delta rather than against your career total:</p>

<pre><code>progress = clamp01(
  (state.stats[task.stat] - task.startValue) / task.target
)</code></pre>

<h3>The task pool</h3>

<table>
  <caption>All ${COUNTS.fairTasks} fair tasks. ${COUNTS.fairTasksPerFair} are drawn each month; ${COUNTS.fairTasksToComplete} must be completed.</caption>
  <thead><tr><th>Id</th><th>Task</th><th>Stat</th><th>Target</th><th>Points</th></tr></thead>
  <tbody>
<tr><td><code>harvest_150</code></td><td>Harvest 150 crops</td><td><code>cropsHarvested</code></td><td>150</td><td>300</td></tr>
<tr><td><code>harvest_320</code></td><td>Harvest 320 crops</td><td><code>cropsHarvested</code></td><td>320</td><td>450</td></tr>
<tr><td><code>produce_40</code></td><td>Produce 40 goods</td><td><code>goodsProduced</code></td><td>40</td><td>300</td></tr>
<tr><td><code>produce_90</code></td><td>Produce 90 goods</td><td><code>goodsProduced</code></td><td>90</td><td>450</td></tr>
<tr><td><code>orders_12</code></td><td>Fulfill 12 board orders</td><td><code>ordersFulfilled</code></td><td>12</td><td>300</td></tr>
<tr><td><code>orders_25</code></td><td>Fulfill 25 board orders</td><td><code>ordersFulfilled</code></td><td>25</td><td>450</td></tr>
<tr><td><code>trucks_6</code></td><td>Complete 6 truck orders</td><td><code>trucksCompleted</code></td><td>6</td><td>350</td></tr>
<tr><td><code>crates_8</code></td><td>Fill 8 boat crates</td><td><code>boatCrates</code></td><td>8</td><td>350</td></tr>
<tr><td><code>fish_15</code></td><td>Catch 15 fish</td><td><code>fishCaught</code></td><td>15</td><td>250</td></tr>
<tr><td><code>fish_35</code></td><td>Catch 35 fish</td><td><code>fishCaught</code></td><td>35</td><td>400</td></tr>
<tr><td><code>dig_10</code></td><td>Dig 10 times in the mine</td><td><code>mineDigs</code></td><td>10</td><td>300</td></tr>
<tr><td><code>animals_60</code></td><td>Collect 60 animal products</td><td><code>animalCollections</code></td><td>60</td><td>300</td></tr>
<tr><td><code>shop_15</code></td><td>Sell 15 shop listings</td><td><code>shopSales</code></td><td>15</td><td>250</td></tr>
<tr><td><code>merges_40</code></td><td>Make 40 merges in the Meadow</td><td><code>merges</code></td><td>40</td><td>300</td></tr>
<tr><td><code>feed_30</code></td><td>Make 30 batches of feed</td><td><code>feedMade</code></td><td>30</td><td>300</td></tr>
<tr><td><code>forage_120</code></td><td>Gather 120 forage finds</td><td><code>foraged</code></td><td>120</td><td>26</td></tr>
<tr><td><code>forage_300</code></td><td>Gather 300 forage finds</td><td><code>foraged</code></td><td>300</td><td>44</td></tr>
<tr><td><code>craft_20</code></td><td>Craft 20 build components</td><td><code>componentsCrafted</code></td><td>20</td><td>40</td></tr>
<tr><td><code>craft_45</code></td><td>Craft 45 build components</td><td><code>componentsCrafted</code></td><td>45</td><td>62</td></tr>
<tr><td><code>exped_4</code></td><td>Complete 4 expeditions</td><td><code>expeditionsCompleted</code></td><td>4</td><td>48</td></tr>
<tr><td><code>relics_3</code></td><td>Find 3 artifacts</td><td><code>artifactsFound</code></td><td>3</td><td>56</td></tr>
<tr><td><code>heli_12</code></td><td>Send 12 helicopter flights</td><td><code>helicopterFlights</code></td><td>12</td><td>34</td></tr>
<tr><td><code>trains_5</code></td><td>Send 5 trains</td><td><code>trainsCompleted</code></td><td>5</td><td>38</td></tr>
<tr><td><code>souvenirs_20</code></td><td>Collect 20 zoo souvenirs</td><td><code>zooSouvenirs</code></td><td>20</td><td>42</td></tr>
<tr><td><code>requests_10</code></td><td>Fill 10 co-op requests</td><td><code>requestsFilled</code></td><td>10</td><td>36</td></tr>
  </tbody>
</table>

<div class="callout callout-warn">
<p><strong>The pool contains two different point scales.</strong> The fifteen original
tasks are worth 250 to 450 points each. The ten added with the expansion content are
worth 26 to 62 — about an order of magnitude less, for targets that are not obviously
easier. Nothing in the validator compares them; it only checks that each target and each
point value is positive. A month whose draw is expansion-heavy is worth far fewer ribbon
points than one whose draw is not, for the same amount of play.</p>
</div>

<h3>Ribbons, and whether they are actually reachable</h3>

<table>
  <caption>Ribbon thresholds and rewards</caption>
  <thead><tr><th>Ribbon</th><th>Points needed</th><th>Reward</th></tr></thead>
  <tbody>
    <tr><td>Bronze</td><td>900</td><td>3,000 coins + 3 diamonds</td></tr>
    <tr><td>Silver</td><td>1,600</td><td>8,000 coins + 6 diamonds</td></tr>
    <tr><td>Gold</td><td>2,300</td><td>20,000 coins + 12 diamonds</td></tr>
  </tbody>
</table>

<p>Given the two point scales, the obvious worry is a month whose nine tasks are mostly
the low-value ones, where completing every task might not even reach bronze. Running the
real draw function over <strong>120 consecutive months</strong> settles it:</p>

<table>
  <caption>Simulated ribbon outcomes over 120 months, 2026 through 2035, using the actual
  seeded draw from <code>src/extras.js</code></caption>
  <thead><tr><th>Completed</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>No ribbon</th></tr></thead>
  <tbody>
    <tr><td>Best seven tasks</td><td>16</td><td>72</td><td>32</td><td>0</td></tr>
    <tr><td>All nine tasks</td><td>26</td><td>70</td><td>24</td><td>0</td></tr>
  </tbody>
</table>

<p>Bronze is never out of reach: the lowest best-seven total across all 120 months was
1,020 points, comfortably above the 900 needed. Gold is genuinely uncommon — 16 of 120
months on seven tasks, 26 on all nine — which is what a gold ribbon should be. The two
point scales make the fair noisier month to month than it probably intends, but they do
not break it. This is a simulation of the draw and the point arithmetic, not a
playtest: it says which ribbons the month's tasks are <em>worth</em>, not whether a
given player will finish them.</p>

<p>Two mechanical details of <code>claimFairRibbon()</code>: it requires at least
<code>tasksToComplete</code> finished tasks before it will look at points at all, and it
then sums <strong>every</strong> completed task, not just the required seven — so
finishing all nine is worth doing when a ribbon tier is close. It refuses when the total
does not reach bronze, leaving <code>ribbonClaimed</code> false so a later attempt can
succeed.</p>

<h3>The Fair Pass</h3>

<p>Gold ribbons accumulate for life in <code>state.fairPass.goldRibbons</code>, and that
lifetime count unlocks the trophy decoration line — the only way to obtain those
three:</p>

<table>
  <caption>Fair Pass ladder</caption>
  <thead><tr><th>Gold ribbons</th><th>Unlocks</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Bronze Fair Trophy</td></tr>
    <tr><td>3</td><td>Silver Fair Trophy</td></tr>
    <tr><td>6</td><td>Golden Fair Trophy, 2x2</td></tr>
  </tbody>
</table>

<p>At roughly 13% of months yielding gold on a best-seven completion, six gold ribbons is
a multi-year decoration. That is the point of it.</p>

<p>Two small notes for anyone reading the source. <code>seededFairTasks</code> sets a
<code>startStat: 0</code> field that is immediately superseded by the
<code>startValue</code> that <code>tickFair</code> writes; <code>startStat</code> is a
harmless leftover that nothing reads. And like an expired weekend event, an expired fair
is cleared with its unclaimed ribbon lost.</p>
`,
    },

    {
      id: 'holidays',
      heading: 'Holiday seasons',
      html: `
<p>Six date-keyed seasons, each covering a single month, each providing a world tint,
optional visual flags, and a small set of decorations you can only buy while it is
running. They are the lightest layer here — no points, no tiers, nothing to claim — and
they exist so that opening the game in December looks different from opening it in
August.</p>

<table>
  <caption>All six holiday seasons</caption>
  <thead>
    <tr><th>Season</th><th>Month</th><th>Tint</th><th>Flags</th><th>Limited decorations</th></tr>
  </thead>
  <tbody>
<tr><td><code>lunar_new_year</code><br>Lunar New Year</td><td>February</td><td><code>#e05548</code></td><td>none</td><td>Red Lanterns, 480</td></tr>
<tr><td><code>spring_bloom</code><br>Spring Bloom</td><td>April</td><td><code>rgba(255, 220, 240, 0.06)</code></td><td><code>extraFlowers</code></td><td>Cherry Blossom, 800</td></tr>
<tr><td><code>midsummer</code><br>Midsummer</td><td>June</td><td><code>#f2c94c</code></td><td>none</td><td>Midsummer Pole, 520</td></tr>
<tr><td><code>summer_splash</code><br>Summer Splash</td><td>July</td><td><code>rgba(255, 240, 180, 0.06)</code></td><td>none</td><td>Beach Chair, 350</td></tr>
<tr><td><code>harvest_fest</code><br>Harvest Fest</td><td>October</td><td><code>rgba(255, 180, 90, 0.08)</code></td><td><code>pumpkinsEverywhere</code></td><td>Pumpkin Pile, 450</td></tr>
<tr><td><code>winter_holiday</code><br>Winter Holiday</td><td>December</td><td><code>rgba(210, 235, 255, 0.12)</code></td><td><code>snow</code></td><td>Snowman 600, String Lights 400</td></tr>
  </tbody>
</table>

<p><strong>Buying is seasonal; owning is permanent.</strong> A holiday decoration can
only be purchased while its season is running, and a snowman you bought last December
stays on your farm in July. That is the rule that makes them worth buying at all — a
decoration that vanished out of season would be a rental.</p>

<p>The validator checks that every decoration's <code>holiday</code> field names a real
season, so a typo cannot quietly produce a decoration that is unbuyable in every month of
the year.</p>

<h3>Three honest observations</h3>

<ul>
  <li><strong>Half the year has no season.</strong> January, March, May, August,
      September and November are covered by none of the six. That may well be deliberate
      pacing — a season every month would stop being a season — but it is worth stating
      rather than leaving to be discovered.</li>
  <li><strong>Lunar New Year is pinned to February.</strong> The season model keys on
      calendar month, and Lunar New Year moves between late January and late February.
      Pinning it to month 2 catches most years and misses the January ones. Handling it
      properly would need a lunisolar date calculation, which is a real piece of work for
      a cosmetic tint.</li>
  <li><strong>Two tints are opaque colours.</strong> Four of the six are
      <code>rgba</code> values with alpha between 0.06 and 0.12 — a wash over the world.
      Lunar New Year and Midsummer are bare hex, which has no alpha at all. If the
      renderer applies a tint by filling with the value, those two would paint over the
      farm completely rather than tinting it. Whichever way that is resolved — alpha in
      the data, or a fixed opacity at the draw call — the six values should end up in one
      consistent form.</li>
</ul>

<p>One implementation detail: <code>activeHoliday()</code> takes no argument and reads
the wall clock directly, unlike the event functions, which all accept a <code>now</code>.
That makes the current holiday awkward to test at a chosen date and is the one function
here that cannot be driven from a simulated clock.</p>
`,
    },

    {
      id: 'state',
      heading: 'What all of this stores',
      html: `
<p>Everything on this page persists in the single JSON save blob described by
<code>src/state.js</code>, at <code>SAVE_VERSION</code> 4. The slices are small, which is
the point — most of these systems store a handful of numbers and derive everything else
from the data tables at read time.</p>

<table>
  <caption>State slices owned by the systems on this page</caption>
  <thead><tr><th>Slice</th><th>Shape</th><th>Seeded by a new game?</th></tr></thead>
  <tbody>
    <tr><td><code>state.foraging</code></td><td><code>{ nodes: [{ id, type, x, y, readyAt }] }</code></td><td>Yes, as an empty list</td></tr>
    <tr><td><code>state.collections</code></td><td><code>{ seen, claimed, mastery }</code></td><td>Yes, all empty</td></tr>
    <tr><td><code>state.decorate</code></td><td><code>{ active, selection, history, historyIndex }</code></td><td>Yes</td></tr>
    <tr><td><code>state.photo</code></td><td><code>{ frame, stickers }</code></td><td>Yes</td></tr>
    <tr><td><code>state.achievements</code></td><td><code>{ unlocked: [id] }</code></td><td>Yes</td></tr>
    <tr><td><code>state.daily</code></td><td><code>{ lastSpinAt, streak }</code></td><td>Yes, both 0</td></tr>
    <tr><td><code>state.pets</code></td><td><code>{ petId: { owned, lastFedAt } }</code></td><td>Yes, empty</td></tr>
    <tr><td><code>state.event</code></td><td><code>{ id, kind, endsAt, points, claimedTiers, levelScaleAt }</code> or null</td><td>Yes, as null</td></tr>
    <tr><td><code>state.stats</code></td><td><code>{ statName: lifetimeTotal }</code></td><td>Yes, empty</td></tr>
    <tr><td><code>state.visitor</code></td><td><code>{ itemId, qty, price, expiresAt }</code></td><td><strong>No</strong> — created on first offer</td></tr>
    <tr><td><code>state.fair</code></td><td><code>{ tasks, endsAt, ribbonClaimed }</code></td><td><strong>No</strong> — created when a fair opens</td></tr>
    <tr><td><code>state.fairPass</code></td><td><code>{ goldRibbons }</code></td><td><strong>No</strong> — created on the first gold ribbon</td></tr>
  </tbody>
</table>

<p>The three "No" rows are worth knowing about. They are absent from
<code>newGameState()</code> and created lazily by the code that first needs them, so
<code>state.fairPass</code> genuinely does not exist on a save from a farm that has never
won gold. Consumers must treat their absence as the empty case rather than assuming the
key is present — <code>claimFairRibbon</code> does exactly that, seeding a zero count
before incrementing.</p>

<p>Nothing on this page stores a countdown. Forage <code>readyAt</code>, event
<code>endsAt</code>, fair <code>endsAt</code>, visitor <code>expiresAt</code>,
<code>lastSpinAt</code> and a pet's <code>lastFedAt</code> are all absolute millisecond
timestamps, which is what lets a farm resume correctly after a week closed. Day
boundaries — the wheel, the pets — are compared as calendar dates in the device's local
time, not as 24-hour intervals, so a spin at 23:00 and another at 07:00 the next morning
are correctly two different days.</p>

<p>Adding a key to the documented save shape bumps <code>SAVE_VERSION</code> and adds a
migration that defaults the new key and passes every existing key through untouched.
Existing saves are never broken.</p>
`,
    },

    {
      id: 'status',
      heading: 'What is proven, and what is not yet connected',
      html: `
<p>This section is the honest one. The modules on this page are implemented and tested;
several of them are not yet called by anything else. Both halves of that sentence are
true and both matter to anyone reading the code.</p>

<h3>What the test suite proves</h3>

<p><code>tools/test-deadtime.mjs</code> is the dedicated suite for this material —
foraging, the newspaper, collections and decorating. It runs as part of
<code>npm test</code> and reports <strong>16 passing assertions</strong>, with no test
framework: plain Node, exiting non-zero on the first failure category.</p>

<ul>
  <li><strong>Foraging, 4 assertions.</strong> Only unlocked node types spawn; a single
      tick never exceeds <code>offlineRespawnCap</code>; thirty consecutive ticks never
      breach <code>globalMaxActive</code> or any per-type <code>maxActive</code>; a node
      whose <code>readyAt</code> is ten hours in the past is ready now; and a pick touches
      neither coins nor diamonds, yields a real <code>GOODS</code> id, and pushes
      <code>readyAt</code> forward by exactly the node's respawn.</li>
  <li><strong>Collections, 3 assertions.</strong> Every book derives a non-empty entry
      list; <code>record</code> is idempotent and a tier pays exactly once; mastery
      advances a star on repetition and its effect key is a member of
      <code>EFFECT_KEYS</code>, with the merged effect never worse than neutral.</li>
  <li><strong>Decorating and photo mode, 4 assertions.</strong> A move undoes and redoes
      to the exact prior layout; a colliding move is refused and leaves both the position
      and the history untouched; a full cycle of rotations returns to the starting
      orientation; and photo mode rejects an unknown frame, enforces
      <code>maxStickers</code>, and captures the composition it was given.</li>
  <li><strong>The newspaper, 5 assertions</strong>, which is documented in its own
      article.</li>
</ul>

<p><code>tools/validate-data.mjs</code> adds the data-shape guarantees quoted throughout
this article: forage nodes must respawn and yield real items with positive weights and
sane quantity ranges; <code>globalMaxActive</code> cannot exceed what the node table could
produce; no book may derive zero entries or set an unreachable first reward; mastery tiers
must ascend in makes and improve in bonus; every decoration must have exactly one route to
obtain it; achievement ids must be unique with positive targets and rewards; event
thresholds must ascend and match their reward lists; and every reward reference must
resolve to a real good or decoration.</p>

<h3>Integration points that are not connected yet</h3>

<p>These are gaps between modules rather than defects inside them. Each was verified by
searching the whole of <code>src/</code> for a caller and finding none, at the commit this
article was written against. The <a href="#/changelog">Changelog</a> is the live record;
some of these may have been wired since.</p>

<table>
  <caption>Observed missing wiring</caption>
  <thead><tr><th>What</th><th>Consequence</th></tr></thead>
  <tbody>
    <tr>
      <td>Nothing calls <code>economy.trackStat('foraged', ...)</code>. <code>collectNode</code> pays XP and items but does not record the stat.</td>
      <td>The <code>foraged</code> counter stays at zero, which leaves the Forager and Gleaner achievements, the Forage Dash mini-event, two Farm Fair tasks, a co-op task and a regatta task all unreachable.</td>
    </tr>
    <tr>
      <td>Nothing calls <code>collections.record</code>, <code>collections.recordMake</code> or <code>collections.masteryEffect</code>.</td>
      <td>Books never fill from play and mastery never accrues, so the tested logic has no input. Fishing, production and foraging are the three call sites this expects.</td>
    </tr>
    <tr>
      <td><code>foraging.tick</code> is not among the systems the game loop ticks.</td>
      <td>Nodes are never spawned during play.</td>
    </tr>
    <tr>
      <td>Nothing reads <code>extras.activeEventEffect()</code> or <code>extras.activeHoliday()</code>.</td>
      <td>Weekend passive buffs, and holiday tints, flags and seasonal purchasing, are declared but not applied.</td>
    </tr>
    <tr>
      <td>Nothing calls <code>maybeSpawnVisitor</code>, <code>spin</code>, <code>buyPet</code> or <code>feedPet</code>.</td>
      <td>The wheel, visitors and pets have no surface yet. The dock offers achievements and a decorate toggle; the collections shelf, the tripod and the rest fall through to a placeholder panel.</td>
    </tr>
    <tr>
      <td><code>claimEventTier</code> is guarded to weekend events only.</td>
      <td>Mini-event rewards have no payout path.</td>
    </tr>
    <tr>
      <td>Three weekend events declare <code>effect</code> as a string, and <code>activeEventEffect</code> merges objects only.</td>
      <td>Expedition Week, Research Sprint and Sky Freight run without a passive buff.</td>
    </tr>
    <tr>
      <td><code>bake_off</code> declares <code>buildingFilter: 'bakery'</code> and nothing reads it.</td>
      <td>Bake-Off scores for any good produced, contrary to its description.</td>
    </tr>
    <tr>
      <td><code>fish_all</code> targets 8 unique species; <code>FISHING.species</code> lists 14.</td>
      <td>An achievement named for catching every fish completes at eight of fourteen.</td>
    </tr>
    <tr>
      <td><code>DECORATE.multiSelectMax</code> is declared and not enforced by <code>select()</code>.</td>
      <td>A selection can exceed the intended ${COUNTS.decorateMultiSelectMax}-object cap.</td>
    </tr>
  </tbody>
</table>

<div class="callout callout-ok">
<p><strong>The shape of that list is the good news.</strong> Every item is one call site,
not a redesign. The modules are written to be driven from outside — they take a
<code>now</code>, they return what happened, they touch nothing they do not own — and that
is exactly what makes them testable without a browser and connectable without being
rewritten.</p>
</div>

<h3>Running the checks yourself</h3>

<pre><code>npm test                          # validator plus every suite
node tools/test-deadtime.mjs      # just this material, 16 assertions
node tools/validate-data.mjs      # data-shape guarantees only
npm run serve                     # then open http://localhost:8123</code></pre>

<div class="callout callout-warn">
<p><strong>On the installer.</strong> The Windows build is unsigned, permanently and by
policy, so Windows will show an unknown-publisher warning when you run it. Nothing about
the download is signed or verified by a certificate, and no claim to the contrary should
ever be made for it.</p>
</div>
`,
    },
  ],

  related: [
    'getting-started',
    'farming',
    'crafting',
    'exploration',
    'social',
    'architecture',
  ],
};
