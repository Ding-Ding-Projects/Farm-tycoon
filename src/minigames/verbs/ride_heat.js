// ride_heat.js — "Ride the Heat". The omelet station's playable item.
//
// Family: route, and the fourth. The other three ask which lane is correct for the item in front
// of you: sort_chillies reads the answer off the pepper, split_press divides a load where every
// destination is legal, match_seam makes the answer the piece before. In all three, each choice
// is scored on its own.
//
// Here nothing is right or wrong and every choice changes the price of the next one. There is ONE
// pan, it holds whatever heat the last omelet left in it, and swinging it to a new temperature
// costs real seconds. So the cost of an order is not a property of the order; it is a property of
// what you cooked immediately before it. Sweep the tickets in heat order and the pan crosses the
// range once. Take them in the order they arrived and it swings back and forth across the whole
// range every single time, and the service ends with two or three still unplated.
//
// Measured across ten seeds: planning the route plates everything, 1.000, while cooking straight
// down the queue lands between 0.375 and 0.750. Idling scores 0.000 and assist is never worse.
//
// This exists because an earlier attempt at a rush verb (work_rush, cut - see registry.js) proved
// that a queue where every item is worth the same and your actions are capped cannot reward
// ordering at all: serving any N scores identically. The loss has to depend on the SEQUENCE, not
// the count. A shared piece of state carried between choices is what does that.

export const id = 'ride_heat';

const TICKETS = 8;
const COOK_MS = 560;              // once the pan is at temperature
const TRAVEL_MS_PER_UNIT = 2400;  // seconds of swing per unit of heat
const DURATION_MS = 8800;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.7 : 1);
  const travelPerUnit = TRAVEL_MS_PER_UNIT * (assist ? 0.6 : 1);

  const rng = mulberry32(seed);
  const heats = [];
  for (let i = 0; i < TICKETS; i++) heats.push(rng());

  // Tickets arrive MIXED, deliberately: sorted ascending, then dealt alternately from the hot end
  // and the cold end, so the order they land in is close to the worst possible route across the
  // pan. Left purely random, roughly one run in five deals them out already near-sorted, and on
  // those runs cooking straight down the queue is as good as planning - which teaches the player
  // the wrong lesson on exactly the runs they are most likely to remember. A rush that is
  // sometimes not a rush is worse than one that is honestly always mixed.
  heats.sort((x, y) => x - y);
  const tickets = [];
  for (let i = 0; i < TICKETS; i++) {
    const fromHot = i % 2 === 0;
    const idx = fromHot ? heats.length - 1 - (i >> 1) : (i >> 1);
    tickets.push({ heat: heats[idx], done: false });
  }

  let panHeat = 0.5;
  let t = 0;
  let busyMs = 0;
  let cooking = -1;
  let done = 0;
  let finished = false;
  let lastResult = null;

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      t += dt;

      if (busyMs > 0) {
        busyMs -= dt;
        if (busyMs <= 0) {
          busyMs = 0;
          if (cooking >= 0) {
            tickets[cooking].done = true;
            panHeat = tickets[cooking].heat;   // the pan keeps the heat it was left at
            done += 1;
            lastResult = 'plated';
            cooking = -1;
          }
        }
      }

      const lane = input && typeof input.lane === 'number' ? input.lane : -1;
      if (busyMs === 0 && input && input.commit && lane >= 0 && lane < TICKETS) {
        const ticket = tickets[lane];
        if (ticket && !ticket.done) {
          const swing = Math.abs(panHeat - ticket.heat);
          busyMs = swing * travelPerUnit + COOK_MS;
          cooking = lane;
          lastResult = swing > 0.45 ? 'long swing' : 'close by';
        }
      }

      if (t >= limitMs || tickets.every((k) => k.done)) finished = true;
    },

    score() {
      const s = done / TICKETS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, done / TICKETS); },
    done() { return finished; },

    snapshot() {
      return {
        panHeat,
        busy: busyMs > 0,
        done,
        total: TICKETS,
        msLeft: Math.max(0, limitMs - t),
        travelPerUnit,
        cookMs: COOK_MS,
        result: lastResult,
        // Every ticket's heat is public, and so is the pan's. The decision is a planning one, not
        // a guessing one: you can see the whole board and still have to work out an order.
        tickets: tickets.map((k, i) => ({ lane: i, heat: k.heat, done: k.done })),
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-route');
  host.innerHTML = '';

  const rail = doc.createElement('span');
  rail.className = 'chutes';
  const lanes = [];
  for (let i = 0; i < TICKETS; i++) {
    const c = doc.createElement('span');
    c.className = 'chute';
    c.dataset.pad = String(i);
    rail.appendChild(c);
    lanes.push(c);
  }
  const status = doc.createElement('span');
  status.className = 'status';
  host.append(rail, status);

  let announced = -1;
  return {
    render(snap) {
      for (const k of snap.tickets) {
        const el = lanes[k.lane];
        el.style.opacity = k.done ? '0.25' : '1';
        // Heat is shown as a height as well as a hue, so it never depends on colour alone.
        el.style.setProperty('--heat', String(k.heat));
        el.style.background = k.done ? '#8a8f96'
          : `hsl(${Math.round(46 - k.heat * 46)}, 82%, ${Math.round(72 - k.heat * 26)}%)`;
        el.setAttribute('aria-label', `Ticket ${k.lane + 1}, heat ${Math.round(k.heat * 100)}%${k.done ? ', plated' : ''}`);
      }
      const word = `Pan at ${Math.round(snap.panHeat * 100)}%. ${snap.done} of ${snap.total} plated. `
        + 'Swinging the pan costs time, so cook near what it is already at.';
      status.textContent = word;
      if (ctx.announce && snap.done !== announced) { announced = snap.done; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-route'); host.innerHTML = ''; },
  };
}
