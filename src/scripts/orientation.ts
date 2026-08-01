/**
 * The entrance hall's first-visit orientation.
 *
 * Shown once, then never. Same rule as the timeline's coach: this is not a
 * reading path, so the design language's ban on browser storage does not reach
 * it — and everything the card says is true of the museum whether or not it
 * ever appeared. Storage refused means it greets each visit, which is a smaller
 * cost than an entrance that will not load because a browser said no to a key.
 */

const KEY = 'axis-mundi-orientation';
const orient = document.querySelector<HTMLElement>('[data-orient]');

if (orient !== null) {
  let seen = false;
  try {
    seen = localStorage.getItem(KEY) === 'seen';
  } catch {
    /* storage unavailable; show it */
  }

  if (!seen) {
    orient.hidden = false;
    orient.querySelector<HTMLButtonElement>('[data-orient-dismiss]')?.focus();
  }

  const dismiss = (): void => {
    orient.hidden = true;
    try {
      localStorage.setItem(KEY, 'seen');
    } catch {
      /* nothing to remember it with; it will greet them again */
    }
  };

  /* A door dismisses it too: following one is the most complete answer to
     "have you read this" there is, and coming back to it would be a scold. */
  orient.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('[data-orient-dismiss]') || t.closest('a') || t === orient) dismiss();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !orient.hidden) dismiss();
  });
}
