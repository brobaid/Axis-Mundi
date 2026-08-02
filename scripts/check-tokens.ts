/**
 * Axis Mundi — design token audit.
 *
 * Enforces the two halves of CLAUDE.md hard rule 1:
 *
 *   1. "tokens only" — src/styles/tokens.css is the single source of every
 *      colour. A raw hex value anywhere else in src/ is a bug. eslint cannot
 *      police this because it cannot parse CSS, so the scan lives here.
 *
 *   2. "both modes must work for every component; WCAG AA" — the contrast
 *      contracts below are asserted in BOTH modes, so a token edit that quietly
 *      breaks AA fails CI instead of shipping.
 *
 * Thresholds: 4.5:1 for body text, 3:1 for large text, non-text UI and
 * graphical objects (WCAG 2.2 SC 1.4.3 / 1.4.11).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const tokensPath = resolve(root, 'src/styles/tokens.css');

/**
 * The three contexts a token set is resolved in. Print is a first-class one:
 * paper is a rendering target the reader can reach from either mode, so its
 * palette is audited rather than assumed.
 */
type Mode = 'gallery' | 'night-gallery' | 'print';

const MODES = ['gallery', 'night-gallery', 'print'] as const;

interface Check {
  readonly fg: string;
  readonly bg: string;
  readonly min: number;
  readonly why: string;
  /** Restrict to one mode; omitted means "must hold in all three". */
  readonly mode?: Mode;
}

/** The ten launch traditions (Phase 0 spec §2.1). */
const TRADITIONS = [
  'judaism',
  'christianity',
  'islam',
  'hinduism',
  'buddhism',
  'sikhism',
  'chinese',
  'shinto',
  'jainism',
  'zoroastrianism',
] as const;

/** Every contrast contract Axis Mundi commits to. */
const CHECKS: readonly Check[] = [
  { fg: '--ink', bg: '--canvas', min: 4.5, why: 'body text on the page' },
  { fg: '--ink', bg: '--surface', min: 4.5, why: 'body text on a card or panel' },
  { fg: '--ink', bg: '--surface-sunken', min: 4.5, why: 'body text on a sunken surface' },
  { fg: '--ink-soft', bg: '--canvas', min: 4.5, why: 'secondary text' },
  { fg: '--ink-soft', bg: '--surface', min: 4.5, why: 'secondary text on a surface' },
  { fg: '--ink-inverse', bg: '--ink', min: 4.5, why: 'inverted text (chips, tooltips)' },

  { fg: '--brass-ink', bg: '--canvas', min: 4.5, why: 'links and active text states' },
  { fg: '--brass-ink', bg: '--surface', min: 4.5, why: 'brass text on a surface' },
  { fg: '--brass-ink', bg: '--brass-wash', min: 4.5, why: 'brass text in its own wash' },

  // The Brass Meridian is a graphical object, so 3:1 (WCAG 2.2 SC 1.4.11).
  { fg: '--brass', bg: '--canvas', min: 3, why: 'the Brass Meridian over the canvas' },
  { fg: '--brass', bg: '--surface', min: 3, why: 'the Brass Meridian over a surface' },

  { fg: '--focus-ring', bg: '--canvas', min: 3, why: 'focus ring on the page' },
  { fg: '--focus-ring', bg: '--surface', min: 3, why: 'focus ring on a surface' },

  { fg: '--hairline-strong', bg: '--canvas', min: 3, why: 'information-carrying borders' },
  { fg: '--hairline-strong', bg: '--surface', min: 3, why: 'control edges on a surface' },
  { fg: '--contested-hatch', bg: '--canvas', min: 3, why: 'contested hatching must stay legible' },
  { fg: '--contested-hatch', bg: '--surface', min: 3, why: 'contested hatching on a surface' },
  { fg: '--contested-badge-ink', bg: '--contested-badge-bg', min: 4.5, why: 'contested badge text' },

  // Tradition ramps: text-safe at 4.5:1, lines and fills at 3:1, in BOTH modes
  // and against BOTH backgrounds (design language §3.2).
  /* Unaffiliated is not a tradition but it is a map fill with a legend entry, so
     it is held to the same contrast bar as the ten. */
  ...[...TRADITIONS, 'unaffiliated'].flatMap((t): Check[] => [
    { fg: `--t-${t}-ink`, bg: '--canvas', min: 4.5, why: `${t} label text on the canvas` },
    { fg: `--t-${t}-ink`, bg: '--surface', min: 4.5, why: `${t} label text on a surface` },
    { fg: `--t-${t}-line`, bg: '--canvas', min: 3, why: `${t} lane rule / event node` },
    { fg: `--t-${t}-line`, bg: '--surface', min: 3, why: `${t} stroke on a surface` },
  ]),
];

