/* ============================================================================
 * Getting started: the first article in the Farm Tycoon documentation site.
 *
 * Every number, id, name, level and behaviour below was read out of the game's
 * own source and content tables, not from a design document and not from
 * memory. Where something is unverified, unfinished or known to be wrong, the
 * article says so rather than rounding it up into a claim.
 *
 * Article contract: see the comment block at the top of ../app.js.
 * ==========================================================================*/

const ICON_INFO = '<svg class="icon" aria-hidden="true"><use href="#ui-info"></use></svg>';
const ICON_WARN = '<svg class="icon" aria-hidden="true"><use href="#ui-warning"></use></svg>';
const ICON_OK = '<svg class="icon" aria-hidden="true"><use href="#ui-check"></use></svg>';

export const article = {
  id: 'getting-started',
  title: 'Getting started',
  group: 'First steps',
  summary:
    'What Farm Tycoon is, how to install and run it, what happens in your first ten minutes, ' +
    'and an honest account of what has actually been verified.',

  sections: [
    /* ------------------------------------------------------------------ */
    {
      id: 'what-it-is',
      heading: 'What Farm Tycoon is',
      html: `
        <p>
          Farm Tycoon is a cosy farm-and-town management game. You plant fields, feed animals,
          cook raw crops into goods, and sell what you make; then the farm grows outward into a
          town, a zoo, a railway, an airport and a string of islands. It takes the two halves of
          its idiom seriously: the <strong>farm loop</strong> of planting, waiting and crafting,
          and the <strong>township layer</strong> of construction materials, population and
          civic milestones that consumes what the farm produces.
        </p>

        <div class="stat-row">
          <div class="stat"><div class="stat-num">22</div><div class="stat-label">crops</div></div>
          <div class="stat"><div class="stat-num">12</div><div class="stat-label">animals</div></div>
          <div class="stat"><div class="stat-num">26</div><div class="stat-label">buildings</div></div>
          <div class="stat"><div class="stat-num">128</div><div class="stat-label">recipes</div></div>
          <div class="stat"><div class="stat-num">192</div><div class="stat-label">goods</div></div>
          <div class="stat"><div class="stat-num">95</div><div class="stat-label">levels</div></div>
        </div>

        <h3>Two things that make it its own game</h3>
        <p>
          The first is that <strong>production buildings are crafted, not bought</strong>. The
          Building Workshop turns raw construction materials into components, components into a
          building kit, and the kit places the factory. A dairy is not a price tag; it is a
          supply chain you had to run. The content tables are built around that spine, and the
          data validator enforces it: a building that declares a kit must have a kit that is
          genuinely craftable in the Workshop, and it must not unlock before the Workshop does,
          or a player could hold a kit for a building the game will never let them own.
        </p>
        <p>
          The second is that <strong>every production building has its own minigame</strong>,
          with an effect that only that factory has. These are a bonus layer and never a gate.
          A player who ignores every one of them still runs the whole game; hand-eye skill is
          never the price of a recipe, because that would break the promise an idle game makes.
        </p>

        <h3>How it is built</h3>
        <p>
          Plain JavaScript, loaded by the browser as ES modules. No framework, no bundler and no
          build step: the files that are committed are the files that run. The world is drawn on
          a single <code>&lt;canvas&gt;</code>; every menu, panel and readout above it is
          ordinary DOM.
        </p>
        <p>
          There are <strong>no binary assets at all</strong>. Every sprite in the world is vector
          drawing code, and every sound effect is synthesised at runtime from oscillators and a
          gain envelope. Nothing is downloaded, nothing is decoded, and there is no art pipeline
          to keep in step with the code.
        </p>

        <div class="callout callout-info">
          ${ICON_INFO}
          <div>
            <p style="margin:0">
              The game is entirely local. There is no account, no server, no sign-in and no
              telemetry. Your farm is one JSON object in your browser or app profile, and it
              never leaves the machine. That is described in full under
              <a href="#/getting-started/saving">Saving, offline progress and your save file</a>.
            </p>
          </div>
        </div>
      `,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'install',
      heading: 'Installing and running it',
      html: `
        <p>There are two ways to play, and they run exactly the same code.</p>

        <h3>The Windows desktop build</h3>
        <p>
          The desktop build wraps the same static files in Electron and ships them as a Windows
          installer. The <a href="#/download">Download page</a> has the installer and the details;
          it is the only page in this site that links anywhere outside it.
        </p>
        <div class="callout callout-warn">
          ${ICON_WARN}
          <div>
            <p style="margin:0">
              <strong>The installer is unsigned, permanently and by policy.</strong> Code signing
              is out of scope for this project, so the file carries no publisher certificate and
              nothing about it has been checked by a certificate authority. Windows will show an
              unknown-publisher warning, and SmartScreen may warn as well. That is the expected
              behaviour of an unsigned artifact, not damage in transit, and it is not something a
              later release quietly fixes.
            </p>
          </div>
        </div>
        <p>
          The desktop window opens at 1280 by 800 and will not shrink below 1024 by 640. The menu
          bar is auto-hidden. The renderer runs sandboxed with context isolation on and Node
          integration off, so the game code has no reach into the file system, which is exactly
          why the save lives in ordinary browser-profile storage rather than in a file you can
          point at.
        </p>

        <h3>From source</h3>
        <p>
          The game itself needs nothing installed to play: any browser with ES module support can
          run it straight from a static server. Node is only needed for the tooling.
        </p>
        <table>
          <thead>
            <tr><th>Command</th><th>What it does</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>npm run serve</code></td>
              <td>Starts a static file server on port 8123. Open <code>http://localhost:8123</code>
                  for the game, or <code>http://localhost:8123/docs/</code> for this documentation.
                  Any static server will do; nothing about the game depends on this one.</td>
            </tr>
            <tr>
              <td><code>npm install</code> then <code>npm start</code></td>
              <td>Runs the desktop build locally through Electron.</td>
            </tr>
            <tr>
              <td><code>npm test</code></td>
              <td>Runs the content validator and every test suite in sequence. See
                  <a href="#/getting-started/status">Project status</a> for what that actually
                  covers and what it does not.</td>
            </tr>
            <tr>
              <td><code>npm run dist</code></td>
              <td>Packages the Windows installer.</td>
            </tr>
            <tr>
              <td><code>npm run count</code></td>
              <td>Prints the line-count report, broken down by area and honest about what it
                  excludes.</td>
            </tr>
          </tbody>
        </table>

        <div class="callout callout-warn">
          ${ICON_WARN}
          <div>
            <p style="margin:0">
              <strong>Do not open <code>index.html</code> straight off disk in a browser.</strong>
              Module scripts are blocked over <code>file://</code>, so the page will load and then
              do nothing, with the real reason buried in the console. Serve the folder instead.
              The desktop build does not have this problem.
            </p>
          </div>
        </div>

        <p>
          Only two development dependencies exist (Electron and its Windows packager), and
          neither is needed to play. Nothing is fetched at runtime, by the game or by this
          documentation site.
        </p>
      `,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'first-launch',
      heading: 'What you see at first launch',
      html: `
        <p>
          The world canvas fills the window and everything else sits on top of it. The camera
          opens centred on the middle of the starting land, so your fields and the first
          structures are already in frame, so there is no hunting around on a fresh save.
        </p>

        <h3>The land</h3>
        <p>
          The farm sits on a 40 by 40 tile grid. You begin owning a 12 by 12 block of it, and
          fifteen further expansions unlock the rest, each costing coins plus a set of expansion
          tools. The ground renders as a continuous meadow with mottling, tufts and flowers;
          grid squares are drawn only while you are placing or moving something, so the farm
          looks like a field rather than a spreadsheet.
        </p>

        <h3>Moving the camera</h3>
        <table>
          <thead><tr><th>Gesture</th><th>Result</th></tr></thead>
          <tbody>
            <tr><td>Drag</td><td>Pans the camera. Movement past six pixels turns a press into a drag.</td></tr>
            <tr><td>Wheel</td><td>Zooms, clamped between 0.5x and 2.5x.</td></tr>
            <tr><td>Tap</td><td>A press under six pixels of movement and under 400 milliseconds. Anything longer or larger is a drag, not a tap.</td></tr>
          </tbody>
        </table>

        <h3>What you start with</h3>
        <table>
          <thead><tr><th>Item</th><th>Amount</th><th>Note</th></tr></thead>
          <tbody>
            <tr><td>Coins</td><td>150</td><td>Enough for a Chicken Coop at 100, with change.</td></tr>
            <tr><td>Diamonds</td><td>5</td><td>The premium currency. Every level-up adds one.</td></tr>
            <tr><td>Level</td><td>1</td><td>Wheat and fields are the only things unlocked.</td></tr>
            <tr><td>Field plots</td><td>6</td><td>Pre-placed and empty, in a row below the barn and silo.</td></tr>
            <tr><td>Wheat seeds</td><td>6</td><td>Exactly one per plot. The opening move is not a puzzle.</td></tr>
            <tr><td>Silo capacity</td><td>50</td><td>Holds crops.</td></tr>
            <tr><td>Barn capacity</td><td>50</td><td>Holds goods, animal products and construction materials.</td></tr>
          </tbody>
        </table>

        <div class="callout callout-info">
          ${ICON_INFO}
          <div>
            <p style="margin:0">
              The game is silent until your first tap. Browsers refuse to start an audio context
              before a user gesture, so the first pointer press on the canvas is what creates it.
              Nothing is wrong if the opening seconds are quiet.
            </p>
          </div>
        </div>
      `,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'first-ten-minutes',
      heading: 'Your first ten minutes',
      html: `
        <p>
          The opening loop is deliberately short and legible: plant, wait two minutes, harvest,
          sell. Everything else in the game is an elaboration of it.
        </p>

        <h3>1. Plant</h3>
        <p>
          Tap an empty field plot. A radial menu opens around your finger listing every crop you
          have unlocked. At level 1 that is wheat alone. Choosing one spends its seed cost from
          the silo. Wheat costs one seed, and you start with exactly six, one per plot.
        </p>

        <h3>2. Wait</h3>
        <p>
          Wheat takes 120 seconds. The plot passes through four visual stages derived from when
          it was planted: sown, one third grown, two thirds grown, and ready. Tapping a plot that
          is still growing tells you so rather than doing anything destructive.
        </p>

        <h3>3. Harvest</h3>
        <p>
          Tap a ready plot and the radial offers a single action. Harvesting returns
          <strong>twice the seed cost</strong> (one wheat in, two wheat out), and awards the
          crop's experience.
        </p>

        <h3>4. Sell</h3>
        <p>
          Tap the silo in the world to open it. Every stack you are holding shows a sell button
          at its base price. Wheat sells for 4 coins. This instant sell is always available and
          always at the base rate; the Roadside Shop, where you set your own prices and other
          farmers buy, unlocks at level 4.
        </p>

        <h3>The arithmetic of one wheat cycle</h3>
        <p>Six plots, all wheat, planted and harvested together:</p>
        <table>
          <thead><tr><th>Quantity</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Seeds spent</td><td>6 wheat</td></tr>
            <tr><td>Elapsed time</td><td>2 minutes</td></tr>
            <tr><td>Wheat returned</td><td>12</td></tr>
            <tr><td>Net gain</td><td>+6 wheat</td></tr>
            <tr><td>Experience</td><td>6</td></tr>
            <tr><td>Coins, if you sell the six surplus</td><td>24</td></tr>
          </tbody>
        </table>

        <h3>How far that gets you</h3>
        <p>
          Levelling is not cumulative in the display sense: each level costs its own amount of
          experience, and the counter resets when you pass it.
        </p>
        <table>
          <thead><tr><th>Level reached</th><th>Experience needed for it</th><th>What it opens</th></tr></thead>
          <tbody>
            <tr><td>2</td><td>50</td><td>Corn, and the Chicken Coop</td></tr>
            <tr><td>3</td><td>174</td><td>Carrots, the Bakery, and the Order Board</td></tr>
            <tr><td>4</td><td>361</td><td>The first land expansion</td></tr>
            <tr><td>5</td><td>606</td><td>Soybean, and the Feed Mill</td></tr>
            <tr><td>6</td><td>906</td><td>Cows, the Dairy, and the Building Workshop</td></tr>
          </tbody>
        </table>
        <p>
          Finishing the guided tutorial hands you 20 of the 50 experience needed for level 2, so
          roughly five wheat cycles (about ten minutes of attentive play) carry you over the
          line and into the first real branch of the game.
        </p>

        <div class="callout callout-warn">
          ${ICON_WARN}
          <div>
            <p style="margin:0">
              <strong>A full silo silently eats a harvest.</strong> A harvest is capped by the
              space remaining, and the plot is cleared either way, so harvesting 12 wheat into a
              silo with room for 3 gives you 3 and loses the other 9. The experience is still
              awarded. Animal pens and building queues behave better: if the barn is full they
              stay ready and simply wait until there is room. Clear the silo before a big
              harvest.
            </p>
          </div>
        </div>

        <h3>Diamonds and skipping</h3>
        <p>
          Any timer can be skipped with diamonds. The price is roughly one diamond per ten
          remaining minutes, with a minimum of one, so skipping a nearly-finished wheat field
          costs the same one diamond as skipping a field with nine minutes left, which is the
          game telling you not to bother. Every level-up drops a diamond, so the supply is
          steady and small.
        </p>
      `,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'tutorial',
      heading: 'The guided tutorial',
      html: `
        <p>
          A first launch starts a twelve-step guided introduction, narrated by Farmhand Ellie in a
          speech bubble that anchors itself beside whatever it is pointing at. Each step waits for
          <strong>one specific thing to happen</strong> and nothing else advances it. There is no
          timer quietly moving you along, and no way to fall out of sequence.
        </p>

        <table>
          <thead>
            <tr><th>#</th><th>Step</th><th>What advances it</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Welcome to your farm</td><td>Tapping the bubble</td></tr>
            <tr><td>2</td><td>Plant wheat on a field</td><td>Planting anything</td></tr>
            <tr><td>3</td><td>Wheat takes a moment to grow</td><td>A crop actually becoming ready</td></tr>
            <tr><td>4</td><td>Harvest the ready field</td><td>Harvesting</td></tr>
            <tr><td>5</td><td>Look inside the silo</td><td>Opening the silo or barn</td></tr>
            <tr><td>6</td><td>Sell wheat for your first coins</td><td>Selling</td></tr>
            <tr><td>7</td><td>Buy a Chicken Coop</td><td>Placing a chicken pen</td></tr>
            <tr><td>8</td><td>Feed your chickens</td><td>Feeding a pen</td></tr>
            <tr><td>9</td><td>Buy a Bakery</td><td>Placing a bakery</td></tr>
            <tr><td>10</td><td>Queue up some bread</td><td>Queueing bread</td></tr>
            <tr><td>11</td><td>Fulfil your first order</td><td>Completing an order</td></tr>
            <tr><td>12</td><td>You are a real farmer now</td><td>Tapping the bubble</td></tr>
          </tbody>
        </table>

        <h3>Why step 3 works differently</h3>
        <p>
          Most steps are triggered by something you did: a plant, a harvest, a sale. Step 3 is
          not. Nothing <em>happens</em> when a timer elapses, so no piece of code would ever
          announce it. That step is polled once per frame instead, checking whether any planted
          field has passed its ready time. It is a small distinction worth knowing, because it is
          the reason the tutorial can advance while you are sitting still.
        </p>

        <h3>Progress, rewards and skipping</h3>
        <p>
          Your position in the tutorial is part of the save, so closing the game and returning
          resumes on the exact step you left. Finishing it pays
          <strong>200 coins, 2 diamonds and 20 experience</strong>. It can also be skipped
          outright from settings, which jumps to the end and pays the same reward.
        </p>

        <div class="callout callout-warn">
          ${ICON_WARN}
          <div>
            <p style="margin:0">
              <strong>Step 8 currently stalls on a fresh save, and this is a real gap rather than
              a design choice.</strong> Chickens unlock at level 2, but the only source of chicken
              feed is the Feed Mill, which unlocks at level 5, and a pen cannot be fed without it.
              So the tutorial will sit on "feed your chickens" until level 5 makes feed possible.
              Everything else in the game continues normally in the meantime: the tutorial does
              not block play. This is recorded rather than hidden; see
              <a href="#/getting-started/status">Project status</a>.
            </p>
          </div>
        </div>
      `,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'world-click',
      heading: 'Everything opens from the world',
      html: `
        <p>
          This is the single interaction rule the whole interface is built on, so it is worth
          stating plainly:
        </p>
        <blockquote>
          Every system with a physical presence is opened by tapping its structure in the world.
          Never from a menu, never from the HUD, never from the dock.
        </blockquote>
        <p>
          The order board opens by tapping the order board. The mine opens by tapping the mine
          entrance. The town opens by following the road out of the farm and tapping the gate.
          There is no list of systems anywhere in the game, because a list is the thing this
          design is avoiding.
        </p>

        <h3>Why locked things are still visible</h3>
        <p>
          Every structure is drawn from level 1, whether or not you can use it. A locked one
          appears <strong>derelict</strong> (overgrown, boarded, unfinished) and it is still
          fully clickable. Tapping it does not open it; it tells you the level it needs and
          leaves you where you were.
        </p>
        <p>
          That is the whole point. A menu of twenty greyed-out rows communicates nothing except
          that you are not allowed yet. A ruined museum on the far side of your land, that you
          can pan over to and tap and be told opens at level 60, is a destination. It is what
          makes a system forty levels away discoverable rather than merely announced.
        </p>

        <h3>What is where</h3>
        <p>All twenty-two, in the order they open to you:</p>
        <table>
          <thead>
            <tr><th>Level</th><th>Structure</th><th>What it opens</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Barn</td><td>Goods, animal products and construction materials</td></tr>
            <tr><td>1</td><td>Silo</td><td>Crops and seeds</td></tr>
            <tr><td>3</td><td>Order Board</td><td>Six rotating orders paying above base rate</td></tr>
            <tr><td>4</td><td>Roadside Shop</td><td>Eight slots you price yourself</td></tr>
            <tr><td>6</td><td>Building Workshop</td><td>Materials into components into building kits</td></tr>
            <tr><td>7</td><td>Mailbox</td><td>The newspaper: other farmers' shop listings</td></tr>
            <tr><td>8</td><td>Truck Bay</td><td>Bundled truck orders on a timer</td></tr>
            <tr><td>9</td><td>Market Stall</td><td>The daily rotating market</td></tr>
            <tr><td>10</td><td>Collections Shelf</td><td>Collection books and building mastery</td></tr>
            <tr><td>12</td><td>Fishing Lake</td><td>The cast-and-reel minigame, and chests</td></tr>
            <tr><td>15</td><td>Camera Tripod</td><td>Photo mode</td></tr>
            <tr><td>17</td><td>Boat Dock</td><td>Boat crates and vouchers</td></tr>
            <tr><td>20</td><td>Road to Town</td><td>Houses, population and civic milestones</td></tr>
            <tr><td>22</td><td>Helicopter Pad</td><td>The fastest materials channel</td></tr>
            <tr><td>24</td><td>Mine Entrance</td><td>Tiered digs, ore, gems and artifacts</td></tr>
            <tr><td>28</td><td>Merge Meadow</td><td>The merge board</td></tr>
            <tr><td>30</td><td>Train Station</td><td>Goods out, construction materials in</td></tr>
            <tr><td>34</td><td>Road to the Zoo</td><td>Enclosures, souvenirs and visitor income</td></tr>
            <tr><td>38</td><td>Airport</td><td>Long-haul cargo</td></tr>
            <tr><td>54</td><td>Laboratory</td><td>Permanent research</td></tr>
            <tr><td>57</td><td>Expedition Camp</td><td>Crews, sites and loot</td></tr>
            <tr><td>60</td><td>Museum</td><td>Artifacts and exhibits</td></tr>
          </tbody>
        </table>

        <h3>How a tap is resolved</h3>
        <p>
          A tap on the canvas is converted from a screen point to a tile, and then tested in a
          fixed order:
        </p>
        <ol>
          <li><strong>A structure footprint.</strong> If the tile falls inside one, that structure
              wins: it either opens its panel or reports the level it needs.</li>
          <li><strong>A placed object.</strong> A field opens the plant-or-harvest radial, an
              animal pen opens the feed-or-collect radial, and a production building opens its
              recipe queue.</li>
          <li><strong>Empty ground.</strong> Nothing opens. Any panel that was open closes, so the
              world always feels responsive to a tap rather than inert.</li>
        </ol>
      `,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'hud-dock',
      heading: 'The HUD and the dock',
      html: `
        <h3>The top bar</h3>
        <p>
          Five readouts, and nothing else: a level badge with a progress ring, coins, diamonds,
          silo used against capacity, and barn used against capacity. It is recalculated every
          frame but only rewritten when a value has genuinely changed, so a game running at sixty
          frames a second is not churning the document sixty times a second.
        </p>
        <p>
          A second banner appears above the world only while an event is running (a weekend
          event, a mini-event or the Farm Fair), carrying the event name, a progress bar with
          bronze, silver and gold tier pins, and the time remaining. When nothing is running,
          nothing is shown.
        </p>

        <h3>The dock, and why it is nearly empty</h3>
        <p>
          Because systems open from the world, the dock holds only the things that have no
          physical place to be tapped:
        </p>
        <table>
          <thead><tr><th>Button</th><th>Why it is here rather than in the world</th></tr></thead>
          <tbody>
            <tr>
              <td>Decorate</td>
              <td><strong>The one declared exception.</strong> Decorating is a mode over the whole
                  world rather than a place within it. There is no building called "rearranging
                  things", so there is nothing to tap.</td>
            </tr>
            <tr>
              <td>Achievements</td>
              <td>A record of what you have done, not a place you go.</td>
            </tr>
            <tr>
              <td>Co-op and Regatta</td>
              <td>Other people's farms, which are not on your land.</td>
            </tr>
            <tr>
              <td>Settings</td>
              <td>Sound, save export and resetting the farm.</td>
            </tr>
          </tbody>
        </table>
        <p>
          Four buttons is the entire dock. Any pressure to add a fifth is pressure to put a
          system somewhere other than in the world, and the answer to that is to give the system
          a building instead.
        </p>

        <h3>Panels, radials, toasts and dialogs</h3>
        <ul>
          <li><strong>Sheet panels</strong> slide up from the bottom for anything with content to
              read: inventories, order lists, recipe queues.</li>
          <li><strong>The radial menu</strong> is used for the quick in-world verbs (plant,
              harvest, feed, collect) arranged in a ring around the point you touched. The
              planting menu offers up to eight crops at once.</li>
          <li><strong>Toasts</strong> carry every piece of ordinary feedback and never block
              anything.</li>
          <li><strong>A blocking dialog</strong> is reserved for a decision you must actually
              make. Resetting the farm is one; almost nothing else is.</li>
        </ul>

        <div class="callout callout-info">
          ${ICON_INFO}
          <div>
            <p style="margin:0">
              The Co-op and Regatta button is present in the markup but ships hidden, and nothing
              in the game's source reveals it, so it is not reachable in the build that was
              captured. The co-op and regatta systems themselves exist and are tested. See
              <a href="#/getting-started/status">Project status</a>.
            </p>
          </div>
        </div>
      `,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'saving',
      heading: 'Saving, offline progress and your save file',
      html: `
        <p>
          Your farm is one JSON object, stored in your browser or app profile under a single key.
          It is written automatically every ten seconds while you play, and once more when the
          window closes. There is nothing to name, nothing to choose, and nothing uploaded
          anywhere.
        </p>

        <h3>Why offline progress just works</h3>
        <p>
          Every timer in the game (a growing crop, a fed pen, a queued recipe, a train, a
          voyage) is stored as an <strong>absolute wall-clock timestamp of the moment it will be
          ready</strong>. Not a countdown, not a remaining duration.
        </p>
        <p>
          That single decision removes an entire class of problem. There is no catch-up pass to
          write, because there is nothing to catch up: a ready-time recorded three days ago,
          compared against the clock right now, has already resolved correctly. Close the game
          with wheat in the ground and come back next week; it is ready, and it was ready the
          whole time. Crops do not rot, timers do not expire, and nothing is lost by being away.
        </p>
        <div class="callout callout-ok">
          ${ICON_OK}
          <div>
            <p style="margin:0">
              A few systems <em>deliberately</em> cap what accrues while you are away: foraging
              nodes respawn only so many times, and zoo visitor income is capped at twelve hours,
              so that a fortnight's absence does not carpet the farm in free goods. Those caps are
              specific and intentional. Crops, pens and production queues have none.
            </p>
          </div>
        </div>

        <h3>The save format</h3>
        <table>
          <thead><tr><th>Property</th><th>Detail</th></tr></thead>
          <tbody>
            <tr><td>Storage</td><td>One JSON string in browser-profile local storage</td></tr>
            <tr><td>Autosave</td><td>Every 10 seconds, and on window close</td></tr>
            <tr><td>Format version</td><td>3</td></tr>
            <tr><td>Migrations</td><td>Two: version 1 to 2 added the merge board, trains and airport; version 2 to 3 added the town, the zoo and the daily market</td></tr>
          </tbody>
        </table>
        <p>
          An older save is migrated forward key by key, defaulting only what is new and passing
          everything else through untouched. A save from a <em>newer</em> build than the one
          reading it is never guessed at, and neither is a corrupt or structurally invalid one.
          In every one of those cases the game starts a fresh farm rather than half-loading
          something it does not understand. Validation is genuine: balances must be non-negative
          numbers, the level must be at least 1, and the farm, silo, barn, production queue,
          orders and statistics must each be the right shape before a save is accepted.
        </p>

        <h3>Export, import and reset</h3>
        <p>
          The save can be serialised out and read back in as a JSON string, and importing is
          all-or-nothing: a file that fails to parse, or comes from a newer version, or fails
          validation, leaves your live farm completely untouched. Resetting is available in
          settings behind a confirmation.
        </p>
        <div class="callout callout-info">
          ${ICON_INFO}
          <div>
            <p style="margin:0">
              The export control in the settings panel currently writes the save to the browser
              console rather than offering a file. It is a real export and the JSON is complete,
              but it is not yet a comfortable one.
            </p>
          </div>
        </div>

        <div class="callout callout-danger">
          ${ICON_WARN}
          <div>
            <p style="margin:0">
              <strong>Local storage is per browser profile and per origin.</strong> Clearing site
              data, using a different browser, or a private window all mean a different farm.
              There is no cloud copy and no recovery. If the save matters to you, export it.
            </p>
          </div>
        </div>
      `,
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'status',
      heading: 'Project status: what is verified and what is open',
      html: `
        <p>
          This section exists so that nothing elsewhere in the site has to be quietly optimistic.
          Everything below was checked by running it, or by reading the source at the commit this
          page was written against. The distinction between "implemented and tested" and
          "reachable by a player" is kept sharp throughout, because in this project they are
          genuinely different things.
        </p>

        <h3>The automated suite</h3>
        <p>
          The content validator and eight test files were each run individually. Every one passed.
        </p>
        <table>
          <thead><tr><th>Suite</th><th>Assertions</th><th>Result</th></tr></thead>
          <tbody>
            <tr><td>Content validator</td><td>whole-table integrity</td><td>Passed</td></tr>
            <tr><td>Camera and viewport</td><td>22</td><td>Passed</td></tr>
            <tr><td>Core: state, economy, production</td><td>27</td><td>Passed</td></tr>
            <tr><td>Logistics</td><td>19</td><td>Passed</td></tr>
            <tr><td>Crafting</td><td>23</td><td>Passed</td></tr>
            <tr><td>Township</td><td>10</td><td>Passed</td></tr>
            <tr><td>Research</td><td>15</td><td>Passed</td></tr>
            <tr><td>Dead-time systems</td><td>16</td><td>Passed</td></tr>
            <tr><td>Social systems</td><td>24</td><td>Passed</td></tr>
            <tr><td><strong>Total</strong></td><td><strong>156</strong></td><td><strong>0 failures</strong></td></tr>
          </tbody>
        </table>

        <h3>What the content validator actually asserts</h3>
        <p>
          It is not a shape check. It refuses, among other things, a recipe whose output is not a
          real good, an input that resolves to nothing, a building kit that cannot be crafted in
          the Workshop, a building that unlocks before the Workshop that would have to build it,
          a construction material demanded from the wrong economy (a barn upgrade asking for
          expansion tools, for instance), and any level between 1 and 95 that carries no unlock at
          all, which is what stops the late game becoming a silent experience corridor. Its
          summary line reports the content it validated: 22 crops, 12 animals, 26 buildings, 128
          recipes, 192 goods, 3 merge chains, 39 achievements, 95 levels all with unlocks, 10
          weekend events, 6 mini-events, 25 fair tasks, 6 holidays, 16 town houses, 10 community
          buildings, 14 zoo enclosures, 8 islands and 23 materials.
        </p>

        <h3>What those tests do not cover</h3>
        <div class="callout callout-warn">
          ${ICON_WARN}
          <div>
            <p style="margin:0">
              The suites exercise the game's logic modules directly, under Node. <strong>They never
              open the app.</strong> A module can be complete, correct and thoroughly tested and
              still have no way to reach it from the running game, and several are exactly that.
              A passing suite is evidence about the logic and evidence about nothing else.
            </p>
          </div>
        </div>

        <h3>Evidence from the real built application</h3>
        <p>
          Separately from the tests, a capture run drove the actual packaged Windows build (not a
          development server, not a mock) on an off-screen desktop, and recorded 47 screenshots
          of real surfaces along with a manifest naming the commit, the viewport and the method
          for each one. That run also recorded, honestly, the eight surfaces it could
          <em>not</em> reach and the exact reason for each. That list is the most useful thing in
          this section.
        </p>

        <h3>The gap between the systems and the interface</h3>
        <p>
          The game has 22 world structures. At the commit this page describes, the panel layer
          renders real content for <strong>five</strong> of them (the barn, the silo, the order
          board, the roadside shop and the Building Workshop), plus the building recipe queue you
          get by tapping a factory, the feed-and-collect radial on animal pens, and the
          achievements, decorate and settings panels on the dock.
        </p>
        <p>
          The other seventeen structures open a panel that says the system is being built. In
          most cases the system behind them is not being built at all. It is finished, and
          tested, and simply has no panel yet:
        </p>
        <table>
          <thead><tr><th>Structure</th><th>State of the system behind it</th></tr></thead>
          <tbody>
            <tr><td>Mine Entrance</td><td>Implemented and tested; no panel</td></tr>
            <tr><td>Merge Meadow</td><td>Implemented and tested; no panel</td></tr>
            <tr><td>Fishing Lake</td><td>Implemented; no panel</td></tr>
            <tr><td>Expedition Camp</td><td>Implemented; no panel</td></tr>
            <tr><td>Truck Bay, Boat Dock, Market Stall</td><td>Implemented; no panel</td></tr>
            <tr><td>Train Station, Airport, Helicopter Pad</td><td>Implemented; no panel</td></tr>
            <tr><td>Road to Town, Road to the Zoo</td><td>Implemented; no panel</td></tr>
            <tr><td>Museum, Laboratory</td><td>Implemented; no panel</td></tr>
            <tr><td>Mailbox, Collections Shelf, Camera Tripod</td><td>Implemented; no panel</td></tr>
          </tbody>
        </table>
        <p>
          Two further gaps of the same kind deserve naming individually, because they touch the
          mechanics this game is meant to be distinguished by. The
          <strong>materials-to-components-to-kit crafting spine</strong> is fully implemented and
          tested, but the live Workshop panel currently lets buildings be bought outright for
          coins instead, bypassing it. And the <strong>per-factory minigames</strong> are
          implemented and tested but are not called from anywhere in the interface, so there is at
          present no way to reach one while playing.
        </p>

        <h3>Other open items, individually verified</h3>
        <ul>
          <li><strong>No item icons.</strong> No content table carries an icon, so every place the
              interface draws one falls back to a generic mark. Purely cosmetic, and pervasive.</li>
          <li><strong>The level progress ring does not fill.</strong> It compares your
              within-level experience against the absolute cost of the current and next level,
              which makes the fraction clamp to zero. The level number itself is correct.</li>
          <li><strong>The tutorial's feed step is gated behind a later unlock</strong>, as
              described under <a href="#/getting-started/tutorial">The guided tutorial</a>.</li>
          <li><strong>The Co-op and Regatta dock button is hidden</strong> and nothing reveals it.</li>
          <li><strong>One visual theme.</strong> The game ships the wood-and-parchment palette
              only; there is no dark variant. This documentation site has both, which is a
              separate thing entirely.</li>
          <li><strong>Camera reach.</strong> The camera clamp defaults to a padded box around the
              starting land, so several structures cannot be brought fully into frame by panning,
              even though tapping them still opens their panel correctly. A fix to that clamp was
              in progress when this page was written.</li>
        </ul>

        <h3>What is never claimed</h3>
        <p>
          The Windows installer is unsigned and will stay unsigned; code signing is permanently
          out of scope here. No release of this game has been verified by any certificate
          authority, and no wording anywhere in this site should be read as suggesting otherwise.
        </p>
        <p>
          To re-check any of this yourself, run <code>npm test</code>, and read the
          <a href="#/changelog">changelog</a> for what has landed since.
        </p>
      `,
    },
  ],

  related: ['farming', 'crafting', 'deadtime', 'download'],
};
