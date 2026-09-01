/* docs/content/logistics.js — "Selling & Shipping".
 *
 * The earn side of the game: how produce leaves the farm and how construction
 * materials come back. Order board, truck, roadside shop, market stall, boat,
 * trains, airport, helicopter.
 *
 * Every number, id and behaviour below was read out of src/ and, where it is a
 * derived figure, computed from the real tables rather than estimated. Where the
 * code and the data disagree, or where something is declared and never used, the
 * article says so instead of quietly presenting the tidier version.
 *
 * Content counts come from ./data-counts.js, a generated module — never typed here.
 */

import { COUNTS } from './data-counts.js';

export const article = {
  id: 'logistics',
  title: 'Selling & Shipping',
  group: 'Logistics',
  summary:
    'Seven channels move goods off the farm and construction materials back onto it: the order board, the truck, the roadside shop, the market stall, the boat, the trains and airport, and the helicopter.',

  sections: [
    /* ------------------------------------------------------------------ */
    {
      id: 'overview',
      heading: 'Goods out, materials in',
      html: `
<p>
  Everything the farm grows or cooks is worth coins. That much is ordinary. What
  makes the middle of this game work is a second thing that cannot be bought with
  coins at all: <strong>construction materials</strong>. Bricks, planks, shovels
  and their ${COUNTS.materials - 3} relatives are what pay for a bigger barn, a wider farm, a house
  in the town, and, through the Building Workshop, every production building you
  will ever place.
</p>
<p>
  So the logistics layer runs in two directions at once. Produce goes out through a
  channel; coins, experience, and in the later channels <em>materials</em> come
  back. Each channel trades a different mix of speed, payout, attention and risk,
  and none of them is strictly better than the others. That is the whole design: a
  player who is present for two minutes uses a different channel from one who will
  not be back until tomorrow.
</p>

<h3>The seven channels</h3>
<div class="callout callout-info">
  <p>
    Every one of these is opened by clicking its structure in the world. There is
    no shipping menu and no dock button for any of them. The structures sit at
    fixed positions in <code>STRUCTURES</code> and are visible, derelict, from
    level 1, so the map doubles as the roadmap.
  </p>
</div>
<table>
  <thead>
    <tr>
      <th>Channel</th><th>Structure</th><th>Opens</th><th>Sends</th><th>Returns</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><svg class="icon" aria-hidden="true"><use href="./icons.svg#i-orders"></use></svg> Order board</td>
      <td>Order Board</td><td>Level 3</td><td>1 to 2 item kinds, 1 to 3 each</td><td>Coins at 1.35x, experience</td>
    </tr>
    <tr>
      <td><svg class="icon" aria-hidden="true"><use href="./icons.svg#i-truck"></use></svg> Truck</td>
      <td>Truck Bay</td><td>Level 8</td><td>3 bundles</td><td>Coins at 1.95x when complete, experience</td>
    </tr>
    <tr>
      <td><svg class="icon" aria-hidden="true"><use href="./icons.svg#i-shop"></use></svg> Roadside shop</td>
      <td>Roadside Shop</td><td>Level 4</td><td>8 listings, at your price</td><td>Coins at 0.7x to 1.5x, no experience</td>
    </tr>
    <tr>
      <td><svg class="icon" aria-hidden="true"><use href="./icons.svg#i-coin"></use></svg> Market stall</td>
      <td>Market Stall</td><td>Level 9</td><td>Coins</td><td>Goods and materials at 1.4x, once each per day</td>
    </tr>
    <tr>
      <td><svg class="icon" aria-hidden="true"><use href="./icons.svg#i-boat"></use></svg> Boat</td>
      <td>Boat Dock</td><td>Level 17</td><td>6 bulk crates, 3 to 8 each</td><td>Coins at 2x, experience, 4 to 10 vouchers</td>
    </tr>
    <tr>
      <td><svg class="icon" aria-hidden="true"><use href="./icons.svg#i-train"></use></svg> Trains and airport</td>
      <td>Train Station, Airport</td><td>Levels 21 and 28</td><td>Wagons and crates of produce</td><td>Construction materials, experience, a coin bonus at the airport</td>
    </tr>
    <tr>
      <td><svg class="icon" aria-hidden="true"><use href="./icons.svg#i-heli"></use></svg> Helicopter</td>
      <td>Helicopter Pad</td><td>Level 22</td><td>3 single items</td><td>Construction materials, experience, coins</td>
    </tr>
  </tbody>
</table>

<h3>The division of labour</h3>
<p>
  The first five are coin channels. They differ in payout multiplier and in what
  they cost you in attention:
</p>
<ul>
  <li>
    <strong>The order board is the patient channel.</strong> Six slots, small
    quantities, an instant payout on fulfil, and a five minute cooldown before a
    fulfilled slot refills. Nothing expires, so an order waits as long as you do.
  </li>
  <li>
    <strong>The shop is the attentive channel.</strong> You set the price, and the
    price sets the speed. Priced at the floor a listing clears in 18 seconds; at
    the ceiling it takes 120. Somebody who relists every few minutes earns roughly
    three times what somebody who lists once at the top price earns.
  </li>
  <li>
    <strong>The boat is the committed channel.</strong> The best rate in the game
    at a flat 2x, plus the only source of vouchers, and the only channel that can
    take your goods and give you nothing at all. Miss the one hour window and
    everything already loaded is gone.
  </li>
</ul>
<p>
  The last two are material channels, and they are the ones the whole mid game
  turns on. See <a href="#/logistics/materials">Where the materials go</a> for what
  the four material sets are spent on and which channel supplies each.
</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'order-board',
      heading: 'The order board',
      html: `
<p>
  Six slots, unlocked at level 3, held in <code>state.orders.board</code>. Each
  slot holds either a live order or an <code>{ empty: true, readyAt }</code> marker
  counting down a 300 second cooldown. <code>refreshBoard(now)</code> walks the six
  slots and fills any that are null or whose cooldown has passed.
</p>

<h3>What an order can ask for</h3>
<p>
  The eligible pool is built by <code>eligibleItemIds(level)</code> and is
  deliberately narrow: every id in <code>CROPS</code> and <code>GOODS</code> whose
  unlock level is at or below yours, and nothing else. Materials are excluded, and
  so are artifacts, for a specific reason worth stating. Artifacts live in
  <code>state.museum</code>, not in the silo or the barn, so an order asking for
  one could never be fulfilled from storage. Restricting the draw to two tables
  makes that impossible by construction rather than by a check somebody has to
  remember to write.
</p>
<p>
  Working out an item's real unlock level takes three lookups, because the content
  tables are keyed three different ways:
</p>
<ol>
  <li>a crop id resolves straight to <code>CROPS[id].unlockLevel</code>;</li>
  <li>a manufactured good resolves through the recipe that produces it, by
      searching every building's <code>recipes</code> array for a matching
      <code>id</code>;</li>
  <li>an animal product resolves through the animal that lays it. This one needs
      its own map: <code>ANIMALS</code> is keyed by animal id, so an egg's gate is
      recorded against <code>chicken</code> and a lookup on <code>egg</code> finds
      nothing. <code>orders.js</code> builds that map itself, taking the lowest
      unlock level when several animals share a product.</li>
</ol>
<p>
  Anything matching none of the three falls back to level 1 rather than being
  refused, so an unclassifiable good never silently disappears from the pool.
</p>

<h3>How an order is built</h3>
<p>
  <code>generateItems()</code> picks 1 or 2 distinct item ids and gives each a
  quantity of 1 to 3. Both numbers are worth reading carefully against the data,
  because the field name is misleading: <code>ORDERS.board.itemsPerOrder</code> is
  <code>[1, 3]</code>, and the code uses it as the <em>quantity range for each
  item</em>. The number of distinct items is a separate hard-coded
  <code>randomInt(1, 2)</code> in <code>orders.js</code>. So an order is never
  three different things, whatever the field is called.
</p>

<h3>The payout</h3>
<pre><code>base        = sum over items of (sellPrice * qty)
rewardCoins = round(base * ORDERS.board.payoutMultiplier)   // 1.35
rewardXp    = round(total qty * ORDERS.board.xpMultiplier)  // 2</code></pre>
<p>
  Take a real order: 3 carrots at 11 each and 2 loaves of bread at 22 each.
</p>
<div class="stat-row">
  <div class="stat"><div class="stat-num">77</div><div class="stat-label">base value</div></div>
  <div class="stat"><div class="stat-num">104</div><div class="stat-label">coins paid</div></div>
  <div class="stat"><div class="stat-num">10</div><div class="stat-label">experience</div></div>
</div>
<p>
  Selling the identical five items through the roadside shop at the top of the
  price band would pay <strong>117 coins</strong>, which is more. It would also
  occupy two of your eight listing slots for two minutes and pay no experience at
  all. That trade is the point of having both: the order board buys convenience and
  progression, the shop buys margin.
</p>

<h3>Fulfilling and discarding</h3>
<p>
  <code>canFulfill(order)</code> checks every line against the right container,
  crops against the silo and everything else against the barn.
  <code>fulfillOrder(id)</code> re-checks before it takes anything, so a failed
  fulfil consumes nothing and pays nothing: there is a test asserting that coins,
  silo and barn are all identical afterwards. On success the items are removed,
  coins and experience are paid, the lifetime <code>ordersFulfilled</code> counter
  increments, and the slot becomes a cooldown marker.
</p>
<p>
  <code>discardOrder(id)</code> does the same to the slot without paying anything.
  Its purpose is to clear an order you cannot or will not fill and start the five
  minute wait for its replacement. Discarding is free: there is no diamond cost and
  no penalty.
</p>
<figure class="shot">
  <img src="./screenshots/14-panel-order_board.webp" alt="A sliding panel titled Orders reading that the order board is being built — check back soon."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>The Order Board.</strong> Captured at <code>7dc0f14</code>, before the panels were wired to their backing modules: nothing refreshed the board, so it opens on the generic placeholder rather than on orders.</figcaption>
</figure>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'truck',
      heading: 'The truck',
      html: `
<p>
  The truck arrives at level 8 and is a single request at a time, held in
  <code>state.orders.truck</code>. It asks for <code>ORDERS.truck.bundles</code>
  bundles, which is 3, each one a single item id with a quantity of 1 to 3. Unlike
  the board, a bundle is filled one at a time and pays as you go.
</p>

<h3>Paying twice</h3>
<p>
  Each bundle pays the ordinary board rate the moment it is filled: 1.35x its base
  value in coins, plus 2 experience per item. When the last bundle goes in, a
  completion bonus lands on top, calculated across the whole truck:
</p>
<pre><code>bonusCoins = round(totalBase * (ORDERS.truck.bonusMultiplier - 1))   // 1.6 - 1 = 0.6</code></pre>
<p>
  So a completed truck pays 1.35x as you load it and 0.6x again at the end, which
  is <strong>1.95x base overall</strong>, plus a final 2 experience per bundle. A
  worked example with 2 tomatoes, 3 eggs and 1 cheese:
</p>
<table>
  <thead><tr><th>Step</th><th>Coins</th><th>Experience</th></tr></thead>
  <tbody>
    <tr><td>Bundle 1: 2 tomato (base 60)</td><td>81</td><td>4</td></tr>
    <tr><td>Bundle 2: 3 egg (base 30)</td><td>41</td><td>6</td></tr>
    <tr><td>Bundle 3: 1 cheese (base 60)</td><td>81</td><td>2</td></tr>
    <tr><td>Completion bonus on base 150</td><td>90</td><td>6</td></tr>
    <tr><td><strong>Total</strong></td><td><strong>293</strong></td><td><strong>18</strong></td></tr>
  </tbody>
</table>
<p>
  293 coins against a base of 150 is a ratio of 1.953, which makes the truck the
  best coin rate available before the boat opens at level 17.
</p>

<h3>The truck has no deadline, and that cuts both ways</h3>
<div class="callout callout-warn">
  <p>
    <code>tickTruck()</code> only spawns a replacement once the current truck has
    <code>departed</code>, and <code>departed</code> is set in exactly one place:
    when every bundle has been filled. An incomplete truck therefore never leaves.
    There is no expiry timer and no discard action.
  </p>
  <p>
    In practice that is generous, because nothing is ever lost. But a truck asking
    for something you genuinely cannot produce will sit in the bay indefinitely and
    no new truck will arrive behind it. The board can be discarded and the boat
    expires on its own; the truck can do neither.
  </p>
</div>
<p>
  Once a truck does complete, the next arrives after
  <code>ORDERS.truck.interval</code>, which is 900 seconds. That interval is
  resolved against the wall clock, so it elapses while the game is closed: there is
  a test that jumps three days forward and asserts exactly one fresh truck is
  waiting, not a queue of them.
</p>
<figure class="shot">
  <img src="./screenshots/15-panel-truck_bay.webp" alt="A sliding panel titled Truck reading that the Truck Bay is being built — check back soon."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>The Truck Bay.</strong> The same capture, in the same state: the structure opens, and at that commit the panel switch had no case for it.</figcaption>
</figure>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'shop',
      heading: 'The roadside shop',
      html: `
<p>
  Eight slots from level 4. You choose the item, the quantity and the price, and
  the listing sells itself on a timer. No other players are involved: the buyers
  are simulated, and <code>shop.tick()</code> simply flips a listing to
  <code>sold</code> once <code>now</code> passes its <code>readyAt</code>.
</p>

<h3>The price band</h3>
<p>
  <code>SHOP.priceBand</code> is <code>[0.7, 1.5]</code>, so any item may be listed
  between 70% and 150% of its base sell price. A price outside that range is
  clamped rather than refused, then rounded to a whole coin. Listing removes the
  goods from storage immediately, and <code>cancel()</code> puts back exactly what
  it took.
</p>

<h3>The speed is set by where you price, not by what you sell</h3>
<p>
  This is the single most useful thing to know about the shop. The sell time is
  computed from a fraction of the way through the band:
</p>
<pre><code>frac     = (price - min) / (max - min)
sellTime = max(15, round(SHOP.sellTimeBase * (0.15 + frac * 0.85)))</code></pre>
<p>
  Because the band is a multiplier of the base price, both <code>min</code> and
  <code>max</code> scale with the item, and <code>frac</code> cancels the item out
  entirely. A listing at base price always lands on <code>frac = 0.375</code>,
  whether it is wheat at 4 coins or cheese at 60. The times are therefore
  universal:
</p>
<table>
  <thead>
    <tr><th>Price</th><th>Multiplier</th><th>frac</th><th>Sell time</th></tr>
  </thead>
  <tbody>
    <tr><td>Floor</td><td>0.70x</td><td>0.000</td><td>18 s</td></tr>
    <tr><td></td><td>0.90x</td><td>0.250</td><td>44 s</td></tr>
    <tr><td>Base</td><td>1.00x</td><td>0.375</td><td>56 s</td></tr>
    <tr><td></td><td>1.20x</td><td>0.625</td><td>82 s</td></tr>
    <tr><td>Ceiling</td><td>1.50x</td><td>1.000</td><td>120 s</td></tr>
  </tbody>
</table>
<p>
  Turn that into coins per minute per slot and the shop's real shape appears. For
  cheese, base price 60:
</p>
<table>
  <thead>
    <tr><th>Price point</th><th>Coins each</th><th>Sell time</th><th>Coins per minute</th></tr>
  </thead>
  <tbody>
    <tr><td>Floor</td><td>42</td><td>18 s</td><td>140.0</td></tr>
    <tr><td>Base</td><td>60</td><td>56 s</td><td>64.3</td></tr>
    <tr><td>Ceiling</td><td>90</td><td>120 s</td><td>45.0</td></tr>
  </tbody>
</table>
<p>
  Pricing at the floor earns roughly <strong>three times</strong> the throughput of
  pricing at the ceiling, if and only if you are there to relist the slot every 18
  seconds. The shop is not a passive income source pretending to be a market; it is
  a deliberate reward for sitting with the game. Somebody about to close the app
  should be filling the order board and the boat instead.
</p>
<div class="callout callout-info">
  <p>
    The <code>MIN_SELL_TIME</code> floor of 15 seconds in <code>shop.js</code> is
    currently unreachable. With <code>sellTimeBase</code> at 120, the cheapest
    possible listing already computes to 18 seconds. The constant only starts to
    bind if the base is tuned below 100.
  </p>
</div>

<h3>Listing, cancelling, collecting</h3>
<p>
  <code>list()</code> refuses if you are below level 4, if the quantity is not a
  positive integer, if the id has no base value, if all eight slots are occupied,
  or if storage does not hold the quantity. It reuses a freed slot before appending
  a new one, so the eight slots stay stable rather than drifting.
  <code>collect()</code> pays <code>price * qty</code> and increments the lifetime
  <code>shopSales</code> counter by the quantity sold rather than by one, so the
  statistic counts items rather than transactions.
</p>
<figure class="shot">
  <img src="./screenshots/16-panel-shop_stand.webp" alt="A sliding panel titled Shop reading that the roadside shop is being built — check back soon."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>The Roadside Shop.</strong> Its renderer existed at that commit and nothing filled the listings, so the panel opens on the placeholder rather than on stock.</figcaption>
</figure>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'market',
      heading: 'The market stall',
      html: `
<p>
  The market stall is the one channel that runs backwards. Everything else takes
  goods and gives coins; the stall takes coins and gives goods. It opens at level 9
  and lives in <code>shop.js</code> alongside the roadside shop, because the two
  share the same price and storage helpers.
</p>

<h3>Six offers a day, the same six every time you look</h3>
<p>
  <code>MARKET.slots</code> is 6, and each may be bought once per day. The day rolls
  over at <code>MARKET.refreshHourLocal</code>, which is 07:00 local time.
</p>
<p>
  What makes the stall interesting is that the offers are not rolled and stored:
  they are <em>derived</em>. A day number is computed from the clock, that number
  seeds a small deterministic generator (mulberry32), and the six offers fall out
  of it. Asking twice on the same day produces the identical list without anything
  having been persisted, which means the stall survives a reload, a crash, or a
  save moved between machines with no state to migrate. Only the six
  <code>bought</code> flags are stored.
</p>

<h3>What it sells</h3>
<p>
  Each slot rolls a 25% chance (<code>MARKET.materialChance</code>) of being a
  construction material rather than a good; otherwise it draws from
  <code>GOODS</code>. Quantity is 1 to 5, and the price is
  <code>max(1, round(base * 1.4))</code>, so you always pay a 40% premium over what
  the item sells for.
</p>
<p>
  <code>buyOffer()</code> is careful in two ways worth noting. It refuses if you
  cannot afford the offer, and it refuses if the destination container does not
  have room for the whole quantity, so a purchase can never overflow the silo or
  barn cap and quietly lose the difference.
</p>
<div class="callout callout-warn">
  <p>
    The material draw is uniform over all 23 entries in <code>MATERIALS</code>,
    including the three in the <code>advanced</code> set. The comment on that set in
    <code>data.js</code> describes it as expedition and Tool Exchange loot only, and
    there is a test asserting the advanced materials never appear in the train,
    airport or helicopter pools. The market stall is not covered by that test, and
    on a day whose roll lands there you can buy a jackhammer for 196 coins. Whether
    that is a shortcut worth closing or a pleasant surprise worth keeping is a
    balance decision nobody has made yet; it is recorded here as it stands.
  </p>
</div>
<figure class="shot">
  <img src="./screenshots/21-panel-market_stall.webp" alt="A sliding panel titled Market reading that the Market Stall is being built — check back soon."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>The Market Stall.</strong> The offer and buy functions lived in the shop module at that commit, with no panel case reading them.</figcaption>
</figure>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'boat',
      heading: 'The boat, and its vouchers',
      html: `
<p>
  From level 17 a boat docks at the Boat Dock with <code>ORDERS.boat.crates</code>
  crates, which is 6, each asking for 3 to 8 of a single item. The crates are drawn
  without repeats where possible, from the same eligible pool the order board uses.
</p>

<h3>All or nothing</h3>
<p>
  Filling a crate pays nothing on its own. The entire reward arrives through
  <code>claimBonus()</code>, which refuses unless every crate is filled and the
  departure window has not expired:
</p>
<pre><code>coins    = round(totalBase * ORDERS.boat.bonusMultiplier)   // 2.0
xp       = round(crates * bonusMultiplier * 2)              // 24 for a 6-crate boat
vouchers = randomInt(4, 10)</code></pre>
<p>
  A representative boat, 31 items across six crates with a combined base value of
  357 coins:
</p>
<div class="stat-row">
  <div class="stat"><div class="stat-num">714</div><div class="stat-label">coins</div></div>
  <div class="stat"><div class="stat-num">24</div><div class="stat-label">experience</div></div>
  <div class="stat"><div class="stat-num">4-10</div><div class="stat-label">vouchers</div></div>
</div>
<p>
  The same 31 items listed in the roadside shop at the very top of the price band
  would pay 540 coins, and would take four full rotations of all eight slots to do
  it. At 2x, the boat is the best coin rate in the game.
</p>

<h3>The window, and what a missed boat costs</h3>
<div class="callout callout-danger">
  <p>
    <code>ORDERS.boat.departureWindow</code> is 3600 seconds. If the hour passes
    without every crate filled <em>and</em> the bonus claimed, the boat departs and
    <strong>everything already loaded into its crates is gone</strong>. Not just the
    bonus: the goods themselves. There is no partial payout and no refund, and a
    test asserts the cycle recovers into a fresh boat rather than leaving the dock
    permanently stuck.
  </p>
  <p>
    This is deliberate and matches the games it is modelled on, but it makes the
    boat the only channel that can take your produce and give you nothing. Load it
    when you can finish it.
  </p>
</div>
<p>
  After departing, whether claimed or missed, the next boat arrives
  <code>ORDERS.boat.interval</code> seconds later, which is 7200. Both timers are
  absolute timestamps, so an offline gap resolves correctly on the next tick.
</p>

<h3>Vouchers</h3>
<p>
  Vouchers are the boat's own currency, kept in <code>state.vouchers</code>. Seven
  decorations in <code>DECORATIONS</code> carry a <code>voucherCost</code>, and they
  are the only things vouchers were meant to buy:
</p>
<table>
  <thead><tr><th>Decoration</th><th>Cost</th><th>Footprint</th></tr></thead>
  <tbody>
    <tr><td>Topiary Horse</td><td>15</td><td>1 x 1</td></tr>
    <tr><td>Crystal Fountain</td><td>18</td><td>2 x 2</td></tr>
    <tr><td>Marble Arch</td><td>24</td><td>2 x 1</td></tr>
    <tr><td>Lily Pond</td><td>25</td><td>2 x 2</td></tr>
    <tr><td>Koi Pond</td><td>30</td><td>2 x 2</td></tr>
    <tr><td>Glass House</td><td>38</td><td>2 x 2</td></tr>
    <tr><td>Golden Cow Statue</td><td>40</td><td>2 x 2</td></tr>
  </tbody>
</table>
<p>
  190 vouchers buys the set, which at an average of 7 per boat is about 27 completed
  boats. A second, smaller source exists: one Merge Meadow chain pays 5 vouchers.
</p>
<div class="callout callout-warn">
  <p>
    <strong>Nothing currently spends them.</strong> <code>boat.js</code> and
    <code>merge.js</code> both add to <code>state.vouchers</code>, but
    <code>decorate.js</code> contains no reference to vouchers or to
    <code>voucherCost</code> at all, so the seven decorations above cannot be bought
    yet. The balance accumulates correctly and the data is complete; the purchase
    path is the missing piece.
  </p>
</div>
<figure class="shot">
  <img src="./screenshots/17-panel-boat_dock.webp" alt="A sliding panel titled Boat reading that the Boat Dock is being built — check back soon."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>The Boat Dock.</strong> The boat module was implemented and exercised directly by the test tools at that commit, and not yet reachable from this panel.</figcaption>
</figure>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'rails-and-runways',
      heading: 'Trains and the airport',
      html: `
<p>
  The trains are where the game changes shape. Everything before them converts
  produce into coins; the train converts produce into <em>materials</em>, and
  materials are what the town, the barn, the farm expansions and the Building
  Workshop all actually run on. Both the station and the airport live in
  <code>trains.js</code>, because they are the same machine with different numbers.
</p>

<h3>The cycle</h3>
<ol>
  <li>A train arrives with <code>TRAINS.wagons</code>, which is 3 to 5 wagons, each
      requesting 3 to 8 of an unlocked crop or good.</li>
  <li>You fill wagons from storage. <code>fillWagon()</code> takes whatever it can,
      up to what is still needed, so a partial fill is allowed and is not wasted.</li>
  <li>The train departs when every wagon is full, or when
      <code>TRAINS.departureWindow</code> (7200 seconds) runs out, whichever comes
      first. <code>dispatchTrain()</code> lets you send a full train early.</li>
  <li>It is away for <code>TRAINS.tripTime</code>, one hour, and then
      <code>readyToCollect</code> is set.</li>
  <li><code>collectDelivery()</code> moves the materials into the barn and pays the
      experience.</li>
</ol>
<p>
  A departing train that was not full still pays. The reward scales by the fraction
  of wagons completed, with a floor of 0.25 so a nearly empty train is never a total
  blank, and the experience is halved on top of that:
</p>
<pre><code>scale = filledWagons / totalWagons
count = round(materialsPerTrip * (full ? 1 : max(0.25, scale)))
xp    = full ? xpPerWagon * wagons : round(xpPerWagon * filledWagons * 0.5)</code></pre>

<h3>The material pools</h3>
<p>
  Which materials come back is decided by a weighted pool, and the three transports
  have deliberately non-overlapping pools. This is the part of the design worth
  internalising: you do not send goods away and get materials, you send goods away
  and get <em>a particular kind</em> of material, so the transport you build next
  depends on what you are short of.
</p>
<table>
  <thead>
    <tr>
      <th>Transport</th><th>Building</th><th>Expansion</th><th>Storage</th><th>Advanced</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Train</td><td>91.9%</td><td>8.1%</td><td>none</td><td>never</td></tr>
    <tr><td>Airport</td><td>10.0%</td><td>42.0%</td><td>48.0%</td><td>never</td></tr>
    <tr><td>Helicopter</td><td>28.0%</td><td>none</td><td>72.0%</td><td>never</td></tr>
  </tbody>
</table>
<p>
  Those percentages are shares of total draw weight, computed from the pools in
  <code>data.js</code>. The train's pool has 14 entries totalling 124 weight; the
  airport's has 11 totalling 100; the helicopter's has 10 totalling 100.
</p>
<p>
  The advanced set (jackhammer, drill, electric saw) is absent from all three by
  design, and a test in the research suite asserts it stays absent. It is meant to
  come from expeditions.
</p>

<h3>The airport</h3>
<p>
  Level 28, four crates of 4 to 10 items each, a 5400 second window. Its rewards are
  larger and slower: 30 experience per crate against the train's 12 per wagon, 3 to
  6 material draws against the train's 4 to 8, and a <code>fullBonusCoins</code> of
  5000 that the train has no equivalent of. Its pool leans expansion and storage,
  because by level 28 the barn and the farm boundary are what is actually holding
  you back.
</p>
<div class="callout callout-info">
  <p>
    The airport has no return-time field of its own in <code>data.js</code>, so
    <code>trains.js</code> reuses <code>TRAINS.tripTime</code> for the flight home.
    This is called out in a comment in the source rather than hidden. A plane is
    therefore away for the same one hour a train is.
  </p>
</div>

<h3>Collection refuses rather than overflows</h3>
<p>
  Both <code>collectDelivery()</code> and <code>collectFlight()</code> total up the
  incoming materials first and return <code>false</code> if the barn does not have
  room for all of them. Nothing is lost: the delivery stays pending until you make
  space. That is the right behaviour for a cargo you may have spent two hours
  filling, and it is worth knowing so that a train that appears stuck is understood
  as a full barn rather than a fault.
</p>
<div class="shot-row">
  <figure class="shot">
    <img src="./screenshots/22-panel-train_station.webp" alt="A sliding panel titled Trains reading that the Train Station is being built — check back soon."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>The Train Station.</strong> Captured before this panel was connected to the trains module.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/23-panel-airport.webp" alt="A sliding panel titled Airport reading that the Airport is being built — check back soon."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>The Airport.</strong> Reached at level 38, and captured in the same pre-wiring state.</figcaption>
  </figure>
  <figure class="shot">
    <img src="./screenshots/02e-locked-airport.webp" alt="The world view with a weathered, derelict-looking airport and a red toast notification reading that it unlocks at level 38."
         width="896" height="560" loading="lazy" decoding="async">
    <figcaption><strong>The Airport before level 38.</strong> Locked, drawn derelict, and still clickable: the tap returns the unlock toast naming the level.</figcaption>
  </figure>
</div>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'helicopter',
      heading: 'The helicopter',
      html: `
<p>
  The helicopter pad opens at level 22, right behind the trains, and it is the
  strangest of the transports: three crates, each holding exactly <em>one</em> item,
  returning more materials per item shipped than anything else in the game by a
  factor of three.
</p>

<h3>Loading is automatic</h3>
<p>
  <code>fillCrate(index)</code> does not let you choose. It sorts the barn by
  quantity, takes one unit of whichever good you have most of, and puts it in the
  slot. Ties break alphabetically, so the behaviour is deterministic. Three crates
  therefore cost you three items in total, and the pad refuses further loading while
  a flight is in the air.
</p>

<h3>Fuel</h3>
<p>
  A dispatch costs one fuel. Fuel regenerates on absolute timestamps like every
  other timer in the game, so it accrues while the app is closed:
</p>
<pre><code>elapsed = now - fuelUpdatedAt
regen   = floor(elapsed / (HELICOPTER.fuel.regenSeconds * 1000))   // 3600 s each
fuel    = min(HELICOPTER.fuel.max, fuel + regen)                   // capped at 5</code></pre>
<p>
  <code>currentFuel()</code> computes this lazily on every read, and
  <code>settleFuel()</code> banks it into state before anything spends, so an
  offline gap and a dispatch interact correctly rather than one silently
  overwriting the other.
</p>
<div class="callout callout-info">
  <p>
    In practice the fuel budget almost never binds. Fuel regenerates once an hour
    while a round trip takes 90 minutes, and only one flight can be in the air at a
    time, so a player who dispatches at every opportunity regenerates faster than
    the pad can consume. The cap of 5 matters only after a long absence, and even
    then the flights have to be taken one at a time.
  </p>
</div>

<h3>The return</h3>
<p>
  <code>dispatch()</code> rolls the whole reward up front and banks it on the flight
  object: the materials, the experience at 40 per crate, and a
  <code>fullBonusCoins</code> of 3500 if all three crates were loaded.
  <code>collectDelivery()</code> hands it over once the return time has passed.
  Rolling at dispatch rather than at collection means the reward cannot shift under
  you while the flight is out.
</p>
<p>
  <code>HELICOPTER.interval</code>, 5400 seconds, is read as the round trip duration
  rather than as a gap between flights, which is a slight mismatch with the field
  name but is what the code does.
</p>

<h3>Why it is worth building first</h3>
<p>
  Compare what each transport gives back per item of produce shipped:
</p>
<table>
  <thead>
    <tr><th>Transport</th><th>Items sent (average, full load)</th><th>Materials returned</th><th>Materials per item</th></tr>
  </thead>
  <tbody>
    <tr><td>Helicopter</td><td>3</td><td>4.23</td><td><strong>1.41</strong></td></tr>
    <tr><td>Train</td><td>22</td><td>10.11</td><td>0.46</td></tr>
    <tr><td>Airport</td><td>28</td><td>7.70</td><td>0.27</td></tr>
  </tbody>
</table>
<p>
  It also pays 3500 coins and 120 experience for those three items. The module
  comment describes it as the fastest materials channel and says that is what makes
  the crafting spine tractable at all, which is true; the margin is nonetheless very
  wide, and if the mid game ever reads as too easy, this table is the first place to
  look.
</p>
<div class="callout callout-warn">
  <p>
    Two declared values are not currently wired up.
    <code>HELICOPTER.departureWindow</code> is never read, so the pad has no loading
    deadline. And <code>HELICOPTER.rewards.coopPoints</code>, 25, is copied onto the
    flight at dispatch but <code>collectDelivery()</code> never awards it; the only
    path that adds co-op points is the separate request-board help reward in
    <code>coop.js</code>, which is worth 5.
  </p>
</div>
<p>
  Unlike the trains, the helicopter clamps rather than refuses when the barn is
  full: <code>addToBarn()</code> gives what fits and the remainder is dropped, and
  the flight is cleared either way. The return value reports what was actually
  received, so nothing lies about it, but the asymmetry with
  <code>collectDelivery()</code> in <code>trains.js</code> is real. Empty the barn
  before collecting a flight.
</p>
<figure class="shot">
  <img src="./screenshots/24-panel-helipad.webp" alt="A sliding panel titled Helicopter reading that the Helicopter Pad is being built — check back soon."
       width="896" height="560" loading="lazy" decoding="async">
  <figcaption><strong>The Helicopter Pad.</strong> Captured before this panel was connected to the helicopter module.</figcaption>
</figure>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'materials',
      heading: 'Where the materials go',
      html: `
<p>
  Twenty-three construction materials, split into four purpose-scoped sets. The
  split is the whole idea: rather than one undifferentiated pile that any spend can
  draw from, each set has its own sources and its own sinks, so you cannot starve
  your barn upgrades to finish a town house.
</p>
<table>
  <thead>
    <tr><th>Set</th><th>Count</th><th>Spent on</th><th>Comes from</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>building</strong></td><td>11</td>
      <td>Town houses and community buildings, zoo enclosures, and every Building Workshop component and kit</td>
      <td>Trains mostly, some from the helicopter, the daily wheel, fishing chests</td>
    </tr>
    <tr>
      <td><strong>expansion</strong></td><td>3</td>
      <td>Farm land expansions and island unlocks</td>
      <td>The airport mostly, a small share from trains</td>
    </tr>
    <tr>
      <td><strong>storage</strong></td><td>6</td>
      <td>Silo and barn capacity upgrades</td>
      <td>The helicopter and the airport only</td>
    </tr>
    <tr>
      <td><strong>advanced</strong></td><td>3</td>
      <td>The very last building kits and the deepest mine seams</td>
      <td>Expeditions. Never a transport.</td>
    </tr>
  </tbody>
</table>

<h3>What that actually costs</h3>
<p>
  Abstract percentages are not much help, so here is the demand side in real
  numbers. The Building Workshop turns raw materials into components and components
  into kits, and a kit is what places a building. Expanding the tree all the way
  down to raw materials:
</p>
<table>
  <thead><tr><th>Kit</th><th>Raw materials required</th><th>Total items</th><th>Full trains</th></tr></thead>
  <tbody>
    <tr>
      <td>Dairy Kit</td>
      <td>7 nails, 7 slab, 2 timber, 2 paint</td>
      <td>18</td><td>about 1.9</td>
    </tr>
    <tr>
      <td>Smelter Kit</td>
      <td>16 nails, 8 brick, 7 cement, 6 hammer, 6 wire</td>
      <td>43</td><td>about 4.6</td>
    </tr>
  </tbody>
</table>
<p>
  A full train returns about 10.11 material items, of which about 9.30 are from the
  building set. So the Smelter is roughly five trains of work, which at one train
  per collected round trip is a real afternoon.
</p>
<p>
  The same exercise on the other two sets:
</p>
<ul>
  <li>
    <strong>Storage.</strong> The tenth silo upgrade wants 12 each of screw, wood
    panel and bracket, which is 36 items. The helicopter returns about 3.05 storage
    items per flight, so that upgrade alone is roughly 12 flights, about 18 hours of
    pad time. The airport is slightly better per flight at 3.69, but its cycle is
    longer.
  </li>
  <li>
    <strong>Expansion.</strong> The ninth farm expansion wants 12 each of shovel,
    axe and saw, again 36 items. The airport returns about 3.23 expansion items per
    flight, so about 11 flights.
  </li>
</ul>

<h3>Before the trains exist</h3>
<p>
  The Building Workshop opens at level 6. The train station is fifteen levels
  further on. That gap is filled deliberately rather than accidentally:
</p>
<ul>
  <li>
    <strong>The daily wheel</strong> has no unlock level at all, and ten of its
    eighteen segments are building materials in ones and twos. The comment in
    <code>data.js</code> is explicit that this exists so a player who has just
    unlocked the Workshop is not staring at an inert building for fifteen levels.
  </li>
  <li>
    <strong>Fishing chests</strong> from level 12 add a second trickle: brick, slab,
    nails and timber, carrying 30 of the 130 total chest weight.
  </li>
  <li>
    <strong>The market stall</strong> from level 9 will sell you materials for coins
    on the quarter of its slots that roll one.
  </li>
</ul>
<p>
  That is genuinely all of it before level 21, and it is thin on purpose: the
  earliest kits are small (the Dairy Kit's 18 items is the whole of it) and the
  intent is that the Workshop feels like a slow accumulation rather than a wall.
</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'throughput',
      heading: 'Reading the throughput',
      html: `
<p>
  The figures below are expected values computed from the weighted pools and
  quantity ranges in <code>data.js</code>, not measurements of play. They assume a
  full load every time and immediate collection, so treat them as a ceiling.
</p>

<h3>Materials per completed trip</h3>
<table>
  <thead>
    <tr>
      <th>Transport</th><th>Average quantity per draw</th><th>Draws per trip</th><th>Items per trip</th><th>Round trip</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Train</td><td>1.69</td><td>4 to 8 (mean 6)</td><td>10.11</td><td>1 hour</td></tr>
    <tr><td>Airport</td><td>1.71</td><td>3 to 6 (mean 4.5)</td><td>7.70</td><td>1 hour</td></tr>
    <tr><td>Helicopter</td><td>1.41</td><td>2 to 4 (mean 3)</td><td>4.23</td><td>1.5 hours</td></tr>
  </tbody>
</table>

<h3>A note on the cycle timers</h3>
<div class="callout callout-warn">
  <p>
    <code>TRAINS.interval</code> (10800 s) and <code>AIRPORT.interval</code>
    (14400 s) are documented in <code>data.js</code> as the gap between arrivals,
    but <code>trains.js</code> never reads either one. The spawn condition is simply
    "no current vehicle and none returning", so the next train or plane appears the
    instant you collect the previous delivery.
  </p>
  <p>
    The practical effect is that the transports are not paced by their declared
    intervals at all. Their real pace is the one hour return trip plus however long
    it takes you to fill the next one, and for an attentive player the binding
    constraint is produce, not time: a train wants 22 items on average and returns
    10 materials for them.
  </p>
</div>

<h3>Coin channels compared</h3>
<table>
  <thead>
    <tr><th>Channel</th><th>Payout</th><th>Experience</th><th>Cost of a mistake</th></tr>
  </thead>
  <tbody>
    <tr><td>Shop at floor</td><td>about 0.70x, cleared in 18 s</td><td>none</td><td>Cancel returns everything</td></tr>
    <tr><td>Order board</td><td>1.35x, instant</td><td>2 per item</td><td>Failed fulfil consumes nothing</td></tr>
    <tr><td>Shop at ceiling</td><td>about 1.50x, cleared in 120 s</td><td>none</td><td>Cancel returns everything</td></tr>
    <tr><td>Truck, completed</td><td>1.95x</td><td>2 per item, plus 2 per bundle</td><td>An unfillable truck blocks the bay</td></tr>
    <tr><td>Boat, claimed</td><td>2.00x</td><td>24 for six crates</td><td>A missed window forfeits the cargo</td></tr>
  </tbody>
</table>
<p>
  Read down that table and the shape of the day falls out. While you are present and
  watching, the shop at the price floor is the fastest way to turn stock into coins,
  because it is the only channel whose rate scales with how often you touch it. When
  you are about to leave, produce should go to the boat and the order board, because
  neither cares how long you are away, and only one of them has a deadline.
</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'timers',
      heading: 'Timers, offline play and state',
      html: `
<p>
  Every timer in this layer is an absolute wall-clock timestamp in milliseconds,
  never a countdown. A boat has a <code>departsAt</code>, a listing has a
  <code>readyAt</code>, a train has a <code>returningAt</code>, and the helicopter
  has a <code>fuelUpdatedAt</code> baseline. Nothing decrements.
</p>
<p>
  That single convention is what makes offline progress correct with no catch-up
  code at all. Closing the game for three days and reopening it is
  indistinguishable, to every module here, from a very slow frame: the next
  <code>tick(now)</code> compares against a larger <code>now</code> and resolves.
  The tests exercise this directly, jumping three and five days forward and
  asserting that exactly one truck and exactly one boat are waiting rather than a
  queue of missed ones.
</p>

<h3>What each module owns</h3>
<table>
  <thead><tr><th>Module</th><th>State</th><th>Tick</th></tr></thead>
  <tbody>
    <tr><td><code>orders.js</code></td><td><code>state.orders.board</code>, <code>state.orders.truck</code></td><td><code>tickTruck(now)</code>, plus <code>refreshBoard(now)</code></td></tr>
    <tr><td><code>boat.js</code></td><td><code>state.orders.boat</code></td><td><code>tick(now)</code></td></tr>
    <tr><td><code>shop.js</code></td><td><code>state.shop.listings</code>, <code>state.market</code></td><td><code>tick(now)</code></td></tr>
    <tr><td><code>trains.js</code></td><td><code>state.trains</code>, <code>state.airport</code></td><td><code>tick(now)</code></td></tr>
    <tr><td><code>helicopter.js</code></td><td><code>state.helicopter</code></td><td><code>tick(now)</code>, fuel only</td></tr>
    <tr><td><code>islands.js</code></td><td><code>state.islands</code></td><td><code>tick(now)</code>, a documented no-op</td></tr>
  </tbody>
</table>
<p>
  <code>trains.js</code> seeds its own slice of state defensively on every entry
  point, because <code>state.js</code> does not yet carry <code>trains</code> and
  <code>airport</code> keys in its documented shape. The seeding never overwrites
  real data, so it becomes a harmless no-op once <code>state.js</code> grows them.
</p>
<p>
  <code>islands.js</code> has a tick that does nothing at all, and says so in a
  comment: the voyage timer is an absolute <code>readyAt</code> that
  <code>pendingCargo()</code> and <code>collect()</code> compare against themselves,
  so there is genuinely nothing to advance. Its cargo is rolled once and cached on
  the voyage the first time it is asked for, so repeated calls cannot re-roll
  different quantities under the caller.
</p>

<h3>The main loop</h3>
<p>
  <code>main.js</code> calls <code>tickAllSystems(now)</code> once per animation
  frame, and from this layer it currently calls <code>orders.tickTruck</code>,
  <code>boat.tick</code>, <code>shop.tick</code> and <code>trains.tick</code>.
  <code>helicopter.tick</code> is not in the list, which is harmless because
  <code>currentFuel()</code> recomputes regeneration lazily on every read; the tick
  only banks it into state. <code>refreshBoard</code> is also not in the list, and
  that one is not harmless. See below.
</p>
`,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'verification',
      heading: 'What is proven, and what is not',
      html: `
<p>
  This section is deliberately blunt. The logistics systems are fully implemented
  and covered by tests, and several of them are not yet reachable from the running
  game. Both halves of that sentence are true, and neither should be discovered by
  surprise.
</p>

<h3>Test coverage</h3>
<p>
  Twenty-four assertions across four suites cover the systems in this article, each
  one run against the real modules with no mocking:
</p>
<table>
  <thead><tr><th>Suite</th><th>Covers</th><th>Assertions</th></tr></thead>
  <tbody>
    <tr><td><code>test-logistics.mjs</code></td><td>order board</td><td>8</td></tr>
    <tr><td><code>test-logistics.mjs</code></td><td>boat</td><td>3</td></tr>
    <tr><td><code>test-logistics.mjs</code></td><td>roadside shop and market stall</td><td>4</td></tr>
    <tr><td><code>test-township.mjs</code></td><td>trains and the airport</td><td>4</td></tr>
    <tr><td><code>test-township.mjs</code></td><td>island voyages</td><td>1</td></tr>
    <tr><td><code>test-social.mjs</code></td><td>helicopter</td><td>3</td></tr>
    <tr><td><code>test-research.mjs</code></td><td>advanced set excluded from all three transports</td><td>1</td></tr>
  </tbody>
</table>
<p>
  The suites install a fresh save through the real <code>importSave()</code> path
  rather than reaching into module internals, so persistence is exercised
  incidentally on every test. The failure paths get as much attention as the success
  paths: a failed order fulfil is asserted to leave coins, silo and barn identical,
  and a cancelled listing is asserted to return the exact quantity.
</p>

<h3>Open gaps</h3>
<div class="callout callout-danger">
  <p>
    <strong>The order board never refills in the running game.</strong>
    <code>refreshBoard()</code> is implemented, correct and tested, and it is called
    from nowhere: not the main loop, not the panel. A new save seeds
    <code>orders: { board: [], truck: null, boat: null }</code>, so the board stays
    empty. This is the most consequential gap in the layer, and it is a wiring
    problem rather than a logic one.
  </p>
</div>
<div class="callout callout-warn">
  <p>
    <strong>Most of these panels are still placeholders.</strong> The panel
    dispatcher in <code>ui.js</code> has real renderers for the order board and the
    roadside shop, along with the barn, silo, building queue, workshop, settings,
    achievements and decorating mode. Everything else falls through to a
    "being built" message. Within this article's subject that means the truck, the
    boat, the market stall, the train station, the airport and the helicopter pad
    are all fully implemented underneath and not yet operable from the interface.
  </p>
</div>
<div class="callout callout-warn">
  <p>
    <strong>Two structures are gated later than their systems.</strong>
    <code>TRAINS.unlockLevel</code> is 21 and <code>LEVELS.unlocks</code> agrees, but
    <code>STRUCTURES.train_station.unlockLevel</code> is 30. The airport is 28
    against a structure gate of 38. Since <code>input.js</code> gates panel opening
    on the structure's level, trains would begin arriving nine levels before the
    station could be opened. The helicopter pad has no such mismatch: both say 22.
  </p>
</div>
<div class="callout callout-warn">
  <p>
    <strong>Some lifetime counters are never incremented.</strong>
    <code>trains.js</code> calls <code>trackStat</code> nowhere, so
    <code>trainsCompleted</code> and <code>planesCompleted</code> stay at zero
    forever. Between them those two counters drive the Stationmaster achievement, a
    co-op task, a regatta task and an event scoring rule, all of which are
    consequently unreachable. Every other channel here does track: orders, trucks,
    boats, shop sales, helicopter flights and voyages all increment correctly.
  </p>
</div>
<div class="callout callout-warn">
  <p>
    <strong>Trains and the airport can request the unobtainable.</strong>
    <code>generateWagons()</code> and <code>generateCrates()</code> filter the pool
    with <code>economy.isUnlocked()</code>, which keys animals by animal id and so
    has no entry for the product they lay. Anything unmapped defaults to level 1.
    The result is that at level 21 a wagon may ask for alpaca wool (level 64) or
    turkey plume (level 82); seven animal products are affected. This is not fatal,
    because a train departs on its window with a partial reward rather than
    blocking, but a wagon can be permanently unfillable.
    <code>orders.js</code> already solves exactly this with its own
    <code>animalProductUnlockLevel</code> map; the transports do not use it.
  </p>
</div>
<p>
  Two smaller notes, recorded so nobody has to rediscover them. A few quantity
  ranges are hard-coded in <code>trains.js</code> and <code>boat.js</code> (3 to 8
  per wagon, 4 to 10 per plane crate, 3 to 8 per boat crate) rather than sitting in
  <code>data.js</code> where the project's convention puts content. And
  <code>MIN_SELL_TIME</code>, <code>HELICOPTER.departureWindow</code>,
  <code>HELICOPTER.rewards.coopPoints</code>, <code>TRAINS.interval</code> and
  <code>AIRPORT.interval</code> are all declared and currently unread.
</p>
<div class="callout callout-info">
  <p>
    None of the above is speculation. Each item was checked against the working
    source rather than against the project's own README or handoff notes, both of
    which are older than the code they describe. If you are picking this up, the
    order board wiring is the first thing to fix and the cheapest.
  </p>
</div>
`,
    },
  ],

  related: ['crafting', 'township', 'farming', 'social', 'deadtime'],
};
