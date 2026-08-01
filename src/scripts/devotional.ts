/**
 * The Devotional frame's switch.
 *
 * Off by default, remembered by the coach's pattern, and never load-bearing:
 * with storage refused the frame is simply off, which is the default anyway.
 * The marks it shows are already in the DOM — this only sets an attribute, so
 * nothing here can alter a word of sourced text.
 */

import { DEVOTIONAL_KEY } from '../lib/devotional';

const boxes = document.querySelectorAll<HTMLInputElement>('[data-devotional]');

if (boxes.length > 0) {
  const read = (): boolean => {
    try {
      return localStorage.getItem(DEVOTIONAL_KEY) === 'on';
    } catch {
      return false;
    }
  };

  /*
    The state attribute and the control must not share a name. `data-devotional`
    on the root and `data-devotional` on the checkbox both answer
    `querySelector('[data-devotional]')`, and the root wins on document order —
    so anything reaching for "the toggle" got the html element instead. The
    control keeps the short name; the state says what it is.
  */
  const apply = (on: boolean, remember: boolean): void => {
    if (on) document.documentElement.dataset['devotionalFrame'] = 'on';
    else delete document.documentElement.dataset['devotionalFrame'];
    for (const box of boxes) box.checked = on;
    if (!remember) return;
    try {
      localStorage.setItem(DEVOTIONAL_KEY, on ? 'on' : 'off');
    } catch {
      /* nothing to remember it with; the choice still holds for this page */
    }
  };

  for (const box of boxes) {
    box.addEventListener('change', () => apply(box.checked, true));
  }

  apply(read(), false);
}
