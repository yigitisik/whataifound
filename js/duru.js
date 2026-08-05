// Duru, the badger along the bottom of the page.
//
// A guru with a d, for discovery, data and diligence. He is a reactive mascot rather than
// decoration: he walks to match your read position, digs when you hover a grade pill,
// peeks over a card when you open its caveats, and shrugs when a search finds nothing. A
// badger keeps digging at one spot, which is the argument this registry makes about claims.
//
// Everything here is additive and self-contained. The layer is built in JS rather than
// shipped in the markup for two reasons: no HTML file needs to change (the entry card is
// byte-diffed between app.js and build-site.py by verify-parity.py, and a mascot is not
// worth touching that), and a reader with scripting off gets the site exactly as it was.
//
// The whole layer is pointer-events: none and duplicates no information. Nothing is lost
// if it never appears.
(function () {
  // No badger on a narrow or touch screen. He needs track width to be a read-position
  // indicator at all, and digging is driven by hover, which a touch screen does not have.
  const SMALL = matchMedia('(max-width: 860px), (pointer: coarse)');
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (SMALL.matches) return;

  const SRC = name => `/assets/duru/${name}.png`;
  const SPRITES = {
    idle:  ['badger-idle-1', 'badger-idle-2'],
    walk:  ['badger-walk-1', 'badger-walk-2'],
    dig:   ['badger-dig-1', 'badger-dig-2'],
    shrug: ['badger-shrug']
  };
  // Native sprites are 22x18 (26x19 digging) and are only ever shown at an integer
  // multiple. Width only, never height: setting both shears the pixel art.
  const WIDTH = { idle: 44, walk: 44, dig: 52, shrug: 44 };
  const RATE = { idle: 1200, walk: 170, dig: 160, shrug: 900 };

  // One line per verification grade, lowercase and deliberately terse. These say nothing
  // the pill beside them has not already said, which is the point: the bubble is never the
  // only channel for anything.
  const SAY = {
    'formal': 'checked.',
    'independent': 'two labs.',
    'peer-reviewed': 'reviewed.',
    'author-verified': 'says who?',
    'claimed': 'unchecked.',
    'disputed': 'hm.',
    'known': 'not new.',
    'refuted': 'wrong.'
  };

  const S = { mode: 'idle', frame: 0, x: 0, dir: 1, say: '' };
  // Deliberately outside S: none of these should cause a repaint on their own. The frame
  // clock accumulator, the scroll speed feeding the walk rate, the last scroll offset, the
  // usable track width, and the three handles that have to be cleared.
  let tick = 0, speed = 0, lastTop = 0, track = 700;
  let clock = null, stopT = null, sayT = null;

  // ---------- the layer ----------
  const el = (tag, cls) => {
    const node = document.createElement(tag);
    node.className = cls;
    return node;
  };

  const layer = el('div', 'duru-layer');
  const trackEl = el('div', 'duru-track');
  const stage = el('div', 'duru-stage');
  const img = el('img', 'duru-img');
  const bubble = el('div', 'duru-bubble');

  img.alt = 'Duru the badger';
  img.src = SRC(SPRITES.idle[0]);
  img.style.width = WIDTH.idle + 'px';
  // The speech is decorative and repeats the pill it is reacting to, so it is not worth
  // announcing. The sprite keeps its alt text; the bubble does not need one too.
  bubble.setAttribute('aria-hidden', 'true');
  bubble.textContent = '\u00a0';

  stage.append(img, el('i', 'duru-dirt duru-dirt1'), el('i', 'duru-dirt duru-dirt2'));
  trackEl.append(stage, bubble);
  layer.append(el('div', 'duru-fade'), trackEl);

  // Head only, 16x14, shown rising from behind the edge of an open disclosure. One
  // element, moved to whichever card is currently open rather than one per card.
  const peek = el('div', 'duru-peek');
  const peekImg = el('img', 'duru-peek-img');
  peekImg.alt = '';
  peekImg.src = SRC('badger-peek');
  peek.appendChild(peekImg);

  document.body.appendChild(layer);

  // ---------- painting ----------
  // Every write is guarded by a comparison. Scroll fires far more often than the badger
  // actually changes, and an unguarded style write on each event is layout thrash.
  let lastMode = '', lastX = null, lastDir = 0, lastSay = null;

  function paint() {
    const frames = SPRITES[S.mode];
    const src = SRC(frames[S.frame % frames.length]);
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);

    if (S.mode !== lastMode) {
      img.style.width = WIDTH[S.mode] + 'px';
      layer.classList.toggle('is-dig', S.mode === 'dig');
      lastMode = S.mode;
    }

    const x = Math.round(S.x);
    if (x !== lastX || S.dir !== lastDir) {
      stage.style.transform = `translateX(${x}px) scaleX(${S.dir})`;
      bubble.style.transform = `translateX(${x + 30}px)`;
      lastX = x;
      lastDir = S.dir;
    }

    if (S.say !== lastSay) {
      // A non-breaking space when empty, so the box keeps its height through the fade out
      // rather than collapsing halfway.
      bubble.textContent = S.say || '\u00a0';
      layer.classList.toggle('is-saying', Boolean(S.say));
      lastSay = S.say;
    }
  }

  function speak(text, ms) {
    clearTimeout(sayT);
    S.say = text;
    paint();
    if (ms) sayT = setTimeout(() => { S.say = ''; paint(); }, ms);
  }

  function setMode(mode) {
    if (S.mode === mode) return;
    S.mode = mode;
    tick = 0;
    paint();
  }

  // ---------- the frame clock ----------
  // One interval accumulating elapsed time, rather than one interval per mode. The walk
  // rate rises with scroll speed, and this lets that change without restarting the timer.
  // Frames are hard cuts: no cross-fade, no transition on the image.
  function startClock() {
    if (clock || REDUCE || SMALL.matches) return;
    clock = setInterval(() => {
      const step = S.mode === 'walk' ? Math.max(70, RATE.walk - speed * 4) : RATE[S.mode];
      tick += 60;
      if (tick >= step) {
        tick = 0;
        S.frame++;
        paint();
      }
    }, 60);
  }

  function stopClock() {
    clearInterval(clock);
    clock = null;
  }

  // A backgrounded tab should cost nothing at all.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopClock(); else startClock();
  });
  SMALL.addEventListener('change', ev => {
    if (ev.matches) stopClock(); else startClock();
  });

  // ---------- 1. scroll: he walks the page ----------
  // rAF-throttled and passive, matching the scroll-spy and back-to-top handlers in app.js.
  let ticking = false;
  const measure = () => { track = Math.max(120, innerWidth - 56 - 44); };

  const progress = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    return Math.min(1, Math.max(0, scrollY / max));
  };

  function onScroll() {
    ticking = false;
    // Shrug outranks everything: while it holds, scrolling is ignored entirely.
    if (S.mode === 'shrug') return;
    const top = scrollY;
    const d = top - lastTop;
    lastTop = top;
    speed = Math.min(26, Math.abs(d));
    S.x = progress() * track;
    if (d !== 0) S.dir = d > 0 ? 1 : -1;
    // Dig outranks walk: scrolling while hovering a pill does not stop the dig.
    if (S.mode !== 'dig') setMode('walk');
    paint();
    if (speed > 20 && !S.say) speak('slow down.', 900);
    clearTimeout(stopT);
    stopT = setTimeout(() => {
      speed = 0;
      if (S.mode === 'walk') setMode('idle');
    }, 260);
  }

  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });

  addEventListener('resize', () => {
    measure();
    S.x = progress() * track;
    paint();
  });

  // ---------- 2. grade pill hover: he digs ----------
  // Delegated rather than bound per pill: app.js replaces the whole of #list on every
  // filter, so listeners attached to a pill would not survive the first search.
  const gradeLine = pill => {
    for (const cls of pill.classList) {
      if (cls.startsWith('v-') && SAY[cls.slice(2)]) return SAY[cls.slice(2)];
    }
    return '';
  };

  // Tracked so that moving the pointer around inside one pill does not restart the dig on
  // every mouseover and freeze it on frame one.
  let digging = null;

  document.addEventListener('mouseover', ev => {
    const pill = ev.target.closest && ev.target.closest('.pill.v');
    if (!pill || pill === digging || S.mode === 'shrug') return;
    digging = pill;
    setMode('dig');
    speak(gradeLine(pill), 0);
  });

  document.addEventListener('mouseout', ev => {
    const pill = ev.target.closest && ev.target.closest('.pill.v');
    if (!pill || pill !== digging) return;
    digging = null;
    if (S.mode !== 'dig') return;
    setMode('idle');
    speak('', 0);
  });

  // ---------- 3. caveats open: he peeks ----------
  // Capture phase, because `toggle` does not bubble. Scoped to a card so the account menu
  // in the masthead, which is also a <details>, does not summon a badger.
  document.addEventListener('toggle', ev => {
    const d = ev.target;
    if (!d || d.tagName !== 'DETAILS' || !d.closest('.entry')) return;
    if (d.open) {
      // Cleared before the move so the rise animates again on the next card rather than
      // arriving already up.
      peek.classList.remove('is-up');
      d.appendChild(peek);
      requestAnimationFrame(() => peek.classList.add('is-up'));
      speak('small print.', 2200);
    } else if (peek.parentNode === d) {
      peek.classList.remove('is-up');
    }
  }, true);

  // ---------- 4. nothing found: he shrugs ----------
  // Watching for the empty state app.js renders, rather than re-implementing the filter.
  // render() rewrites #list wholesale, so the outcome is the only thing worth reading, and
  // this stays correct through the first-paint adopt path and the deferred data fetch.
  const list = document.getElementById('list');
  if (list) {
    new MutationObserver(() => {
      // A pill hovered at the moment the list is rewritten never gets its mouseout, since
      // the element it would have fired on is gone. Without this the dig holds forever.
      if (digging && !digging.isConnected) {
        digging = null;
        if (S.mode === 'dig') {
          setMode('idle');
          speak('', 0);
        }
      }
      const empty = Boolean(list.querySelector('.empty'));
      if (empty && S.mode !== 'shrug') {
        setMode('shrug');
        speak('nothing.', 0);
      } else if (!empty && S.mode === 'shrug') {
        setMode('idle');
        speak('', 0);
      }
    }).observe(list, { childList: true });
  }

  // ---------- start ----------
  measure();
  lastTop = scrollY;
  S.x = progress() * track;
  paint();
  startClock();
  // Decode the second idle frame up front so the first blink is not a flash of nothing.
  SPRITES.idle.forEach(name => { new Image().src = SRC(name); });
})();
