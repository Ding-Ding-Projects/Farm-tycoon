// stack_layers.js — "Stack the Layers". The sandwich bar's playable item.
//
// Family: drag, and deliberately NOT the same game as lay_slices. That one is matching: every
// slice has a plate it belongs on, and the order you work in is entirely yours. This one is
// ORDERING: there is exactly one correct sequence, every ingredient goes on the same pile, and
// putting the tomato under the bread is wrong even though the tomato is "correct".
//
// So the two share a grammar and share nothing else: one is a sorting problem you can solve in
// any order, the other is a sequence you can only solve in one.

export const id = 'stack_layers';

const DURATION_MS = 16000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LAYERS = ['bread', 'bacon', 'tomato', 'cheese', 'bacon', 'bread'];

export function create(seed, opts = {}) {
  const assist = !!opts.assist;
  const limitMs = (opts.durationMs || DURATION_MS) * (assist ? 2 : 1);

  // The tray is shuffled; the RECIPE is not. Assist keeps the tray in a helpful order rather
  // than making the sandwich shorter.
  const rng = mulberry32(seed);
  const tray = LAYERS.map((name, i) => ({ i, name }));
  if (!assist) {
    for (let i = tray.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [tray[i], tray[j]] = [tray[j], tray[i]];
    }
  }

  let placed = 0;      // how many layers are correctly on the pile
  let wrong = 0;
  let elapsed = 0;
  const used = new Set();
  let finished = false;
  let lastResult = null;

  return {
    step(dtMs, input) {
      if (finished) return;
      elapsed += Math.max(0, dtMs || 0);

      if (input && input.dropped && input.grabbed >= 0 && !used.has(input.grabbed)) {
        const item = tray[input.grabbed];
        // dropOn 0 is the pile; anything else is putting it back, which costs nothing.
        if (item && input.dropOn === 0) {
          used.add(input.grabbed);
          if (item.i === placed) { placed += 1; lastResult = 'on it goes'; }
          else { wrong += 1; lastResult = 'out of order'; }
        }
      }

      if (placed >= LAYERS.length || used.size >= tray.length || elapsed >= limitMs) finished = true;
    },

    score() {
      const s = placed / LAYERS.length - Math.min(0.3, wrong * 0.08);
      return Math.max(0, Math.min(1, Number.isNaN(s) ? 0 : s));
    },

    progress() { return Math.min(1, used.size / tray.length); },
    done() { return finished; },

    snapshot() {
      return {
        tray: tray.map((t, idx) => ({ name: t.name, used: used.has(idx) })),
        placed, wrong,
        needed: LAYERS.length,
        next: placed < LAYERS.length ? LAYERS[placed] : null,
        result: lastResult,
      };
    },
  };
}

const COLOUR = { bread: '#e8c07a', bacon: '#e0705a', tomato: '#e0453a', cheese: '#f7d43e' };

export function mount(host, ctx = {}) {
  const doc = host.ownerDocument;
  host.classList.add('stage-stack');
  host.innerHTML = '';

  const tray = doc.createElement('div'); tray.className = 'tray';
  const pile = doc.createElement('button');
  pile.type = 'button'; pile.className = 'pile'; pile.dataset.drop = '0';
  pile.setAttribute('aria-label', 'The sandwich');
  const status = doc.createElement('span'); status.className = 'status';
  host.append(tray, pile, status);

  let built = -1;
  const items = [];
  return {
    render(snap) {
      if (items.length === 0) {
        snap.tray.forEach((t, i) => {
          const b = doc.createElement('button');
          b.type = 'button'; b.className = 'layer';
          b.dataset.grab = String(i);
          b.style.background = COLOUR[t.name] || '#ddd';
          b.textContent = t.name;
          tray.appendChild(b);
          items.push(b);
        });
      }
      snap.tray.forEach((t, i) => items[i].classList.toggle('used', t.used));
      if (snap.placed !== built) {
        built = snap.placed;
        pile.innerHTML = '';
        for (let i = 0; i < snap.placed; i++) {
          const l = doc.createElement('span');
          l.className = 'built';
          l.style.background = COLOUR[LAYERS[i]] || '#ddd';
          pile.appendChild(l);
        }
      }
      const word = snap.next ? `Next: ${snap.next}` : 'Sandwich built';
      status.textContent = `${word} — ${snap.placed} of ${snap.needed}`;
      if (ctx.announce) ctx.announce(status.textContent);
    },
    unmount() { host.classList.remove('stage-stack'); host.innerHTML = ''; },
  };
}
