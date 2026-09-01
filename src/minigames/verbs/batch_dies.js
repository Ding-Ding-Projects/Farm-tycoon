// batch_dies.js — "Batch the Dies". The pasta maker's playable item.
//
// Family: route, and the fifth. sort_chillies sends each thing down the chute it belongs in.
// split_press divides one flow between two. match_seam picks the lane that fits what is coming.
// ride_heat works the tickets in temperature order because swinging the pan costs seconds.
//
// This is ride_heat's cousin and has to earn its place against it, so the difference is worth
// stating plainly: ride_heat's cost depends on how FAR apart two tickets are, a smooth gradient
// you can shave, and its pan is a single value that drifts. Here there is nothing to shave. A die
// is fitted or it is not; working a ticket that wants the fitted die is free and any other ticket
// costs the same flat swap however similar the shapes look. The question changes from "which is
// nearest" to "have I finished with this one", and that is a different plan: ride_heat's answer is
// a tour, this one's answer is a partition.
//
// It also has to survive the trap that killed work_rush, which is why it is built this way. That
// verb failed because WITH UNIFORM ITEM VALUE AND A HARD LIMIT ON ACTIONS, TRIAGE IS
// MATHEMATICALLY IRRELEVANT - serving any N items scored the same, so no ordering could beat any
// other. Here the limit is on TIME and the actions do not cost the same: the cost lives in the
// TRANSITIONS between tickets rather than in the tickets. Grouping is therefore provably better,
// not merely intended to be, and the measurement is in tools/test-verbs.mjs rather than in this
// comment.
//
// The tickets are shown in arrival order on purpose. Serving them the way they came is the natural
// and wrong answer, and it should look reasonable right up until the clock beats you.

export const id = 'batch_dies';

const DIES = 3;              // matches the route family's default lane count
const TICKETS = 12;
const FILL_MS = 700;         // extruding one ticket once the right die is on
const SWAP_MS = 1400;        // changing the die, whichever die you are changing to
const DURATION_MS = 13500;

const DIE_NAMES = ['macaroni', 'penne', 'ravioli'];

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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 1.6 : 1);
  const swapMs = SWAP_MS * (assist ? 0.6 : 1);

  // An even-ish spread across the three dies, shuffled, so arrival order really does interleave
  // them. A run that happened to arrive already grouped would have no decision in it.
  const rng = mulberry32(seed);
  const tickets = [];
  for (let i = 0; i < TICKETS; i++) tickets.push({ die: i % DIES, filled: false });
  for (let i = tickets.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = tickets[i]; tickets[i] = tickets[j]; tickets[j] = t;
  }

  let elapsed = 0;
  let finished = false;
  let fitted = 0;              // which die is on the machine right now
  let busyMs = 0;              // time left on the job in hand
  let busyOn = -1;             // ticket index being worked
  let swapping = false;
  let swaps = 0;
  let filled = 0;
  let lastResult = null;

  const nextFor = (die) => tickets.findIndex((t) => !t.filled && t.die === die);

  return {
    step(dtMs, input) {
      if (finished) return;
      const dt = Math.max(0, dtMs || 0);
      elapsed += dt;

      if (busyMs > 0) {
        busyMs -= dt;
        if (busyMs <= 0) {
          busyMs = 0;
          if (swapping) {
            // The swap has landed; the ticket that asked for it still has to be extruded. Clear
            // the message with it, or the status reads "Extruding (changing to the penne die)"
            // and tells the player two different things about the same moment.
            swapping = false;
            lastResult = null;
            if (busyOn >= 0) busyMs = FILL_MS;
          } else if (busyOn >= 0) {
            tickets[busyOn].filled = true;
            filled += 1;
            busyOn = -1;
            lastResult = null;
          }
        }
      } else if (input && input.commit) {
        const die = typeof input.lane === 'number' ? Math.max(0, Math.min(DIES - 1, input.lane)) : 0;
        const idx = nextFor(die);
        if (idx < 0) {
          lastResult = `no ${DIE_NAMES[die]} tickets left`;
        } else {
          busyOn = idx;
          if (die === fitted) {
            busyMs = FILL_MS;
            lastResult = null;
          } else {
            fitted = die;
            swaps += 1;
            swapping = true;
            busyMs = swapMs;
            lastResult = `changing to the ${DIE_NAMES[die]} die`;
          }
        }
      }

      if (filled >= TICKETS) finished = true;
      if (elapsed >= limitMs) finished = true;
    },

    score() {
      const s = filled / TICKETS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, filled / TICKETS); },
    done() { return finished; },

    snapshot() {
      return {
        dies: DIES,
        dieNames: DIE_NAMES.slice(),
        // Arrival order, exactly as they came in. Reordering them for the player would hand over
        // the answer, and the whole verb is noticing that the order shown is not the order to work.
        tickets: tickets.map((t) => ({ die: t.die, filled: t.filled })),
        fitted,
        filled,
        total: TICKETS,
        swaps,
        busy: busyMs > 0,
        swapping,
        // Both costs published. A player who cannot see that a change costs twice an extrusion is
        // being asked to discover the rule by losing, which is not the same as playing it.
        fillMs: FILL_MS,
        swapMs,
        msLeft: Math.max(0, limitMs - elapsed),
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-route', 'stage-dies');
  host.innerHTML = '';

  const rack = doc.createElement('div');
  rack.className = 'ticket-rack';
  const chips = [];

  const lanes = doc.createElement('div');
  lanes.className = 'die-lanes';
  const laneEls = [];
  for (let i = 0; i < DIES; i++) {
    const l = doc.createElement('button');
    l.type = 'button';
    l.className = 'die-lane';
    l.textContent = DIE_NAMES[i];
    l.setAttribute('aria-label', `Work the next ${DIE_NAMES[i]} ticket`);
    lanes.appendChild(l);
    laneEls.push(l);
  }

  const status = doc.createElement('span');
  status.className = 'status';
  host.append(rack, lanes, status);

  let built = false;
  let announced = '';

  return {
    render(snap) {
      if (!built) {
        for (const t of snap.tickets) {
          const c = doc.createElement('span');
          c.className = `ticket die-${t.die}`;
          c.textContent = snap.dieNames[t.die].slice(0, 3);
          rack.appendChild(c);
          chips.push(c);
        }
        built = true;
      }
      for (let i = 0; i < chips.length; i++) chips[i].classList.toggle('filled', snap.tickets[i].filled);
      for (let i = 0; i < laneEls.length; i++) {
        laneEls[i].classList.toggle('fitted', i === snap.fitted);
        const left = snap.tickets.filter((t) => !t.filled && t.die === i).length;
        laneEls[i].classList.toggle('empty', left === 0);
        laneEls[i].dataset.left = String(left);
      }

      const word = snap.busy
        ? (snap.swapping ? 'Changing the die' : 'Extruding')
        : `${snap.filled} of ${snap.total} done, ${snap.swaps} die changes.`
          + ` The ${snap.dieNames[snap.fitted]} die is on - anything else costs ${Math.round(snap.swapMs / 100) / 10}s.`;
      status.textContent = snap.result ? `${word} (${snap.result})` : word;
      if (ctx.announce && word !== announced) { announced = word; ctx.announce(word); }
    },
    unmount() {
      host.classList.remove('stage-route', 'stage-dies');
      host.innerHTML = '';
    },
  };
}
