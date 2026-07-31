/**
 * Client-side control for the shared detail panel.
 *
 * Both canvases drive the same element: the timeline's event panel and the
 * map's realm card differ only in what they put inside it. Opening never moves
 * the canvas underneath, and closing returns focus to whatever opened it —
 * "preserving canvas position" in both senses.
 */

export interface PanelHooks {
  /** Called after the panel closes, so a surface can clear its own state. */
  readonly onClose?: () => void;
}

export interface PanelController {
  open(html: string, trigger?: HTMLElement | null): void;
  close(): void;
  readonly isOpen: boolean;
}

export function createPanel(hooks: PanelHooks = {}): PanelController | null {
  const panel = document.querySelector<HTMLElement>('[data-panel]');
  const scrim = document.querySelector<HTMLElement>('[data-panel-scrim]');
  const body = panel?.querySelector<HTMLElement>('[data-panel-body]');
  if (panel === null || body === null || body === undefined) return null;

  let lastTrigger: HTMLElement | null = null;

  const controller: PanelController = {
    get isOpen(): boolean {
      return !panel.hidden;
    },

    open(html: string, trigger?: HTMLElement | null): void {
      body.innerHTML = html;
      panel.hidden = false;
      scrim?.removeAttribute('hidden');
      lastTrigger = trigger ?? null;
      panel.querySelector<HTMLButtonElement>('[data-panel-close]')?.focus();
    },

    close(): void {
      if (panel.hidden) return;
      panel.hidden = true;
      scrim?.setAttribute('hidden', '');
      const trigger = lastTrigger;
      lastTrigger = null;
      hooks.onClose?.();
      trigger?.focus();
    },
  };

  document.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement;
    if (target.closest('[data-panel-close]') || target.closest('[data-panel-scrim]')) {
      controller.close();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') controller.close();
  });

  return controller;
}

/** Escapes text for insertion into the panel. Shared with the other renderers. */
export { esc } from './escape';
