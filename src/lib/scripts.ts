/**
 * Script → font token.
 *
 * Written out rather than composed. A token name built by string concatenation
 * from the script id is invisible to the token audit — and rightly so: the
 * audit can only see the names actually written down, which is the whole point
 * of having one. Every value here is a token from tokens.css; a raw family
 * name in this file would be the same bug as a raw hex.
 */
export const SCRIPT_FONT: Readonly<Record<string, string>> = {
  arabic: 'var(--font-arabic)',
  hebrew: 'var(--font-hebrew)',
  devanagari: 'var(--font-devanagari)',
  gurmukhi: 'var(--font-gurmukhi)',
  han: 'var(--font-sc)',
  japanese: 'var(--font-jp)',
  latin: 'var(--font-prose)',
};

/** The font a work's original column is set in, falling back to the prose face. */
export const fontFor = (script: string): string => SCRIPT_FONT[script] ?? 'var(--font-prose)';

/**
 * Scripts whose diacritics sit above and below the line.
 *
 * Naskh with harakat and Hebrew with nikkud both need more leading than the
 * Latin column at the same nominal size, and the vowel points clip against a
 * tight line box before they merely look cramped.
 */
export const POINTED = new Set(['arabic', 'hebrew']);
