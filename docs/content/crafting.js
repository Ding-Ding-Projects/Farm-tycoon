/* ---------------------------------------------------------------------------
 * The Building Workshop, the crafting spine, the per-factory minigames and
 * building mastery.
 *
 * Every number, id, name and behaviour in this file was read out of the game's
 * own source: src/data.js (MATERIALS, MATERIAL_SETS, BUILDINGS, MINIGAMES,
 * EFFECT_KEYS, MASTERY, TRAINS, AIRPORT, HELICOPTER, FISHING, DAILY_WHEEL,
 * EXPEDITIONS, MINE, TOWN, STORAGE, FARM), src/workshop.js, src/minigames.js,
 * src/collections.js, src/production.js, src/economy.js, src/lab.js and
 * tools/validate-data.mjs. Nothing here is remembered or inferred.
 *
 * Content counts come from ./data-counts.js, a generated module — never typed here.
 * ------------------------------------------------------------------------ */

import { COUNTS, MINIGAMES_TABLE, KITS_TABLE } from './data-counts.js';

export const article = {
  id: 'crafting',
  title: 'Crafting',
  group: 'The Workshop',
  summary:
    'The Building Workshop turns raw materials into components, components into a building kit, and the kit into a placed factory. Every factory then carries a minigame of its own that only it has.',

  sections: [
    {
      id: 'why',
      heading: 'Why a factory cannot simply be bought',
      html: `
<p>
  Most farm games price a production building in coins and stop there. Farm Tycoon does not.
  ${COUNTS.kitBuildings} of the ${COUNTS.buildings} buildings carry a <code>kit</code> field, and that kit is a
  crafted good that has to exist in your barn before the building can be placed. Coins are
  still charged on top, but coins alone are never enough.
</p>
<p>
  This one decision is what makes the late game a logistics problem instead of a savings
  problem. A player sitting on two million coins and no materials cannot buy their way to a
  Perfumery; a player with a well-fed train line and a busy workshop can build one while
  comparatively poor. It is also the reason the transport systems exist at all. Trains, the
  airport and the helicopter deliver construction materials, and without a sink that consumes
  them they would be decoration. The Workshop is that sink.
</p>

<h3>The chain, in full</h3>
<ol>
  <li><strong>Materials</strong> arrive in the barn from a transport, a chest, an expedition, a milestone or the daily wheel. They are never crafted.</li>
  <li>The <strong>Building Workshop</strong> turns materials into one of ${COUNTS.workshopComponents} <strong>components</strong> &mdash; a Roof Shingle, a Steel Beam, a Glazing Unit and so on.</li>
  <li>The same Workshop turns components (and occasionally raw materials again) into one of ${COUNTS.kitBuildings} <strong>kits</strong>.</li>
  <li>Placing the building <strong>consumes the kit</strong> and charges its coin cost. The kit is gone; the factory is yours.</li>
</ol>

<h3>The three exceptions, and why they exist</h3>
<p>
  The Feed Mill (level 5), the Bakery (level 3) and the Building Workshop itself (level 6) are
  coin-only. That is deliberate and it is enforced: <code>tools/validate-data.mjs</code> keeps a
  hand-written list of which buildings must require a kit and which must not, and refuses a data
  file where a building appears in neither list. The reason is a bootstrapping one. The opening
  hour of the game cannot depend on a supply chain that has not been built yet, and the Workshop
  obviously cannot require a kit that only the Workshop could make.
</p>

<div class="callout callout-info">
  <p>
    <strong>Where it lives.</strong> The Workshop is a real structure standing on the world grid
    at tile (13,&nbsp;10), three tiles by two, and you open it by clicking it. There is no
    Workshop button on the dock. Every system in this game opens from the thing that represents
    it in the world; the dock keeps only what has no place out there.
  </p>
</div>
<figure class="shot">
  <img src="./screenshots/25-panel-workshop_yard.webp" alt="A sliding panel titled Workshop with one card offering to build the Workshop itself for coins."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>Before the Workshop exists.</strong> Tapping the Workshop Yard while the Workshop itself is unbuilt offers exactly one card: build the Workshop, for coins. The materials, components and kits only appear once that building is standing.</figcaption>
</figure>
`,
    },

    {
      id: 'materials',
      heading: 'The four material sets',
      html: `
<p>
  There are ${COUNTS.materials} construction materials, and they are not one undifferentiated pile.
  Each carries a <code>set</code>, and the four sets are a closed list &mdash;
  <code>MATERIAL_SETS</code> is <code>['building', 'expansion', 'storage', 'advanced']</code> and
  the validator rejects anything outside it. The split matters because it decides what a delivery
  is <em>for</em>. A crate of bolts cannot be spent on land, and a shovel cannot become a Glazing
  Unit.
</p>

<table>
  <caption>The four sets and what they buy</caption>
  <thead>
    <tr><th>Set</th><th>Count</th><th>Members</th><th>Spent on</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>building</code></td><td>11</td>
      <td>Brick, Slab, Glass, Paint, Hammer, Nails, Cement, Roof Tile, Wire, Rope, Timber</td>
      <td>Workshop components and kits, town houses, community buildings, zoo enclosures, mine depth openings, the Laboratory build cost</td>
    </tr>
    <tr>
      <td><code>expansion</code></td><td>3</td>
      <td>Shovel, Axe, Saw</td>
      <td>The fifteen farm land expansions, and island unlocks</td>
    </tr>
    <tr>
      <td><code>storage</code></td><td>6</td>
      <td>Bolt, Plank, Duct Tape (barn); Screw, Wood Panel, Bracket (silo)</td>
      <td>Barn and silo capacity upgrades &mdash; three types per upgrade, three of each for the first one and one more of each every upgrade after</td>
    </tr>
    <tr>
      <td><code>advanced</code></td><td>3</td>
      <td>Jackhammer, Drill, Electric Saw</td>
      <td>The three deepest kits, and opening mine depths 3, 4 and 5</td>
    </tr>
  </tbody>
</table>

<h3>The advanced set is a hard gate, and it has a scar</h3>
<p>
  Advanced materials come from expedition loot and nothing else. No train carries them, no plane,
  no helicopter, no chest, no wheel segment. Since the Expedition Camp opens at level 57, that
  makes any recipe consuming one unreachable before level 57 by construction rather than by
  balance.
</p>
<p>
  The validator asserts exactly that, and the comment above the check records why it was written.
  Timber, Wire and Rope were once wrongly tagged <code>advanced</code>. Every other check still
  passed, the test suite stayed green, and the effect was that the Building Workshop's entire
  early crafting spine was silently walled off for fifty-one levels &mdash; a Timber Frame needs
  Timber, and Timber had no source until expeditions. The guard now re-asserts the tier's own
  promise independently: any recipe consuming an advanced material must itself be gated no
  earlier than <code>EXPEDITIONS.unlockLevel</code>, regardless of how early its building opens.
</p>

<div class="callout callout-warn">
  <p>
    <strong>A dead reference worth knowing about.</strong> Two comments in <code>data.js</code>
    describe advanced materials as coming from a &ldquo;Tool Exchange&rdquo; alongside expedition
    loot. There is no Tool Exchange anywhere in the source &mdash; the phrase appears only in
    those two comments. Expeditions are the only implemented source.
  </p>
</div>
`,
    },

    {
      id: 'sources',
      heading: 'Where materials come from',
      html: `
<p>
  Every material must be both earnable and spendable, and the validator checks both halves
  separately. Its own comment explains why the earn half was added: only the spend side was ever
  implemented at first, which left nine materials spendable and obtainable nowhere. That made
  every farm expansion and every storage upgrade permanently unbuyable while the whole suite
  stayed green.
</p>

<table>
  <caption>Material channels, with the level each opens at</caption>
  <thead>
    <tr><th>Channel</th><th>Opens</th><th>Cadence</th><th>Carries</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Daily wheel</td><td>1</td><td>One free spin per calendar day</td>
      <td>Ten of the eleven building materials (everything but Roof Tile), one or two at a time. Ten of the wheel's eighteen segments are materials.</td>
    </tr>
    <tr>
      <td>Fishing chests</td><td>12</td><td>An 8% chance per cast, instead of a fish</td>
      <td>Brick, Slab, Nails, Timber</td>
    </tr>
    <tr>
      <td>Town milestones</td><td>20</td><td>Once each, at nine population thresholds</td>
      <td>Building materials in fixed bundles &mdash; 4 Brick and 4 Slab at 60 population, rising to 20 Brick and 18 Glass at 2,000</td>
    </tr>
    <tr>
      <td>Cargo trains</td><td>21</td><td>Arrive every 3 hours; a filled train is away 1 hour</td>
      <td>The workhorse. All eleven building materials plus the three expansion tools, 4&ndash;8 items per trip. Brick and Slab are the heaviest weighted at 16 each; Shovel, Axe and Saw the lightest at 4, 3 and 3.</td>
    </tr>
    <tr>
      <td>Helicopter</td><td>22</td><td>Every 90 minutes, costing 1 of 5 fuel; fuel regenerates one per hour</td>
      <td>The earliest storage channel, and the reason the barn can grow before the airport exists. All six storage materials at weight 12, plus Nails, Brick, Slab and Glass. 2&ndash;4 items per flight.</td>
    </tr>
    <tr>
      <td>Airport</td><td>28</td><td>Every 4 hours</td>
      <td>Leans expansion and storage: Shovel, Axe and Saw at weight 14 each, all six storage materials at 8, and Cement and Roof Tile at 5. 3&ndash;6 items per flight.</td>
    </tr>
    <tr>
      <td>Co-op tasks and regatta placings</td><td>52</td><td>Daily tasks; weekly race</td>
      <td>Material bundles as task and placement rewards</td>
    </tr>
    <tr>
      <td>Expeditions</td><td>57</td><td>Per site, 1.5 to 11 hours per run</td>
      <td>One material per site's loot table. Cement, Wire, Rope and Timber from the four earliest sites; Jackhammer, Electric Saw and Drill from Fossil Beds, Drowned Bay and Ember Slope. The only advanced source.</td>
    </tr>
  </tbody>
</table>

<h3>An honest word about the early trickle</h3>
<p>
  The validator proves that every material has a source. It does not, and cannot easily, prove
  that the source arrives fast enough to be worth waiting for. The Dairy is the first kit-gated
  building and it opens at level 6 &mdash; but fishing chests are six levels away, trains fifteen,
  and there are no event material rewards in the data at all. At level 6 the daily wheel is the
  only channel, one spin a day, with roughly a ten-in-eighteen chance of one or two building
  materials.
</p>
<p>
  The <a href="#/crafting/worked-example">worked example below</a> puts a number on what that
  means: eighteen raw materials for a single Dairy Kit. This is a real open balance question
  rather than a defect, and it is recorded here rather than smoothed over.
</p>
`,
    },

    {
      id: 'components',
      heading: 'The eight components',
      html: `
<p>
  Components are the middle layer. Each is a good in its own right, sits in the barn, and is made
  from raw materials &mdash; except Glazing Unit and Plumbing Set, which consume a Brass Fitting
  and so make the Workshop feed itself one level deep.
</p>

<table>
  <caption>Every Workshop component. All eight unlock with the Workshop at level 6.</caption>
  <thead>
    <tr><th>Component</th><th>Id</th><th>Inputs</th><th>Craft time</th><th>XP</th><th>Sells for</th></tr>
  </thead>
  <tbody>
    <tr><td>Roof Shingle</td><td><code>shingle</code></td><td>1 Slab + 1 Nails</td><td>10 min</td><td>3</td><td>60</td></tr>
    <tr><td>Steel Beam</td><td><code>beam</code></td><td>1 Brick + 2 Nails</td><td>15 min</td><td>4</td><td>70</td></tr>
    <tr><td>Timber Frame</td><td><code>frame</code></td><td>1 Timber + 2 Nails</td><td>20 min</td><td>5</td><td>85</td></tr>
    <tr><td>Wall Panel</td><td><code>panel</code></td><td>2 Slab + 1 Paint</td><td>25 min</td><td>6</td><td>95</td></tr>
    <tr><td>Brass Fitting</td><td><code>fitting</code></td><td>1 Hammer + 1 Wire</td><td>30 min</td><td>7</td><td>110</td></tr>
    <tr><td>Glazing Unit</td><td><code>glazing</code></td><td>2 Glass + 1 Brass Fitting</td><td>40 min</td><td>9</td><td>130</td></tr>
    <tr><td>Wiring Loom</td><td><code>wiring_loom</code></td><td>2 Wire + 1 Rope</td><td>50 min</td><td>11</td><td>150</td></tr>
    <tr><td>Plumbing Set</td><td><code>plumbing</code></td><td>1 Cement + 2 Brass Fitting</td><td>1 h</td><td>13</td><td>170</td></tr>
  </tbody>
</table>

<h3>Components and kits are deliberate losses</h3>
<p>
  The validator enforces a margin rule on production: a recipe's output must sell for more than
  the sum of its inputs, or the player is strictly better off selling the raw ingredients. Every
  Workshop recipe is exempt, because every one of them carries <code>sink: true</code>.
</p>
<p>
  Take the Steel Beam. One Brick at 30 plus two Nails at 25 each is 80 coins of input; the Beam
  sells for 70. Crafting it and selling it loses ten coins and fifteen minutes. That is the point.
  Components exist to become buildings, not to be flipped, and the only other recipes in the game
  tagged as sinks are the animal feeds &mdash; which are eaten, not sold. If you find yourself
  selling Glazing Units for coins, the game has stopped working as designed.
</p>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/25b-workshop-craft-available.webp" alt="A Workshop panel showing a grid of craftable components and kits with question-mark icons, most disabled with a note listing which materials are missing, one (Roof Shingle) enabled."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>The chain, once the Workshop is up.</strong> Every component and kit is listed, and each unaffordable card states which materials it is short of rather than showing a blanket lock. One Roof Shingle is affordable here.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/25c-workshop-craft-in-progress.webp" alt="A Workshop panel showing a Roof Shingle card with a progress bar partway full and the label Crafting."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Crafting.</strong> Craft consumed the slab and the nails and pushed a real queue entry with a running timer.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/25d-workshop-craft-ready.webp" alt="A Workshop panel showing a Roof Shingle card with a full progress bar, the label Ready to collect, and a Collect button."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Ready to collect.</strong> The Workshop queue uses the same progress bar and Collect button as an ordinary production building.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/25e-workshop-component-collected.webp" alt="A Workshop panel with an empty crafting queue and a green toast reading Collected Roof Shingle."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Into the barn.</strong> Collect banks the finished Roof Shingle, awards its experience and clears the queue.</figcaption>
  </figure>
</div>
`,
    },

    {
      id: 'kits',
      heading: `The ${COUNTS.kitBuildings} kits`,
      html: `
<p>
  A kit is a single barn item that unlocks one specific building. The mapping is one-to-one and
  the validator proves it: a kit must be a real good, must actually be craftable in the Workshop,
  and no two buildings may claim the same kit.
</p>
<p>
  Two further gates are checked, and the second is subtler than it looks. The first is simply that
  no building may unlock before the Workshop does. The second is that a building must not unlock
  before <em>its own</em> kit is craftable &mdash; it is not enough that the kit exists somewhere
  in the recipe list, because that recipe carries its own <code>unlockLevel</code>. A building
  that opened at level 15 with a kit gated at 21 would be visible, affordable and unplaceable for
  six levels.
</p>

<table>
  <caption>Every kit, its building, and the two levels that gate it</caption>
  <thead>
    <tr>
      <th>Kit</th><th>Places</th><th>Building level</th><th>Kit level</th>
      <th>Inputs</th><th>Craft time</th><th>XP</th><th>Coin cost on top</th>
    </tr>
  </thead>
  <tbody>
${KITS_TABLE.map((k) => `<tr><td>${k.kitName}</td><td>${k.building}</td><td>${k.buildingLevel}</td><td>${k.kitLevel}</td><td>${k.inputs}</td><td>${k.craftTime}</td><td>${k.xp}</td><td>${k.coinCost.toLocaleString('en-US')}</td></tr>`).join('')}
  </tbody>
</table>

<h3>Reading the shape of that table</h3>
<p>
  Three things are worth pulling out. First, the kit recipes cluster at two unlock levels &mdash;
  ${COUNTS.kitsAtWorkshopLevel} of them open with the Workshop at ${COUNTS.workshopUnlockLevel},
  and ${COUNTS.kitsAtTrainLevel} more at 21, the same level trains
  arrive. That is not a coincidence: the second batch of kits assumes a train line feeding them.
</p>
<p>
  Second, craft times run from ninety minutes to just under twenty-five hours. The Yogurt Maker
  Kit is a full day in the queue, and that is before counting the components it eats or the
  expedition runs that produce the three Drills.
</p>
<p>
  Third, only the last ${COUNTS.kitsAdvancedCount} kits touch advanced materials, and their kit-recipe levels (75, 80
  and 86) all sit above the level 57 expedition gate, exactly as the advanced-tier guard demands.
</p>
<figure class="shot">
  <img src="./screenshots/25f-workshop-kit-ready.webp" alt="A Workshop panel showing a Dairy Kit card with a full progress bar, the label Ready to collect, and a Collect button."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>A kit, one tier up.</strong> The Dairy Kit crafted from two Timber Frames, two Wall Panels and three Roof Shingles, waiting to be collected. Same queue, higher up the chain.</figcaption>
</figure>
`,
    },

    {
      id: 'queue',
      heading: 'How a craft actually runs',
      html: `
<p>
  The Workshop is not a second production system. It is an ordinary <code>BUILDINGS</code> entry
  with a recipe list, and <code>src/workshop.js</code> delegates every timer to
  <code>production.enqueue</code> and <code>production.tick</code>. All the module adds on top is
  the workshop-specific view of what is craftable, and the kit gates that placement leans on.
</p>

<h3>Three slots, and what fills them</h3>
<p>
  The Workshop has <code>queueSlots: 3</code>, so three components or kits can be in progress at
  once. Crafting refuses when the queue is already full, when the recipe has not unlocked for your
  level, or when any single input is short.
</p>

<h3>Nothing is ever half-consumed</h3>
<p>
  This is the invariant the crafting tests care most about. <code>enqueue</code> checks every
  input before it touches any of them:
</p>
<pre><code>// Check every input BEFORE consuming any of them, so a failure never leaves
// a partial consumption behind that would need refunding.
for (const [inputId, qty] of Object.entries(recipe.inputs)) {
  if ((stockOf(inputId)[inputId] || 0) &lt; qty) return false;
}
for (const [inputId, qty] of Object.entries(recipe.inputs)) {
  stockOf(inputId)[inputId] -= qty;
}</code></pre>
<p>
  A failed craft therefore needs no refund path, because there is nothing to refund. The same
  discipline governs the kit: <code>consumeKit</code> only ever decrements when a whole kit is
  actually held, and returns <code>false</code> without touching the barn otherwise. Two separate
  tests pin this down &mdash; that a kit cannot be consumed when none is held and nothing is
  touched, and that a held kit is consumed exactly once and never left negative.
</p>

<h3>Timers are timestamps, not countdowns</h3>
<p>
  Every queue entry stores an absolute <code>readyAt</code> in milliseconds. Nothing counts down;
  the game compares <code>readyAt</code> against the current time at the moment of use. That is
  what makes a twenty-five-hour kit safe to start before closing the game: when you come back, the
  comparison resolves correctly whether the gap was a minute or a fortnight. There is no catch-up
  loop to get wrong. See <a href="#/deadtime">Dead time</a> for how the same model carries the
  rest of the timers in this game.
</p>

<h3>A full barn stalls collection rather than losing the craft</h3>
<p>
  Collecting a finished slot pays exactly one unit into the barn, and if there is no room it pays
  nothing and <em>leaves the entry queued</em>. A finished Glazing Unit sitting in a slot you
  cannot collect is annoying. A finished Glazing Unit that silently evaporated because the barn
  was full would be much worse. The queue slot stays occupied until you make room, which is its
  own quiet pressure toward upgrading the barn.
</p>
`,
    },

    {
      id: 'minigames',
      heading: 'Per-factory minigames: a bonus layer, never a gate',
      html: `
<p>
  Every one of the ${COUNTS.buildings} production buildings has exactly one minigame, and every one of
  those ${COUNTS.minigames} minigames carries a different effect. Not one minigame reskinned ${COUNTS.buildings}
  times, and not ${COUNTS.buildings} variations on a single timing bar that all do the same thing. The
  Bakery kneads dough for extra yield; the Smelter works the bellows for purity; the Workshop
  lines a frame up to save material. The verb and the reward both belong to that factory.
</p>

<div class="callout callout-ok">
  <p>
    <strong>Production completes whether or not you ever play one.</strong> This is the
    load-bearing rule of the whole feature, not a nicety. A player who never opens a minigame is
    playing the game correctly, just without the bonus.
  </p>
</div>

<h3>Why gating on skill would break the game</h3>
<p>
  The timer model is built around absolute timestamps precisely so that a batch started before bed
  is finished when you wake up. If a recipe required a minigame to complete, that guarantee would
  evaporate: offline play would produce nothing, and a player with unsteady hands, a trackpad, a
  slow connection or a screen reader would be locked out of production entirely rather than merely
  earning a smaller bonus. Hand-eye skill decides how much extra you get. It never decides whether
  you get anything.
</p>

<h3>The three ways a run can end</h3>
<ul>
  <li><strong>You play it and score well.</strong> A bonus is banked against that building and spent when its batch is collected.</li>
  <li><strong>You play it badly.</strong> A score of zero banks a bonus of zero. There is no penalty; a bad run is exactly as good as no run.</li>
  <li><strong>You cancel, or never start.</strong> <code>cancel()</code> abandons a run without penalty, and its own comment says so plainly: skipping a minigame is always free.</li>
</ul>

<h3>Availability</h3>
<p>
  A minigame can only be started when its building has a batch already queued and still running
  &mdash; <code>isAvailable</code> is true when at least one queue entry for that building has a
  <code>readyAt</code> in the future. You cannot bank bonuses against an idle factory and cash
  them in later, and you cannot improve a batch that has already finished.
</p>
`,
    },

    {
      id: 'minigame-list',
      heading: 'Every minigame',
      html: `
<p>
  ${COUNTS.buildings} buildings, ${COUNTS.minigames} minigames, ${COUNTS.minigames} distinct
  effect keys. The cap is the most
  a perfect run can grant, so no bonus is farmable without bound; the range across the whole set
  is 20% to 35%.
</p>

<table>
  <caption>All ${COUNTS.minigames} per-factory minigames</caption>
  <thead>
    <tr><th>Minigame</th><th>Factory</th><th>Effect key</th><th>Cap</th><th>What it is</th></tr>
  </thead>
  <tbody>
${MINIGAMES_TABLE.map((m) => `<tr><td>${m.name}</td><td>${m.factory}</td><td><code>${m.effect}</code></td><td>${m.capPercent}%</td><td>${m.purpose}</td></tr>`).join('')}
  </tbody>
</table>

<p>
  The validator checks both directions of that mapping: every building must name a minigame that
  exists, and every minigame's effect must be a member of the closed <code>EFFECT_KEYS</code> set.
  A typo in either place fails the data check rather than shipping a factory whose bonus quietly
  goes nowhere.
</p>
`,
    },

    {
      id: 'runs',
      heading: 'How a run is generated, scored and spent',
      html: `
<p>
  A minigame run has three moving parts, and each of them is deliberately boring in a way that
  matters.
</p>

<h3>The round is a pure function of its seed</h3>
<p>
  <code>start()</code> picks a 32-bit seed from the current time, a hash of the building id and a
  random draw, and builds the round from that seed alone using mulberry32 &mdash; a small,
  well-known generator that produces the same stream of floats for a given seed on every
  platform, with no dependence on <code>Math.random</code>. The board is eight events long and
  every event's timing and target come out of that one stream.
</p>
<p>
  Picking <em>which</em> round you are offered is allowed to vary. What must never vary is the
  mapping from a seed to its round, because the seed is stored in the save. A refresh, a replay or
  a reconnect regenerates the board from the stored seed, and if that regeneration could reroll,
  it would eventually reroll into something easier. A test asserts directly that the same seed
  always produces the same round.
</p>

<h3>The score is clamped, not trusted</h3>
<p>
  <code>finish()</code> takes a score between 0 and 1 and pays out the score multiplied by the
  cap. The caller is user-interface code, so the score is treated as untrusted input: anything
  above 1 is clamped to 1, anything below 0 is clamped to 0, and a value that is not a number at
  all becomes 0. Two tests cover exactly those cases &mdash; a score above 1 is clamped rather
  than paying more than the cap, and a negative score is clamped to zero rather than being treated
  as a penalty.
</p>

<h3>A bonus is banked once and spent once</h3>
<p>
  Finishing deletes the pending run and writes a result against the building. Finishing a second
  time on the same building fails, because there is no longer a pending run to finish &mdash;
  again, a test pins this. Later, <code>pendingBonus()</code> reads the result and deletes it in
  the same call, so collecting the batch spends it exactly once.
</p>
<p>
  Two small design touches sit around that. A run stays valid for sixty seconds and then expires,
  swept up by the game loop, so a run left open forever cannot be cashed in against a much later
  batch. And <code>pendingBonus()</code> returns a zeroed effect rather than <code>null</code>
  when nothing is pending, so no caller ever has to branch on absence &mdash; there is a test for
  that too.
</p>

<h3>What the save holds</h3>
<pre><code>state.minigames = {
  pending: { buildingId: { gameId, seed, expiresAt } },
  results: { buildingId: { effect, amount, appliedAt } },
  played:  { gameId: count },
}</code></pre>
`,
    },

    {
      id: 'mastery',
      heading: 'Building mastery',
      html: `
<p>
  Mastery is the patient counterpart to the minigames. Where a minigame rewards one good run,
  mastery rewards repetition, and what it grants is permanent. Every completed production counts
  toward the building that made it, and four star tiers hang off that count.
</p>

<table>
  <caption>The four mastery tiers. The bonus multiplies production time, so lower is better.</caption>
  <thead>
    <tr><th>Star</th><th>Completed makes</th><th>Production time</th><th>Time saved</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>50</td><td>&times; 0.98</td><td>2%</td></tr>
    <tr><td>2</td><td>200</td><td>&times; 0.96</td><td>4%</td></tr>
    <tr><td>3</td><td>600</td><td>&times; 0.93</td><td>7%</td></tr>
    <tr><td>4</td><td>1,500</td><td>&times; 0.90</td><td>10%</td></tr>
  </tbody>
</table>

<h3>How it composes</h3>
<p>
  Mastery uses one effect key for every building: <code>productionTimeMult</code>. The merged
  figure is the <em>product</em> of every mastered building's current bonus, and an unmastered
  building contributes exactly 1 rather than <code>undefined</code>. So a farm with three
  buildings at four stars is running at 0.90 &times; 0.90 &times; 0.90 = 0.729, a 27% reduction
  applied globally.
</p>
<p>
  Two properties are asserted by test. The star tier really does advance on repetition, and
  <code>MASTERY.effect</code> really is a member of <code>EFFECT_KEYS</code>. There is also a
  directional assertion worth quoting, because it is the kind of check that catches a sign error
  before a player does: a mastered building must only ever help, never hurt,
  <code>productionTimeMult</code>.
</p>

<h3>Mastery sits beside the collection books</h3>
<p>
  Both live in <code>src/collections.js</code> and open from the Collections Shelf, a one-tile
  structure at (10,&nbsp;21) that unlocks at level 10. The five books &mdash; Crop Almanac, Recipe
  Book, Fishing Log, Forage Journal, Relic Catalogue &mdash; derive their entries from the live
  data tables rather than a hand-written list, so a new recipe joins the Recipe Book the moment it
  lands in <code>data.js</code>. The Recipe Book's entry list is every recipe in the game,
  Workshop components and kits included, at ten entries per reward tier.
</p>
`,
    },

    {
      id: 'effects',
      heading: 'One merge point: EFFECT_KEYS',
      html: `
<p>
  Three separate systems in this game hand out multipliers: minigames, building mastery, and
  Laboratory research. A fourth, co-op perks, borrows the same machinery. Left alone, that is four
  independent notions of how fast production runs, which will eventually disagree, and the
  disagreement will be invisible because each one is individually correct.
</p>
<p>
  So there is one closed list of ${COUNTS.effectKeysTotal} effect keys, and every bonus in the game must name one
  of them. ${COUNTS.minigames} of the ${COUNTS.effectKeysTotal} belong to the minigames, one per factory. The remaining
  ${COUNTS.effectKeysShared} are shared: <code>cropGrowMult</code>, <code>productionTimeMult</code>,
  <code>animalProduceMult</code>, <code>siloCapBonus</code>, <code>barnCapBonus</code>,
  <code>orderPayoutMult</code>, <code>mineYieldBonus</code>, <code>fishRareChance</code>,
  <code>zooIncomeMult</code> and <code>truckIntervalMult</code>.
</p>

<h3>The registry</h3>
<p>
  <code>src/economy.js</code> keeps a small provider registry. Any module that computes a
  multiplier registers a function, and every registered provider is consulted at the single merge
  point. With nothing registered the multiplier is a plain 1, so the economy works standalone. A
  provider that throws is caught and ignored, because a broken provider must never break the
  economy.
</p>
<pre><code>export function registerMultiplierEffect(fn) { multiplierProviders.push(fn); }</code></pre>
<p>
  The Laboratory registers itself against that hook at the bottom of <code>src/lab.js</code>, so
  any caller already asking the economy for a multiplier picks up research automatically, with no
  circular import between the two modules. <code>collections.masteryEffect()</code> returns an
  object shaped identically to <code>lab.researchedEffect()</code> &mdash; every key present,
  neutral values filled in &mdash; for the same reason: callers never have to branch on a missing
  key.
</p>

<div class="callout callout-warn">
  <p>
    <strong>Honestly, this merge point is not finished.</strong> The Laboratory is registered.
    Mastery and the minigames both compute correct, tested effect objects, but neither is
    registered as a provider yet, and <code>production.collectBuilding</code> does not call
    <code>minigames.pendingBonus()</code> or <code>collections.recordMake()</code>. The bonuses are
    calculated and banked; they are not yet spent. See <a href="#/crafting/status">Status</a>.
  </p>
</div>
`,
    },

    {
      id: 'worked-example',
      heading: 'Worked example: one Dairy, from nothing',
      html: `
<p>
  The Dairy is the first kit-gated building in the game and the cheapest, so it is the honest
  smallest case. Here is the whole chain with real ids and real numbers.
</p>

<h3>What the kit needs</h3>
<p>
  <code>kit_dairy</code> takes <code>{ frame: 2, panel: 2, shingle: 3 }</code> and 5,400 seconds
  &mdash; ninety minutes &mdash; for 20 XP.
</p>

<h3>What those seven components need</h3>
<table>
  <thead>
    <tr><th>Component</th><th>Needed</th><th>Raw inputs each</th><th>Raw total</th><th>Time each</th><th>XP each</th></tr>
  </thead>
  <tbody>
    <tr><td>Timber Frame</td><td>2</td><td>1 Timber + 2 Nails</td><td>2 Timber, 4 Nails</td><td>20 min</td><td>5</td></tr>
    <tr><td>Wall Panel</td><td>2</td><td>2 Slab + 1 Paint</td><td>4 Slab, 2 Paint</td><td>25 min</td><td>6</td></tr>
    <tr><td>Roof Shingle</td><td>3</td><td>1 Slab + 1 Nails</td><td>3 Slab, 3 Nails</td><td>10 min</td><td>3</td></tr>
  </tbody>
</table>

<h3>The bill of materials</h3>
<div class="stat-row">
  <div class="stat"><div class="stat-num">18</div><div class="stat-label">raw materials</div></div>
  <div class="stat"><div class="stat-num">3 h 30 m</div><div class="stat-label">total craft time</div></div>
  <div class="stat"><div class="stat-num">51</div><div class="stat-label">XP earned</div></div>
  <div class="stat"><div class="stat-num">450</div><div class="stat-label">coins on placement</div></div>
</div>
<p>
  Eighteen raw materials: <strong>7 Slab, 7 Nails, 2 Timber, 2 Paint</strong>. Three and a half
  hours is the total oven time if everything ran one after another. In practice the seven
  component crafts share three queue slots, and the best possible packing of 25, 25, 20, 20, 10,
  10 and 10 minutes into three slots finishes in 45 minutes &mdash; so with every material in
  hand and prompt re-queueing, the realistic floor is about 2 hours 15 minutes rather than 3
  hours 30.
</p>
<p>
  The 51 XP is the sum of the parts: two Timber Frames at 5, two Wall Panels at 6, three Roof
  Shingles at 3, and the kit itself at 20.
</p>

<h3>Where the eighteen come from</h3>
<p>
  All four are <code>building</code>-set materials. The Dairy unlocks at level 6, and at level 6
  the only channel that carries them is the daily wheel: one spin a day, one or two items when it
  lands on a material segment. Fishing chests join at 12 with Brick, Slab, Nails and Timber;
  trains at 21 with everything.
</p>
<p>
  So the Dairy at level 6 is genuinely a saving-up exercise measured in days rather than hours.
  That is worth stating plainly rather than implying a smoother ramp than the data describes. The
  validator confirms every one of those four materials has a source; it makes no claim about the
  rate.
</p>

<h3>The last step</h3>
<p>
  With <code>kit_dairy</code> in the barn, placing the Dairy checks
  <code>hasKitFor('dairy')</code>, charges 450 coins, and calls <code>consumeKit('dairy')</code>,
  which decrements the kit by exactly one. The Dairy occupies two tiles by two, has three queue
  slots of its own, and comes with Churn Timing &mdash; its own minigame, capped at a 20% speed
  bonus, which you are free to ignore forever.
</p>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/25g-workshop-build-gate.webp" alt="A Workshop panel Build section: the Dairy card shows a checked kit and an enabled Build button, while other building cards show an unchecked kit requirement and are disabled."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>The gate.</strong> With one Dairy Kit banked, the Dairy card shows a satisfied requirement and an enabled Build button, while its neighbours stay disabled until their own kits exist.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/25h-workshop-building-placed.webp" alt="A Workshop panel Build section with a green toast reading Built Dairy, and no Dairy card left in the list."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Built.</strong> Build places the Dairy and consumes the kit. The card leaves the list because the Dairy is now a placed object rather than an available one.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/25i-workshop-dairy-in-world.webp" alt="A dairy building sitting on the farm, freshly placed."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>The payoff.</strong> The Dairy standing on the farm at the end of the materials, components and kit chain, drawn like every other building.</figcaption>
  </figure>
</div>
`,
    },

    {
      id: 'status',
      heading: 'Status: what is built, what is proven, what is not wired',
      html: `
<p>
  This page describes the game as the committed source actually behaves, which means being clear
  about the seam between logic that exists and logic that is reached.
</p>

<h3>Implemented and covered by tests</h3>
<ul>
  <li>Component and kit crafting, including that a recipe consumes its materials exactly once, and that a craft short of an input refuses without touching the barn at all.</li>
  <li>Collecting a finished component pays exactly one unit into the barn.</li>
  <li><code>hasKitFor</code> gates placement; <code>consumeKit</code> consumes exactly one kit and never leaves a negative count; a building with no kit requirement always reports <code>hasKitFor</code> true.</li>
  <li>Minigame score clamping in both directions, seed determinism, single-consumption of a finished run, and the zeroed-rather-than-null pending bonus.</li>
  <li>Mastery tier advancement, and the assertion that its effect key is a real <code>EFFECT_KEYS</code> member and only ever helps.</li>
</ul>
<p>
  Against the committed tree, <code>tools/test-crafting.mjs</code> reports
  <strong>23 passed, 0 failed</strong> and <code>tools/test-deadtime.mjs</code> reports
  <strong>16 passed, 0 failed</strong>. <code>tools/validate-data.mjs</code> passes, reporting
  ${COUNTS.buildings} buildings, ${COUNTS.recipes} recipes, ${COUNTS.goods} goods and
  ${COUNTS.materials} materials.
</p>

<h3>Written, correct, and not yet called</h3>
<div class="callout callout-warn">
  <p>These are real gaps, not stylistic quibbles. Each is a function that works and has no caller.</p>
</div>
<ul>
  <li>
    <strong>The minigame bonus never reaches an output.</strong>
    <code>production.collectBuilding</code> does not call <code>minigames.pendingBonus()</code>, so
    a banked result sits in <code>state.minigames.results</code> and is never spent. Playing a
    minigame currently moves the <code>played</code> counter and nothing else a player can see.
  </li>
  <li>
    <strong>Mastery never counts.</strong> Nothing calls <code>collections.recordMake()</code>
    when a batch completes, so <code>makes</code> stays at zero and no building earns a star
    through normal play.
  </li>
  <li>
    <strong>Mastery is not registered as a multiplier provider.</strong> Only
    <code>src/lab.js</code> calls <code>economy.registerMultiplierEffect</code>. Even a
    hand-populated mastery table would not affect production time today.
  </li>
  <li>
    <strong>The validator's event branch is dead.</strong> Its material-source check iterates
    <code>EVENTS.types</code>, and <code>EVENTS</code> has no <code>types</code> key &mdash; its
    keys are <code>weekend</code>, <code>miniWeekday</code>, <code>fair</code> and
    <code>holidays</code>. The loop is a no-op, which is harmless here only because no event grants
    materials anyway.
  </li>
</ul>

<div class="callout callout-ok">
  <p>
    <strong>The kit gate is enforced, and this page previously said it was not.</strong> The
    earlier wording claimed the build panel called <code>farm.place</code> without consulting
    <code>workshop.hasKitFor</code>. That was wrong when it was written, not merely overtaken:
    the panel was wired in <code>2b33dec</code>, which landed before this article's first commit.
    What was true, and misread as proof, is that <code>src/farm.js</code> itself contains no
    reference to kits &mdash; the gate deliberately sits <em>above</em> <code>farm.place</code>
    rather than inside it, because that same function also places animal pens and the Workshop
    itself, and those are coin-only by design. <code>renderWorkshop()</code> in
    <code>src/ui.js</code> disables the Build button while the kit is missing, re-checks
    <code>workshop.hasKitFor</code> inside the click handler so a re-enabled button still
    refuses, and calls <code>workshop.consumeKit</code> only from the post-placement callback,
    so a placement that fails for any other reason never eats the kit. All three behaviours are
    pinned by <code>tools/test-ui-workshop.mjs</code>.
  </p>
</div>

<h3>An open balance question</h3>
<p>
  Recorded rather than resolved: the first kit-gated building arrives at level 6 needing eighteen
  raw materials, and the only material channel open at level 6 is a once-a-day wheel spin. Either
  the Dairy wants to move later, or an early material trickle wants to arrive sooner. The data
  validator cannot decide this; it only proves that each material is obtainable somewhere.
</p>

<div class="callout callout-info">
  <p>
    Nothing on this page describes a signed installer. The Windows build is unsigned as a matter of
    permanent project policy, so it shows an unknown-publisher warning on install.
  </p>
</div>
`,
    },
  ],

  related: ['logistics', 'exploration', 'farming', 'deadtime', 'architecture'],
};
