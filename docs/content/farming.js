/* ============================================================================
 * Farm Tycoon documentation — "The farm loop".
 *
 * Crops and fields, animals and pens, production buildings and their recipe
 * queues, the silo and the barn, coins, XP, the ninety-five level curve, and
 * diamond time-skips.
 *
 * Every number in this article was read out of the game's own source: the
 * content tables in src/data.js, and the behaviour in src/production.js,
 * src/farm.js, src/economy.js and src/state.js. The larger tables were
 * generated from those tables rather than typed by hand. Where something is
 * defined in data but has no code consuming it yet, this article says so
 * rather than describing an intention as a behaviour.
 *
 * Content counts come from ./data-counts.js, a generated module — never typed here.
 * ==========================================================================*/

import { COUNTS, BUILDINGS_TABLE } from './data-counts.js';

export const article = {
  id: 'farming',
  title: 'The farm loop',
  group: 'The Farm',
  summary:
    'Crops, animals, production buildings, storage and the level curve — the loop everything else in the game is built on top of.',

  sections: [
    /* --------------------------------------------------------------- */
    {
      id: 'the-loop',
      heading: 'The loop in one page',
      html: `
<p>
  Farm Tycoon has one engine underneath every other system. Land grows crops.
  Crops feed animals and factories. Factories turn cheap things into expensive
  things. Everything sells for coins and pays experience, experience buys
  levels, and levels open more land, more crops, more animals and more
  factories. The town, the trains, the zoo, the mine and the islands all hang
  off this loop; none of them replaces it.
</p>

<div class="stat-row">
  <div class="stat"><div class="stat-num">22</div><div class="stat-label">crops</div></div>
  <div class="stat"><div class="stat-num">12</div><div class="stat-label">animals</div></div>
  <div class="stat"><div class="stat-num">26</div><div class="stat-label">production buildings</div></div>
  <div class="stat"><div class="stat-num">128</div><div class="stat-label">recipes</div></div>
  <div class="stat"><div class="stat-num">95</div><div class="stat-label">levels</div></div>
</div>

<h3>The six nouns</h3>
<p>
  Almost everything in the game is one of six things, and knowing which one you
  are looking at tells you how it behaves.
</p>
<ul>
  <li><strong>A field</strong> is a one-tile plot. It holds one crop at a time,
    and it is empty again the moment you harvest it.</li>
  <li><strong>A crop</strong> is both the seed and the harvest. There is no
    separate seed item: planting wheat spends wheat, and harvesting wheat
    returns wheat.</li>
  <li><strong>A pen</strong> holds one species. You feed it, wait, and collect a
    batch of that species' product.</li>
  <li><strong>A good</strong> is anything that is not a crop — animal products,
    feed, cooked and crafted items, ores, fish and construction materials.</li>
  <li><strong>A production building</strong> takes goods and crops in, holds
    them on a queue for a fixed time, and hands back one good per queue slot.</li>
  <li><strong>A structure</strong> is a fixed piece of world furniture — the
    barn, the silo, the order board, the mine, the workshop. You open a system
    by clicking its structure in the world, not by finding it in a menu.</li>
</ul>

<h3>Two buckets, and only two</h3>
<p>
  Storage is deliberately split in half. <strong>Crops live in the silo. Every
  other item lives in the barn.</strong> That single rule decides where anything
  is stored, with no exceptions and no third bucket: construction materials,
  ores, fish and crafted kits are all goods, so they are all in the barn.
</p>
<p>
  The code makes the same split in one line — <code>production.js</code> asks
  whether an id exists in the crop table and picks a bucket from the answer:
</p>
<pre><code>function isCrop(id) { return Object.prototype.hasOwnProperty.call(CROPS, id); }
function stockOf(id) { return isCrop(id) ? state.silo.items : state.barn.items; }</code></pre>
<p>
  This matters when you read a recipe. A bakery loaf costs three wheat and pays
  out one bread, so it draws from the silo and deposits into the barn. A recipe
  with mixed inputs draws from both at once, per ingredient.
</p>

<h3>One clock, and it never stops</h3>
<p>
  There is no tick counter anywhere in this game. Every timer — a growing crop,
  a producing pen, a queued recipe — is stored as an <em>absolute wall-clock
  timestamp</em> called <code>readyAt</code>, and everything asks the same
  question: is <code>readyAt</code> in the past yet?
</p>
<div class="callout callout-info">
  <p>
    <strong>The consequence is the whole design.</strong> Because a timestamp
    from last Tuesday compared against right now already gives the right answer,
    closing the game changes nothing. There is no offline catch-up pass to run,
    no elapsed time to replay, and nothing that can drift. A two-day absence and
    a two-day wait produce byte-identical results, and a test in
    <code>tools/test-core.mjs</code> asserts exactly that.
  </p>
</div>
<p>
  Read more about how this interacts with the systems designed for absences in
  <a href="#/deadtime">the dead-time systems</a>, and about the save format that
  carries those timestamps across sessions in
  <a href="#/architecture">the architecture notes</a>.
</p>
<figure class="shot">
  <img src="./screenshots/03-world-growth-stages.webp" alt="A farm showing wheat at four different growth stages side by side — bare seeded soil, small sprouts, a growing stem, and a fully grown ready-to-harvest head — next to two empty tilled plots."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>Every growth stage at once.</strong> Four of the six starting fields sown with wheat and advanced into each of the four bands the crop renderer draws: seed dots when freshly planted, sprout leaves at a quarter grown, a stem at three quarters, and a full head once ready. The two plots left bare are there for contrast.</figcaption>
</figure>
`,
    },

    /* --------------------------------------------------------------- */
    {
      id: 'crops',
      heading: 'Crops and fields',
      html: `
<p>
  Twenty-two crops, from wheat at level 1 to mint at level 84. A crop is defined
  by five numbers: when it unlocks, how long it grows, how many seeds it costs
  to plant, what one unit sells for, and how much experience a harvest pays.
</p>

<h3>The doubling rule</h3>
<p>
  Every crop returns exactly twice what it cost to plant. This is the single
  most important number in the early game and it is one line of
  <code>production.js</code>:
</p>
<pre><code>const yieldQty = crop.seedCost * 2; // harvest returns 2x the planted seed</code></pre>
<p>
  Planting spends <code>seedCost</code> units from the silo; harvesting returns
  <code>seedCost &times; 2</code>. So a field's <em>net</em> output is one
  <code>seedCost</code> per cycle, and your seed stock compounds — six wheat
  becomes twelve, twelve becomes twenty-four, and you never buy a seed. The
  columns below split this out: <strong>yield</strong> is what the harvest
  hands you, and <strong>net coins</strong> is what the surplus is worth once
  you have set the next planting aside.
</p>

<h3>Growth stages</h3>
<p>
  A planted field reports one of five states, derived from elapsed time rather
  than stored anywhere. <code>growthStage()</code> returns <code>-1</code> for an
  empty plot, then <code>0</code>, <code>1</code> and <code>2</code> for the
  three growing thirds, and <code>3</code> once <code>readyAt</code> has passed.
</p>
<table>
  <caption>What each stage means</caption>
  <thead><tr><th>Stage</th><th>Elapsed</th><th>What you see</th></tr></thead>
  <tbody>
    <tr><td><code>-1</code></td><td>&mdash;</td><td>Bare soil. The plot is empty and can be planted.</td></tr>
    <tr><td><code>0</code></td><td>under one third</td><td>Sprouts.</td></tr>
    <tr><td><code>1</code></td><td>one to two thirds</td><td>Half grown.</td></tr>
    <tr><td><code>2</code></td><td>over two thirds</td><td>Nearly ready.</td></tr>
    <tr><td><code>3</code></td><td>past <code>readyAt</code></td><td>Ready to harvest.</td></tr>
  </tbody>
</table>
<p>
  The thirds are proportional, not absolute, so wheat spends forty seconds in
  each stage and mint spends twelve hours in each. The stage is recomputed from
  <code>plantedAt</code> on every frame, which is why it is correct after any
  absence without anything having to be saved.
</p>

<h3>All ${COUNTS.crops} crops</h3>
<p>
  <strong>Coins per hour</strong> below assumes a perfect cadence — that you
  harvest and replant the instant a crop finishes. Nobody plays that way, and
  the next heading explains why the column is misleading if you read it as
  advice.
</p>
<table>
  <caption>Every crop, with its economics at a perfect harvest cadence</caption>
  <thead>
    <tr>
      <th>Id</th><th>Name</th><th>Level</th><th>Grows in</th>
      <th>Seeds</th><th>Yield</th><th>Sells at</th>
      <th>Net coins</th><th>Coins/h</th><th>XP</th>
    </tr>
  </thead>
  <tbody>
<tr><td><code>wheat</code></td><td>Wheat</td><td>1</td><td>2 min</td><td>1</td><td>2</td><td>4</td><td>4</td><td>120</td><td>1</td></tr>
<tr><td><code>corn</code></td><td>Corn</td><td>2</td><td>5 min</td><td>2</td><td>4</td><td>7</td><td>14</td><td>168</td><td>1</td></tr>
<tr><td><code>carrot</code></td><td>Carrot</td><td>3</td><td>10 min</td><td>3</td><td>6</td><td>11</td><td>33</td><td>198</td><td>2</td></tr>
<tr><td><code>soybean</code></td><td>Soybean</td><td>5</td><td>20 min</td><td>4</td><td>8</td><td>15</td><td>60</td><td>180</td><td>2</td></tr>
<tr><td><code>sugarcane</code></td><td>Sugarcane</td><td>7</td><td>30 min</td><td>5</td><td>10</td><td>19</td><td>95</td><td>190</td><td>3</td></tr>
<tr><td><code>cotton</code></td><td>Cotton</td><td>9</td><td>45 min</td><td>6</td><td>12</td><td>24</td><td>144</td><td>192</td><td>3</td></tr>
<tr><td><code>tomato</code></td><td>Tomato</td><td>11</td><td>1 h</td><td>7</td><td>14</td><td>30</td><td>210</td><td>210</td><td>4</td></tr>
<tr><td><code>potato</code></td><td>Potato</td><td>13</td><td>1 h 30 min</td><td>8</td><td>16</td><td>37</td><td>296</td><td>197</td><td>4</td></tr>
<tr><td><code>strawberry</code></td><td>Strawberry</td><td>15</td><td>2 h</td><td>10</td><td>20</td><td>46</td><td>460</td><td>230</td><td>5</td></tr>
<tr><td><code>pumpkin</code></td><td>Pumpkin</td><td>18</td><td>3 h</td><td>12</td><td>24</td><td>58</td><td>696</td><td>232</td><td>6</td></tr>
<tr><td><code>indigo</code></td><td>Indigo</td><td>21</td><td>4 h</td><td>14</td><td>28</td><td>72</td><td>1,008</td><td>252</td><td>7</td></tr>
<tr><td><code>chili</code></td><td>Chili Pepper</td><td>25</td><td>6 h</td><td>17</td><td>34</td><td>90</td><td>1,530</td><td>255</td><td>8</td></tr>
<tr><td><code>coffee</code></td><td>Coffee Bean</td><td>29</td><td>8 h</td><td>20</td><td>40</td><td>112</td><td>2,240</td><td>280</td><td>10</td></tr>
<tr><td><code>grapes</code></td><td>Grapes</td><td>33</td><td>12 h</td><td>25</td><td>50</td><td>140</td><td>3,500</td><td>292</td><td>12</td></tr>
<tr><td><code>rice</code></td><td>Rice</td><td>51</td><td>14 h</td><td>30</td><td>60</td><td>172</td><td>5,160</td><td>369</td><td>14</td></tr>
<tr><td><code>olive</code></td><td>Olive</td><td>55</td><td>16 h</td><td>34</td><td>68</td><td>200</td><td>6,800</td><td>425</td><td>17</td></tr>
<tr><td><code>lavender</code></td><td>Lavender</td><td>58</td><td>18 h</td><td>39</td><td>78</td><td>232</td><td>9,048</td><td>503</td><td>19</td></tr>
<tr><td><code>tea_leaf</code></td><td>Tea Leaf</td><td>62</td><td>20 h</td><td>45</td><td>90</td><td>270</td><td>12,150</td><td>608</td><td>23</td></tr>
<tr><td><code>bell_pepper</code></td><td>Bell Pepper</td><td>66</td><td>23 h</td><td>52</td><td>104</td><td>314</td><td>16,328</td><td>710</td><td>26</td></tr>
<tr><td><code>peony</code></td><td>Peony</td><td>71</td><td>26 h</td><td>60</td><td>120</td><td>365</td><td>21,900</td><td>842</td><td>30</td></tr>
<tr><td><code>watermelon</code></td><td>Watermelon</td><td>77</td><td>30 h</td><td>69</td><td>138</td><td>424</td><td>29,256</td><td>975</td><td>35</td></tr>
<tr><td><code>mint</code></td><td>Mint</td><td>84</td><td>36 h</td><td>80</td><td>160</td><td>492</td><td>39,360</td><td>1,093</td><td>41</td></tr>
  </tbody>
</table>

<h3>Why late crops look bad and are not</h3>
<p>
  Measured instantaneously, wheat pays about fifteen experience per hour per
  field and mint pays about one. Read that way, the late game looks like a
  punishment. It is an artefact of measuring the wrong thing, and the game's
  own source records the correction beside the crop table so nobody re-derives
  it wrongly a fourth time.
</p>
<p>
  A crop only pays out when somebody is present to harvest it. The honest unit
  is therefore not <code>growTime</code> but
  <code>ceil(growTime / visit) &times; visit</code> — how long a field is
  actually tied up given how often you check in. Model a cadence a person
  really keeps and the ranking inverts:
</p>
<table>
  <caption>Experience per hour per field, by how often you actually check in</caption>
  <thead><tr><th>Check-in cadence</th><th>Wheat</th><th>Strawberry</th><th>Grapes</th><th>Mint</th></tr></thead>
  <tbody>
    <tr><td>every 2 minutes</td><td>15.15</td><td>2.48</td><td>1.00</td><td>1.14</td></tr>
    <tr><td>every 4 hours</td><td>0.25</td><td>1.25</td><td>1.00</td><td>1.14</td></tr>
    <tr><td>every 12 hours</td><td>0.08</td><td>0.42</td><td>1.00</td><td>1.14</td></tr>
  </tbody>
</table>
<p>
  Wheat only wins for somebody tapping thirty times an hour. At any cadence a
  human sustains, late crops beat it by four to fourteen times. The curve is
  correct as it stands; raising late-crop experience would inflate the economy
  to fix a problem that does not occur.
</p>

<h3>Planting and harvesting</h3>
<p>
  Tapping a field opens a small radial menu whose contents depend on what the
  plot is doing. An empty plot offers crops to plant. A growing plot says so and
  closes. A finished plot offers a single harvest action.
</p>
<p>
  <code>plant()</code> refuses cleanly and changes nothing if the plot is
  already planted, the crop id is unknown, or the silo holds fewer than
  <code>seedCost</code> units. <code>harvest()</code> refuses if the field is
  empty or <code>readyAt</code> has not passed. Neither leaves partial state
  behind on refusal.
</p>
<div class="callout callout-warn">
  <p>
    <strong>Harvesting into a nearly full silo loses the overflow.</strong>
    The harvest is capped at whatever room remains
    (<code>Math.min(yieldQty, siloRoom())</code>) and the field is cleared
    regardless. Harvest twenty strawberries into three slots of space and you
    get three; the other seventeen are gone, not held. A pen behaves the same
    way once there is <em>any</em> room at all. Clear space before a big harvest
    — <a href="#/farming/storage">the storage section</a> covers the exact rule
    and the one case where an item is genuinely held for you.
  </p>
</div>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/04-plant-radial-menu.webp" alt="A circular radial menu floating over an empty field plot, offering a wheat crop icon to plant."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Planting.</strong> Tapping an empty plot opens a radial menu of every crop unlocked so far. At level 1 that is Wheat and nothing else.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/05-harvest-radial-menu.webp" alt="A circular radial menu over a fully grown wheat field, offering a single harvest basket icon."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Harvesting.</strong> A field that has finished growing offers a single Harvest option in the same menu.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/06-harvest-success-toast.webp" alt="A green success toast reading &quot;Harvested Wheat!&quot; over the farm, with the previously-ready field now empty again."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>The payoff.</strong> Harvest runs the real harvest path: the plot returns to bare soil and a green toast names what came off it.</figcaption>
  </figure>
</div>
`,
    },

    /* --------------------------------------------------------------- */
    {
      id: 'fields-and-land',
      heading: 'Fields, land and expansions',
      html: `
<p>
  The world is a 40 &times; 40 grid of logical tiles drawn as isometric
  diamonds. You do not own all of it. A new farm owns one 12 &times; 12 start
  zone at grid position (10, 10), and fifteen expansion rectangles are bought
  one at a time from there.
</p>

<h3>What a new farm starts with</h3>
<table>
  <caption>New-game state, from <code>NEW_GAME</code> in the content tables</caption>
  <thead><tr><th>Thing</th><th>Amount</th></tr></thead>
  <tbody>
    <tr><td>Coins</td><td>150</td></tr>
    <tr><td>Diamonds</td><td>5</td></tr>
    <tr><td>Level</td><td>1</td></tr>
    <tr><td>Field plots, pre-placed</td><td>6</td></tr>
    <tr><td>Seeds</td><td>6 wheat</td></tr>
    <tr><td>Silo capacity</td><td>50</td></tr>
    <tr><td>Barn capacity</td><td>50</td></tr>
    <tr><td>Owned land</td><td>the 12 &times; 12 start zone</td></tr>
  </tbody>
</table>
<p>
  The six starting plots are placed as a row inside the start zone, deliberately
  clear of the row where the fixed structures sit, so the barn, silo and order
  board can never land on top of them. A further field costs 25 coins, which is
  the cheapest purchase in the game and stays that price forever.
</p>

<h3>Placement rules</h3>
<p>
  Every placement goes through one check, <code>canPlace()</code>, and it
  enforces four things in order: integer coordinates and a positive size; the
  whole footprint inside the 40 &times; 40 grid; <em>every</em> tile of the
  footprint inside land you own; and no overlap with any existing object.
</p>
<p>
  Footprints come from the content tables. Fields are 1 &times; 1. Production
  buildings are 2 &times; 2, except the Building Workshop which is 3 &times; 2.
  Animal pens have no size in the data at all, so placement defaults them to
  2 &times; 2 — a rendering decision made in <code>farm.js</code>, not game
  content.
</p>
<p>
  Placing something deducts its cost first and refuses if you cannot afford it,
  with nothing mutated on the failing path so there is nothing to refund.
  Removing a decoration or field returns half the cost, rounded down.
</p>

<h3>The fifteen expansions</h3>
<p>
  An expansion costs coins <em>and</em> construction materials, and needs both
  in stock before it will run. The materials are always the same three —
  <code>shovel</code>, <code>axe</code> and <code>saw</code>, the expansion
  material set — which never come from the same sources as the building or
  storage sets. See <a href="#/logistics">logistics</a> for where those arrive
  from.
</p>
<table>
  <caption>Every expansion, in unlock order</caption>
  <thead><tr><th>Id</th><th>Level</th><th>Size</th><th>Tiles</th><th>Coins</th><th>Materials</th></tr></thead>
  <tbody>
<tr><td><code>expansion_1</code></td><td>4</td><td>5&times;12</td><td>60</td><td>500</td><td>shovel &times;1, axe &times;1, saw &times;1</td></tr>
<tr><td><code>expansion_2</code></td><td>13</td><td>12&times;5</td><td>60</td><td>2,000</td><td>shovel &times;2, axe &times;2, saw &times;2</td></tr>
<tr><td><code>expansion_3</code></td><td>19</td><td>5&times;12</td><td>60</td><td>6,000</td><td>shovel &times;3, axe &times;3, saw &times;3</td></tr>
<tr><td><code>expansion_4</code></td><td>25</td><td>12&times;5</td><td>60</td><td>15,000</td><td>shovel &times;4, axe &times;4, saw &times;4</td></tr>
<tr><td><code>expansion_5</code></td><td>28</td><td>5&times;5</td><td>25</td><td>30,000</td><td>shovel &times;6, axe &times;5, saw &times;5</td></tr>
<tr><td><code>expansion_6</code></td><td>31</td><td>5&times;5</td><td>25</td><td>50,000</td><td>shovel &times;7, axe &times;6, saw &times;6</td></tr>
<tr><td><code>expansion_7</code></td><td>35</td><td>5&times;5</td><td>25</td><td>80,000</td><td>shovel &times;8, axe &times;8, saw &times;7</td></tr>
<tr><td><code>expansion_8</code></td><td>37</td><td>5&times;5</td><td>25</td><td>120,000</td><td>shovel &times;10, axe &times;9, saw &times;9</td></tr>
<tr><td><code>expansion_9</code></td><td>39</td><td>5&times;22</td><td>110</td><td>200,000</td><td>shovel &times;12, axe &times;12, saw &times;12</td></tr>
<tr><td><code>expansion_10</code></td><td>54</td><td>27&times;5</td><td>135</td><td>320,000</td><td>shovel &times;15, axe &times;14, saw &times;14</td></tr>
<tr><td><code>expansion_11</code></td><td>59</td><td>27&times;5</td><td>135</td><td>500,000</td><td>shovel &times;18, axe &times;17, saw &times;16</td></tr>
<tr><td><code>expansion_12</code></td><td>63</td><td>5&times;32</td><td>160</td><td>800,000</td><td>shovel &times;22, axe &times;20, saw &times;19</td></tr>
<tr><td><code>expansion_13</code></td><td>67</td><td>8&times;32</td><td>256</td><td>1,200,000</td><td>shovel &times;26, axe &times;24, saw &times;23</td></tr>
<tr><td><code>expansion_14</code></td><td>73</td><td>40&times;4</td><td>160</td><td>1,800,000</td><td>shovel &times;31, axe &times;29, saw &times;27</td></tr>
<tr><td><code>expansion_15</code></td><td>78</td><td>40&times;4</td><td>160</td><td>2,600,000</td><td>shovel &times;36, axe &times;34, saw &times;32</td></tr>
  </tbody>
</table>
<p>
  The start zone is 144 tiles. The fifteen expansions add 1,456 more, which is
  the grid's whole 1,600 tiles — buy every expansion and you own all of it, with
  nothing left unclaimed. Coin cost rises roughly geometrically while materials
  rise roughly linearly, so the late expansions are gated by coins far more than
  by supply lines.
</p>
<div class="callout callout-info">
  <p>
    The grid was widened from 32 to 40 tiles specifically to fit expansions 10
    to 15: the original nine rectangles plus the start zone already tiled the
    old grid completely, so anything further would have overlapped. The data
    validator now asserts that every expansion rectangle is in bounds and that
    no two overlap, which is why that class of mistake cannot recur silently.
  </p>
</div>
`,
    },

    /* --------------------------------------------------------------- */
    {
      id: 'animals',
      heading: 'Animals and pens',
      html: `
<p>
  Twelve species. A pen is bought once, animals are bought into it, and from
  then on the cycle is the same every time: spend feed, wait, collect a batch.
  Pens never expire and animals never die.
</p>

<h3>One number does two jobs</h3>
<p>
  Each species has a <code>capacity</code> — the number of animals a pen holds —
  and that same number is used twice by <code>production.js</code>. It is how
  much feed a feeding consumes, and it is how many products a collection
  returns:
</p>
<pre><code>// feedPen
const need = animal.capacity;    // feed consumed
// collectPen
const qty = animal.capacity;     // products returned</code></pre>
<p>
  So a Chicken Coop eats five Chicken Feed and lays five Eggs. There is no
  partial stocking and no per-animal accounting: a pen is fed as a unit and
  collected as a unit.
</p>

<h3>All ${COUNTS.animals} species</h3>
<table>
  <caption>Every animal, with the cost of one cycle and what it returns</caption>
  <thead>
    <tr>
      <th>Id</th><th>Name</th><th>Pen</th><th>Level</th><th>Feed per cycle</th>
      <th>Cycle</th><th>Produces</th><th>Batch value</th><th>Coins/h</th>
      <th>Pen cost</th><th>Per animal</th><th>XP</th>
    </tr>
  </thead>
  <tbody>
<tr><td><code>chicken</code></td><td>Chicken</td><td>Chicken Coop</td><td>2</td><td>Chicken Feed &times;5</td><td>10 min</td><td>Egg &times;5</td><td>50</td><td>300</td><td>100</td><td>20</td><td>2</td></tr>
<tr><td><code>cow</code></td><td>Cow</td><td>Cow Pasture</td><td>6</td><td>Cow Feed &times;4</td><td>30 min</td><td>Milk &times;4</td><td>64</td><td>128</td><td>350</td><td>60</td><td>3</td></tr>
<tr><td><code>pig</code></td><td>Pig</td><td>Pig Pen</td><td>10</td><td>Pig Feed &times;4</td><td>1 h</td><td>Bacon &times;4</td><td>100</td><td>100</td><td>750</td><td>120</td><td>4</td></tr>
<tr><td><code>sheep</code></td><td>Sheep</td><td>Sheep Field</td><td>14</td><td>Sheep Feed &times;4</td><td>1 h 30 min</td><td>Wool &times;4</td><td>136</td><td>91</td><td>1,400</td><td>200</td><td>5</td></tr>
<tr><td><code>goat</code></td><td>Goat</td><td>Goat Yard</td><td>19</td><td>Goat Feed &times;3</td><td>2 h</td><td>Goat Milk &times;3</td><td>132</td><td>66</td><td>2,600</td><td>320</td><td>6</td></tr>
<tr><td><code>bee</code></td><td>Bees</td><td>Beehive</td><td>23</td><td>&mdash;</td><td>3 h</td><td>Honey &times;1</td><td>58</td><td>19</td><td>4,200</td><td>&mdash;</td><td>7</td></tr>
<tr><td><code>duck</code></td><td>Duck</td><td>Duck Pond</td><td>27</td><td>Chicken Feed &times;3</td><td>2 h 30 min</td><td>Feathers &times;3</td><td>150</td><td>60</td><td>6,000</td><td>450</td><td>8</td></tr>
<tr><td><code>lamb</code></td><td>Lamb</td><td>Lamb Meadow</td><td>53</td><td>Lamb Feed &times;3</td><td>3 h 30 min</td><td>Lamb Chop &times;3</td><td>210</td><td>60</td><td>9,000</td><td>700</td><td>10</td></tr>
<tr><td><code>quail</code></td><td>Quail</td><td>Quail Hutch</td><td>58</td><td>Quail Feed &times;4</td><td>4 h</td><td>Quail Egg &times;4</td><td>176</td><td>44</td><td>13,000</td><td>950</td><td>12</td></tr>
<tr><td><code>alpaca</code></td><td>Alpaca</td><td>Alpaca Paddock</td><td>64</td><td>Alpaca Feed &times;3</td><td>5 h</td><td>Alpaca Wool &times;3</td><td>315</td><td>63</td><td>19,000</td><td>1,400</td><td>15</td></tr>
<tr><td><code>otter</code></td><td>Otter</td><td>Otter Pond</td><td>72</td><td>Otter Feed &times;2</td><td>6 h</td><td>Pearls &times;2</td><td>320</td><td>53</td><td>27,000</td><td>2,000</td><td>18</td></tr>
<tr><td><code>turkey</code></td><td>Turkey</td><td>Turkey Run</td><td>82</td><td>Turkey Feed &times;3</td><td>7 h</td><td>Turkey Plume &times;3</td><td>405</td><td>58</td><td>38,000</td><td>2,800</td><td>22</td></tr>
  </tbody>
</table>

<h3>Two things the table shows that are easy to miss</h3>
<p>
  <strong>Bees are the exception.</strong> The Beehive has no feed and no
  per-animal cost. Its <code>feed</code> field is null, so
  <code>feedPen()</code> skips the consumption check entirely and just starts
  the timer. A hive is pure output once bought, which is what its 4,200 coin
  price is buying.
</p>
<p>
  <strong>Ducks eat chicken feed.</strong> Every other species has feed named
  after itself; the Duck Pond shares the Chicken Coop's supply. That makes ducks
  much cheaper to run than their unlock level suggests, and it means one feed
  line supports two pens.
</p>

<h3>The chain, priced end to end</h3>
<p>
  Take one Chicken Coop cycle. Five Chicken Feed at two wheat and one corn each
  is ten wheat and five corn, and five feed batches at 300 seconds each occupy
  the Feed Mill's three queue slots for two rounds. The coop then takes ten
  minutes to turn that into five eggs.
</p>
<table>
  <caption>One Chicken Coop cycle, valued at instant-sell prices</caption>
  <thead><tr><th>Stage</th><th>Items</th><th>Instant-sell value</th></tr></thead>
  <tbody>
    <tr><td>Raw crops consumed</td><td>10 wheat, 5 corn</td><td>75 coins</td></tr>
    <tr><td>After the Feed Mill</td><td>5 Chicken Feed</td><td>25 coins</td></tr>
    <tr><td>After the coop</td><td>5 Eggs</td><td>50 coins</td></tr>
    <tr><td>Same eggs on an order</td><td>5 Eggs &times; 1.35</td><td>68 coins</td></tr>
  </tbody>
</table>
<div class="callout callout-warn">
  <p>
    <strong>Animal products are worth less in coins than the crops that fed
    them, and this is deliberate.</strong> Selling five eggs raw returns 50
    coins against 75 coins of wheat and corn. The same is true of milk (64
    against 116) and of every other species. Animals are not a way to turn
    crops into more coins; they are a way to turn crops into <em>inputs the
    factories need</em>, and into experience. Muffins need eggs. Cheese needs
    milk. There is no other route to either.
  </p>
</div>
<p>
  This is why the feed recipes carry a <code>sink: true</code> flag in the
  content tables, and why the data validator exempts them from the margin rule
  that every other recipe must satisfy. See
  <a href="#/farming/value-chain">the value chain</a> below.
</p>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/10-pen-built.webp" alt="A fenced chicken pen sitting on the farm."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>A pen in the world.</strong> A chicken pen placed through the same call the Workshop Build button makes, drawn by vector sprite code rather than an image file.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/10b-pen-radial-feed.webp" alt="A radial menu over a chicken pen offering a single feed icon."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Feeding.</strong> An unfed pen offers exactly one option when tapped.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/10c-pen-radial-collect.webp" alt="A radial menu over a chicken pen offering a single collect icon."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Collecting.</strong> The same pen once its timer has run out: the menu now offers Collect.</figcaption>
  </figure>
</div>
`,
    },

    /* --------------------------------------------------------------- */
    {
      id: 'buildings',
      heading: 'Production buildings and recipe queues',
      html: `
<p>
  ${COUNTS.buildings} production buildings between them hold ${COUNTS.recipes} recipes. A
  building is a
  2 &times; 2 slab (3 &times; 2 for the Building Workshop) with a small queue.
  You pick a recipe, it takes the inputs immediately, and some time later you
  collect one finished item per slot.
</p>

<h3>Buildings are crafted, not bought</h3>
<p>
  This is the mechanic that most distinguishes Farm Tycoon from the games it
  takes after. Only ${COUNTS.buildings - COUNTS.kitBuildings} buildings can be paid for in
  coins alone — the
  <strong>Bakery</strong>, the <strong>Feed Mill</strong> and the
  <strong>Building Workshop</strong> itself. The other ${COUNTS.kitBuildings} each require
  a <em>kit</em>, and a kit is a Workshop recipe: raw construction materials
  become components, components become the kit, and the kit is consumed to place
  the building.
</p>
<p>
  Three coin-only buildings is not an arbitrary number. It is the smallest set
  that keeps the opening from dead-ending: the Bakery gives you something to do
  with wheat before you have materials, the Feed Mill lets animals run, and the
  Workshop is the thing that produces every other kit. The full crafting spine
  is documented in <a href="#/crafting">the crafting article</a>.
</p>

<h3>How the queue behaves</h3>
<p>
  Most buildings have three queue slots; the Smelter has two. Queueing checks
  every input before consuming any of them, so a failed queue never leaves a
  partial consumption that would need refunding:
</p>
<pre><code>// Check every input BEFORE consuming any of them.
for (const [inputId, qty] of Object.entries(recipe.inputs)) {
  if ((stockOf(inputId)[inputId] || 0) &lt; qty) return false;
}
for (const [inputId, qty] of Object.entries(recipe.inputs)) {
  stockOf(inputId)[inputId] -= qty;
}</code></pre>
<p>
  Four consequences follow from that, and all four are covered by tests in
  <code>tools/test-core.mjs</code>:
</p>
<ul>
  <li><strong>Inputs are spent at queue time, not collect time.</strong> Once
    queued, the ingredients are gone and the output is guaranteed. You cannot
    cancel to get them back.</li>
  <li><strong>A refused queue changes nothing.</strong> Short one ingredient and
    the call returns false having touched no stock at all.</li>
  <li><strong>A full queue refuses.</strong> Slots are counted against
    <code>queueSlots</code> before anything else happens.</li>
  <li><strong>Collecting returns exactly one unit per finished slot</strong>, and
    the queue entry is removed only once that unit is safely in the barn.</li>
</ul>
<div class="callout callout-ok">
  <p>
    <strong>A full barn holds your work rather than destroying it.</strong>
    Unlike a harvest, a finished recipe with no barn room is <em>left queued</em>
    and can be collected later. The same is true of a pen with zero room. It is
    only the partial cases — a harvest, or a pen collection with some but not
    enough room — that lose the remainder.
  </p>
</div>

<h3>All ${COUNTS.buildings} buildings</h3>
<table>
  <caption>Every production building, with its kit, queue and minigame</caption>
  <thead>
    <tr>
      <th>Id</th><th>Name</th><th>Level</th><th>Coins</th><th>Kit</th>
      <th>Slots</th><th>Recipes</th><th>Minigame</th><th>Effect</th><th>Max bonus</th>
    </tr>
  </thead>
  <tbody>
${BUILDINGS_TABLE.map((b) => `<tr><td><code>${b.id}</code></td><td>${b.name}</td><td>${b.level}</td><td>${b.cost}</td><td>${b.kit}</td><td>${b.slots}</td><td>${b.recipes}</td><td>${b.minigame}</td><td>${b.effect}</td><td>${b.maxBonus}</td></tr>`).join('')}
  </tbody>
</table>

<h3>Every building has its own minigame, and none of them is a gate</h3>
<p>
  Each production building carries exactly one minigame, and each does something
  only that building would plausibly do — this is not one minigame reskinned
  ${COUNTS.buildings} times. The Smelter works bellows; the Sewing Machine holds a seam;
  the Pie Oven crimps a crust.
</p>
<p>
  Every one of them is an <strong>optional bonus layer</strong>, and that is
  load-bearing rather than a nicety. Production runs identically whether or not
  you ever touch a minigame. Gating a recipe behind hand-eye timing would break
  the idle contract that the absolute-timestamp model exists to protect, and it
  would punish exactly the player who closes the game and comes back tomorrow.
</p>
<p>
  Every bonus is capped — the <strong>Max bonus</strong> column above is the
  most a perfect run can grant — so no effect is farmable without bound. The
  effect names come from one closed list shared with the Laboratory's research
  tree and with co-op perks, so a bonus from a minigame and a bonus from
  research compose through a single merge point rather than two competing ones.
  <a href="#/exploration">The exploration article</a> covers the research side;
  the merge point itself is in <a href="#/architecture">the architecture
  notes</a>.
</p>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/11-building-queue-panel.webp" alt="A building queue panel showing a Chicken Feed card with a question-mark icon and a partially filled progress bar with the label Crafting."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>A recipe queued.</strong> The Feed Mill queue after Chicken Feed was ordered, with the real ingredients taken out of the silo and a live progress bar. The question mark beside the name is not the intended art: at the commit this was captured from, nothing in the content tables carried an icon, so every list in the DOM fell back to that glyph. Icons landed shortly afterwards.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/11b-building-queue-ready.webp" alt="A building queue panel showing a Chicken Feed card with a full progress bar, the label Ready to collect, and a Collect button."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Ready.</strong> The same entry once its timer is up: a full bar, a ready label and a Collect button.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/11c-building-queue-collected.webp" alt="A building queue panel with an empty queue and a green toast reading Collected Chicken Feed, over the farm."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>Collected.</strong> Collect moves the finished goods into the barn, empties the queue and confirms with a toast.</figcaption>
  </figure>
</div>
`,
    },

    /* --------------------------------------------------------------- */
    {
      id: 'value-chain',
      heading: 'The value chain, and the rule that keeps it honest',
      html: `
<p>
  A processing step should be worth taking. If a loaf of bread sold for less
  than the three wheat it consumed, baking would be a trap, and a player who
  worked that out would rationally never bake again. Farm Tycoon enforces the
  opposite as a hard rule at validation time.
</p>

<h3>The margin rule</h3>
<p>
  <code>tools/validate-data.mjs</code> refuses to pass the content tables if any
  recipe that is not explicitly flagged as a sink produces an output selling for
  no more than the sum of its inputs:
</p>
<pre><code>if (out.sellPrice &lt;= inSum)
  errors.push(bid + '/' + r.id + ': output sells for ' + out.sellPrice +
              ' but inputs sell for ' + inSum +
              ' - underwater and not marked sink: true');</code></pre>
<p>
  Checked against the shipped tables, the rule holds exactly. Of the ${COUNTS.recipes}
  recipes, ${COUNTS.recipesUnderwaterTotal} produce an output worth less than their inputs —
  and every single
  one of those ${COUNTS.recipesUnderwaterTotal} carries <code>sink: true</code>
  (${COUNTS.recipesUnderwaterUnmarkedSink} do not, which would be the actual defect this check
  exists to catch). There is not one
  value-negative recipe that is unmarked.
</p>

<h3>What counts as a sink, and why</h3>
<p>
  ${COUNTS.recipesSinkTotal} recipes are flagged as sinks. They fall into two groups, and
  neither
  exists to be resold:
</p>
<ul>
  <li><strong>The ${COUNTS.recipesSinkFeedMill} Feed Mill recipes.</strong> Feed is eaten by animals. Its
    sale price is close to irrelevant, and it is deeply value-negative on
    purpose — Alpaca Feed costs 644 coins of crops and sells for 28. That is the
    crop sink that stops late-game fields from simply becoming a coin printer.</li>
  <li><strong>All ${COUNTS.recipesSinkWorkshop} Building Workshop recipes.</strong> Components and
    kits exist to place a building, not to be flipped. A kit that was worth more
    than its materials would turn the Workshop into an arbitrage machine and
    detach building from the material economy entirely.</li>
</ul>
<p>
  ${COUNTS.recipesSinkNonUnderwaterCount} of the ${COUNTS.recipesSinkTotal} —
  ${COUNTS.recipesSinkNonUnderwaterNames || 'none, currently'} — happen${COUNTS.recipesSinkNonUnderwaterCount === 1 ? 's' : ''} to
  break even or slightly better. ${COUNTS.recipesSinkNonUnderwaterCount > 0 ? 'They are still flagged, because what the flag records is intent rather than the arithmetic of the moment.' : 'Every sink recipe is currently underwater, which is the ordinary case rather than a guaranteed one — the flag records intent, and a future recipe could land here without breaking anything.'}
</p>

<h3>What the uplift actually looks like</h3>
<p>
  Across the ${COUNTS.recipesNonSinkTotal} non-sink recipes, the median output is worth about
  ${COUNTS.recipesNonSinkMedianUplift}&times;
  its inputs. A few examples, at instant-sell prices:
</p>
<table>
  <caption>Value uplift for a sample of recipes</caption>
  <thead><tr><th>Recipe</th><th>Building</th><th>Inputs worth</th><th>Output worth</th><th>Uplift</th></tr></thead>
  <tbody>
    <tr><td>Bread</td><td>Bakery</td><td>12</td><td>22</td><td>1.83&times;</td></tr>
    <tr><td>Cookie</td><td>Bakery</td><td>58</td><td>100</td><td>1.72&times;</td></tr>
    <tr><td>Strawberry Muffin</td><td>Bakery</td><td>120</td><td>220</td><td>1.83&times;</td></tr>
    <tr><td>Baked Potato</td><td>Grill</td><td>120</td><td>220</td><td>1.83&times;</td></tr>
    <tr><td>Cheese Fondue</td><td>Fondue Pot</td><td>142</td><td>1,250</td><td>8.80&times;</td></tr>
    <tr><td>Plain Yogurt</td><td>Yogurt Maker</td><td>76</td><td>1,350</td><td>17.76&times;</td></tr>
    <tr><td>Fresh Pasta</td><td>Pasta Kitchen</td><td>18</td><td>560</td><td>31.11&times;</td></tr>
  </tbody>
</table>
<div class="callout callout-info">
  <p>
    <strong>An observation rather than a defect.</strong> The uplift climbs
    steeply at the top of the tree — Fresh Pasta turns 18 coins of wheat and egg
    into 560. That is consistent with a curve where late buildings cost hundreds
    of thousands of coins and are gated behind fifty or more levels, but it is a
    much wider spread than the early game's steady 1.7 to 1.9 times, and it is
    worth naming rather than leaving for somebody to discover as a surprise.
  </p>
</div>

<h3>Every crop earns its place</h3>
<p>
  All ${COUNTS.crops} crops appear as an input to at least one recipe. None is
  decorative and none is purely a sell-item, which means a newly unlocked crop
  always opens something rather than just adding a row to the plant menu.
</p>
<p>
  The order board pays <code>sellValue &times; 1.35</code> and two experience
  per item, and the truck adds a further 1.6 times bonus on a completed run.
  Those multipliers are the reason a chain whose raw arithmetic looks thin is
  still worth running. <a href="#/logistics">The logistics article</a> covers
  every selling route and what each pays.
</p>
`,
    },

    /* --------------------------------------------------------------- */
    {
      id: 'storage',
      heading: 'The silo and the barn',
      html: `
<p>
  Both start at ${COUNTS.siloBaseCapacity} slots (silo and barn currently share the same
  starting capacity). A slot is one item, not one stack —
  ${COUNTS.siloBaseCapacity} wheat fills
  the silo exactly as ${COUNTS.siloBaseCapacity} different crops would. Storage is the game's real
  constraint far more often than coins are.
</p>

<h3>What goes where</h3>
<table>
  <caption>Which bucket holds what</caption>
  <thead><tr><th>Bucket</th><th>Holds</th><th>Examples</th></tr></thead>
  <tbody>
    <tr>
      <td>Silo</td>
      <td>Crops, and only crops</td>
      <td>wheat, strawberry, mint</td>
    </tr>
    <tr>
      <td>Barn</td>
      <td>Everything else</td>
      <td>eggs, feed, bread, ores, fish, bricks, kits, artifacts' museum aside</td>
    </tr>
  </tbody>
</table>
<p>
  Construction materials deserve a specific note because it surprises people:
  they have <strong>no bucket of their own</strong>. Bricks, shovels, bolts and
  jackhammers are goods, so they occupy barn slots alongside your bread. A large
  materials delivery from a train can therefore push you against the barn cap
  and stall production, which is a real interaction rather than an oversight.
</p>
<p>
  There is one genuine exception in the whole game, and it is not in the barn at
  all: museum artifacts live in their own store, so a full barn can never cost
  you an artifact. That is covered in <a href="#/exploration">exploration</a>.
</p>

<h3>Overflow: three different behaviours</h3>
<p>
  What happens when something finishes and there is no room depends on what
  finished, and the three cases genuinely differ:
</p>
<table>
  <caption>Overflow behaviour by source</caption>
  <thead><tr><th>Source</th><th>No room at all</th><th>Some room, not enough</th></tr></thead>
  <tbody>
    <tr>
      <td>Crop harvest</td>
      <td>Field is cleared, nothing gained</td>
      <td>You get what fits; the rest is lost and the field clears</td>
    </tr>
    <tr>
      <td>Animal pen</td>
      <td>Pen stays ready, collect later</td>
      <td>You get what fits; the rest is lost and the timer clears</td>
    </tr>
    <tr>
      <td>Building queue</td>
      <td>Entry stays queued, collect later</td>
      <td>Not applicable — one unit per slot, so it either fits or it does not</td>
    </tr>
  </tbody>
</table>
<div class="callout callout-danger">
  <p>
    <strong>The partial cases are the ones that cost you.</strong> A pen with
    one slot of room hands over one product and clears its timer, discarding the
    other four. A test in <code>tools/test-core.mjs</code> pins this exactly —
    "a capped-but-nonzero collect still clears the timer". If the barn is
    nearly full, it is safer to leave it completely full than to leave one slot
    open.
  </p>
</div>

<h3>Capacity upgrades</h3>
<p>
  The content tables define upgrade tuning for both buildings. Silo and barn
  take <em>different</em> material trios, deliberately, so one cannot be starved
  to feed the other:
</p>
<table>
  <caption>Storage upgrade tuning, as defined in the content tables</caption>
  <thead><tr><th>Field</th><th>Silo</th><th>Barn</th></tr></thead>
  <tbody>
    <tr><td>Base capacity</td><td>50</td><td>50</td></tr>
    <tr><td>Capacity added per upgrade</td><td>25</td><td>25</td></tr>
    <tr><td>First upgrade coin cost</td><td>150</td><td>200</td></tr>
    <tr><td>Coin cost factor</td><td>1.6</td><td>1.6</td></tr>
    <tr><td>Materials</td><td><code>screw</code>, <code>wood_panel</code>, <code>bracket</code></td><td><code>bolt</code>, <code>plank</code>, <code>duct_tape</code></td></tr>
    <tr><td>Materials on upgrade 1</td><td>3 of each</td><td>3 of each</td></tr>
    <tr><td>Added per later upgrade</td><td>+1 of each</td><td>+1 of each</td></tr>
  </tbody>
</table>
<p>
  The material rule works out to <em>upgrade n needs n + 2 of each of its three
  types</em>: three each for the first, four each for the second, and so on. The
  validator enforces that both trios come from the storage material set and that
  the two lists do not share a single entry.
</p>
<div class="callout callout-warn">
  <p>
    <strong>Honest gap: nothing in the game reads this tuning yet.</strong> The
    <code>STORAGE</code> table is referenced only by the data validator. No
    module exposes an upgrade action, and no code applies the coin factor or
    deducts the materials, so silo and barn capacity currently stay at 50 unless
    something else writes to them directly. The two mega-upgrade unlocks at
    levels 32 and 34, and the two titan upgrades at 57 and 61, are level-table
    entries with no consumer behind them. Treat the numbers above as the
    intended shape, not as behaviour you can observe.
  </p>
</div>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/12-panel-barn.webp" alt="A sliding panel titled Barn with the empty-state text &quot;No goods in the barn yet — cook something up!&quot;"
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>The barn, empty.</strong> Nothing had been cooked on this save yet, so the panel shows its own empty state rather than a blank list.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/13-panel-silo.webp" alt="A sliding panel titled Silo showing a wheat item card with quantity and a sell button."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>The silo, holding wheat.</strong> The crop harvested earlier, listed as a sellable card. The question mark is the missing-icon state described above, not the finished art.</figcaption>
  </figure>
</div>
`,
    },

    /* --------------------------------------------------------------- */
    {
      id: 'coins-xp-levels',
      heading: 'Coins, experience and the level curve',
      html: `
<p>
  Two currencies and one progression track. Coins buy land, fields, pens and the
  ${COUNTS.buildings - COUNTS.kitBuildings} coin-only buildings. Experience buys levels. Levels unlock content, and
  every single one of the ${COUNTS.maxLevel} unlocks something.
</p>

<h3>Coins cannot go negative, ever</h3>
<p>
  <code>addCoins()</code> computes the result before assigning it and throws
  rather than allowing a negative balance:
</p>
<pre><code>const next = state.coins + amount;
if (next &lt; 0) throw new Error('addCoins: ' + state.coins + ' + ' + amount + ' would go negative');</code></pre>
<p>
  Callers are written to work with that. <code>farm.place()</code> catches the
  throw and returns null, and because the deduction is the first thing it
  attempts, a failure has mutated nothing and there is no refund path to get
  wrong. Every consume-then-fail route in the game is written the same way:
  check everything, then act.
</p>

<h3>Levelling</h3>
<p>
  <code>addXp()</code> adds experience and then loops, so a single large award
  can carry you through several levels at once. Each level costs a fixed amount
  which is subtracted rather than compared against a running total, and each
  level-up pays <strong>one diamond</strong>.
</p>
<p>
  There are ${COUNTS.maxLevel} levels. Reaching the cap therefore pays ${COUNTS.maxLevel - 1}
  diamonds from
  levelling alone, on top of the ${COUNTS.startDiamonds} you start with and the
  ${COUNTS.achievementDiamondsTotal} available across
  the game's ${COUNTS.achievements} achievements. At the cap the loop stops and experience simply
  accumulates without being spent.
</p>

<h3>The curve is piecewise, and the seam is deliberate</h3>
<p>
  Experience needed to go from level <em>n</em> to <em>n</em> + 1:
</p>
<pre><code>n &lt;= 50 :  round(50 * n^1.8)
n &gt;  50 :  round(50 * 50^1.8 * (n / 50)^1.65)</code></pre>
<p>
  The first half is the original curve, kept exactly, so every level the game
  had already shipped costs precisely what it did before. Above 50 the exponent
  eases from 1.8 to 1.65 to keep the back half reachable.
</p>
<p>
  It is worth being precise about how much that easing buys, because the source
  comment beside the curve reaches for "several million" and the real figure is
  more modest. Held at a flat 1.8, level 95 alone would cost 181,498 experience
  and levels 51 to 95 would total 5,017,991. The eased exponent brings those to
  161,986 and 4,719,846 — just under six per cent off the back half, and just
  under eleven per cent off the single most expensive level. That is a trim rather
  than a transformation; the back half of this game is long by design either
  way.
</p>
<p>
  The two halves are joined <em>at</em> 50 rather than near it: substituting
  <em>n</em> = 50 into the second expression gives
  <code>50 &times; 50^1.8 &times; 1^1.65</code>, which is the first expression
  exactly. There is no jump at the seam, by construction rather than by tuning.
</p>

<div class="stat-row">
  <div class="stat"><div class="stat-num">50</div><div class="stat-label">XP for level 2</div></div>
  <div class="stat"><div class="stat-num">57,163</div><div class="stat-label">XP for level 51</div></div>
  <div class="stat"><div class="stat-num">161,986</div><div class="stat-label">XP for level 95</div></div>
  <div class="stat"><div class="stat-num">5,769,369</div><div class="stat-label">XP for the whole game</div></div>
</div>

<p>
  For scale: a wheat harvest pays 1 experience, so level 2 is fifty harvests. A
  mint harvest pays 41. The full 5.77 million to reach the cap is not reachable
  by farming alone at any sane cadence — orders, which pay double experience per
  item, and the systems in <a href="#/logistics">logistics</a> and
  <a href="#/social">social play</a> are where most of it comes from.
</p>

<h3>How unlocking is decided</h3>
<p>
  There are two sources of unlock levels and they are merged into one map,
  built once, on first use:
</p>
<ul>
  <li><strong>Per-entity levels.</strong> Most content carries its own
    <code>unlockLevel</code> — every crop, animal, building, recipe, zoo
    enclosure, island and mine depth. These are discovered by walking every
    exported content table, so adding new content needs no change to the
    economy code at all.</li>
  <li><strong>Feature gates.</strong> Things that are a concept rather than an
    entity — the town, the mine, trains, the order board — live only in the
    level table's <code>unlocks</code> lists.</li>
</ul>
<p>
  Per-entity levels are added first, so an id present in both wins from its own
  table. Anything the map has never heard of returns level 1, which means an
  unknown id is treated as unlocked rather than permanently hidden.
</p>
`,
    },

    /* --------------------------------------------------------------- */
    {
      id: 'unlocks',
      heading: 'What unlocks at every level',
      html: `
<p>
  All ${COUNTS.maxLevel} levels, the experience each one costs, the running total to
  reach it, and what it opens. Every level carries at least one unlock: the data
  validator refuses a level with an empty list, which is what stops the late game
  from becoming a silent corridor of experience with nothing at the end of it.
</p>
<p>
  Ids shown here are the game's internal names. Crops, animals and buildings
  appear in their own tables earlier in this article; the rest belong to the
  systems documented in the other articles.
</p>
<table>
  <caption>The complete unlock schedule</caption>
  <thead><tr><th>Level</th><th>XP to next</th><th>Total XP to here</th><th>Unlocks</th></tr></thead>
  <tbody>
<tr><td>1</td><td>50</td><td>0</td><td><code>field</code> <code>wheat</code></td></tr>
<tr><td>2</td><td>174</td><td>50</td><td><code>corn</code> <code>chicken</code></td></tr>
<tr><td>3</td><td>361</td><td>224</td><td><code>bakery</code> <code>orders_board</code> <code>carrot</code></td></tr>
<tr><td>4</td><td>606</td><td>585</td><td><code>expansion_1</code></td></tr>
<tr><td>5</td><td>906</td><td>1,191</td><td><code>feed_mill</code> <code>soybean</code></td></tr>
<tr><td>6</td><td>1,258</td><td>2,097</td><td><code>cow</code> <code>build_workshop</code> <code>dairy</code></td></tr>
<tr><td>7</td><td>1,660</td><td>3,355</td><td><code>sugarcane</code></td></tr>
<tr><td>8</td><td>2,111</td><td>5,015</td><td><code>truck</code> <code>sugar_mill</code></td></tr>
<tr><td>9</td><td>2,610</td><td>7,126</td><td><code>cotton</code> <code>popcorn_pot</code> <code>market</code></td></tr>
<tr><td>10</td><td>3,155</td><td>9,736</td><td><code>pig</code> <code>pets</code></td></tr>
<tr><td>11</td><td>3,745</td><td>12,891</td><td><code>tomato</code> <code>merge_meadow</code></td></tr>
<tr><td>12</td><td>4,380</td><td>16,636</td><td><code>fishing</code> <code>grill</code></td></tr>
<tr><td>13</td><td>5,059</td><td>21,016</td><td><code>potato</code> <code>expansion_2</code></td></tr>
<tr><td>14</td><td>5,781</td><td>26,075</td><td><code>sheep</code> <code>loom</code></td></tr>
<tr><td>15</td><td>6,545</td><td>31,856</td><td><code>strawberry</code> <code>juice_press</code></td></tr>
<tr><td>16</td><td>7,352</td><td>38,401</td><td><code>pie_oven</code></td></tr>
<tr><td>17</td><td>8,199</td><td>45,753</td><td><code>boat</code></td></tr>
<tr><td>18</td><td>9,088</td><td>53,952</td><td><code>pumpkin</code></td></tr>
<tr><td>19</td><td>10,017</td><td>63,040</td><td><code>goat</code> <code>expansion_3</code></td></tr>
<tr><td>20</td><td>10,986</td><td>73,057</td><td><code>sewing_machine</code> <code>town</code></td></tr>
<tr><td>21</td><td>11,994</td><td>84,043</td><td><code>indigo</code> <code>trains</code></td></tr>
<tr><td>22</td><td>13,042</td><td>96,037</td><td><code>jam_maker</code></td></tr>
<tr><td>23</td><td>14,128</td><td>109,079</td><td><code>bee</code></td></tr>
<tr><td>24</td><td>15,253</td><td>123,207</td><td><code>mine</code> <code>smelter</code></td></tr>
<tr><td>25</td><td>16,416</td><td>138,460</td><td><code>chili</code> <code>expansion_4</code></td></tr>
<tr><td>26</td><td>17,617</td><td>154,876</td><td><code>candy_machine</code></td></tr>
<tr><td>27</td><td>18,855</td><td>172,493</td><td><code>duck</code></td></tr>
<tr><td>28</td><td>20,130</td><td>191,348</td><td><code>expansion_5</code> <code>airport</code></td></tr>
<tr><td>29</td><td>21,443</td><td>211,478</td><td><code>coffee</code></td></tr>
<tr><td>30</td><td>22,792</td><td>232,921</td><td><code>coffee_kiosk</code></td></tr>
<tr><td>31</td><td>24,178</td><td>255,713</td><td><code>expansion_6</code></td></tr>
<tr><td>32</td><td>25,600</td><td>279,891</td><td><code>silo_mega_upgrade</code></td></tr>
<tr><td>33</td><td>27,058</td><td>305,491</td><td><code>grapes</code></td></tr>
<tr><td>34</td><td>28,552</td><td>332,549</td><td><code>barn_mega_upgrade</code> <code>zoo</code> <code>zoo_peacock</code> <code>zoo_monkey</code></td></tr>
<tr><td>35</td><td>30,081</td><td>361,101</td><td><code>expansion_7</code></td></tr>
<tr><td>36</td><td>31,646</td><td>391,182</td><td><code>golden_fields</code> <code>islands</code> <code>isle_palm</code> <code>tropical_cafe</code></td></tr>
<tr><td>37</td><td>33,246</td><td>422,828</td><td><code>expansion_8</code></td></tr>
<tr><td>38</td><td>34,880</td><td>456,074</td><td><code>master_orders</code></td></tr>
<tr><td>39</td><td>36,550</td><td>490,954</td><td><code>expansion_9</code></td></tr>
<tr><td>40</td><td>38,254</td><td>527,504</td><td><code>golden_windmill</code></td></tr>
<tr><td>41</td><td>39,993</td><td>565,758</td><td><code>zoo_penguin</code></td></tr>
<tr><td>42</td><td>41,766</td><td>605,751</td><td><code>zoo_flamingo</code></td></tr>
<tr><td>43</td><td>43,573</td><td>647,517</td><td><code>isle_coral</code></td></tr>
<tr><td>44</td><td>45,413</td><td>691,090</td><td><code>zoo_lion</code></td></tr>
<tr><td>45</td><td>47,288</td><td>736,503</td><td><code>isle_lagoon</code></td></tr>
<tr><td>46</td><td>49,196</td><td>783,791</td><td><code>zoo_panda</code></td></tr>
<tr><td>47</td><td>51,138</td><td>832,987</td><td><code>isle_volcano</code></td></tr>
<tr><td>48</td><td>53,113</td><td>884,125</td><td><code>zoo_giraffe</code></td></tr>
<tr><td>49</td><td>55,122</td><td>937,238</td><td><code>town_mega_milestone</code></td></tr>
<tr><td>50</td><td>57,163</td><td>992,360</td><td><code>zoo_elephant</code> <code>golden_town_statue</code></td></tr>
<tr><td>51</td><td>59,062</td><td>1,049,523</td><td><code>rice</code></td></tr>
<tr><td>52</td><td>60,985</td><td>1,108,585</td><td><code>oil_press</code> <code>isle_frutus</code></td></tr>
<tr><td>53</td><td>62,932</td><td>1,169,570</td><td><code>lamb</code></td></tr>
<tr><td>54</td><td>64,903</td><td>1,232,502</td><td><code>expansion_10</code></td></tr>
<tr><td>55</td><td>66,898</td><td>1,297,405</td><td><code>olive</code></td></tr>
<tr><td>56</td><td>68,917</td><td>1,364,303</td><td><code>tea_house</code> <code>zoo_otter</code></td></tr>
<tr><td>57</td><td>70,959</td><td>1,433,220</td><td><code>silo_titan_upgrade</code></td></tr>
<tr><td>58</td><td>73,025</td><td>1,504,179</td><td><code>lavender</code> <code>quail</code> <code>isle_olivia</code></td></tr>
<tr><td>59</td><td>75,114</td><td>1,577,204</td><td><code>expansion_11</code></td></tr>
<tr><td>60</td><td>77,226</td><td>1,652,318</td><td><code>sushi_bar</code></td></tr>
<tr><td>61</td><td>79,361</td><td>1,729,544</td><td><code>barn_titan_upgrade</code></td></tr>
<tr><td>62</td><td>81,520</td><td>1,808,905</td><td><code>tea_leaf</code> <code>zoo_toucan</code></td></tr>
<tr><td>63</td><td>83,700</td><td>1,890,425</td><td><code>expansion_12</code></td></tr>
<tr><td>64</td><td>85,904</td><td>1,974,125</td><td><code>perfumery</code> <code>alpaca</code></td></tr>
<tr><td>65</td><td>88,130</td><td>2,060,029</td><td><code>golden_meadow</code></td></tr>
<tr><td>66</td><td>90,378</td><td>2,148,159</td><td><code>bell_pepper</code> <code>isle_fishers</code></td></tr>
<tr><td>67</td><td>92,649</td><td>2,238,537</td><td><code>expansion_13</code></td></tr>
<tr><td>68</td><td>94,941</td><td>2,331,186</td><td><code>salad_bar</code> <code>zoo_koala</code></td></tr>
<tr><td>69</td><td>97,256</td><td>2,426,127</td><td><code>master_orders_ii</code></td></tr>
<tr><td>70</td><td>99,593</td><td>2,523,383</td><td><code>grand_fair</code></td></tr>
<tr><td>71</td><td>101,951</td><td>2,622,976</td><td><code>peony</code></td></tr>
<tr><td>72</td><td>104,331</td><td>2,724,927</td><td><code>pasta_kitchen</code> <code>otter</code></td></tr>
<tr><td>73</td><td>106,733</td><td>2,829,258</td><td><code>expansion_14</code></td></tr>
<tr><td>74</td><td>109,156</td><td>2,935,991</td><td><code>harvest_festival</code> <code>isle_bonita</code></td></tr>
<tr><td>75</td><td>111,601</td><td>3,045,147</td><td><code>deep_silo</code> <code>zoo_tiger</code></td></tr>
<tr><td>76</td><td>114,066</td><td>3,156,748</td><td><code>fondue_pot</code></td></tr>
<tr><td>77</td><td>116,553</td><td>3,270,814</td><td><code>watermelon</code></td></tr>
<tr><td>78</td><td>119,062</td><td>3,387,367</td><td><code>expansion_15</code></td></tr>
<tr><td>79</td><td>121,591</td><td>3,506,429</td><td><code>golden_barn</code></td></tr>
<tr><td>80</td><td>124,141</td><td>3,628,020</td><td><code>preservation_station</code></td></tr>
<tr><td>81</td><td>126,711</td><td>3,752,161</td><td><code>prize_pavilion</code></td></tr>
<tr><td>82</td><td>129,303</td><td>3,878,872</td><td><code>turkey</code></td></tr>
<tr><td>83</td><td>131,915</td><td>4,008,175</td><td><code>master_grower</code> <code>zoo_polar</code></td></tr>
<tr><td>84</td><td>134,548</td><td>4,140,090</td><td><code>mint</code></td></tr>
<tr><td>85</td><td>137,201</td><td>4,274,638</td><td><code>jeweler</code></td></tr>
<tr><td>86</td><td>139,874</td><td>4,411,839</td><td><code>gilded_orders</code></td></tr>
<tr><td>87</td><td>142,568</td><td>4,551,713</td><td><code>master_rancher</code></td></tr>
<tr><td>88</td><td>145,282</td><td>4,694,281</td><td><code>grand_market</code></td></tr>
<tr><td>89</td><td>148,016</td><td>4,839,563</td><td><code>master_crafter</code></td></tr>
<tr><td>90</td><td>150,770</td><td>4,987,579</td><td><code>yogurt_maker</code></td></tr>
<tr><td>91</td><td>153,544</td><td>5,138,349</td><td><code>legend_trucks</code> <code>zoo_rhino</code></td></tr>
<tr><td>92</td><td>156,338</td><td>5,291,893</td><td><code>legend_boats</code></td></tr>
<tr><td>93</td><td>159,152</td><td>5,448,231</td><td><code>legend_trains</code></td></tr>
<tr><td>94</td><td>161,986</td><td>5,607,383</td><td><code>master_farmer</code></td></tr>
<tr><td>95</td><td>&mdash;</td><td>5,769,369</td><td><code>golden_farm_crown</code></td></tr>
  </tbody>
</table>
`,
    },

    /* --------------------------------------------------------------- */
    {
      id: 'timers-and-diamonds',
      heading: 'Timers, offline progress and diamond skips',
      html: `
<p>
  One clock, one rule, and one way to buy your way past it.
</p>

<h3>tick() reports, it does not advance</h3>
<p>
  Every frame, and once on load, the game calls <code>production.tick(now)</code>.
  What it does <em>not</em> do is interesting: it mutates nothing. Because every
  <code>readyAt</code> is an absolute timestamp compared against
  <code>now</code> at the point of use, a timestamp from days ago already
  resolves correctly with no catch-up pass at all.
</p>
<p>
  So <code>tick()</code> exists purely to answer one question — what is ready
  right now — and returns three lists:
</p>
<pre><code>{ now, readyFields: [...], readyPens: [...], readyBuildings: [...] }</code></pre>
<p>
  It is the single place that walks the world for readiness, so the renderer and
  the dock do not each re-walk every object and every queue entry sixty times a
  second.
</p>

<h3>Diamond skips</h3>
<p>
  Any object carrying a <code>readyAt</code> can be skipped — a growing field, a
  producing pen, a queued recipe. The price is one diamond per ten minutes
  remaining, rounded up, with a minimum of one:
</p>
<pre><code>export function skipCost(remainingSeconds) {
  if (!(remainingSeconds &gt; 0)) return 0;
  return Math.max(1, Math.ceil(remainingSeconds / 600));
}</code></pre>
<p>
  It is charged on time <em>remaining</em>, not total time, so a skip gets
  cheaper the longer you have already waited. A skip refuses if you cannot
  afford it, and refuses on an already-finished timer, and in both cases spends
  nothing.
</p>
<table>
  <caption>What a full-length skip costs</caption>
  <thead><tr><th>Timer</th><th>Length</th><th>Diamonds</th></tr></thead>
  <tbody>
    <tr><td>Wheat growing</td><td>2 min</td><td>1</td></tr>
    <tr><td>Chicken Coop cycle</td><td>10 min</td><td>1</td></tr>
    <tr><td>Strawberry Muffin</td><td>1 h</td><td>6</td></tr>
    <tr><td>Strawberry growing</td><td>2 h</td><td>12</td></tr>
    <tr><td>Turkey Run cycle</td><td>7 h</td><td>42</td></tr>
    <tr><td>Yogurt Maker kit</td><td>24 h 57 min</td><td>150</td></tr>
    <tr><td>Mint growing</td><td>36 h</td><td>216</td></tr>
  </tbody>
</table>
<p>
  Set against a supply of roughly 99 diamonds from starting funds and levelling,
  plus 497 across all achievements, the late-game numbers make the point clearly:
  skipping is a way past a specific inconvenient wait, not a way to play the
  late game faster. Nothing about the pricing changes at any level.
</p>

<h3>What cannot be skipped</h3>
<p>
  <code>skipTimer()</code> takes any object with a numeric
  <code>readyAt</code>, which covers fields, pens and queue entries. It has no
  concept of cost tiers or forbidden targets — anything shaped like a timer is
  skippable, and anything that is not shaped like one is simply refused with no
  charge.
</p>
`,
    },

    /* --------------------------------------------------------------- */
    {
      id: 'verified',
      heading: 'What is verified, and what is still open',
      html: `
<p>
  Documentation is worth less than nothing if it describes intent as behaviour.
  This section separates the two for everything above.
</p>

<h3>Covered by tests</h3>
<p>
  <code>tools/test-core.mjs</code> exercises the farming loop directly against
  the real modules. Running it at the current commit gives
  <strong>27 passed, 0 failed</strong>. The assertions that back this article:
</p>
<ul>
  <li>Planting deducts <code>seedCost</code> immediately; harvesting returns
    exactly twice it and clears the field.</li>
  <li>Harvesting before <code>readyAt</code> fails, and a two-day offline gap
    resolves to exactly the same yield a two-day live wait would.</li>
  <li>Harvest output is capped by remaining silo room and never overflows it.</li>
  <li>Feeding a pen consumes feed exactly once, refuses a pen already producing,
    and a collection capped by barn room still clears the timer.</li>
  <li>Queueing consumes inputs exactly once, a failed queue touches no stock,
    the queue-slot limit is enforced, and collecting removes the entry.</li>
  <li>Skipping a timer spends diamonds and clears the wait; an unaffordable skip
    refunds nothing because it spent nothing.</li>
  <li>Skip cost is one diamond per ten minutes, minimum one.</li>
</ul>

<h3>Covered by the data validator</h3>
<p>
  <code>tools/validate-data.mjs</code> runs over the content tables and refuses
  several classes of mistake outright:
</p>
<ul>
  <li>A non-sink recipe whose output sells for no more than its inputs.</li>
  <li>A level in the ${COUNTS.maxLevel} with no unlock at all.</li>
  <li>An expansion rectangle out of grid bounds, or overlapping another.</li>
  <li>Silo and barn upgrade materials that are not from the storage set, or that
    share a single entry between the two.</li>
  <li>A material with no source, or with no build cost that spends it.</li>
</ul>

<h3>Open, and worth knowing before you rely on it</h3>
<div class="callout callout-warn">
  <p>
    <strong>Storage upgrades are data only.</strong> As described in
    <a href="#/farming/storage">the storage section</a>, no module implements an
    upgrade action. Capacity stays at 50 for both buildings.
  </p>
</div>
<div class="callout callout-warn">
  <p>
    <strong>The plant menu shows at most eight crops.</strong> The radial menu on
    an empty field lists unlocked crops and then truncates the list to the first
    eight in table order. From level 15 onward that is wheat through potato, so
    strawberry and everything later cannot be planted from that menu. Crops
    beyond the eighth are fully implemented in <code>production.js</code> and
    plant correctly when the call is made — the limit is in the menu, not the
    mechanic.
  </p>
</div>
<div class="callout callout-warn">
  <p>
    <strong>Drag-to-plant is described but not implemented.</strong> The header
    of <code>input.js</code> lists drag-plant among its responsibilities, and the
    tutorial tells you to drag wheat over your plots. The pointer handling
    implements pan, zoom and tap; a drag pans the camera. Planting works
    correctly through tapping a plot.
  </p>
</div>
<p>
  None of these three is a data problem, and none affects a save. They are gaps
  between what the interface offers and what the underlying systems already
  support. The <a href="#/changelog">changelog</a> records when each moves.
</p>
`,
    },
  ],

  related: ['getting-started', 'crafting', 'logistics', 'deadtime', 'architecture'],
};
