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

type Mode = 'gallery' | 'night-gallery';

interface Check {
  readonly fg: string;
  readonly bg: string;
  readonly min: number;
  readonly why: string;
  /** Restrict to one mode; omitted means "must hold in both". */
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

function parseModeBlocks(css: string): Record<Mode, Map<string, string>> {
  const out: Record<Mode, Map<string, string>> = {
    gallery: new Map(),
    'night-gallery': new Map(),
  };

  // `:root` and `:root, [data-mode='gallery']` both seed the light mode; the
  // night block then overrides. Walk declarations in source order.
  // Strip comments first: they may legitimately quote CSS containing braces,
  // which would otherwise be parsed as a rule and desynchronise everything.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // tokens.css has no nested at-rules, so a flat `selector { body }` scan is
  // sufficient. Do NOT anchor on the previous `}` — consuming it would make
  // every second block unmatchable.
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(stripped)) !== null) {
    const selector = (m[1] ?? '').trim();
    const body = m[2] ?? '';
    const decls = [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(
      (d) => [d[1] as string, (d[2] as string).trim()] as const,
    );

    const isNight = selector.includes('night-gallery');
    const isLight = selector.includes(':root') || selector.includes("data-mode='gallery'");

    for (const [name, value] of decls) {
      if (isNight) {
        out['night-gallery'].set(name, value);
      } else if (isLight) {
        out.gallery.set(name, value);
        // Shared primitives in :root apply to night mode too, unless overridden later.
        if (!out['night-gallery'].has(name)) out['night-gallery'].set(name, value);
      }
    }
  }

  // Night mode inherits every :root primitive it did not override.
  for (const [name, value] of out.gallery) {
    if (!out['night-gallery'].has(name)) out['night-gallery'].set(name, value);
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
/* 2. Contrast audit                                                          */
/* -------------------------------------------------------------------------- */

const css = readFileSync(tokensPath, 'utf8');
const modes = parseModeBlocks(css);

interface Failure {
  readonly mode: Mode;
  readonly check: Check;
  readonly ratio: number | null;
  readonly note?: string;
}

const failures: Failure[] = [];
let passed = 0;

for (const mode of ['gallery', 'night-gallery'] as const) {
  const vars = modes[mode];
  for (const check of CHECKS) {
    if (check.mode !== undefined && check.mode !== mode) continue;

    const fgRaw = resolveVar(check.fg, vars);
    const bgRaw = resolveVar(check.bg, vars);
    if (fgRaw === null || bgRaw === null) {
      failures.push({
        mode,
        check,
        ratio: null,
        note: `undefined token: ${fgRaw === null ? check.fg : check.bg}`,
      });
      continue;
    }

    const fg = hexToRgb(fgRaw);
    const bg = hexToRgb(bgRaw);
    if (fg === null || bg === null) {
      failures.push({ mode, check, ratio: null, note: 'value is not a plain hex color' });
      continue;
    }

    const ratio = contrast(fg, bg);
    if (ratio + 1e-9 < check.min) {
      failures.push({ mode, check, ratio });
    } else {
      passed += 1;
    }
  }
}

const fmt = (n: number): string => `${n.toFixed(2)}:1`;

if (failures.length > 0) {
  console.error('\n  Token contrast audit FAILED\n');
  for (const f of failures) {
    const label = `${f.check.fg} on ${f.check.bg}`;
    const got = f.ratio === null ? (f.note ?? 'unresolved') : `${fmt(f.ratio)} < ${f.check.min}:1`;
    console.error(`  [${f.mode}] ${label}\n      ${got}\n      needed for: ${f.check.why}\n`);
  }
  console.error(`  ${failures.length} failing, ${passed} passing.\n`);
  process.exit(1);
}

console.log(
  `  Design token audit passed — no stray colours, ${passed} contrast checks across both modes.`,
);