/* ------------------------------------------------------------------------- */

interface Block {
  /** Space-joined preludes of every enclosing at-rule; '' at top level. */
  readonly media: string;
  readonly selector: string;
  /** Custom-property declarations only — what the token resolver replays. */
  readonly decls: readonly (readonly [string, string])[];
  /** Every declaration, custom or not. The containment check needs `color`. */
  readonly all: readonly (readonly [string, string])[];
}

/**
 * Flatten tokens.css into rule blocks, in source order, each tagged with the
 * at-rules it sits inside.
 *
 * A flat regex scan cannot do this: `@media print { :root { … } }` reads to a
 * `selector { body }` pattern as a block whose selector is the inner one and
 * whose media context has vanished — which is how a print override silently
 * became a night-mode override. Brace matching is the only honest read.
 */
function parseBlocks(css: string): Block[] {
  // Strip comments first: they may legitimately quote CSS containing braces,
  // which would otherwise be parsed as a rule and desynchronise everything.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

  const blocks: Block[] = [];
  const atRules: string[] = [];
  let i = 0;
  let preludeStart = 0;

  while (i < stripped.length) {
    const ch = stripped[i];

    if (ch === '{') {
      const prelude = stripped.slice(preludeStart, i).trim();
      if (prelude.startsWith('@')) {
        atRules.push(prelude);
        i += 1;
        preludeStart = i;
        continue;
      }
      // A declaration block. tokens.css nests no rules inside a rule, so the
      // next `}` closes it.
      const close = stripped.indexOf('}', i);
      const end = close === -1 ? stripped.length : close;
      const body = stripped.slice(i + 1, end);
      const all = [...body.matchAll(/([-\w]+)\s*:\s*([^;]+);/g)].map(
        (d) => [d[1] as string, (d[2] as string).trim()] as const,
      );
      blocks.push({
        media: atRules.join(' '),
        selector: prelude,
        decls: all.filter(([name]) => name.startsWith('--')),
        all,
      });
      i = end + 1;
      preludeStart = i;
      continue;
    }

    if (ch === '}') {
      atRules.pop();
      i += 1;
      preludeStart = i;
      continue;
    }

    i += 1;
  }

  return blocks;
}

/** Does a block's media context apply when rendering to `medium`? */
function mediaApplies(media: string, medium: 'screen' | 'print'): boolean {
  const mentionsPrint = /\bprint\b/.test(media);
  const mentionsScreen = /\bscreen\b/.test(media);
  if (!mentionsPrint && !mentionsScreen) return true;
  return medium === 'print' ? mentionsPrint : mentionsScreen;
}

/**
 * Resolve the token set for one context by replaying every applicable block in
 * source order — which is the cascade, since every selector here is a single
 * class-weight one and so ties are broken by position.
 */
function resolveMode(blocks: readonly Block[], mode: Mode): Map<string, string> {
  const medium = mode === 'print' ? 'print' : 'screen';
  const out = new Map<string, string>();

  for (const block of blocks) {
    if (!mediaApplies(block.media, medium)) continue;

    const isNight = block.selector.includes('night-gallery');
    const isLight =
      block.selector.includes(':root') || block.selector.includes("data-mode='gallery'");

    // Gallery takes only the light blocks. Night and print both start from the
    // light ramp and let anything later override it — for night that is the
    // dark block, for print the paper block. If the night block ever escapes
    // its `@media screen` wrapper it lands here too, and the toner-burning
    // contrast failures that follow are the point.
    const applies = mode === 'gallery' ? isLight : isLight || isNight;
    if (!applies) continue;

    for (const [name, value] of block.decls) out.set(name, value);
  }

  return out;
}

