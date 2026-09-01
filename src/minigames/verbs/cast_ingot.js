// cast_ingot.js — "Cast the Ingot". The smelter's playable item.
//
// Family: aim. The model sees {angle, power, fired}: where the crucible is pointed and how far it
// has been tipped, both committed in one motion when you let go. Two coupled continuous values
// judged together is what makes this its own grammar: season_pinch judges a magnitude with no
// direction, sort_chillies picks a direction with no magnitude, and neither is this.
//
// Tip too shallow and the mould fills short; too far and it slops over the rim. Aim off and it
// misses the channel entirely, however good the pour was.

export const id = 'cast_ingot';

const MOULDS = 4;
const DURATION_MS = 13000;

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
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 2 : 1);
  const angleTol = assist ? 0.55 : 0.30;   // radians either side of the channel
  const powerTol = assist ? 0.24 : 0.13;
  const perMouldMs = limitMs / MOULDS;

  const rng = mulberry32(seed);
  const moulds = [];
  for (let i = 0; i < MOULDS; i++) {
    moulds.push({ angle: (rng() - 0.5) * Math.PI * 1.4, depth: 0.3 + rng() * 0.55 });
  }

  let index = 0;
  let sinceMould = 0;
  let scored = 0;
  let judged = 0;
  let finished = false;
  let lastResult = null;

  function judge(angle, power) {
    const m = moulds[index];
    let da = Math.abs(angle - m.angle);
    while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
    const dp = Math.abs(power - m.depth);

    // BOTH have to be right. A perfect pour aimed at the floor is still a floor full of metal,
    // so the two accuracies multiply rather than average.
    const aimOk = Math.max(0, 1 - da / (angleTol * 2));
    const powOk = Math.max(0, 1 - dp / (powerTol * 2));
    scored += aimOk * powOk;
    judged += 1;
    lastResult = da <= angleTol && dp <= powerTol ? 'clean cast'
      : da > angleTol ? 'missed the channel' : (power > m.depth ? 'overpoured' : 'short');

    index += 1;
    sinceMould = 0;
    if (index >= MOULDS) finished = true;
  }

  return {
    step(dtMs, input) {
      if (finished) return;
      sinceMould += Math.max(0, dtMs || 0);
      if (input && input.fired) { judge(input.angle || 0, Math.max(0, Math.min(1, input.power || 0))); return; }
      // A mould you never pour sets empty; the run does not wait on you.
      if (sinceMould >= perMouldMs) judge(Math.PI, 0);
    },

    score() {
      if (judged === 0) return 0;
      const s = scored / MOULDS;
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, index / MOULDS); },
    done() { return finished; },

    snapshot() {
      const m = moulds[Math.min(index, MOULDS - 1)];
      return {
        wantAngle: m.angle, wantDepth: m.depth,
        mould: Math.min(index + 1, MOULDS), moulds: MOULDS,
        result: lastResult,
      };
    },
  };
}

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-aim');
  host.innerHTML = '';

  const dish = doc.createElement('div'); dish.className = 'dish';
  const channel = doc.createElement('span'); channel.className = 'channel';
  dish.appendChild(channel);

  const depth = doc.createElement('div'); depth.className = 'depth';
  const wantBar = doc.createElement('span'); wantBar.className = 'want';
  depth.appendChild(wantBar);

  const status = doc.createElement('span'); status.className = 'status';
  host.append(dish, depth, status);

  let announced = -1;
  return {
    render(snap) {
      channel.style.transform = `rotate(${(snap.wantAngle * 180 / Math.PI).toFixed(1)}deg)`;
      wantBar.style.bottom = `${Math.round(snap.wantDepth * 100)}%`;
      const word = `Mould ${snap.mould} of ${snap.moulds}` + (snap.result ? ` — last one ${snap.result}` : '');
      status.textContent = word;
      if (ctx.announce && snap.mould !== announced) { announced = snap.mould; ctx.announce(word); }
    },
    unmount() { host.classList.remove('stage-aim'); host.innerHTML = ''; },
  };
}
