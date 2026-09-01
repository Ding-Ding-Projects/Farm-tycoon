/* ============================================================================
 * Exploration — the mine, the museum, expeditions, the laboratory, fishing and
 * Merge Meadow.
 *
 * Every number in this article was read out of src/ and src/data.js rather than
 * from any design document, and the arithmetic was recomputed against those
 * tables. Where the code and the design notes disagree, the code wins and the
 * disagreement is written down.
 *
 * Content counts come from ./data-counts.js, a generated module — never typed here.
 * ==========================================================================*/

import { COUNTS, FMT } from './data-counts.js';

export const article = {
  id: 'exploration',
  title: 'Exploration',
  group: 'Exploration',
  summary:
    'Six systems that pay out in things you cannot grow: the tiered mine, the museum and its artifacts, expeditions, permanent research, fishing, and the Merge Meadow board.',

  sections: [
    /* --------------------------------------------------------------------- */
    {
      id: 'overview',
      heading: 'Six systems, one shape',
      html: `
<p>The farm proper is a loop you can reason about: plant, wait, harvest, sell. The six
systems on this page are the other half of the game — the half that produces things no
field can grow. Ore and gemstones. Fish. Artifacts. Permanent multipliers. The tools and
vouchers that the rest of the economy quietly assumes you already have.</p>

<p>They are deliberately built to one shape. Each one <strong>costs a resource that is not
coins</strong>, each one <strong>resolves on absolute wall-clock time</strong> so it keeps
running while the game is closed, and each one <strong>opens from a structure standing in
the world</strong> rather than from a button on the heads-up display. That last rule is why
the mine is a hole in the hillside at grid position (5,&nbsp;13) and the laboratory is a
building at (27,&nbsp;5): the systems are places you walk to, and a locked one is visibly
derelict rather than absent.</p>

<h3>What each one actually charges you</h3>

<p>This is the distinction that matters when you are deciding what to do with ten spare
minutes. Coins are rarely the binding constraint; the second column is.</p>

<table>
  <thead>
    <tr><th>System</th><th>Spends</th><th>Returns</th><th>Time base</th></tr>
  </thead>
  <tbody>
    <tr><td>Mine</td><td>One pickaxe or one stick of dynamite per dig</td><td>Ore, gemstones, artifacts below the surface</td><td>Instant — the tool is the gate</td></tr>
    <tr><td>Museum</td><td>Nothing. It is a display case</td><td>Coins, diamonds, visitor income on a completed exhibit</td><td>None</td></tr>
    <tr><td>Expeditions</td><td>Food and drink, consumed up front</td><td>Ore, materials, coins, artifacts</td><td>1.5 to 11 hours per trip</td></tr>
    <tr><td>Laboratory</td><td>Coins, crops and components</td><td>Permanent multipliers</td><td>2 to 24 hours per node</td></tr>
    <tr><td>Fishing</td><td>A 20-second cast and a timed reel</td><td>Fish, and treasure chests</td><td>20 seconds</td></tr>
    <tr><td>Merge Meadow</td><td>Energy, which refills on its own</td><td>Coins, diamonds, vouchers, mine tools</td><td>90 seconds per point of energy</td></tr>
  </tbody>
</table>

<h3>When each one opens</h3>

<p>Two gates exist for every system: the level at which the system itself is defined, and
the level on the world structure you click to reach it. In five of the six they agree.</p>

<table>
  <thead>
    <tr><th>System</th><th>System gate</th><th>World structure</th><th>Structure gate</th></tr>
  </thead>
  <tbody>
    <tr><td>Merge Meadow</td><td>Level 11</td><td><code>merge_plot</code> — Merge Meadow</td><td>Level 28 — see below</td></tr>
    <tr><td>Fishing</td><td>Level 12</td><td><code>lake</code> — Fishing Lake</td><td>Level 12</td></tr>
    <tr><td>Mine</td><td>Level 24</td><td><code>mine_entrance</code> — Mine Entrance</td><td>Level 24</td></tr>
    <tr><td>Laboratory</td><td>Level 54</td><td><code>laboratory</code> — Laboratory</td><td>Level 54</td></tr>
    <tr><td>Expeditions</td><td>Level 57</td><td><code>expedition_camp</code> — Expedition Camp</td><td>Level 57</td></tr>
    <tr><td>Museum</td><td>Level 60</td><td><code>museum_hall</code> — Museum</td><td>Level 60</td></tr>
  </tbody>
</table>

<div class="callout callout-warn">
<p><strong>Merge Meadow has two different answers.</strong> <code>MERGE.unlockLevel</code> is
11, and the level table lists <code>merge_meadow</code> as a level-11 unlock — but the world
structure <code>merge_plot</code> carries <code>unlockLevel: 28</code>. The merge module
itself performs no level check at all, so which gate a player actually meets depends on
which one the interface reads. The data validator checks structure positions, sizes, panels
and overlaps, but it does not check that a structure's gate agrees with its system's, so
nothing currently flags this. It is recorded here as an open question rather than presented
as a decision.</p>
</div>

<h3>They feed each other more than they feed the farm</h3>

<p>The interesting part is the second-order plumbing. Merge Meadow's tool chain pays out
three pickaxes when you complete it, and its plant chain pays a stick of dynamite — which
are exactly the two things the mine consumes. Fishing's treasure chests drop pickaxes and
dynamite too. So the mine is not really gated on level 24; it is gated on whether you are
playing the two minigames that produce its ammunition. Meanwhile the mine's ore is inert
until the Smelter refines it, and the Smelter is an ordinary production building unlocked in
the same breath at level 24.</p>

<p>Artifacts run the other way. Both the mine and expeditions produce them, and both hand
them to exactly one place — the museum — for reasons set out in
<a href="#/exploration/museum">The museum and its artifacts</a>.</p>
`,
    },

    /* --------------------------------------------------------------------- */
    {
      id: 'mine',
      heading: 'The mine and its five depths',
      html: `
<p>The mine opens at level 24 and is the simplest system on this page to describe and the
hardest to exhaust. You hold a tool, you spend it, you get ore. There is no timer and no
queue: the whole of the mine's pacing lives in how many pickaxes and sticks of dynamite you
can get hold of.</p>

<h3>One dig, step by step</h3>

<p><code>digAt(depthId, tool)</code> is the whole system, and its ordering is deliberate:</p>

<ol>
  <li>The depth must exist and must be in <code>state.mine.depthUnlocked</code>.</li>
  <li>The depth must have a yield table for that tool.</li>
  <li>You must be holding at least one of the tool.</li>
  <li><strong>Only then</strong> is the tool consumed — exactly once. The source comment is
      explicit about why: nothing below that line can fail in a way that would need the tool
      refunded, so there is no refund path to get wrong.</li>
  <li>One row is drawn from that depth's weighted yield table, and a quantity rolled inside
      that row's range.</li>
  <li>The quantity is capped by the room actually left in the barn, exactly like every other
      production output in the game.</li>
  <li>Independently of all of the above, the depth's artifact chance is rolled.</li>
</ol>

<div class="callout callout-info">
<p><strong>A dig into a full barn still costs the tool.</strong> Step 6 caps the ore at the
free space, and if there is none the tool is gone and no ore arrives. This is consistent with
how the rest of the game treats a full barn rather than a special case, but it is worth
knowing before you spend a stack of dynamite you were saving. The artifact roll in step 7 is
unaffected — artifacts do not live in the barn at all, so a full barn cannot stop one landing.</p>
</div>

<h3>The five depths</h3>

<p>Each depth after the first costs coins <em>and</em> construction materials to open, and
opening one immediately makes it the current depth. The material costs climb through the
tiers on purpose: the surface seam wants nothing, and The Deep wants six jackhammers, six
drills and four electric saws, none of which come from the ordinary train and airport
material channels.</p>

<table>
  <thead>
    <tr><th>Depth</th><th>Level</th><th>Cost to open</th><th>Materials</th><th>Artifact chance</th><th>Artifact pool</th></tr>
  </thead>
  <tbody>
    <tr><td>Surface Seam</td><td>24</td><td>—</td><td>—</td><td>0%</td><td>none</td></tr>
    <tr><td>Iron Gallery</td><td>56</td><td>60,000</td><td>rope 5, timber 4</td><td>6%</td><td>Clay Shard, Flint Blade</td></tr>
    <tr><td>Crystal Vault</td><td>68</td><td>140,000</td><td>jackhammer 3, timber 8</td><td>9%</td><td>Quartz Cluster, Bronze Coin</td></tr>
    <tr><td>Fossil Bed</td><td>79</td><td>300,000</td><td>drill 4, cement 10</td><td>12%</td><td>Ammonite, Silver Denarius</td></tr>
    <tr><td>The Deep</td><td>90</td><td>600,000</td><td>jackhammer 6, drill 6, electric saw 4</td><td>15%</td><td>Star Sapphire, Raptor Claw, Pearl Casket</td></tr>
  </tbody>
</table>

<p>Opening all four costs <strong>1,100,000 coins</strong> in total, spread across levels 56
to 90. The validator enforces that each depth's level is strictly greater than the one
before, so the ladder cannot be reordered by accident.</p>

<h3>What a dig is actually worth</h3>

<p>Expected units per dig, computed from each depth's weight table. "Units" means items of
whatever kind the row produced — a gemstone unit is worth far more than a silver ore unit,
which is why the gem-row column matters as much as the total.</p>

<table>
  <thead>
    <tr><th>Depth</th><th>Pickaxe: expected units</th><th>Pickaxe: gem row</th><th>Dynamite: expected units</th><th>Dynamite: gem row</th></tr>
  </thead>
  <tbody>
    <tr><td>Surface Seam</td><td>1.30</td><td>1%</td><td>2.25</td><td>5%</td></tr>
    <tr><td>Iron Gallery</td><td>2.08</td><td>20%</td><td>2.15</td><td>20%</td></tr>
    <tr><td>Crystal Vault</td><td>2.48</td><td>25%</td><td>2.65</td><td>35%</td></tr>
    <tr><td>Fossil Bed</td><td>2.90</td><td>40%</td><td>3.57</td><td>50%</td></tr>
    <tr><td>The Deep</td><td>4.13</td><td>45%</td><td>5.22</td><td>50%</td></tr>
  </tbody>
</table>

<p>Two things fall out of that table. First, dynamite's advantage over a pickaxe is enormous
at the surface (2.25 against 1.30) and then <em>narrows sharply</em> at the Iron Gallery
(2.15 against 2.08) before widening again with depth — the Iron Gallery is the one depth
where a pickaxe is very nearly as good, so it is where you should be burning your cheap
tools rather than your expensive ones. Second, the surface seam's 1% gem row is essentially
decorative; gemstones are a mid-mine reward, not an early one.</p>

<p>At the four base sell prices — Silver Ore 60, Gold Ore 100, Platinum Ore 160, Gemstone
320 — a dig at The Deep with dynamite is worth several times one at the surface, which is
what justifies the 600,000 coins and the advanced-tier tools it takes to get there.</p>

<h3>Ore is not the product; bars are</h3>

<p>Nothing you pull out of the mine is finished. Ore refines in the Smelter, which unlocks at
level 24 alongside the mine itself and is an ordinary production building with an ordinary
queue:</p>

<table>
  <thead><tr><th>Recipe</th><th>Inputs</th><th>Time</th><th>XP</th></tr></thead>
  <tbody>
    <tr><td>Silver Bar</td><td>2 Silver Ore</td><td>1 hour</td><td>9</td></tr>
    <tr><td>Gold Bar</td><td>2 Gold Ore</td><td>1 hour 30 minutes</td><td>12</td></tr>
    <tr><td>Platinum Bar</td><td>2 Platinum Ore</td><td>2 hours</td><td>16</td></tr>
  </tbody>
</table>

<p>Two ore to one bar, uniformly. Gemstones are the exception — they are already a finished
good and are never smelted.</p>

<h3>Where the tools come from</h3>

<p>Pickaxes and dynamite are marked in the goods table as <code>source: 'loot'</code>: no
recipe anywhere produces them. They arrive from fishing chests (a pickaxe row at roughly 8%
of chest contents, dynamite at roughly 4%), from Merge Meadow's chain rewards, from the
order and truck economy, and from the roadside shop. This is why the mine reads as a
<em>reward sink</em> rather than an activity you can grind: you dig with what the rest of the
game happened to give you.</p>

<div class="callout callout-warn">
<p><strong>The mine's event bonus does not currently fire.</strong> The mine checks for an
active event whose id is <code>gold_rush</code> and doubles its yield if it finds one. No
event with that id exists anywhere in the content tables. The event that is plainly meant for
the mine is <code>mining_madness</code> ("Mining Madness", carrying an effect payload of
<code>mineDouble</code>), and nothing reads that payload either. So at present a dig during a
mining event yields exactly what a dig on any other day yields. See
<a href="#/exploration/verification">Verification and open items</a>.</p>
</div>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/02c-locked-mine_entrance.webp" alt="The world view with a weathered, derelict-looking mine entrance and a red toast notification reading that it unlocks at level 24."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Locked at level 24.</strong> The mine entrance sits in the world from the start, drawn derelict, and says so when tapped.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/19-panel-mine_entrance.webp" alt="A sliding panel titled Mine reading that the Mine Entrance is being built — check back soon."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Once it opens.</strong> Captured at <code>7dc0f14</code>, before the panels were wired: it opens on the placeholder rather than on a dig.</figcaption>
  </figure>
</div>
`,
    },

    /* --------------------------------------------------------------------- */
    {
      id: 'museum',
      heading: 'The museum and its artifacts',
      html: `
<p>The museum opens at level ${COUNTS.museumUnlockLevel} and holds ${COUNTS.artifacts} artifacts
across ${COUNTS.museumExhibits} exhibits of four each.
Complete an exhibit — one of each of its four artifacts — and it pays out once, permanently.</p>

<h3>Artifacts live in the museum, never in the barn</h3>

<p>This is the single most load-bearing decision in the whole area, and it is worth setting
out properly because the reasoning is not obvious until you have seen it go wrong.</p>

<p>Artifacts are stored in <code>state.museum.artifacts</code>, a store of their own, entirely
separate from <code>state.barn.items</code>. They occupy no barn capacity, they are never
counted against it, and no code path ever writes an artifact id into the barn. Two consequences
follow, and each one is a bug that did not happen:</p>

<ul>
  <li><strong>A full barn cannot soft-lock collection.</strong> Every other output in the game
      is capped by remaining barn space, including the ore from the very same dig that produced
      the artifact. If artifacts shared that cap, a player with a full barn and a 15% artifact
      chance would be silently throwing away the rarest drop in the game, and the fix — empty
      the barn first — is something nobody would ever guess. The test suite pins this down by
      setting the barn capacity to zero and asserting that the artifact still lands and that the
      artifact id never appears among the barn's items.</li>
  <li><strong>No generator can ask you to hand one over.</strong> The order board, the truck,
      the boat and the regatta all build requests from "things the player can own". Because
      those generators draw from the crops and goods tables and artifacts are in neither, an
      order for a Pearl Casket is impossible <em>by construction</em> rather than by a filter
      somebody has to remember to write. The order module says so in as many words.</li>
</ul>

<p>The data validator enforces the separation from the other direction too: artifact ids are
checked against the goods, crops and materials tables for collisions, because a shared id
would mean two stores disagreeing about what you own with nothing to notice.</p>

<h3>The ${COUNTS.museumExhibits} exhibits</h3>

<table>
  <thead>
    <tr><th>Exhibit</th><th>Artifacts</th><th>Coins</th><th>Diamonds</th><th>Decoration</th><th>Visitor income</th></tr>
  </thead>
  <tbody>
    <tr><td>Ancient Pottery</td><td>Clay Shard, Painted Jug, Storage Urn, Clay Oil Lamp</td><td>60,000</td><td>8</td><td>Relic Plinth</td><td>+40/hour</td></tr>
    <tr><td>The Stone Age</td><td>Flint Blade, Hand Axe, Bone Needle, Carved Totem</td><td>85,000</td><td>10</td><td>—</td><td>+55/hour</td></tr>
    <tr><td>Coins of Empire</td><td>Bronze Coin, Silver Denarius, Gold Stater, Coin Hoard</td><td>120,000</td><td>12</td><td>—</td><td>+70/hour</td></tr>
    <tr><td>Crystals</td><td>Quartz Cluster, Amethyst Geode, Rose Crystal, Star Sapphire</td><td>160,000</td><td>14</td><td>—</td><td>+90/hour</td></tr>
    <tr><td>Fossils</td><td>Ammonite, Trilobite, Fern Imprint, Raptor Claw</td><td>210,000</td><td>18</td><td>Fossil Display</td><td>+115/hour</td></tr>
    <tr><td>The Sunken Ship</td><td>Ship's Bell, Brass Sextant, Captain's Seal, Pearl Casket</td><td>280,000</td><td>24</td><td>—</td><td>+145/hour</td></tr>
  </tbody>
</table>

<div class="stat-row">
  <div class="stat"><div class="stat-num">${COUNTS.artifacts}</div><div class="stat-label">artifacts</div></div>
  <div class="stat"><div class="stat-num">${COUNTS.museumExhibits}</div><div class="stat-label">exhibits</div></div>
  <div class="stat"><div class="stat-num">${FMT.museumCoinsTotal}</div><div class="stat-label">coins for all ${COUNTS.museumExhibits}</div></div>
  <div class="stat"><div class="stat-num">${COUNTS.museumDiamondsTotal}</div><div class="stat-label">diamonds for all ${COUNTS.museumExhibits}</div></div>
  <div class="stat"><div class="stat-num">+${COUNTS.museumIncomeTotal}</div><div class="stat-label">visitor income per hour</div></div>
</div>

<p>${COUNTS.museumExhibits} exhibits is a deliberate rejection of the genre's usual scale. The design note in the
content tables says so directly: a museum with dozens of collections and hundreds of artifacts
is a years-long treadmill, and this game is not asking for one. ${COUNTS.artifacts} artifacts is a
target you can actually see the end of.</p>

<h3>Duplicates, and the rule that protects you from yourself</h3>

<p>Duplicates are kept rather than refused, and can be sold for coins — artifact sell prices
run from 200 for a Clay Shard to 900 for a Pearl Casket, which makes a duplicate roughly
comparable to three gemstones. The important part is the guard:
<code>sellDuplicate</code> <strong>never sells your last copy</strong>. Ask it to sell five
when you own three and it sells two and tells you so. There is no way to accidentally
dismantle an exhibit you have already half-built, which matters because the loss would be
invisible until you tried to complete the set weeks later.</p>

<p>Claiming a completed exhibit is likewise idempotent: the exhibit id goes into a claimed
list, and a second claim returns false and moves no coins. The test asserts the balance is
unchanged after the second attempt, not merely that the call failed.</p>

<div class="callout callout-danger">
<p><strong>No exhibit can currently be completed.</strong> Of the 24 artifacts, only
<strong>10 have a source anywhere in the code</strong>. Nine appear in mine depth artifact
pools and eight appear in expedition loot tables, overlapping to ten distinct artifacts. The
remaining fourteen — Painted Jug, Storage Urn, Clay Oil Lamp, Hand Axe, Bone Needle, Carved
Totem, Gold Stater, Coin Hoard, Amethyst Geode, Rose Crystal, Trilobite, Fern Imprint, Brass
Sextant and Captain's Seal — exist only in the artifact table and in their exhibit's list.
Nothing drops them.</p>
<p>Per exhibit, the reachable count is: Ancient Pottery 1 of 4, The Stone Age 1 of 4, and 2 of
4 for each of Coins of Empire, Crystals, Fossils and The Sunken Ship. The museum's own
mechanics are complete and tested; what is missing is drop-table coverage. The validator does
not catch it because it checks that every artifact belongs to exactly one exhibit — a genuine
bijection, checked in both directions — but never asks whether an artifact can be
<em>obtained</em>.</p>
</div>

<h3>Two rewards that are recorded but not yet applied</h3>

<p>Completing an exhibit also does two things that stop short of the world:</p>

<ul>
  <li><strong>The decoration reward.</strong> Ancient Pottery grants a Relic Plinth and
      Fossils a Fossil Display. Both exist in the decorations table, flagged
      <code>museumOnly</code>. The museum module deliberately does not place them — placement
      belongs to the decorating and farm modules — and records the reward so those modules can
      grant it. Neither currently does.</li>
  <li><strong>Visitor income.</strong> <code>visitorBonusPerHour()</code> sums the bonus of
      every completed exhibit and is documented as feeding the zoo's hourly rate. It is
      exported, and nothing calls it: the zoo module does not import the museum. The +515 per
      hour in the table above is what the data promises, not what the running game currently
      pays.</li>
</ul>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/02g-locked-museum_hall.webp" alt="The world view with a weathered, derelict-looking museum hall and a red toast notification reading that it unlocks at level 60."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Locked at level 60.</strong> Far out along the curve, and still drawn and clickable from level 1.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/26-panel-museum_hall.webp" alt="A sliding panel titled Museum reading that the Museum is being built — check back soon."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>The Museum panel.</strong> The museum module was implemented at that commit, and its panel opened on the placeholder.</figcaption>
  </figure>
</div>
`,
    },

    /* --------------------------------------------------------------------- */
    {
      id: 'expeditions',
      heading: 'Expeditions: crew, sites and the cost of failure',
      html: `
<p>Expeditions open at level 57. You hire specialists, send one to a site with a bag of
supplies, and they come back hours later with loot — or, sometimes, with nothing at all.
It is the only system in the game where an action can genuinely fail.</p>

<h3>Supplies are consumed up front, and that is the whole design</h3>

<p>The launch takes the site's supplies out of your barn immediately, before the trip starts.
The source comment gives the reason in one line: otherwise the failure chance is decoration
and there is no decision in choosing a site. A risk you can retry for free is not a risk.</p>

<p>Because the supplies are real goods — bread, cheese, sushi rolls, caviar tins — a failed
expedition is a genuine loss of production time from the buildings that made them. The test
suite verifies both halves: that the supplies leave the barn at launch, and that after a
failure the crew slot is freed and the supplies do not come back.</p>

<h3>The four specialists</h3>

<table>
  <thead><tr><th>Specialist</th><th>Cost</th><th>Bonus</th><th>What it does</th></tr></thead>
  <tbody>
    <tr><td>Digger</td><td>40,000</td><td>artifact chance +0.05</td><td>Adds five percentage points to the artifact re-roll, described below</td></tr>
    <tr><td>Scout</td><td>55,000</td><td>speed multiplier 0.85</td><td>Trips take 85% of their listed duration</td></tr>
    <tr><td>Cook</td><td>70,000</td><td>risk reduction 0.05</td><td>Subtracts five percentage points from the site's failure chance</td></tr>
    <tr><td>Mechanic</td><td>90,000</td><td>loot bonus 0.15</td><td>Multiplies non-artifact quantities and coin rewards by 1.15</td></tr>
  </tbody>
</table>

<p>Three slots limit how many trips run <em>at once</em>, not how many specialists you may own
— hiring is unbounded, so you can keep one of each and pick the right person for the site.
The Scout's speed bonus is the one that compounds hardest over a long session, since it
applies to the eleven-hour trips as readily as the ninety-minute ones.</p>

<div class="callout callout-info">
<p><strong>Hiring is instant.</strong> Each specialist carries a <code>hireTime</code> of two
to three and a half hours, and the hire records a <code>hiredAt</code> timestamp — but nothing
reads either. Pay the coins and the specialist is available immediately. The data is in place
for a hiring delay that has not been wired up.</p>
</div>

<h3>The eight sites</h3>

<table>
  <thead>
    <tr><th>Site</th><th>Level</th><th>Duration</th><th>Failure</th><th>Supplies</th><th>Coin row</th></tr>
  </thead>
  <tbody>
    <tr><td>Dust Canyon</td><td>57</td><td>1h 30m</td><td>10%</td><td>2 bread, 1 carrot juice</td><td>500–1,500</td></tr>
    <tr><td>Hollow Ridge</td><td>61</td><td>2h 30m</td><td>12%</td><td>3 bread, 1 cheese</td><td>1,200–3,000</td></tr>
    <tr><td>Salt Flats</td><td>65</td><td>3h 30m</td><td>14%</td><td>2 green tea, 1 pickles</td><td>2,500–5,000</td></tr>
    <tr><td>Glass Caves</td><td>70</td><td>4h 30m</td><td>15%</td><td>1 olive oil, 1 sushi roll</td><td>4,000–8,000</td></tr>
    <tr><td>Fossil Beds</td><td>75</td><td>6h</td><td>16%</td><td>1 lasagna, 2 mint tea</td><td>7,000–13,000</td></tr>
    <tr><td>Drowned Bay</td><td>80</td><td>7h 30m</td><td>18%</td><td>1 canned fish, 1 herb fondue</td><td>11,000–20,000</td></tr>
    <tr><td>Ember Slope</td><td>86</td><td>9h</td><td>20%</td><td>1 pearl necklace, 2 mint yogurt</td><td>18,000–32,000</td></tr>
    <tr><td>The Lost Terrace</td><td>92</td><td>11h</td><td>22%</td><td>1 gold ring, 1 caviar tin</td><td>30,000–55,000</td></tr>
  </tbody>
</table>

<p>The curve is honest: duration, failure chance, supply value and payout all climb together.
The Lost Terrace asks for a gold ring and a tin of caviar — two of the most expensive goods in
the game — for an eleven-hour trip that fails better than one time in five.</p>

<h3>Expeditions are the only route to the advanced materials</h3>

<p>Materials are split into four purpose-scoped sets, and the advanced set — jackhammers,
drills, electric saws — is reachable from expedition loot and the Tool Exchange only. Never
from trains, never from the airport, never from the helicopter. This is checked by a dedicated
test rather than left to convention.</p>

<p>Which closes a loop worth noticing: the mine's deepest three depths cost jackhammers,
drills and electric saws to open. So <strong>the deep mine is gated behind expeditions</strong>,
and expeditions are gated behind having enough finished food to spend on them. The three
systems on this page are a chain, not three parallel activities.</p>

<h3>The artifact re-roll, and how an expedition returns empty-handed</h3>

<p>This is the subtlest mechanic in the area and it is easy to misread from the tables alone.
Collecting a successful expedition draws one weighted row from the site's loot table. If that
row is <em>not</em> an artifact, you get it. If it <em>is</em> an artifact, the game rolls a
second, independent check against the site's artifact chance plus any Digger bonus — and
<strong>if that second roll fails, you get nothing at all</strong>. The row is not replaced.</p>

<p>The stated reason is that a Digger should genuinely raise your artifact odds rather than
merely change which table row you land on. The consequence is that an expedition has three
outcomes, not two:</p>

<table>
  <thead>
    <tr><th>Site</th><th>Artifact row weight</th><th>Artifact chance</th><th>P(artifact)</th><th>P(empty-handed overall)</th></tr>
  </thead>
  <tbody>
    <tr><td>Dust Canyon</td><td>15%</td><td>25%</td><td>3.75%</td><td>20.1%</td></tr>
    <tr><td>Hollow Ridge</td><td>17%</td><td>28%</td><td>4.76%</td><td>22.8%</td></tr>
    <tr><td>Salt Flats</td><td>18%</td><td>30%</td><td>5.40%</td><td>24.8%</td></tr>
    <tr><td>Glass Caves</td><td>20%</td><td>33%</td><td>6.60%</td><td>26.4%</td></tr>
    <tr><td>Fossil Beds</td><td>22%</td><td>36%</td><td>7.92%</td><td>27.8%</td></tr>
    <tr><td>Drowned Bay</td><td>24%</td><td>38%</td><td>9.12%</td><td>30.2%</td></tr>
    <tr><td>Ember Slope</td><td>26%</td><td>40%</td><td>10.40%</td><td>32.5%</td></tr>
    <tr><td>The Lost Terrace</td><td>28%</td><td>45%</td><td>12.60%</td><td>34.0%</td></tr>
  </tbody>
</table>

<p>The final column combines outright failure with the succeeded-but-empty case. Read it
carefully before committing a caviar tin: a trip to The Lost Terrace comes back with nothing
about a third of the time, and only 12.6% of trips produce the Pearl Casket you sent it for.
A Digger raises that to roughly 15.4% and a Cook trims the failure side by five points.</p>

<p>Whether "succeeded but returned nothing" should read as a distinct outcome in the interface
is an open design question. Mechanically it is not the same as a failure — the expedition is
recorded as completed and counts toward the Pathfinder and Far Traveller achievements — but it
feels identical to the player.</p>

<h3>Trips survive being closed</h3>

<p>A launched expedition stores an absolute <code>readyAt</code> timestamp, so closing the game
for the night and collecting in the morning works exactly as it should. The module's
<code>tick(now)</code> is a deliberate no-op, documented as such: readiness is computed on
demand from the timestamp, so there is nothing to accumulate. The tick exists only so that
every system shares one shape. A test confirms collection resolves correctly across a
simulated offline gap.</p>
<figure class="shot">
  <img src="./screenshots/28-panel-expedition_camp.webp" alt="A sliding panel titled Expeditions reading that the Expedition Camp is being built — check back soon."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>The Expedition Camp.</strong> The expeditions module was implemented and exercised by the test tools at that commit, with no panel reading it yet.</figcaption>
</figure>
`,
    },

    /* --------------------------------------------------------------------- */
    {
      id: 'laboratory',
      heading: `The laboratory: ${COUNTS.researchNodes} permanent nodes`,
      html: `
<p>The laboratory opens at level ${COUNTS.labUnlockLevel}, costs
${COUNTS.labBuildCoins.toLocaleString('en-US')} coins plus ${COUNTS.labBuildMaterials} to
build, and then offers ${COUNTS.researchNodes} research nodes arranged as
${COUNTS.researchBranches} branches of four.</p>

<h3>Permanent, not rented</h3>

<p>The genre's usual laboratory sells you a temporary boost — two days of faster growth for a
handful of gems, then it lapses and you buy it again. This one does not. Research is a one-way
tree: once a node completes it is in your save forever, and the design note is explicit about
why. The goal is that <em>a late player's farm is measurably better than an early player's,
rather than merely better stocked</em>. A permanent tree makes progress structural; a rental
makes it a subscription.</p>

<h3>The ${COUNTS.researchBranches} branches</h3>

<p>Each branch is a strict chain — tier 2 requires tier 1, tier 3 requires tier 2, and so on —
so there are no build orders to optimise within a branch, only across them. One project runs
at a time.</p>

<table>
  <thead>
    <tr><th>Branch</th><th>Effect</th><th>Tier values</th><th>All four</th><th>Coins</th><th>Research time</th></tr>
  </thead>
  <tbody>
    <tr><td>Irrigation</td><td>Crop growth time</td><td>0.95, 0.90, 0.85, 0.80</td><td>×0.5814</td><td>650,000</td><td>30h</td></tr>
    <tr><td>Automation</td><td>Production time</td><td>0.95, 0.90, 0.85, 0.80</td><td>×0.5814</td><td>835,000</td><td>35.5h</td></tr>
    <tr><td>Husbandry</td><td>Animal produce time</td><td>0.95, 0.90, 0.85, 0.80</td><td>×0.5814</td><td>780,000</td><td>35.5h</td></tr>
    <tr><td>Logistics</td><td>Order payout</td><td>1.05, 1.10, 1.15, 1.20</td><td>×1.5939</td><td>1,040,000</td><td>41h</td></tr>
    <tr><td>Cellars</td><td>Barn capacity</td><td>+25, +50, +80, +120</td><td>+275</td><td>910,000</td><td>41h</td></tr>
    <tr><td>Granary</td><td>Silo capacity</td><td>+25, +50, +80, +120</td><td>+275</td><td>910,000</td><td>41h</td></tr>
    <tr><td>Prospecting</td><td>Mine yield</td><td>+0.10, +0.20, +0.30, +0.45</td><td>+1.05</td><td>1,300,000</td><td>52h</td></tr>
  </tbody>
</table>

<div class="stat-row">
  <div class="stat"><div class="stat-num">${COUNTS.researchNodes}</div><div class="stat-label">nodes</div></div>
  <div class="stat"><div class="stat-num">${COUNTS.labSlots}</div><div class="stat-label">project at a time</div></div>
  <div class="stat"><div class="stat-num">${COUNTS.labTotalCoinsWithBuild.toLocaleString('en-US')}</div><div class="stat-label">coins, build included</div></div>
  <div class="stat"><div class="stat-num">${COUNTS.labTotalResearchDays}</div><div class="stat-label">days of research</div></div>
</div>

<p>Because only one slot exists, the 276 hours of research time is strictly sequential — you
cannot parallelise your way out of it. That is eleven and a half days of wall-clock time for a
fully researched farm, which is a deliberate long tail for a game whose level cap is 95.</p>

<h3>How the values compose</h3>

<p>The composition rule is the part most likely to be misread, so it is stated explicitly in
the source: <strong>multiplier keys multiply and everything else adds</strong>.</p>

<p>Each tier's multiplier is expressed relative to 1, so Irrigation IV's 0.80 is not "80% of
base" — it is "20% off whatever we are already at". All four together give
0.95&nbsp;×&nbsp;0.90&nbsp;×&nbsp;0.85&nbsp;×&nbsp;0.80&nbsp;=&nbsp;0.5814, so a fully
irrigated crop grows in about 58% of its base time. The alternative — later tiers replacing
earlier ones — would make the cheap tier-4 multiplier <em>undo</em> the expensive work below
it. Flat bonuses add instead, so Cellars I through IV give a straightforward +275 barn slots.</p>

<h3>One merge point for every permanent multiplier</h3>

<p><code>researchedEffect()</code> is deliberately the single place where every permanent
multiplier in the game is combined. It returns a <em>complete</em> object — every key in the
shared effect list, at its neutral value if nothing touches it, meaning 1 for a multiplier and
0 for a bonus — so a caller never has to branch on a missing key. Minigame results, building
mastery and co-operative perks all use the same key list for the same reason: three systems
that hand out bonuses must not drift into three different opinions about what a bonus is.</p>

<p>The laboratory registers itself with the economy as a multiplier provider rather than being
imported by it, which avoids a circular import while keeping one merge point.</p>

<div class="callout callout-danger">
<p><strong>No completed research currently changes a gameplay number.</strong> The merge point
is correct and tested — a test proves neutral values with nothing researched, and proves two
nodes compose — but the wiring from that merge point out to the consumers does not exist yet.
Traced through the source: the registered provider is only reachable through the economy's
combined-multiplier helper, and that helper has exactly one call site, which asks for the key
<code>'sell'</code>. That key is not in the effect list, so the provider returns 1 every time.
Meanwhile the crop-growth, production-time, animal-produce, order-payout, silo and barn
capacity, mine yield, fishing rarity and zoo income keys appear nowhere outside the content
tables — the production module reads no multiplier at all.</p>
<p>This is the classic shape of a feature wired at one end and consumed at neither: the
laboratory builds, the costs are charged, the timer runs, the node is recorded, the effect
composes correctly — and the farm behaves exactly as it did before. It is a wiring gap rather
than a design gap, and the merge point being already correct is what makes it a small one.</p>
</div>

<h3>Cancelling, and one consequence worth knowing</h3>

<p>Cancelling an active project refunds its full cost — coins, items and materials — because a
cancelled project must not cost anything. There is one wrinkle, documented in the source:
research costs are drawn <strong>from the silo first, then the barn</strong>, but refunds go
entirely <strong>to the barn</strong>, which is described as the safe universal home for a
refund since every item id is storable there.</p>

<p>So cancelling Irrigation I, whose cost is 60 wheat and 20 cotton, moves 80 units of crops
out of your silo and into your barn. The refund also does not check barn capacity, so it can
push the barn above its limit. Nothing is lost either way — but the goods will not be where you
left them.</p>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/02f-locked-laboratory.webp" alt="The world view with a weathered, derelict-looking laboratory and a red toast notification reading that it unlocks at level 54."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Locked at level 54.</strong> Derelict in the world, clickable, and honest about why it will not open.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/27-panel-laboratory.webp" alt="A sliding panel titled Laboratory reading that the Laboratory is being built — check back soon."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>The Laboratory panel.</strong> The research module was implemented at that commit, and the panel it should drive opened on the placeholder.</figcaption>
  </figure>
</div>
`,
    },

    /* --------------------------------------------------------------------- */
    {
      id: 'fishing',
      heading: `Fishing: a cast, a reel and ${COUNTS.fishSpecies} species`,
      html: `
<p>The lake unlocks at level 12 and is the earliest of these six systems apart from Merge
Meadow. Cast, wait twenty seconds, then reel with a timing minigame.</p>

<h3>The loop</h3>

<ol>
  <li><code>cast()</code> refuses below level 12, and refuses a second cast while one is
      already in the water. It stores an absolute ready time twenty seconds out.</li>
  <li>When that time passes, the interface shows the moving marker.</li>
  <li><code>reel(accuracy)</code> takes a number from 0 to 1 off that marker. The cast is
      consumed regardless of outcome — there is no way to muff a reel and try again on the
      same cast.</li>
  <li>An 8% roll decides treasure chest instead of fish. This happens <em>before</em> the
      species roll, so a chest is not a species outcome.</li>
  <li>Otherwise a species is drawn by rarity tier, and the quantity capped by barn room.</li>
</ol>

<h3>How the rarity tiers are derived</h3>

<p>Worth spelling out because the tiers are computed rather than listed. There are 14 species
and three rarity buckets weighted 60 / 30 / 10. The code splits the species list into thirds
using a rounded-up third — ceiling of 14 divided by 3, which is 5 — giving 5 common, 5
uncommon and 4 rare. The species list is ordered lowest tier first, so the split lands
correctly by construction rather than by a hand-maintained mapping.</p>

<table>
  <thead>
    <tr><th>Tier</th><th>Tier weight</th><th>Species</th><th>Each species</th></tr>
  </thead>
  <tbody>
    <tr><td>Common</td><td>60%</td><td>Perch 30, Trout 34, Carp 38, Bass 60, Pike 68</td><td>12.0%</td></tr>
    <tr><td>Uncommon</td><td>30%</td><td>Catfish 76, Salmon 120, Golden Koi 260, Lake Sturgeon 210, Zander 250</td><td>6.0%</td></tr>
    <tr><td>Rare</td><td>10%</td><td>Huchen 300, Arctic Charr 360, Giant Barb 430, Moonfish 520</td><td>2.5%</td></tr>
  </tbody>
</table>

<p>Numbers after each species are its base sell price. Those are the odds <em>given</em> that
you caught a fish; multiply by 0.92 for the odds on any given reel, since the chest roll comes
first. A Moonfish is therefore about a 2.3% outcome per reel — and at 520 coins it is worth
roughly seventeen Perch.</p>

<h3>What accuracy actually buys</h3>

<p>Less than you might assume, and this is a deliberate restraint rather than an oversight.
A near-perfect reel — accuracy above 0.9 — grants a 25% chance of a <em>second</em> fish. That
is all. Accuracy does not shift the rarity roll, does not affect the chest chance, and does not
change which species you catch.</p>

<p>So the best possible expected catch is 1.25 fish and the worst is 1.0. The reason to keep it
this narrow is the game's idle contract: fishing must not become a system where a player with
better reflexes gets meaningfully rarer goods, because that would make hand-eye skill a gate on
content. The timing bar is a flourish on top of a roll, not the roll itself. The same principle
governs the per-building minigames described under <a href="#/crafting">Crafting</a>.</p>

<div class="callout callout-info">
<p><strong>A rare-fish research key exists and is unused.</strong> <code>fishRareChance</code>
is in the shared effect key list, and no laboratory node grants it and no code reads it.
Fishing also reads no event state at all, so the Fishing Frenzy event's doubling payload does
not reach it.</p>
</div>

<h3>Treasure chests</h3>

<p>8% of reels produce a chest instead of a fish. Chests are the game's mid-early trickle of
mine tools and building materials — the design note says as much, pointing out that level 12
sits comfortably inside the Sugar Mill, Popcorn Pot and Grill window when brick and slab are
in demand.</p>

<table>
  <thead><tr><th>Contents</th><th>Quantity</th><th>Share of chests</th></tr></thead>
  <tbody>
    <tr><td>Coins</td><td>50–200</td><td>46.2%</td></tr>
    <tr><td>Diamonds</td><td>1–3</td><td>19.2%</td></tr>
    <tr><td>Pickaxe</td><td>1–2</td><td>7.7%</td></tr>
    <tr><td>Brick</td><td>1–2</td><td>6.2%</td></tr>
    <tr><td>Slab</td><td>1–2</td><td>6.2%</td></tr>
    <tr><td>Nails</td><td>1–3</td><td>6.2%</td></tr>
    <tr><td>Timber</td><td>1–2</td><td>4.6%</td></tr>
    <tr><td>Dynamite</td><td>1</td><td>3.8%</td></tr>
  </tbody>
</table>

<p>Nearly a fifth of chests carry diamonds, which makes fishing one of the few reliable
non-purchase diamond sources in the game. Item and material rewards are capped by barn room
like everything else, and a test covers that specific case. Coins and diamonds are not capped,
so a full barn never wastes a chest entirely.</p>

<div class="callout callout-warn">
<p><strong>A chest is not stored.</strong> The reel returns a chest marker and the opening
function rolls the contents when called, but no chest is written into the save. If the
interface loses the result between the reel and the open — a reload, a crash — the chest is
gone. Every other timed reward in the game is anchored to persistent state; this one is held
only in the interface. Worth knowing when the fishing panel is built out.</p>
</div>
<figure class="shot">
  <img src="./screenshots/18-panel-lake.webp" alt="A sliding panel titled Fishing reading that the Fishing Lake is being built — check back soon."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>The Fishing Lake.</strong> Captured before this panel was connected to the fishing module, so no cast can be made from the screen shown.</figcaption>
</figure>
`,
    },

    /* --------------------------------------------------------------------- */
    {
      id: 'merge-meadow',
      heading: 'Merge Meadow',
      html: `
<p>Merge Meadow is a merge-board minigame on its own 7-by-9 board, reached from a plot in the
world. Drag two identical items together to make one of the next tier up; claim high tiers for
rewards that pay into the main farm economy.</p>

<h3>The board</h3>

<div class="stat-row">
  <div class="stat"><div class="stat-num">63</div><div class="stat-label">cells (7 × 9)</div></div>
  <div class="stat"><div class="stat-num">3</div><div class="stat-label">chains</div></div>
  <div class="stat"><div class="stat-num">100</div><div class="stat-label">energy maximum</div></div>
  <div class="stat"><div class="stat-num">2h 30m</div><div class="stat-label">full energy refill</div></div>
</div>

<p>On first open the board seeds itself once and is idempotent thereafter: three generators are
spread along the top row at cells 0, 2 and 4 — index times the board width divided by the
generator count — and three tier-one items are dropped into the first free cells after them, one
from each chain. A board that already has anything on it is left alone, so re-entering never
resets your progress.</p>

<h3>Energy</h3>

<p>Energy is capped at 100, regenerates one point every 90 seconds, and costs one point per
generator tap. A full bar from empty therefore takes two and a half hours.</p>

<p>The regeneration deserves a note because it is the same discipline every timer in this game
follows. Energy is not counted down while the game runs; it is derived from a stored timestamp
whenever it is read, so it accrues identically whether the game is open or closed. And when
partial progress toward the next point exists, the stored clock advances only by the whole
intervals actually consumed — the remainder carries into the next read rather than being
discarded. Without that, a player checking their energy frequently would earn less than one
checking it rarely. Two tests cover it: a full offline gap capped at maximum, and a partial gap
crediting the right amount.</p>

<p>Tapping a generator with a full board spends nothing and spawns nothing. The free-cell check
runs before the energy is deducted, so there is no way to burn a point into a board with
nowhere to put the result.</p>

<h3>The three chains</h3>

<table>
  <thead><tr><th>Chain</th><th>Generator</th><th>Tiers</th><th>Mid-chain claims</th><th>Top reward</th></tr></thead>
  <tbody>
    <tr>
      <td>Tools</td><td>Toolbox (1–3 per tap)</td>
      <td>Nail, Hammer, Saw, Drill, Toolkit, Workbench, Golden Workbench</td>
      <td>Drill 120c; Toolkit 400c; Workbench 1,000c + 1 diamond</td>
      <td>2,500c + 3 pickaxes</td>
    </tr>
    <tr>
      <td>Plants</td><td>Seed Sack (1–3 per tap)</td>
      <td>Sprout, Seedling, Herb Pot, Flower Box, Shrub, Fruit Tree, Tree of Plenty</td>
      <td>Flower Box 100c; Shrub 350c; Fruit Tree 900c + 1 dynamite</td>
      <td>2,000c + 3 diamonds</td>
    </tr>
    <tr>
      <td>Treats</td><td>Gift Box (1–2 per tap)</td>
      <td>Crumb, Cookie Bite, Cupcake, Cake Slice, Layer Cake, Wedding Cake</td>
      <td>Cupcake 80c; Cake Slice 250c; Layer Cake 800c + 1 diamond</td>
      <td>3,000c + 5 vouchers</td>
    </tr>
  </tbody>
</table>

<p>Claiming removes the item from the board, so every claim is a decision: bank the mid-chain
coins now, or push the piece further up and take the top reward later. The top tier cannot be
merged again — that is enforced, and tested.</p>

<h3>The arithmetic that makes the board interesting</h3>

<p>Merging is strictly two-into-one, so a top-tier item in a seven-tier chain costs
2<sup>6</sup> = <strong>64 tier-one items</strong>. Treats, at six tiers, costs 32.</p>

<p>Now compare that with the board: 63 cells, three of them permanently occupied by generators,
leaving 60 free. <strong>You cannot hold the 64 pieces a Golden Workbench needs.</strong> The
board is one item short of the raw requirement even if it held nothing else, which means a full
chain run must be merged progressively — build pairs into higher tiers as you go, keeping the
footprint small — rather than hoarding a pile of nails and merging at the end.</p>

<p>Energy is not the constraint it first appears to be, either. At a mean of two items per
Toolbox tap, 64 tier-one items cost about 32 taps, or 32 of your 100 energy. Space, not energy,
is what the board is really rationing. That is the right way round for a merge game: the puzzle
should be the layout.</p>

<h3>The bonus drop</h3>

<p>Each merge has a 12% chance of a small bonus: 70% of those are 20–80 coins and 30% are 5–15
energy. The energy bubbles are the more valuable of the two in practice, since they feed
directly back into the constraint you are actually managing.</p>

<h3>What it feeds back into the farm</h3>

<p>Merge Meadow is not a closed loop. Its top rewards pay coins, diamonds and vouchers into the
main balances, and two of its rewards are mine tools — three pickaxes from the Tools chain, one
stick of dynamite from the Plants chain. Vouchers are otherwise a boat currency, which makes the
Treats chain a small side channel into the voucher decorations.</p>

<p>The board state lives in the save alongside everything else, with the same cell shape the
module expects; a test asserts the freshly created save seeds a board the merge module can
read without a migration.</p>

<div class="callout callout-info">
<p>The Merge Mania event carries an energy-regeneration payload of 2. Like the other event
payloads on this page, nothing reads it — the merge module does not consult event state.</p>
</div>
<figure class="shot">
  <img src="./screenshots/20-panel-merge_plot.webp" alt="A sliding panel titled Merge reading that the Merge Meadow is being built — check back soon."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>Merge Meadow.</strong> Captured before this panel was connected to the merge module, so the board described above is not on the screen shown.</figcaption>
</figure>
`,
    },

    /* --------------------------------------------------------------------- */
    {
      id: 'verification',
      heading: 'Verification and open items',
      html: `
<p>Everything on this page was read out of the source rather than a design document, and the
arithmetic in the tables was recomputed against the content tables. This section records what is
actually proven, and what is honestly still open.</p>

<h3>What is covered by tests</h3>

<table>
  <thead><tr><th>Suite</th><th>Assertions</th><th>Covers, among other things</th></tr></thead>
  <tbody>
    <tr><td>Crafting</td><td>23 passing</td><td>The surface seam never dropping an artifact over 500 digs; a depth-5 artifact appearing over 4,000; a dig without a tool doing nothing; exactly one tool per dig; merge energy across full and partial offline gaps; matched and mismatched merges; the top tier refusing to merge</td></tr>
    <tr><td>Research</td><td>15 passing</td><td>An artifact landing in the museum with barn capacity set to zero; an exhibit paying exactly once; a duplicate sale never taking the last copy; expedition loot across an offline gap; a failed expedition still costing its supplies; the advanced materials being unreachable except through expeditions; research prerequisites, the one-project limit, a full cancellation refund, neutral and composed effect values, and completion on tick</td></tr>
    <tr><td>Logistics</td><td>19 passing</td><td>Reeling before the cast is ready; a second cast refused; rarity weights holding over many rolls; chest loot respecting barn capacity</td></tr>
  </tbody>
</table>

<p>The content validator also passes clean, confirming among much else that every artifact
belongs to exactly one exhibit in both directions, that no artifact id collides with a good,
crop or material, that each mine depth's level strictly increases, that every expedition loot
row names exactly one kind of reward, and that the research tree is acyclic.</p>

<h3>Open items</h3>

<p>These are verified defects and gaps, not speculation. Each was traced through the source.</p>

<table>
  <thead><tr><th>Item</th><th>Effect</th><th>Kind</th></tr></thead>
  <tbody>
    <tr>
      <td>14 of 24 artifacts have no drop source</td>
      <td>No exhibit can be completed; the best any set reaches is 2 of 4</td>
      <td>Missing content in the drop tables</td>
    </tr>
    <tr>
      <td>No research effect reaches a consumer</td>
      <td>Completed nodes charge their cost and change no gameplay number</td>
      <td>Wiring gap; the merge point itself is correct</td>
    </tr>
    <tr>
      <td>Museum visitor income is never read</td>
      <td>The +515 per hour from completed exhibits does not reach the zoo</td>
      <td>Wiring gap</td>
    </tr>
    <tr>
      <td>Exhibit decoration rewards are recorded, not granted</td>
      <td>The Relic Plinth and Fossil Display are never placeable</td>
      <td>Wiring gap, deliberately left to the decorating module</td>
    </tr>
    <tr>
      <td>The mine looks for an event id that does not exist</td>
      <td>The mine's yield doubling never fires; the real event is Mining Madness</td>
      <td>Identifier mismatch</td>
    </tr>
    <tr>
      <td>No event effect payload is read by any system on this page</td>
      <td>Mining, fishing, merge, expedition and research events run their timers and points but apply no effect</td>
      <td>Wiring gap</td>
    </tr>
    <tr>
      <td>Specialist hire time is stored and unused</td>
      <td>Hiring is instantaneous</td>
      <td>Unimplemented data</td>
    </tr>
    <tr>
      <td>Merge Meadow has two different unlock levels</td>
      <td>The system says 11, the world structure says 28, and the module checks neither</td>
      <td>Inconsistency the validator does not catch</td>
    </tr>
    <tr>
      <td>A treasure chest is not persisted</td>
      <td>A chest lost between the reel and the open cannot be recovered</td>
      <td>State gap</td>
    </tr>
  </tbody>
</table>

<h3>Documented behaviours that are not defects</h3>

<ul>
  <li><strong>A dig into a full barn consumes the tool.</strong> Consistent with how every
      production output is capped, and the artifact roll is unaffected.</li>
  <li><strong>Cancelled research refunds to the barn.</strong> Even for costs drawn from the
      silo, and without a capacity check. Nothing is lost; the goods move.</li>
  <li><strong>An expedition can succeed and return nothing.</strong> A consequence of rolling
      the artifact chance independently so a Digger genuinely improves the odds.</li>
  <li><strong>The expedition tick does nothing.</strong> Readiness is computed from the stored
      timestamp; the hook exists only so every system shares one shape.</li>
</ul>

<div class="callout callout-info">
<p>Nothing on this page describes the interface. These modules are implemented and exercised
directly by the test suites, but how much of each one is currently reachable through the game's
panels is a separate question, recorded in
<a href="#/architecture">Architecture</a>.</p>
</div>
`,
    },
  ],

  related: ['crafting', 'township', 'logistics', 'deadtime', 'architecture'],
};
