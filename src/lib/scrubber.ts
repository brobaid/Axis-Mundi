/**
 * Shared behaviour for the era scrubber, which the map and the tree both mount.
 *
 * The rail is a horizontal scroll container: twelve detents from 500 BCE to
 * 2020 do not fit in 390px, and squeezing them until they do would put the
 * labels below the type scale's floor. Scrolling is the right answer — but a
 * scrolling rail has to keep the selected detent in the frame, or a phone
 * lands on /map with the current era off the right edge and the reader has no
 * way to know which era they are looking at.
 */

/**
 * Bring `btn` into the rail's frame if it is not already there.
 *
 * Scrolls the rail only — never `scrollIntoView`, which would walk up to the
 * document and yank the whole page sideways to reach a detent. Movement is
 * instant rather than smooth: this fires on first paint and on every arrow
 * key, where a 300ms glide lags behind a held key and reads as drift.
 */
export function revealDetent(rail: HTMLElement, btn: HTMLElement | null): void {
  if (btn === null) return;

  const railBox = rail.getBoundingClientRect();
  const btnBox = btn.getBoundingClientRect();

  /* A detent sitting flush against the edge looks like the end of the rail.
     Leave a detent's width of room so the reader can see there is more. */
  const margin = btnBox.width;

  if (btnBox.right > railBox.right - margin) {
    rail.scrollLeft += btnBox.right - railBox.right + margin;
  } else if (btnBox.left < railBox.left + margin) {
    rail.scrollLeft -= railBox.left - btnBox.left + margin;
  }
}
