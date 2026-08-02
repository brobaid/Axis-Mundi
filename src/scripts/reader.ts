/**
 * The Reading Room's island — Phase 5.
 *
 * Four small things, none of which reading depends on. The text is
 * server-rendered in every edition the work carries, the mode is a CSS switch,
 * and every verse is a plain anchor at a plain address, so if this file never
 * loads — or storage is refused — the page still shows the work's own default
 * column and every link still works.
 *
 * That is the design language's ban on browser storage for core reading paths,
 * kept honestly: storage here buys a convenience and is never load-bearing.
 */

import {
  POSITION_KEY,
  parsePositions,
  refFor,
  withPosition,
  type Position,
} from '../lib/reading-position';

const MODE_KEY = 'axis-mundi-reading-mode';
const MODES = ['english', 'original', 'both'] as const;
type Mode = (typeof MODES)[number];

const toggle = document.querySelector<HTMLElement>('[data-reader-toggle]');
const verses = document.querySelector<HTMLElement>('.rd-verses');

if (toggle !== null && verses !== null) {
  const buttons = [...toggle.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  const offered = (verses.dataset['modes'] ?? '').split(' ').filter(Boolean);
  const fallback = (verses.dataset['default'] ?? 'english') as Mode;

  /** The stored preference, but only if this work can honour it. */
  function current(): Mode {
    const attr = document.documentElement.dataset['readingMode'];
    const hit = MODES.find((m) => m === attr && offered.includes(m));
    return hit ?? fallback;
  }

  function apply(mode: Mode): void {
    document.documentElement.dataset['readingMode'] = mode;
    for (const b of buttons) {
      const on = b.dataset['mode'] === mode;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* nothing to remember it with; the choice still holds for this page */
    }
  }

  for (const b of buttons) {
    b.addEventListener('click', () => {
      const mode = MODES.find((m) => m === b.dataset['mode']);
      if (mode !== undefined) apply(mode);
    });
  }

  /* Arrows step the choices, matching every other radiogroup in the museum. */
  toggle.addEventListener('keydown', (ev) => {
    const key = ev.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;
    ev.preventDefault();
    const order = buttons.map((b) => b.dataset['mode'] as Mode);
    const i = order.indexOf(current());
    const next =
      key === 'Home' ? 0
      : key === 'End' ? order.length - 1
      : key === 'ArrowLeft' || key === 'ArrowUp' ? Math.max(0, i - 1)
      : Math.min(order.length - 1, i + 1);
    const mode = order[next];
    if (mode === undefined) return;
    apply(mode);
    buttons[next]?.focus();
  });

  /* The button state has to agree with the attribute the head script set. */
  apply(current());
}

/**
 * The jump control.
 *
 * A native select, so it is a real control on every device, and it only ever
 * navigates — the contents page beside it does the same job without any of
 * this, which is why the select can fail silently. Each option carries its own
 * full address, because what it jumps between differs by page: books on a
 * book, chapters inside one.
 */
const jump = document.querySelector<HTMLSelectElement>('[data-reader-jump]');
if (jump !== null) {
  jump.addEventListener('change', () => {
    if (jump.value !== '') location.href = jump.value;
  });
}

/*
  Go to a numbered division, by number.

  A static host cannot turn a form submission into a path, so this is where the
  typed number becomes one. The form's own action is the work's contents page,
  which is where a submit lands if scripting never runs — the wrong page but not
  a broken one, and every division is listed there.
*/
const goto = document.querySelector<HTMLFormElement>('[data-reader-goto]');
if (goto !== null) {
  goto.addEventListener('submit', (event) => {
    const work = goto.dataset['readerGoto'];
    const max = Number(goto.dataset['max'] ?? 0);
    const field = goto.querySelector<HTMLInputElement>('input[type="number"]');
    const n = Number(field?.value ?? '');
    if (work === undefined || !Number.isInteger(n) || n < 1 || n > max) return;
    event.preventDefault();
    location.href = `/read/${work}/${n}`;
  });
}

/* ── the reader itself ──────────────────────────────────────────────────── */

const reader = document.querySelector<HTMLElement>('[data-reader]');
const work = reader?.dataset['work'];
const divisionSlug = reader?.dataset['division'];
const heading = reader?.dataset['heading'] ?? '';

if (reader !== undefined && reader !== null && work !== undefined && divisionSlug !== undefined) {
  const anchorOf = (verse: Element): string => verse.id;

  /* ── copy a link to a verse ───────────────────────────────────────────── */

  /*
    One control, moved, rather than one per verse: Psalms is two and a half
    thousand verses, and a button apiece would be five thousand nodes bought
    for a thing a reader does once. It lands in whichever verse the fragment
    names — which is the verse whose numeral was just clicked — so the control
    is always exactly where the reader's attention already is.

    Without the clipboard API there is no button at all. The address bar
    already holds the link the button would have copied.
  */
  if (navigator.clipboard !== undefined) {
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'rd-copy';
    const label = document.createElement('span');
    label.textContent = 'Copy link';
    copy.append(label);

    let restore: ReturnType<typeof setTimeout> | undefined;

    const place = (): void => {
      const target = document.querySelector<HTMLElement>('.rd-verse:target');
      if (target === null) {
        copy.remove();
        return;
      }
      const ref = refFor(heading, anchorOf(target));
      copy.setAttribute('aria-label', `Copy a link to ${ref}`);
      label.textContent = 'Copy link';
      copy.dataset['state'] = 'ready';
      target.append(copy);
    };

    copy.addEventListener('click', () => {
      void navigator.clipboard.writeText(location.href).then(
        () => {
          /* The confirmation is the label, not a toast: it is already where
             the reader is looking, and it cannot cover the text. */
          label.textContent = 'Link copied';
          copy.dataset['state'] = 'done';
          clearTimeout(restore);
          restore = setTimeout(() => {
            label.textContent = 'Copy link';
            copy.dataset['state'] = 'ready';
          }, 2400);
        },
        () => {
          label.textContent = 'Press to select, then copy';
          copy.dataset['state'] = 'failed';
        },
      );
    });

    place();
    window.addEventListener('hashchange', place);
  }

  /* ── where the reader left off ────────────────────────────────────────── */

  const readStored = (): Position | undefined => {
    try {
      return parsePositions(localStorage.getItem(POSITION_KEY))[work];
    } catch {
      return undefined;
    }
  };

  /*
    The marker shows the previous visit's position, captured before this
    visit's tracking overwrites it. A marker that followed the reader down the
    page would be a scroll indicator, which the scrollbar already is.
  */
  const previous = readStored();
  if (
    previous !== undefined &&
    previous.division === divisionSlug &&
    location.hash === ''
  ) {
    const verse = document.getElementById(previous.anchor);
    if (verse !== null) {
      verse.classList.add('rd-verse--mark');
      const note = document.createElement('p');
      note.className = 'rd-verse__mark caption';
      note.textContent = 'Where you left off';
      verse.prepend(note);
      /* Not scrolled to: the browser restores its own scroll on a back
         navigation, and fighting it would land a reader somewhere neither of
         them chose. The marker is there when they reach it. */
    }
  }

  /*
    Tracking. elementFromPoint answers "which verse is here" in constant time;
    an observer over twenty-three thousand verses would not.

    A third of the way down, not just under the header. Measured: probing at a
    fixed 160px recorded Exodus 20:2 for a reader who had followed a link to
    20:3, because an anchored verse rests below the sticky header rather than
    against it. A viewport fraction is also the better answer to "what is being
    read" — that is the middle of a screen, not its top edge.
  */
  const rows = document.querySelectorAll('.rd-verse');
  if (rows.length > 0) {
    let queued = false;
    const remember = (): void => {
      queued = false;
      const probe = document.elementFromPoint(
        Math.round(window.innerWidth / 2),
        Math.round(window.innerHeight / 3),
      );
      const verse = probe?.closest<HTMLElement>('.rd-verse');
      if (verse === null || verse === undefined || verse.id === '') return;
      const position: Position = {
        division: divisionSlug,
        anchor: verse.id,
        ref: refFor(heading, verse.id),
      };
      try {
        const all = withPosition(parsePositions(localStorage.getItem(POSITION_KEY)), work, position);
        localStorage.setItem(POSITION_KEY, JSON.stringify(all));
      } catch {
        /* storage refused or full; the reader simply is not offered a resume */
      }
    };
    window.addEventListener(
      'scroll',
      () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(remember);
      },
      { passive: true },
    );
    remember();
  }
}

/* ── the resume offer, on the library and on a contents page ────────────── */

/*
  Rendered empty and filled in here, so a reader with no stored position — or
  no storage — sees nothing rather than an offer that goes nowhere.
*/
for (const slot of document.querySelectorAll<HTMLElement>('[data-resume]')) {
  const id = slot.dataset['resume'];
  if (id === undefined || id === '') continue;
  let position: Position | undefined;
  try {
    position = parsePositions(localStorage.getItem(POSITION_KEY))[id];
  } catch {
    continue;
  }
  if (position === undefined) continue;

  const link = slot.querySelector<HTMLAnchorElement>('.rd-resume__link');
  if (link === null) continue;
  link.href = `/read/${id}/${position.division}#${position.anchor}`;
  link.textContent = `Continue at ${position.ref}`;
  slot.hidden = false;
}
