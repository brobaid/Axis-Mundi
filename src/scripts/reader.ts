/**
 * The Reading Room's island — Phase 5.
 *
 * Two controls and nothing else. The text is server-rendered in every edition
 * the work carries, and the mode is a CSS switch, so reading never waits on
 * this file and never depends on storage: if it fails to load, or storage is
 * refused, the page still shows the work's own default column.
 */

const KEY = 'axis-mundi-reading-mode';
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
      localStorage.setItem(KEY, mode);
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
 * this, which is why the select can fail silently.
 */
const jump = document.querySelector<HTMLSelectElement>('[data-reader-jump]');
if (jump !== null) {
  jump.addEventListener('change', () => {
    const work = jump.dataset['work'];
    if (work === undefined || jump.value === '') return;
    location.href = `/read/${work}/${jump.value}`;
  });
}
