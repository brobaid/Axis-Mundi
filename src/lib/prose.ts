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
  /**
   * Headwords to match automatically, where no author wrapped anything.
   * Omitted means authored references only.
   */
  readonly autoTerms?: readonly AutoTerm[];
}

/* ── automatic matching ─────────────────────────────────────────────────── */

export interface AutoTerm {
  readonly id: string;
  readonly term: string;
  readonly traditions: readonly string[];
}

/**
 * The headwords that may match inside prose belonging to `traditions`.
 *
 * Without this guard the matcher offers the wrong card: "theology of grace" in
 * a Shaiva Siddhanta record matched Grace, whose definition is about the
 * Reformation, and a Jain cell's "Tattvartha Sutra" matched a headword defined
 * for Buddhist and Hindu usage. A term is only a technical term inside the
 * traditions that hold it as one; everywhere else it is an ordinary word.
 *
 * Prose with no tradition — a general note — matches nothing rather than
 * everything, since there is no context to be right about.
 */
export function termsFor(
  traditions: readonly string[],
  terms: readonly AutoTerm[],
): AutoTerm[] {
  if (traditions.length === 0) return [];
  const held = new Set(traditions);
  return terms.filter((t) => t.traditions.some((x) => held.has(x)));
}

/**
 * A term short enough that a case-insensitive match is a liability.
 *
 * "Li" and "Qi" and "Ren" are ordinary syllables in transliterated names, and
 * "Zen" opens a hundred English adjectives. At this length the capital is the
 * only signal that the word is being used as the technical term, so it is
 * required. Longer headwords match either way.
 */
const SHORT = 3;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Wrap the first occurrence of each glossary headword in a body of text.
 *
 * Spec §8 asks that every technical term in prose be wrapped. Four hundred
 * event summaries and a hundred and thirty matrix nuances arrived from the
 * owner without markers, and hand-marking them would mean editing his prose;
 * matching instead leaves every authored character untouched.
 *
 * First occurrence only. A term repeated four times in a paragraph does not
 * need four dashed underlines — the second one stops being an offer and starts
 * being noise.
 *
 * The input must already be HTML-escaped and must contain no tags: this walks
 * plain text and would happily match a headword inside an attribute otherwise.
 */
export function autoLink(escaped: string, terms: readonly AutoTerm[]): string {
  /* Every match is found against the untouched input, then spliced in one
     pass. Wrapping as we go would let a later headword match inside markup an
     earlier one just inserted — `data-term="…"` is text like any other to a
     regex. */
  const hits: { start: number; end: number; id: string }[] = [];

  for (const { id, term } of terms) {
    /* Not \b: it treats a hyphen as a boundary, so "wei" would match inside
       "Wu-wei" and "Yin" inside "Yin-yang". */
    const flags = term.length <= SHORT ? '' : 'i';
    const re = new RegExp(`(?<![\\w-])${escapeRe(term)}(?![\\w-])`, flags);
    const match = re.exec(escaped);
    if (match !== null) hits.push({ start: match.index, end: match.index + match[0].length, id });
  }

  if (hits.length === 0) return escaped;
  hits.sort((a, b) => a.start - b.start || b.end - a.end);

  let out = '';
  let cursor = 0;
  for (const hit of hits) {
    /* Longer headwords sort first at a shared start, so a shorter one nested
       inside a claimed span is simply skipped. */
    if (hit.start < cursor) continue;
    out +=
      escaped.slice(cursor, hit.start) +
      `<button type="button" class="gloss" data-term="${hit.id}" aria-describedby="glossary-card">` +
      escaped.slice(hit.start, hit.end) +
      `</button>`;
    cursor = hit.end;
  }
  return out + escaped.slice(cursor);
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

      /* Authored references win, and they are lifted out before matching runs
         so a headword can never be matched inside one — an author who wrote
         [[karma|its fruits]] chose that display text, and the matcher has no
         business reopening the decision. */
      const authored: string[] = [];
      const masked = escaped.replace(REF, (_match, id: string, display?: string) => {
        const text = display ?? id;
        const html = options.available.has(id)
          ? `<button type="button" class="gloss" data-term="${id}"` +
            ` aria-describedby="glossary-card">${text}</button>`
          : text;
        authored.push(html);
        /* Angle-bracketed, because escapeHtml has already turned every real
           "<" into "&lt;" — so this shape cannot occur in the input. A bare
           index would collide with prose: "the 5 pillars" is full of numerals. */
        return `<${authored.length - 1}>`;
      });

      const linked =
        options.autoTerms === undefined ? masked : autoLink(masked, options.autoTerms);

      /* Restores after matching. Nothing autoLink inserts looks like <digits>,
         so the button markup passes through untouched. */
      const withTerms = linked.replace(
        /<(\d+)>/g,
        (_m, n: string) => authored[Number(n)] ?? '',
      );
      return `<p>${withTerms}</p>`;
    })
    .join('\n');
}
