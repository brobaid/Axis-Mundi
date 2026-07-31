import type { TraditionId } from '../schemas/primitives.js';

/**
 * The launch ten (Phase 0 spec §2.1) paired with their identity hues
 * (design language §3.2).
 *
 * The hue values themselves live in tokens.css and are referenced here only by
 * custom-property name — no raw hex outside the token file.
 *
 * `rationale` is the association the design doc records. Per §3.2 rule 4 these
 * associations are conventional, not official, and the methodology page says so.
 */

export interface TraditionMeta {
  readonly id: TraditionId;
  /** Display name, verbatim from spec §2.1. */
  readonly name: string;
  /** Hue name from design language §3.2. */
  readonly hue: string;
  /** Custom property holding the hue ramp base. */
  readonly hueToken: `--t-${string}`;
  /** Line-art identifier from the handoff prompt, work item 2. Identifier only. */
  readonly symbol: string;
  readonly rationale: string;
}

export const TRADITIONS: readonly TraditionMeta[] = [
  {
    id: 'judaism',
    name: 'Judaism',
    hue: 'Tekhelet azure',
    hueToken: '--t-judaism',
    symbol: 'star-of-david',
    rationale: 'The tekhelet dye of tzitzit',
  },
  {
    id: 'christianity',
    name: 'Christianity',
    hue: 'Byzantine violet',
    hueToken: '--t-christianity',
    symbol: 'cross',
    rationale: 'Liturgical purple',
  },
  {
    id: 'islam',
    name: 'Islam',
    hue: 'Emerald',
    hueToken: '--t-islam',
    symbol: 'crescent-and-star',
    rationale: 'Longstanding association with green',
  },
  {
    id: 'hinduism',
    name: 'Hinduism',
    hue: 'Saffron',
    hueToken: '--t-hinduism',
    symbol: 'om',
    rationale: 'Bhagwa saffron',
  },
  {
    id: 'buddhism',
    name: 'Buddhism',
    hue: 'Maroon',
    hueToken: '--t-buddhism',
    symbol: 'dharmachakra',
    rationale: 'Monastic robe maroon',
  },
  {
    id: 'sikhism',
    name: 'Sikhism',
    hue: 'Indigo navy',
    hueToken: '--t-sikhism',
    symbol: 'khanda',
    rationale: 'Nihang blue',
  },
  {
    id: 'chinese',
    name: 'Chinese traditions',
    hue: 'Imperial yellow',
    hueToken: '--t-chinese',
    symbol: 'taijitu',
    rationale: 'Imperial and temple gold',
  },
  {
    id: 'shinto',
    name: 'Shinto',
    hue: 'Vermilion',
    hueToken: '--t-shinto',
    symbol: 'torii',
    rationale: 'Torii vermilion',
  },
  {
    id: 'jainism',
    name: 'Jainism',
    hue: 'Teal',
    hueToken: '--t-jainism',
    symbol: 'jain-hand-with-wheel',
    rationale: 'Pragmatic assignment; white, their true color, is reserved for the canvas',
  },
  {
    id: 'zoroastrianism',
    name: 'Zoroastrianism',
    hue: 'Flame crimson',
    hueToken: '--t-zoroastrianism',
    symbol: 'faravahar',
    rationale: 'The sacred fire',
  },
];

const BY_ID = new Map(TRADITIONS.map((t) => [t.id, t]));

export const traditionMeta = (id: TraditionId): TraditionMeta => {
  const meta = BY_ID.get(id);
  if (meta === undefined) throw new Error(`unknown tradition id: ${id}`);
  return meta;
};
