/**
 * Authored prose → HTML, with glossary terms wrapped at authoring time.
 *
 * Spec §8: "Every technical term in any prose gets wrapped at authoring time."
 * The wrapping syntax is deliberately tiny, because prose lives in JSON and a
 * full Markdown pipeline would be more machinery than the content needs:
 *
 *   [[tawhid]]              the term, rendered as its glossary headword
 *   [[quran|the Quran]]     the term, rendered as different display text
 *
 * A wrapped term whose record is absent from the build — because it has not
 * been source-checked yet — degrades to plain text rather than a dead control.
 * The reader loses the card, never the sentence.
 *
 * Pure and DOM-free: runs at build time, and the same escaping rules apply to
 * the client-side search index.
 */

const REF = /\[\[([a-z0-9]+(?:-[a-z0-9]+)*)(?:\|([^\]]+))?\]\]/g;

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Every glossary id a body of prose references. Used by the validator. */
export function glossaryRefs(body: string): string[] {
  const out = new Set<string>();
  for (const match of body.matchAll(REF)) {
    const id = match[1];
    if (id !== undefined) out.add(id);
  }
  return [...out];
}

/** The prose with its wrapping markers removed, for search indexing and alt text. */
export function stripMarkup(body: string): string {
  return body.replace(REF, (_m, id: string, display?: string) => display ?? id);
}

export interface RenderOptions {
  /**
   * Glossary ids present in this build. A reference to anything else renders
   * as plain text — see the note above about degrading gracefully.
   */
  readonly available: ReadonlySet<string>;
}

/**
 * Renders one prose block. Paragraphs split on blank lines; everything is
 * escaped before any markup is introduced, so authored content can never
 * inject HTML.
 */
export function renderProse(body: string, options: RenderOptions): string {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
    .map((paragraph) => {
      /* Escape first, then substitute. The reference syntax survives escaping
         because it contains no HTML-special characters. */
      const escaped = escapeHtml(paragraph);
      const withTerms = escaped.replace(REF, (_match, id: string, display?: string) => {
        const text = display ?? id;
        if (!options.available.has(id)) return text;
        return (
          `<button type="button" class="gloss" data-term="${id}"` +
          ` aria-describedby="glossary-card">${text}</button>`
        );
      });
      return `<p>${withTerms}</p>`;
    })
    .join('\n');
}
