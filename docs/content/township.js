/**
 * township.js - the Township layer: the town, the zoo and the island voyages.
 *
 * One article for the documentation shell; see ./README-CONTRACT.md for the module
 * contract. Every figure below was derived from src/data.js or from running the
 * modules directly, never quoted from prose elsewhere in the repository.
 */

export const article = {
  id: "township",
  title: "Township",
  group: "Township",
  summary: "The second economy: a town that turns construction materials into population, a zoo that turns farm goods into souvenirs and passive income, and island voyages that supply the one factory nothing else can feed.",
  sections: [
    {
      id: "overview",
      heading: "The second economy",
      html: `
<p>Farm Tycoon runs two economies side by side. The farm economy grows crops, feeds animals and
turns both into goods, and its currency is coins. The <strong>Township</strong> layer runs on
<strong>construction materials</strong> instead, and it is where those materials go to be spent:
bricks, slabs, glass, paint, hammers, nails, cement and roof tiles arrive from trains, the
airport, the helicopter, mine chests, expeditions and event rewards, and the town and the zoo are
what consume them.</p>

<p>That separation is the whole design. A farm with nothing to build towards eventually becomes a
coin printer with no sink, and coins with nothing to buy stop being interesting. The town is a
sink that does not fill: 814 material items and 3,614,400 coins buys one of
every house and one of every community building, and that is only the beginning, because the
final population milestone asks for 2,000 residents and one of everything comes to
1,476.</p>

<div class="stat-row">
  <div class="stat"><div class="stat-num">16</div><div class="stat-label">house types</div></div>
  <div class="stat"><div class="stat-num">10</div><div class="stat-label">community buildings</div></div>
  <div class="stat"><div class="stat-num">9</div><div class="stat-label">population milestones</div></div>
  <div class="stat"><div class="stat-num">14</div><div class="stat-label">zoo enclosures</div></div>
  <div class="stat"><div class="stat-num">8</div><div class="stat-label">island destinations</div></div>
</div>

<h3>Three systems, three doors</h3>

<p>Every Township system opens from an object in the world rather than from a button on the
heads-up display. That is a deliberate rule for the whole game: a level-90 system is visible as a
derelict building from level 1, so a new player can see that there is more coming without being
handed a menu of things they cannot use.</p>

<table>
  <caption>How each Township system is reached, and at what level</caption>
  <thead><tr><th>System</th><th>World object</th><th>Unlocks at</th><th>Module</th></tr></thead>
  <tbody>
    <tr><td>Town</td><td>Road to Town, a 2&times;2 gate at tile (5,&nbsp;10)</td><td>Level 20</td><td><code>src/town.js</code></td></tr>
    <tr><td>Zoo</td><td>Road to the Zoo, a 2&times;2 gate at tile (5,&nbsp;22)</td><td>Level 34</td><td><code>src/zoo.js</code></td></tr>
    <tr><td>Islands</td><td>No world object of its own yet</td><td>Level 36</td><td><code>src/islands.js</code></td></tr>
  </tbody>
</table>

<p>The islands are the odd one out, and it is worth saying so plainly rather than glossing it.
Voyages were split out of the boat module, which kept crates and vouchers, and the world structure
table has no entry for an island dock. The nearest thing is the Boat Dock, which opens the boat
panel. The last section of this article,
<a href="#/township/gaps">what is implemented, what is wired and what is not</a>, gives the full
state of all three modules.</p>
`,
    },
    {
      id: "houses",
      heading: "Houses and population",
      html: `
<p>A house costs coins <em>and</em> materials, and it grants a fixed population. Nothing about a
house is random and nothing about it decays: population, once built, is permanent. There are
16 types across seven tiers, and tiers are gated by milestones rather than by player
level, which means the town advances on its own schedule instead of waiting for the farm.</p>

<p>The cheapest population is the Cottage at 300 coins
per resident; the curve then bends upward, so the late-game houses buy density rather than value.
That is the point of the last column below. It is the number to watch when you are deciding whether
to fill a plot with something cheap now or wait for the tier that fits more people onto the same
four tiles.</p>

<table>
  <caption>Every house type, from <code>TOWN.houses</code></caption>
  <thead><tr><th>Id</th><th>Name</th><th>Tier</th><th>Coins</th><th>Materials</th><th>Population</th><th>Size</th><th>Coins per resident</th></tr></thead>
  <tbody>
    <tr><td><code>cottage</code></td><td>Cottage</td><td>1</td><td>1,200</td><td>Brick &times;2, Nails &times;2</td><td>4</td><td>1&times;1</td><td>300</td></tr>
    <tr><td><code>cabin</code></td><td>Log Cabin</td><td>1</td><td>2,200</td><td>Slab &times;3, Nails &times;2</td><td>6</td><td>1&times;1</td><td>367</td></tr>
    <tr><td><code>bungalow</code></td><td>Bungalow</td><td>2</td><td>4,000</td><td>Brick &times;3, Glass &times;2</td><td>9</td><td>1&times;1</td><td>444</td></tr>
    <tr><td><code>duplex</code></td><td>Duplex</td><td>2</td><td>7,000</td><td>Brick &times;4, Slab &times;3, Paint &times;2</td><td>14</td><td>2&times;2</td><td>500</td></tr>
    <tr><td><code>townhouse</code></td><td>Townhouse</td><td>3</td><td>12,000</td><td>Brick &times;5, Glass &times;4, Hammer &times;2</td><td>20</td><td>2&times;2</td><td>600</td></tr>
    <tr><td><code>cape_house</code></td><td>Cape House</td><td>3</td><td>18,000</td><td>Slab &times;6, Paint &times;4, Nails &times;4</td><td>27</td><td>2&times;2</td><td>667</td></tr>
    <tr><td><code>villa</code></td><td>Villa</td><td>4</td><td>28,000</td><td>Brick &times;8, Glass &times;6, Paint &times;4</td><td>36</td><td>2&times;2</td><td>778</td></tr>
    <tr><td><code>terrace_row</code></td><td>Terrace Row</td><td>4</td><td>40,000</td><td>Brick &times;10, Slab &times;8, Hammer &times;4</td><td>48</td><td>2&times;2</td><td>833</td></tr>
    <tr><td><code>loft_block</code></td><td>Loft Block</td><td>5</td><td>60,000</td><td>Glass &times;12, Slab &times;10, Paint &times;6</td><td>62</td><td>2&times;2</td><td>968</td></tr>
    <tr><td><code>mansion</code></td><td>Mansion</td><td>5</td><td>90,000</td><td>Brick &times;14, Glass &times;10, Hammer &times;6, Paint &times;6</td><td>80</td><td>2&times;2</td><td>1125</td></tr>
    <tr><td><code>apartment_block</code></td><td>Apartment Block</td><td>6</td><td>130,000</td><td>Brick &times;18, Glass &times;14, Cement &times;8</td><td>100</td><td>2&times;2</td><td>1300</td></tr>
    <tr><td><code>courtyard_row</code></td><td>Courtyard Row</td><td>6</td><td>180,000</td><td>Slab &times;20, Paint &times;14, Roof Tile &times;10</td><td>125</td><td>2&times;2</td><td>1440</td></tr>
    <tr><td><code>hillside_villas</code></td><td>Hillside Villas</td><td>6</td><td>250,000</td><td>Brick &times;24, Glass &times;18, Cement &times;12</td><td>160</td><td>2&times;2</td><td>1563</td></tr>
    <tr><td><code>riverside_lofts</code></td><td>Riverside Lofts</td><td>7</td><td>340,000</td><td>Glass &times;28, Slab &times;22, Roof Tile &times;14</td><td>205</td><td>2&times;2</td><td>1659</td></tr>
    <tr><td><code>clocktower_flats</code></td><td>Clocktower Flats</td><td>7</td><td>460,000</td><td>Brick &times;32, Hammer &times;20, Cement &times;16</td><td>260</td><td>2&times;2</td><td>1769</td></tr>
    <tr><td><code>grand_estate</code></td><td>Grand Estate</td><td>7</td><td>620,000</td><td>Brick &times;40, Glass &times;30, Roof Tile &times;20</td><td>320</td><td>2&times;2</td><td>1938</td></tr>
  </tbody>
</table>

<h3>Duplicates are allowed, and that matters</h3>

<p>Building a house does not consume the house type. The build call pushes a new record onto the
town's building list every time, with an id derived from the type, the timestamp and a random
suffix, so nothing prevents ten Cottages. This is not an oversight; it is what makes the
2,000-resident milestone reachable at all. One of every house type totals 1,476
residents, which is well short, so the last two milestones are a deliberate instruction to build
the same high-density house repeatedly.</p>

<div class="callout callout-info">
  <p><strong>Everything is checked before anything is spent.</strong> The affordability check tests
  the tier, the player level, the population cap, the coin balance and every material in the barn;
  the build call runs it again and returns false without touching anything if it fails. There is no
  path that deducts coins and then discovers a missing brick. The township test suite asserts
  exactly this, against a deliberately short material stock: a refused build leaves both the barn
  and the coin balance untouched.</p>
</div>
`,
    },
    {
      id: "capacity",
      heading: "Community buildings and the population cap",
      html: `
<p>Population is capped, and the cap starts at <strong>30</strong>. That
number is small on purpose. A Cottage houses 4, so a brand new town fits
7 of them, 28 residents in all, and the
8th is refused. The cap is a hard ceiling rather than a soft penalty: the
affordability check returns false the moment the next house would cross it, and the test suite
builds Cottages in a loop until it does.</p>

<p>Raising the ceiling is what community buildings are for. Each adds a flat amount of capacity and
grants no population of its own, so a town alternates: build houses until the cap bites, build a
community building, build houses again. The Town Hall is the first one available at tier 1 for
5,000 coins and Brick &times;4, Slab &times;4, and it triples a starting town's ceiling from
30 to 90.</p>

<table>
  <caption>Every community building, from <code>TOWN.communityBuildings</code></caption>
  <thead><tr><th>Id</th><th>Name</th><th>Tier</th><th>Coins</th><th>Materials</th><th>Capacity</th><th>Size</th></tr></thead>
  <tbody>
    <tr><td><code>town_hall</code></td><td>Town Hall</td><td>1</td><td>5,000</td><td>Brick &times;4, Slab &times;4</td><td>+60</td><td>2&times;2</td></tr>
    <tr><td><code>school</code></td><td>School</td><td>2</td><td>12,000</td><td>Brick &times;6, Glass &times;4, Nails &times;4</td><td>+90</td><td>2&times;2</td></tr>
    <tr><td><code>clinic</code></td><td>Clinic</td><td>3</td><td>22,000</td><td>Slab &times;8, Glass &times;6, Paint &times;4</td><td>+120</td><td>2&times;2</td></tr>
    <tr><td><code>cinema</code></td><td>Cinema</td><td>4</td><td>38,000</td><td>Brick &times;10, Glass &times;8, Hammer &times;4</td><td>+160</td><td>2&times;2</td></tr>
    <tr><td><code>pavilion</code></td><td>Park Pavilion</td><td>4</td><td>60,000</td><td>Slab &times;12, Paint &times;8, Nails &times;6</td><td>+210</td><td>2&times;2</td></tr>
    <tr><td><code>museum</code></td><td>Museum</td><td>5</td><td>95,000</td><td>Brick &times;16, Glass &times;12, Paint &times;8</td><td>+280</td><td>2&times;2</td></tr>
    <tr><td><code>library</code></td><td>Library</td><td>6</td><td>150,000</td><td>Brick &times;20, Glass &times;14</td><td>+350</td><td>2&times;2</td></tr>
    <tr><td><code>sports_hall</code></td><td>Sports Hall</td><td>6</td><td>220,000</td><td>Slab &times;26, Cement &times;12</td><td>+460</td><td>2&times;2</td></tr>
    <tr><td><code>observatory</code></td><td>Observatory</td><td>7</td><td>320,000</td><td>Glass &times;30, Hammer &times;18</td><td>+620</td><td>2&times;2</td></tr>
    <tr><td><code>botanic_garden</code></td><td>Botanical Garden</td><td>7</td><td>450,000</td><td>Slab &times;34, Paint &times;24</td><td>+900</td><td>2&times;2</td></tr>
  </tbody>
</table>

<p>One of each community building takes the ceiling to <strong>3,280</strong>, comfortably
above what one of each house can fill. Community buildings can be duplicated exactly as houses can,
so the ceiling has no theoretical maximum at all: ten Botanical Gardens alone would be
9,000 capacity. In practice the limit is materials and space, not the rule.</p>
`,
    },
    {
      id: "milestones",
      heading: "Milestones, tiers and the claim rule",
      html: `
<p>Milestones are the town's progression spine. Each names a total population; reaching it makes
that milestone claimable; claiming it pays a one-off reward and may raise the highest house and
community tier you are allowed to build. Milestones are the <em>only</em> way tiers advance.
Player level has nothing to do with it.</p>

<table>
  <caption>Population milestones, from <code>TOWN.milestones</code></caption>
  <thead><tr><th>#</th><th>Population</th><th>Coins</th><th>Diamonds</th><th>Materials</th><th>Unlocks tier</th></tr></thead>
  <tbody>
    <tr><td>0</td><td>20</td><td>2,000</td><td>2</td><td>&mdash;</td><td>2</td></tr>
    <tr><td>1</td><td>60</td><td>6,000</td><td>3</td><td>Brick &times;4, Slab &times;4</td><td>3</td></tr>
    <tr><td>2</td><td>140</td><td>15,000</td><td>5</td><td>Glass &times;6, Paint &times;4</td><td>4</td></tr>
    <tr><td>3</td><td>260</td><td>40,000</td><td>8</td><td>Hammer &times;6, Nails &times;6</td><td>5</td></tr>
    <tr><td>4</td><td>400</td><td>100,000</td><td>15</td><td>&mdash;</td><td>5</td></tr>
    <tr><td>5</td><td>600</td><td>90,000</td><td>12</td><td>Cement &times;8, Roof Tile &times;6</td><td>6</td></tr>
    <tr><td>6</td><td>900</td><td>150,000</td><td>16</td><td>Glass &times;12, Brick &times;12</td><td>6</td></tr>
    <tr><td>7</td><td>1,400</td><td>260,000</td><td>22</td><td>Cement &times;14, Roof Tile &times;12</td><td>7</td></tr>
    <tr><td>8</td><td>2,000</td><td>420,000</td><td>30</td><td>Brick &times;20, Glass &times;18</td><td>7</td></tr>
  </tbody>
</table>

<p>Claimed in full, the ladder pays <strong>1,083,000 coins</strong> and
<strong>113 diamonds</strong> across 9 claims. Two details in that table are
easy to misread:</p>

<ul>
  <li><strong>Some milestones unlock no new tier.</strong> Milestone 4 repeats tier 5, milestone 6
  repeats tier 6 and milestone 8 repeats tier 7. Those three are pure rewards, placed between the
  tier steps so the gap between them does not feel empty. The unlocked tier is computed as the
  <em>maximum</em> across every claimed milestone, so claiming out of order, or skipping one, can
  never lower a tier you already have.</li>
  <li><strong>The coin rewards are not monotonic.</strong> Milestone 4, at
  400 residents, pays 100,000 coins;
  milestone 5, at 600, pays
  90,000, which is less for a harder target. Milestone 4 was the
  end of the original level-50 content and reads as a capstone; the 4 milestones after
  it arrived with the late-game levels and restart a gentler curve. Worth knowing before you plan
  around it.</li>
</ul>

<h3>Claiming is idempotent</h3>

<p>Claiming a milestone that is already claimed returns success without paying anything a second
time. That is a deliberate choice rather than a loose end: success means "this milestone is
settled", which is what an interface actually wants to know, and it makes a double tap on a claim
button harmless. Claiming a milestone whose population has not been reached returns failure and
changes nothing.</p>

<p>Material rewards go into the barn through the same add path a refund uses. Coins go through the
economy module, so the usual tracking applies; diamonds are added directly.</p>
`,
    },
    {
      id: "materials",
      heading: "Where the materials come from, and how many",
      html: `
<p>The town consumes the <strong>building set</strong>: 8 distinct materials across
houses and community buildings. It never asks for the expansion set, which buys land; never the
storage set, which upgrades the barn and silo; and never the advanced set, which comes only from
the tool exchange and expedition loot.</p>

<table>
  <caption>Total bill for one of every town building</caption>
  <thead><tr><th>What</th><th>Coins</th><th>Material items</th></tr></thead>
  <tbody>
    <tr><td>One of each of the 16 house types</td><td>2,242,400</td><td>&mdash;</td></tr>
    <tr><td>One of each of the 10 community buildings</td><td>1,372,000</td><td>&mdash;</td></tr>
    <tr><td><strong>Combined</strong></td><td><strong>3,614,400</strong></td><td><strong>814</strong></td></tr>
  </tbody>
</table>

<p>Broken down by material, that combined bill is: Brick &times;216, Glass &times;198, Slab &times;156, Paint &times;80, Hammer &times;54, Cement &times;48, Roof Tile &times;44, Nails &times;18.</p>

<h3>The supply side</h3>

<p>Three transports feed the barn, and they deliberately overlap as little as possible. The
<a href="#/logistics">logistics article</a> covers them properly; what matters here is which of
them the town can actually use.</p>

<table>
  <caption>Material channels and what each one carries</caption>
  <thead><tr><th>Channel</th><th>From level</th><th>Items per completed trip</th><th>Pool leans towards</th></tr></thead>
  <tbody>
    <tr><td>Cargo trains</td><td>21</td><td>4&ndash;8</td><td>Building set, plus a little expansion</td></tr>
    <tr><td>Helicopter</td><td>22</td><td>2&ndash;4</td><td>Storage set, plus light building stock</td></tr>
    <tr><td>Airport</td><td>28</td><td>3&ndash;6</td><td>Expansion and storage, a little building</td></tr>
  </tbody>
</table>

<p>Trains are the town's channel. Their pool carries 14 materials by
weight, of which the 8 the town uses account for
<strong>72.6%</strong> of the draw. The remainder is wire, rope and timber:
building-set materials the town never asks for, which go instead to the Building Workshop's
components, the deeper mine seams and the laboratory. One pool serving two demands is why the
building set is as large as it is.</p>

<div class="callout callout-info">
  <p><strong>A rough sense of scale, derived rather than measured.</strong> At the midpoint of
  6 items per completed train trip, 72.6% of which the town can use, one
  trip yields about 4.4 useful items. The 814-item bill for
  one of everything is therefore on the order of <strong>187 completed train
  trips</strong>, before counting the airport, the helicopter, mine chests, expeditions or event
  rewards. This is arithmetic over the content tables rather than a play-tested figure, and it
  assumes every train departs full. Treat it as an order of magnitude and nothing finer.</p>
</div>

<div class="callout callout-warn">
  <p>How that translates into wall-clock time depends on the train cadence, and the cadence is one
  of the loose threads in the current code: the declared train and airport intervals are present in
  the content tables and are not read anywhere. The train tick starts a new train as soon as there
  is no current one and nothing returning, so the real cycle is the fill plus the return trip rather
  than the declared gap between arrivals. That belongs to the <a href="#/logistics">logistics</a>
  lane, but it changes any estimate made here, so it is recorded rather than assumed away.</p>
</div>
`,
    },
    {
      id: "zoo-enclosures",
      heading: "The zoo: enclosures and the feeding cycle",
      html: `
<p>The zoo opens at level 34 and is the town's twin. It also costs coins and
building materials, and it also pays out over wall-clock time. Where it differs is that the zoo
turns <em>farm output</em> into a second class of goods: an enclosure eats crops, fish or meat and
produces a souvenir, and souvenirs sell for several times what the feed would have.</p>

<p>The cycle has exactly three steps and no hidden state.</p>

<ol>
  <li><strong>Buy</strong> the enclosure once. It costs coins and materials, is gated on player
  level, and is refused if you already own it. Unlike houses, enclosures are one of each.</li>
  <li><strong>Feed</strong> it. The feed is consumed immediately and an absolute ready timestamp is
  set. Feeding an enclosure that is already producing is refused; collect first.</li>
  <li><strong>Collect</strong> once that timestamp has passed. Exactly one souvenir goes into the
  barn and the enclosure resets to idle.</li>
</ol>

<table>
  <caption>Every enclosure, from <code>ZOO.enclosures</code></caption>
  <thead><tr><th>Id</th><th>Name</th><th>Level</th><th>Coins</th><th>Materials</th><th>Feed</th><th>Time</th><th>Produces</th></tr></thead>
  <tbody>
    <tr><td><code>zoo_peacock</code></td><td>Peacock Aviary</td><td>34</td><td>15,000</td><td>Glass &times;4, Nails &times;4</td><td>Wheat &times;10</td><td>2 h</td><td>Peacock Feather</td></tr>
    <tr><td><code>zoo_monkey</code></td><td>Monkey Treehouse</td><td>34</td><td>20,000</td><td>Slab &times;5, Nails &times;4</td><td>Banana &times;3</td><td>2.5 h</td><td>Monkey Plush</td></tr>
    <tr><td><code>zoo_penguin</code></td><td>Penguin Pool</td><td>41</td><td>28,000</td><td>Glass &times;6, Slab &times;4</td><td>Perch &times;6</td><td>3 h</td><td>Penguin Badge</td></tr>
    <tr><td><code>zoo_flamingo</code></td><td>Flamingo Lagoon</td><td>42</td><td>34,000</td><td>Paint &times;5, Glass &times;4</td><td>Trout &times;5</td><td>3 h</td><td>Flamingo Pin</td></tr>
    <tr><td><code>zoo_lion</code></td><td>Lion Rock</td><td>44</td><td>45,000</td><td>Brick &times;8, Hammer &times;4</td><td>Bacon &times;5</td><td>4 h</td><td>Lion Figurine</td></tr>
    <tr><td><code>zoo_panda</code></td><td>Panda Grove</td><td>46</td><td>60,000</td><td>Slab &times;8, Paint &times;5</td><td>Sugarcane &times;12</td><td>4 h</td><td>Panda Souvenir</td></tr>
    <tr><td><code>zoo_giraffe</code></td><td>Giraffe Savanna</td><td>48</td><td>80,000</td><td>Brick &times;10, Glass &times;6</td><td>Carrot &times;15</td><td>5 h</td><td>Giraffe Scarf</td></tr>
    <tr><td><code>zoo_elephant</code></td><td>Elephant Meadow</td><td>50</td><td>110,000</td><td>Brick &times;12, Slab &times;10</td><td>Pumpkin &times;6</td><td>6 h</td><td>Elephant Statue</td></tr>
    <tr><td><code>zoo_otter</code></td><td>Otter Pond</td><td>56</td><td>140,000</td><td>Glass &times;14, Slab &times;12</td><td>Perch &times;6</td><td>7 h</td><td>Otter Charm</td></tr>
    <tr><td><code>zoo_toucan</code></td><td>Toucan Aviary</td><td>62</td><td>175,000</td><td>Brick &times;15, Glass &times;12</td><td>Banana &times;8</td><td>7.5 h</td><td>Toucan Mask</td></tr>
    <tr><td><code>zoo_koala</code></td><td>Koala Grove</td><td>68</td><td>215,000</td><td>Slab &times;16, Paint &times;12</td><td>Tea Leaf &times;6</td><td>8 h</td><td>Koala Plush</td></tr>
    <tr><td><code>zoo_tiger</code></td><td>Tiger Ridge</td><td>75</td><td>265,000</td><td>Brick &times;18, Hammer &times;12</td><td>Lamb Chop &times;5</td><td>9 h</td><td>Tiger Banner</td></tr>
    <tr><td><code>zoo_polar</code></td><td>Polar Shore</td><td>83</td><td>325,000</td><td>Glass &times;20, Cement &times;10</td><td>Salmon &times;4</td><td>10 h</td><td>Polar Snow Globe</td></tr>
    <tr><td><code>zoo_rhino</code></td><td>Rhino Plain</td><td>91</td><td>400,000</td><td>Brick &times;24, Slab &times;20</td><td>Watermelon &times;6</td><td>11 h</td><td>Rhino Carving</td></tr>
  </tbody>
</table>

<p>One of every enclosure costs <strong>1,912,000 coins</strong> and
<strong>284 material items</strong> (Brick &times;87, Slab &times;75, Glass &times;66, Paint &times;22, Hammer &times;16, Cement &times;10, Nails &times;8). The unlock levels run from
34 to 91, which makes the zoo one of the few systems still adding
content at the level cap.</p>

<h3>Where the feed is taken from</h3>

<p>Feed is looked up in a deliberate order: <strong>the silo first, and the barn only if the silo
has no entry at all for that item</strong>. Crops live in the silo and goods live in the barn, so
in ordinary play this does the obvious thing. The edge is worth knowing, though, because it is
genuinely surprising the first time you meet it.</p>

<div class="callout callout-warn">
  <p><strong>Stock does not pool across the two stores.</strong> If the silo holds an entry for an
  item, even a zero one, the barn is never consulted for it. A new save starts with 6 wheat in the
  silo; with 50 more wheat sitting in the barn, feeding the Peacock Aviary
  (Wheat &times;10) is still refused, because the lookup sees the
  silo's 6 and stops there. Setting the silo entry to 0 does not help either. Only removing the key
  entirely lets the barn answer. This was verified by running the module directly rather than
  inferred from reading it, and the same lookup governs whether a zoo order can be filled.</p>
</div>
`,
    },
    {
      id: "zoo-margins",
      heading: "What a souvenir is actually worth",
      html: `
<p>The interesting question about an enclosure is not what the souvenir sells for but what the feed
would have sold for instead. The table below is that subtraction, at base sell prices throughout:
the raw value of one feeding, the souvenir it produces, the difference, and the difference divided
by the production time.</p>

<table>
  <caption>Feed cost against souvenir value, at base sell prices</caption>
  <thead><tr><th>Enclosure</th><th>Feed value</th><th>Souvenir sells for</th><th>Margin</th><th>Margin per hour</th></tr></thead>
  <tbody>
    <tr><td>Peacock Aviary</td><td>40</td><td>220</td><td>180</td><td>90</td></tr>
    <tr><td>Monkey Treehouse</td><td>180</td><td>260</td><td>80</td><td>32</td></tr>
    <tr><td>Penguin Pool</td><td>180</td><td>300</td><td>120</td><td>40</td></tr>
    <tr><td>Flamingo Lagoon</td><td>170</td><td>320</td><td>150</td><td>50</td></tr>
    <tr><td>Lion Rock</td><td>125</td><td>380</td><td>255</td><td>64</td></tr>
    <tr><td>Panda Grove</td><td>228</td><td>420</td><td>192</td><td>48</td></tr>
    <tr><td>Giraffe Savanna</td><td>165</td><td>470</td><td>305</td><td>61</td></tr>
    <tr><td>Elephant Meadow</td><td>348</td><td>540</td><td>192</td><td>32</td></tr>
    <tr><td>Otter Pond</td><td>180</td><td>600</td><td>420</td><td>60</td></tr>
    <tr><td>Toucan Aviary</td><td>480</td><td>680</td><td>200</td><td>27</td></tr>
    <tr><td>Koala Grove</td><td>1,620</td><td>770</td><td>&minus;850</td><td>&minus;106</td></tr>
    <tr><td>Tiger Ridge</td><td>350</td><td>870</td><td>520</td><td>58</td></tr>
    <tr><td>Polar Shore</td><td>480</td><td>980</td><td>500</td><td>50</td></tr>
    <tr><td>Rhino Plain</td><td>2,544</td><td>1,100</td><td>&minus;1,444</td><td>&minus;131</td></tr>
  </tbody>
</table>

<div class="callout callout-warn">
  <p><strong>Two enclosures have a negative raw margin, and this article is not going to pretend
  otherwise.</strong> Koala Grove eats Tea Leaf &times;6, an input worth
  1,620 coins, to produce a 770-coin Koala Plush.
  Rhino Plain eats Watermelon &times;6, worth 2,544,
  to produce a 1,100-coin Rhino Carving. Measured against simply selling the
  feed, both lose money.</p>
  <p>Whether that is a balance defect or a deliberate one cannot be settled from the tables alone,
  so it is recorded as an open question rather than smoothed over. What can be said is that Tea Leaf
  and Watermelon are two of the slowest crops in the game, 20 and
  30 hours to grow, so their sell prices are high for reasons that
  have nothing to do with the zoo; and that both souvenirs earn their keep through zoo orders rather
  than the sell button.</p>
</div>

<p>Read past those two and the shape is consistent: roughly 30 to 90 coins an hour of margin per
enclosure. That is small beside a production building, but it asks for one tap twice a day and no
attention in between. The zoo is an idle system and it is priced like one.</p>
`,
    },
    {
      id: "zoo-visitors",
      heading: "Visitor income and the twelve-hour cap",
      html: `
<p>Alongside the souvenirs, the zoo pays a passive coin trickle from visitors. It is the only place
in the game where the town and the zoo touch directly: <strong>the rate is a function of town
population</strong>, because a bigger town sends more visitors.</p>

<pre><code>visitorIncomePerHour = min(500, 40 + population &times; 2)</code></pre>

<p>Two consequences fall straight out of that line. The first is a floor: a zoo with no town at all
still earns 40 coins an hour. The second is a ceiling, and it arrives sooner than you would
expect.</p>

<table>
  <caption>Visitor rate against town population</caption>
  <thead><tr><th>Town population</th><th>Coins per hour</th><th>A full 12-hour accrual</th></tr></thead>
  <tbody>
    <tr><td>0</td><td>40</td><td>480</td></tr>
    <tr><td>30 (a starting town at its cap)</td><td>100</td><td>1,200</td></tr>
    <tr><td>100</td><td>240</td><td>2,880</td></tr>
    <tr><td>200</td><td>440</td><td>5,280</td></tr>
    <tr><td><strong>230 (the rate saturates)</strong></td><td><strong>500</strong></td><td><strong>6,000</strong></td></tr>
    <tr><td>2,000 (the final milestone)</td><td>500</td><td>6,000</td></tr>
  </tbody>
</table>

<p><strong>The rate saturates at 230 residents</strong>, which is milestone 3 territory and a
long way from the top of the ladder. Past 230 the town keeps growing for its own milestones,
its own tiers and its own sake, and the zoo stops noticing entirely. Whether that is the intended
shape, or a ceiling that wants raising alongside the late-game milestones, is a fair question. As
the tables stand, it is what happens.</p>

<h3>The twelve-hour cap, and why the clock advances anyway</h3>

<p>Accrual is capped at <strong>12 hours</strong>. Come back after a fortnight and you are paid for
twelve hours, not for fourteen days: at most 6,000 coins. The reasoning is the one every
offline system in this game shares. An idle game has to be worth returning to daily, and a
fortnight away that prints a fortune makes the daily return pointless. Foraging respawns are capped
for the same reason, and the <a href="#/deadtime">offline progress article</a> covers the pattern
across the whole game.</p>

<div class="callout callout-info">
  <p><strong>Collecting advances the clock even when the payout is zero.</strong> The collect call
  writes the current time before it checks the amount, so a call made below the unlock level, or
  with nothing accrued, still resets the accrual window. Without that, time could pile up unnoticed
  past the cap while an early-game player tapped an empty button, and the cap would quietly stop
  being a cap.</p>
</div>
`,
    },
    {
      id: "zoo-orders",
      heading: "Zoo orders, generated rather than authored",
      html: `
<p>The zoo keeps <strong>3 order slots</strong> filled. Each order asks for one zoo
souvenir and one farm item and pays coins and experience. Unlike the main order board, which draws
from an authored table, <strong>zoo orders have no content table at all</strong>. They are
generated from whatever you own.</p>

<h3>How an order is built</h3>

<ol>
  <li>Take the products of every enclosure you actually own. If you own none, no order can be
  generated, and the tick stops trying rather than looping.</li>
  <li>Take every crop and good the economy reports as unlocked at your level.</li>
  <li>Pick one of each: 1 to 3 of the souvenir, 2 to 6 of the farm item.</li>
  <li>Sum the two at base sell price to get a value, then pay
  <code>round(value &times; 1.6) + 100</code> coins and <code>max(10, round(value / 10))</code>
  experience.</li>
</ol>

<p>A real example, generated by running the module at level 34 with the Peacock
Aviary and Monkey Treehouse owned:</p>

<pre><code>{ items: [ { itemId: 'peacock_feather', qty: 2 },
           { itemId: 'grapes',          qty: 3 } ],
  rewardCoins: 1476,
  rewardXp: 86 }</code></pre>

<p>The 1.6 multiplier is what makes filling an order worth more than selling the same items at the
roadside shop, and the flat 100 is what stops a cheap order being worth almost nothing. Filling an
order checks every line before consuming anything, exactly like every other consume-then-pay path
in the game.</p>

<h3>Known rough edges</h3>

<ul>
  <li><strong>Orders never expire or rotate.</strong> The tick tops the list back up to
  3 and does nothing else, so an order you do not want simply sits there. There is
  no skip, no reroll and no timer. The main order board rotates; the zoo board does not, yet.</li>
  <li><strong>The farm half of the pool is wider than it looks.</strong> Eligibility is "unlocked at
  this level", and an item with no declared unlock level of its own defaults to level 1. Fish are
  declared as goods without individual unlock levels, so a level-34 zoo order can
  name a rare fish. It is fillable, since nothing in the pool is impossible, but it can be a long
  way from convenient.</li>
  <li><strong>The order counter is not persisted.</strong> Ids combine a module-level counter with a
  timestamp suffix. The counter restarts at 1 on every page load; the timestamp is what keeps ids
  distinct across sessions.</li>
</ul>
`,
    },
    {
      id: "islands",
      heading: "Island voyages",
      html: `
<p>Islands open at level 36. Send the boat to a destination, wait, and it
returns with tropical goods that grow nowhere on the farm. There are 8 destinations and
<strong>one voyage at a time</strong>. That single-slot rule is the entire design constraint, and it
is what makes choosing a destination a decision rather than a checklist.</p>

<table>
  <caption>Every destination, from <code>ISLANDS.destinations</code></caption>
  <thead><tr><th>Id</th><th>Name</th><th>Level</th><th>Trip</th><th>Cargo</th><th>Cargo value</th><th>Coins per hour</th></tr></thead>
  <tbody>
    <tr><td><code>isle_palm</code></td><td>Palm Isle</td><td>36</td><td>1 h</td><td>Banana &times;3&ndash;6</td><td>180&ndash;360</td><td>180&ndash;360</td></tr>
    <tr><td><code>isle_coral</code></td><td>Coral Cove</td><td>43</td><td>2 h</td><td>Pineapple &times;3&ndash;5</td><td>240&ndash;400</td><td>120&ndash;200</td></tr>
    <tr><td><code>isle_lagoon</code></td><td>Blue Lagoon</td><td>45</td><td>3 h</td><td>Cocoa &times;2&ndash;5</td><td>200&ndash;500</td><td>67&ndash;167</td></tr>
    <tr><td><code>isle_volcano</code></td><td>Volcano Key</td><td>47</td><td>4 h</td><td>Vanilla &times;2&ndash;4</td><td>260&ndash;520</td><td>65&ndash;130</td></tr>
    <tr><td><code>isle_frutus</code></td><td>Frutus Isle</td><td>52</td><td>5 h</td><td>Peach &times;3&ndash;6 + Plum &times;2&ndash;4</td><td>910&ndash;1,820</td><td>182&ndash;364</td></tr>
    <tr><td><code>isle_olivia</code></td><td>Olivia Isle</td><td>58</td><td>7 h</td><td>Key Lime &times;2&ndash;5 + Island Melon &times;2&ndash;4</td><td>920&ndash;2,110</td><td>131&ndash;301</td></tr>
    <tr><td><code>isle_fishers</code></td><td>Fisherman Isle</td><td>66</td><td>9 h</td><td>Coconut &times;2&ndash;4 + Avocado &times;2&ndash;3</td><td>1,400&ndash;2,420</td><td>156&ndash;269</td></tr>
    <tr><td><code>isle_bonita</code></td><td>Bonita Isle</td><td>74</td><td>11 h</td><td>Mango &times;2&ndash;4 + Aloe &times;1&ndash;3</td><td>1,420&ndash;3,360</td><td>129&ndash;305</td></tr>
  </tbody>
</table>

<p>The first four destinations carry a single good each; the four added with the late-game levels
carry two, which is what keeps a nine- or eleven-hour trip worth the slot it occupies. Note that raw
coins per hour is <em>not</em> the reason to sail: Palm Isle beats every later island on that
measure. The reason is the <a href="#/township/cafe">Tropical Café</a> and the recipes there that
cannot be made from anything else.</p>

<h3>How a voyage resolves</h3>

<p>A voyage stores an absolute ready timestamp, so it needs no ongoing ticks and resolves correctly
across any offline gap, including days away. The module's tick function is genuinely and
deliberately empty: it takes the current time and ignores it, because the comparison happens where
the cargo is asked for instead. The test suite proves this by moving a voyage's ready time into the
past and collecting successfully without a single intervening tick.</p>

<p>Two further details are worth knowing, because both exist to protect you rather than the
code.</p>

<ul>
  <li><strong>Cargo is rolled once and then cached on the voyage.</strong> Each destination declares
  a quantity range, and the roll happens the first time the cargo is asked for. The result is stored
  on the voyage, so asking again, including the internal call that collection makes, returns the
  identical numbers. Without that, an interface showing "3 bananas waiting" could hand you 6 at
  collection time.</li>
  <li><strong>Collection is refused rather than truncated when the barn is full.</strong> The total
  quantity is compared against remaining barn space, and if it does not fit, nothing is taken and
  the voyage stays waiting. Cargo is never silently lost to an over-full barn: clear some space and
  collect again.</li>
</ul>

<p>Completing a voyage increments a lifetime voyages-completed statistic. No achievement reads that
counter at present. It is recorded for one that does not exist yet.</p>
`,
    },
    {
      id: "cafe",
      heading: "Why the cargo exists: the Tropical Café",
      html: `
<p>Island cargo has one destination that justifies the trip. The Tropical Café unlocks at level
36, the same level as the islands themselves, which is not a coincidence, and every
one of its 9 recipes is built on goods that only a voyage can supply.</p>

<table>
  <caption>Tropical Café recipes and the value they add</caption>
  <thead><tr><th>Product</th><th>Level</th><th>Inputs</th><th>Time</th><th>Input value</th><th>Sells for</th><th>Uplift</th></tr></thead>
  <tbody>
    <tr><td>Banana Split</td><td>36</td><td>Banana &times;2, Cream &times;1, Sugar &times;1</td><td>1.5 h</td><td>178</td><td>280</td><td>+102 (1.57&times;)</td></tr>
    <tr><td>Piña Smoothie</td><td>43</td><td>Pineapple &times;2, Milk &times;1</td><td>1.75 h</td><td>176</td><td>300</td><td>+124 (1.70&times;)</td></tr>
    <tr><td>Choco Banana</td><td>45</td><td>Banana &times;2, Cocoa &times;1, Sugar &times;1</td><td>2 h</td><td>250</td><td>330</td><td>+80 (1.32&times;)</td></tr>
    <tr><td>Vanilla Ice Cream</td><td>47</td><td>Vanilla &times;1, Cream &times;2, Sugar &times;2</td><td>2.5 h</td><td>246</td><td>380</td><td>+134 (1.54&times;)</td></tr>
    <tr><td>Peach Melba</td><td>52</td><td>Peach &times;3, Cream &times;1</td><td>1.5 h</td><td>478</td><td>900</td><td>+422 (1.88&times;)</td></tr>
    <tr><td>Lime Cooler</td><td>58</td><td>Key Lime &times;2, Island Melon &times;2</td><td>1.75 h</td><td>920</td><td>1,050</td><td>+130 (1.14&times;)</td></tr>
    <tr><td>Coconut Cream</td><td>66</td><td>Coconut &times;3, Milk &times;2</td><td>2 h</td><td>992</td><td>1,240</td><td>+248 (1.25&times;)</td></tr>
    <tr><td>Mango Sorbet</td><td>74</td><td>Mango &times;3, Plum &times;2</td><td>2.25 h</td><td>1,810</td><td>3,260</td><td>+1,450 (1.80&times;)</td></tr>
    <tr><td>Aloe Tonic</td><td>74</td><td>Aloe &times;2, Avocado &times;2, Honey &times;1</td><td>2.5 h</td><td>1,858</td><td>3,340</td><td>+1,482 (1.80&times;)</td></tr>
  </tbody>
</table>

<p>That is the answer to "why sail for four hours for two vanilla pods". The pods are worth
260 coins on their own; run through the Café with cream and sugar they become
a Vanilla Ice Cream worth 380. The late recipes are stronger still.
Mango Sorbet and Aloe Tonic both close to double their input value,
and they carry two of the highest single-item sell prices in the game.</p>

<p>The Café is an ordinary production building in every other respect. It is crafted from a kit at
the Building Workshop, it has a queue, and it has its own minigame. The
<a href="#/crafting">crafting article</a> covers how kits and minigames work; what belongs here is
simply that the islands are not a side activity but the supply line for one specific factory.</p>
`,
    },
    {
      id: "saves",
      heading: "How the three slices live in a save",
      html: `
<p>Each of the three systems owns one key in the save file, and each is small enough to read at a
glance.</p>

<pre><code>town:    { buildings: [ { id, kind, typeId, x, y, size } ],
           population, capacity, claimedMilestones: [ index ] }

zoo:     { enclosures: { enclosureId: { fedAt, readyAt } },
           lastIncomeAt, orders: [ ... ] }

islands: { voyage: { islandId, readyAt, cargo } | null,
           unlocked: [ islandId ] }</code></pre>

<p>Every timer in there is an absolute wall-clock millisecond timestamp. Nothing is a countdown,
which is the rule that makes offline progress work at all: closing the game for three days and
reopening it is arithmetic on two numbers rather than a replay of three days of ticks.</p>

<h3>Lazy seeding, and the migration that made it unnecessary</h3>

<p>The town, zoo and market slices arrived after the save format already existed. Builds up to
<code>v0.1.0-build15</code> shipped version 2 saves without them, so each module carries its own
state-seeding helper that creates its slice on first use. Save version 3 then added the keys
properly, with a version 2 to 3 migration that fills in whichever are missing.</p>

<p>Both halves are still present, deliberately. The migration means a fresh save has the keys from
the start; the lazy seed means a module cannot be broken by a save that predates it or by a shape
change elsewhere. The shared shape builders in the state module mirror each module's own fallback
exactly, so the two cannot drift apart. The islands slice never needed the treatment, having been in
the documented shape from the beginning, but it defends itself anyway.</p>

<div class="callout callout-info">
  <p><strong>Saves are never broken.</strong> Any change to the documented shape bumps the save
  version and adds a migration. A save written by a newer version than the running code understands
  is refused rather than guessed at, which is the safer direction in which to fail. The
  <a href="#/architecture">architecture article</a> covers the save format in full.</p>
</div>
`,
    },
    {
      id: "gaps",
      heading: "What is implemented, what is wired and what is not",
      html: `
<p>This article documents the Township modules as they are, which means being straight about where
the implementation stops. All three are written and covered by tests: the township suite exercises
trains, town, zoo and islands together, asserting the capacity cap, atomic material spending,
idempotent milestone claims, the twelve-hour income cap, single-consumption feeding and offline
voyage resolution. What follows is not a list of things that fail. It is a list of things that are
not connected yet, each verified by reading or running the source rather than assumed.</p>

<h3>No interface panels</h3>

<p>The interface module's panel switch handles nine panels: the silo, the barn, orders, the shop,
the building queue, the workshop, settings, achievements and decorating. <strong>None of them is
town, zoo or islands.</strong> The world objects exist and are clickable. The Road to Town and the
Road to the Zoo are both drawn, derelict before their unlock level and solid after it. But tapping
either opens the generic fallback panel rather than a town or zoo screen. The logic underneath is
complete; the screen on top of it is not.</p>

<h3>The islands have no door at all</h3>

<p>The world structure table has no island entry. Voyages were split out of the boat module, which
kept crates and vouchers, and no dock was added in the same change. Until one is, no world object
anywhere reaches the island system.</p>

<h3>Building positions are recorded but not validated</h3>

<p>Town buildings are placed with x and y coordinates, and the town declares a district: a 5&times;5
rectangle at tile (27,&nbsp;27). The build call stores the coordinates on the record and checks
neither of them. Verified by running the module directly: three Town Halls were built on the same
tile, and a fourth at (&minus;500,&nbsp;9999), all accepted, with capacity rising correctly each
time. Placement rules therefore have to come from the interface layer, and the interface layer is
the part that does not exist yet.</p>

<p>Two related facts sit in the content tables and are worth recording while they are visible. Most
houses above tier 1 are 2&times;2, so the declared 25-tile district holds six of them at most. And
that district sits inside expansion 10, which is bought at level 54, while the town itself unlocks
at level 20: a 34-level gap between opening the town and owning the land it is
drawn on. Neither is enforced by anything today.</p>

<h3>Smaller loose ends</h3>

<ul>
  <li>The islands' list of unlocked destinations is appended to every time a voyage starts and is
  never read by anything. It is a log of where you have been rather than a gate. Sailing is
  permitted on player level alone.</li>
  <li>The voyages-completed statistic is tracked and no achievement uses it.</li>
  <li>Zoo orders never rotate or expire, as described in
  <a href="#/township/zoo-orders">their own section</a>.</li>
  <li>The level-49 town milestone unlock is a marker with no content table behind it. It appears in
  the data validator's list of concept-only unlock ids, so this is intentional rather than a
  dangling reference. The level-50 Golden Town Statue, by contrast, is a real 2&times;2
  decoration.</li>
</ul>

<div class="callout callout-warn">
  <p>Everything above was checked against the source at the time of writing. These are the kind of
  gaps that get closed by one change each, so if you are reading this after a Township interface
  pass has landed, check the modules rather than trusting this list.</p>
</div>
`,
    },
  ],
  related: ["logistics", "crafting", "exploration", "deadtime", "architecture"],
};