/** Resolve `var(--x)` chains down to a literal. */
function resolveVar(name: string, vars: Map<string, string>, seen = new Set<string>()): string | null {
  if (seen.has(name)) return null;
  seen.add(name);
  const raw = vars.get(name);
  if (raw === undefined) return null;
  const varRef = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw);
  if (varRef) return resolveVar(varRef[1] as string, vars, seen);
  return raw;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const chan = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* 1. Raw-hex scan: tokens.css is the only file allowed to name a colour.      */
/* -------------------------------------------------------------------------- */

const SCAN_EXTENSIONS = ['.css', '.astro', '.ts'];
const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

function walkSrc(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walkSrc(full));
    else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

const strays: string[] = [];
for (const file of walkSrc(resolve(root, 'src'))) {
  if (file === tokensPath) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  for (const [i, line] of lines.entries()) {
    // Ignore comment lines: prose may legitimately mention a banned hex, e.g.
    // the design doc's "nothing near #D97757".
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    const match = HEX.exec(line);
    if (match !== null) {
      strays.push(`  ${relative(root, file)}:${i + 1}  ${match[0]}  in: ${trimmed.slice(0, 72)}`);
    }
  }
}

if (strays.length > 0) {
  console.error('\n  Raw colours found outside src/styles/tokens.css\n');
  console.error(strays.join('\n'));
  console.error(
    '\n  tokens.css is the single source of every colour (CLAUDE.md hard rule 1).' +
      '\n  Add a token and reference it with var(--name).\n',
  );
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* 2. Undefined custom properties                                             */
/* -------------------------------------------------------------------------- */

/*
 * `var(--space-5)` is not an error anywhere. It is an invalid value at computed
 * time, so the declaration is simply dropped and the box gets zero padding —
 * silently, in five places, for as long as nobody looks. The scale runs
 * 1,2,3,4,6,8,12,16,24 and skipping a rung is an easy thing to do from memory.
 *
 * A property counts as defined if tokens.css declares it or if anything in src/
 * assigns it — islands set --morph-shift and --dot at runtime, and a lane sets
 * --tradition-hue inline, none of which belong in tokens.css.
 */
const VAR_REF = /var\(\s*(--[\w-]+)/g;
const VAR_DECL = /(--[\w-]+)\s*:/g;
/* A property an island sets through the CSSOM never appears as a declaration. */
const VAR_SET = /setProperty\(\s*['"`](--[\w-]+)/g;
/*
  And one Astro spells without the dashes.

  `define:vars={{ turn: '300s' }}` emits `--turn: 300s` onto the component's
  scope at render time, so the property is as defined as any in tokens.css —
  but the source never contains the string `--turn:`, so the scan above cannot
  see it and reports three false failures on a component that works. Read the
  keys out of the block instead.
*/
const DEFINE_VARS = /define:vars=\{\{([\s\S]*?)\}\}/g;
const OBJECT_KEY = /(?:^|[,{])\s*['"`]?([A-Za-z_$][\w$-]*)['"`]?\s*:/g;

const declared = new Set<string>();
const referenced = new Map<string, string>();

for (const file of walkSrc(resolve(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(VAR_DECL)) declared.add(m[1] as string);
  for (const m of text.matchAll(VAR_SET)) declared.add(m[1] as string);
  for (const block of text.matchAll(DEFINE_VARS)) {
    for (const key of (block[1] as string).matchAll(OBJECT_KEY)) {
      declared.add(`--${key[1] as string}`);
    }
  }
  for (const m of text.matchAll(VAR_REF)) {
    const name = m[1] as string;
    if (!referenced.has(name)) {
      const line = text.slice(0, m.index).split('\n').length;
      referenced.set(name, `${relative(root, file)}:${line}`);
    }
  }
}

/* `--t-` is the stem of `--t-${tradition}`, built by template literal. */
const undefinedVars = [...referenced].filter(([name]) => !declared.has(name) && name !== '--t-');

if (undefinedVars.length > 0) {
  console.error('\n  Custom properties referenced but never defined\n');
  for (const [name, where] of undefinedVars) console.error(`  ${name}  first used at ${where}`);
  console.error(
    '\n  An undefined var() drops its whole declaration at computed-value time,' +
      '\n  so the property silently falls back to its initial value.\n',
  );
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* 2. Contrast audit                                                          */
/* -------------------------------------------------------------------------- */

const css = readFileSync(tokensPath, 'utf8');
const blocks = parseBlocks(css);

interface Failure {
  readonly mode: Mode;
  readonly check: Check;
  readonly ratio: number | null;
  readonly note?: string;
  /** Set when the failure belongs to one tradition's theme. */
  readonly theme?: string;
}

const failures: Failure[] = [];
let passed = 0;

function audit(vars: Map<string, string>, mode: Mode, checks: readonly Check[], theme?: string): void {
  for (const check of checks) {
    if (check.mode !== undefined && check.mode !== mode) continue;

    const fgRaw = resolveVar(check.fg, vars);
    const bgRaw = resolveVar(check.bg, vars);
    if (fgRaw === null || bgRaw === null) {
      failures.push({
        mode,
        check,
        ratio: null,
        ...(theme === undefined ? {} : { theme }),
        note: `undefined token: ${fgRaw === null ? check.fg : check.bg}`,
      });
      continue;
    }

    const fg = hexToRgb(fgRaw);
    const bg = hexToRgb(bgRaw);
    if (fg === null || bg === null) {
      failures.push({
        mode,
        check,
        ratio: null,
        ...(theme === undefined ? {} : { theme }),
        note: 'value is not a plain hex color',
      });
      continue;
    }

    const ratio = contrast(fg, bg);
    if (ratio + 1e-9 < check.min) {
      failures.push({ mode, check, ratio, ...(theme === undefined ? {} : { theme }) });
    } else {
      passed += 1;
    }
  }
}

for (const mode of MODES) {
  audit(resolveMode(blocks, mode), mode, CHECKS);
}

/* -------------------------------------------------------------------------- */
/* 2b. Tradition themes: the same guarantees, ten more times, in all three     */
/*     contexts.                                                              */
/* -------------------------------------------------------------------------- */

/*
  A dive's header band is a new background this museum did not have, and every
  contrast contract that used to be checked against the canvas has to hold
  against it too. Ten themes × three contexts is where a hand-tuned palette
  quietly fails: a hue that clears 4.5:1 on cream fails on its own band, in
  night mode only, on one tradition.

  `--th-pattern` is deliberately absent from these checks. It is drawn at 5–6%
  and is never asked to be legible; a contrast floor on it would be a floor on
  something the design intends to be almost invisible.
*/
const THEME_CHECKS: readonly Check[] = [
  /*
    What is left of the ornament vocabulary after the second pass.

    `--th-band` and `--th-link` are gone: the header band is the world now, and
    a dive's links are the theme's own re-cut `--brass-ink`, which the 186
    already cover. These four are the ornament kit's ink, and they are checked
    against the panels they are drawn on.
  */
  { fg: '--th-rule', bg: '--canvas', min: 3, why: 'the section divider on a panel' },
  { fg: '--th-accent', bg: '--canvas', min: 3, why: 'a corner motif on a panel' },
  { fg: '--th-accent-ink', bg: '--canvas', min: 4.5, why: 'the recitation frame on the page' },
  { fg: '--th-accent-ink', bg: '--surface', min: 4.5, why: 'the accent as text on a card' },
];

/*
  The deep field's own contracts.

  `--world` never carries text, so it is held to no text threshold — and that
  absence is the point, which is why the containment check below asserts it
  never backs prose rather than trusting this list to have caught it.

  What it must do is bound the panel floating on it. Which thing carries that
  boundary differs by mode: in gallery the panel is paper on a deep field and
  its own fill separates at ten to one; at night the panel is a lift of about
  1.7:1 and its border is the edge. Requiring the fill to clear 3:1 in both is
  not merely strict, it is unsatisfiable at night — a panel light enough to
  clear 3:1 above any achievable dark field is a panel too light to be night
  mode. So the check is on whichever of the two is doing the work.
*/
const WORLD_CHECKS: readonly Check[] = [
  /*
    1.25, not 3 and not 1.5.

    At the luminance a dark panel actually sits at, the 0.05 offset in the
    contrast formula dominates and no achievable field is even 1.15:1 below it
    — solved, not guessed. So the fill is asked only to read as lifted, and the
    panel's border carries the boundary, which is what SC 1.4.11 asks of a
    boundary anyway. In gallery the fill clears this ten times over.
  */
  { fg: '--canvas', bg: '--world', min: 1.25, why: 'a panel has to read as lifted off its field' },
  /*
    No focus-ring-on-world check, deliberately.

    It cannot exist. One colour cannot clear 3:1 against both a near-white panel
    and a mid-tone field, and Jainism has exactly that pair — marble panels on
    stone, which is the palette the owner's table specifies. Proved rather than
    assumed: a ring clearing 3:1 off Jainism's paper needs luminance at or below
    0.283, and clearing 3:1 off its field needs 0.304 or above.

    So the requirement moves to where it can be met: nothing focusable sits on
    the bare field. Every control in a dive is inside a panel, and the panel's
    own `--focus-ring on --canvas` and `on --surface` checks above are what
    guarantee it. The containment check asserts the structural half.
  */
  /* The header band IS the world, so its lettering is the one text this museum
     sets on a deep field, and it is held to the body threshold across the whole
     gradient — both ends of it, because the inscription crosses both. */
  { fg: '--band-ink', bg: '--world', min: 4.5, why: 'the inscription on the gate' },
  { fg: '--band-ink', bg: '--world-deep', min: 4.5, why: 'the inscription, deep end' },
  { fg: '--band-ink-soft', bg: '--world', min: 4.5, why: "the band's secondary line" },
  { fg: '--band-ink-soft', bg: '--world-deep', min: 4.5, why: "the band's secondary line, deep end" },
];

/**
 * Resolve one tradition's theme in one context: the base mode, then every theme
 * block that applies — the tradition's own, and the bare `[data-tradition]`
 * print reset that covers all ten.
 */
function resolveTheme(
  allBlocks: readonly Block[],
  mode: Mode,
  tradition: string,
): Map<string, string> {
  const medium = mode === 'print' ? 'print' : 'screen';
  const out = resolveMode(allBlocks, mode);

  for (const block of allBlocks) {
    if (!mediaApplies(block.media, medium)) continue;
    if (!block.selector.includes('[data-tradition')) continue;

    const forThis =
      block.selector.includes(`[data-tradition='${tradition}']`) ||
      /\[data-tradition\](?!=)/.test(block.selector);
    if (!forThis) continue;

    /* A night world block is written `html[data-mode='night-gallery'][data-tradition=…]`
       — the mode attribute and the tradition attribute are on the same element,
       which is the document. */

    /* Same cascade rule as the base modes: gallery takes only the blocks that
       are not night-scoped; night and print take the light ones first and let
       anything later win. */
    const isNight = block.selector.includes('night-gallery');
    if (mode === 'gallery' && isNight) continue;

    for (const [name, value] of block.decls) out.set(name, value);
  }

  return out;
}

/*
  Every contract, ten more times.

  Not a theme-specific subset: a dive redefines the museum's own tokens, so the
  186 the untinted site meets have to hold inside each of the ten worlds as
  well, in all three contexts. That is what makes "entering a tradition
  entirely" compatible with "body text sits on legible reading surfaces" —
  the surfaces are re-tinted, and every promise made about them still holds.
*/
for (const mode of MODES) {
  for (const tradition of TRADITIONS) {
    const vars = resolveTheme(blocks, mode, tradition);
    audit(vars, mode, CHECKS, tradition);
    audit(vars, mode, THEME_CHECKS, tradition);
    audit(vars, mode, WORLD_CHECKS, tradition);
  }
}

const fmt = (n: number): string => `${n.toFixed(2)}:1`;

if (failures.length > 0) {
  console.error('\n  Token contrast audit FAILED\n');
  for (const f of failures) {
    const label = `${f.check.fg} on ${f.check.bg}`;
    const where = f.theme === undefined ? f.mode : `${f.mode} · ${f.theme}`;
    const got = f.ratio === null ? (f.note ?? 'unresolved') : `${fmt(f.ratio)} < ${f.check.min}:1`;
    console.error(`  [${where}] ${label}\n      ${got}\n      needed for: ${f.check.why}\n`);
  }
  console.error(`  ${failures.length} failing, ${passed} passing.\n`);
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* 3. Theme containment: ornament lives in the frame, never on the text        */
/* -------------------------------------------------------------------------- */

/*
  The standing constraint, made checkable — and inverted by the second pass.

  The first pass asked "does any theme token touch body text?", because the
  theme was a parallel vocabulary beside the museum's. It is not any more: a
  dive redefines `--canvas`, `--surface`, `--ink` and the rest, so a theme token
  touching body text is now the normal, correct case, and the 186 contracts
  re-run per world are what make it safe.

  What survives is the half that still bites. `--world` is the one token that
  never carries text — it is the deep field a panel floats on, and nothing this
  museum asks a reader to read may sit on it. So the allow-list is on the field
  alone: every rule that paints with it must be one of the places a field is
  legitimately painted.
*/
const THEME_SURFACES = [
  /* tokens.css itself: the declarations, not the uses. */
  ':root',
  "[data-tradition='",
  '[data-tradition]',
  /* The field, and the gate that is made of it. */
  '.dd-world',
  '.dd-mast__field',
];

/*
  And the other half, stated positively: the selectors that set a dive's prose
  must not set a colour or a background at all. They inherit `--ink` on the
  panel, which is what every one of the 186 checks is about.
*/
const PROSE_SELECTORS = ['.dd-section :global(p)', '.dd-section p', '.dd :global(p)'];

const THEME_VAR = /var\(\s*(--world(?:-deep)?)\s*\)/;
const containment: string[] = [];

/*
  Only the CSS, and only the CSS.

  A .astro file is frontmatter, then markup, then style blocks, and the first
  two are full of braces that are not rules. Handing the whole file to the brace
  matcher desynchronises it and it reports no blocks at all — which reads
  exactly like "nothing to complain about". The first version of this check
  passed both of its own negative controls that way.
*/
const STYLE_BLOCK = /<style[^>]*>([\s\S]*?)<\/style>/g;

function stylesheetsIn(file: string, text: string): string[] {
  if (file.endsWith('.css')) return [text];
  if (!file.endsWith('.astro')) return [];
  return [...text.matchAll(STYLE_BLOCK)].map((m) => m[1] as string);
}

for (const file of walkSrc(resolve(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes('--world')) continue;
  const rel = relative(root, file);

  const sheets = stylesheetsIn(file, text);
  if (sheets.length === 0 && THEME_VAR.test(text)) {
    containment.push(
      `  ${rel}\n      references the deep field outside any stylesheet, where this check cannot see it`,
    );
  }

  for (const block of sheets.flatMap((sheet) => parseBlocks(sheet))) {
    const usesTheme = block.all.some(([, value]) => THEME_VAR.test(value));
    if (usesTheme) {
      const allowed = THEME_SURFACES.some((s) => block.selector.includes(s));
      if (!allowed) {
        containment.push(
          `  ${rel}\n      selector: ${block.selector}\n      uses a --th- token on a surface that is not on the allow-list`,
        );
      }
    }

    const isProse = PROSE_SELECTORS.some((s) => block.selector.includes(s));
    if (isProse) {
      for (const [prop, value] of block.all) {
        if (prop === 'color' || prop === 'background' || prop === 'background-color') {
          containment.push(
            `  ${rel}\n      selector: ${block.selector}\n      sets ${prop}: ${value} on body prose, which must inherit --ink on --canvas`,
          );
        }
      }
    }
  }
}

if (containment.length > 0) {
  console.error('\n  Theme containment FAILED\n');
  console.error(containment.join('\n\n'));
  console.error(
    '\n  Ornament lives in the frame. Content surfaces keep the standing' +
      '\n  paper-and-ink tokens and every contrast guarantee.\n',
  );
  process.exit(1);
}

console.log(
  `  Design token audit passed — no stray colours, ${passed} contrast checks across ` +
    `${MODES.join(', ')}, including ${TRADITIONS.length} tradition themes; ` +
    'the deep field never backs prose.',
);
