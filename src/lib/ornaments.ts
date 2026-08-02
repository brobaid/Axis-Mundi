import type { TraditionId } from '../schemas/primitives.js';

/**
 * The ten ornament kits.
 *
 * House-drawn line geometry, one kit per tradition, from the owner's motif
 * table. Every kit has three required pieces and two optional ones:
 *
 *   corner    a small motif for the header band's corners
 *   divider   the rule between sections, carrying the tradition's own figure
 *   pattern   a tile laid behind the header band at 4–6%
 *   mark      the once-only emblem in the header, where the table names one
 *   frame     a framing shape for the quoted claim, where the table names one
 *
 * Rules that governed every stroke here:
 *
 *   - Nothing figurative. No depiction of any person, prophet or deity.
 *   - No tradition's sacred emblem used as wallpaper. Where the table names an
 *     emblem it appears once, small, in the header, and never in the pattern or
 *     the divider. Where the table says an emblem is not to be used as ornament
 *     — the khanda, the ahimsa palm — it is absent entirely.
 *   - Geometry only. These are strokes on a plate, not illustrations.
 *
 * Substitutions are recorded in `note` and reported, because a taste call made
 * under the aniconism and no-emblem-wallpaper rules is a flag, not a silence.
 */

export interface Ornament {
  /** viewBox, as `0 0 w h`. */
  readonly view: string;
  /** Path data, each stroked in the theme's accent unless `fill` says otherwise. */
  readonly paths: readonly string[];
  /** Paths that are filled rather than stroked. */
  readonly fills?: readonly string[];
}

export interface PatternTile {
  /** Tile size in user units; the tile repeats on this grid. */
  readonly size: number;
  readonly paths: readonly string[];
  readonly fills?: readonly string[];
}

/**
 * A divider is a running border, not one stretched drawing.
 *
 * The first version rendered each divider as a single 160-unit SVG scaled to
 * the column with `preserveAspectRatio="none"`, which is how a quatrefoil
 * became an ellipse and a boteh became a comma five times too wide. A tile that
 * repeats keeps every motif at the proportions it was drawn at, at any column
 * width, which is also what a border in an illuminated page actually is.
 */
export interface DividerTile {
  /** Tile width in user units; the band is DIVIDER_H tall. */
  readonly size: number;
  readonly paths: readonly string[];
  readonly fills?: readonly string[];
}

/** Every divider band is this tall, so one rule serves all ten. */
export const DIVIDER_H = 14;

export interface OrnamentKit {
  readonly corner: Ornament;
  readonly divider: DividerTile;
  readonly pattern: PatternTile;
  /** The once-only header emblem, where the tradition's table names one. */
  readonly mark?: Ornament;
  /** A framing shape for the quoted claim, where the table names one. */
  readonly frame?: Ornament;
  /** Any substitution or omission, stated rather than silent. */
  readonly note?: string;
}

/* A corner is always 48 × 48. */
const COR = '0 0 48 48';

export const ORNAMENTS: Readonly<Record<TraditionId, OrnamentKit>> = {
  /* ---------------------------------------------------------------- islam */
  /*
    Strictly geometric throughout, which is the aniconic rule applied rather
    than a stylistic preference: nothing in this kit depicts a living thing.
    The eight-pointed khatim and girih strapwork are construction geometry —
    lines and their intersections — which is precisely what the tradition's own
    ornament is. The crescent appears once, small, in the header, and nowhere
    in the pattern or the divider.
  */
  islam: {
    corner: {
      view: COR,
      /* The khatim: two squares at 45° to each other. */
      paths: ['M24 3 L45 24 L24 45 L3 24 Z', 'M9.2 9.2 H38.8 V38.8 H9.2 Z', 'M24 14 L34 24 L24 34 L14 24 Z'],
    },
    divider: {
      /* Arabesque: one wave of the scroll, with the house lozenge at its crest.
         The wave leaves and enters the tile at the same height, so the band
         reads as one continuous scroll however wide the column is. */
      size: 80,
      paths: ['M0 7 Q 20 1.5, 40 7 T 80 7', 'M40 4.4 L42.6 7 L40 9.6 L37.4 7 Z'],
    },
    pattern: {
      size: 40,
      /* Girih strapwork: the star-and-cross grid the strapwork is built on. */
      paths: [
        'M20 0 L40 20 L20 40 L0 20 Z',
        'M0 0 H40 M0 40 H40 M0 0 V40 M40 0 V40',
        'M10 10 L30 30 M30 10 L10 30',
      ],
    },
    /*
      No mark. The masthead's own identifier is already a crescent-and-star —
      the symbol set has carried it since M2 — so a second crescent from this
      kit would be the emblem used twice on one wall, which is not what "once,
      small, in the header" asks for.
    */
    note:
      'Aniconic rule applied: every piece is construction geometry and nothing ' +
      'in the kit depicts a living thing. The crescent is in the header once — ' +
      "the masthead's existing identifier — and the kit adds no second one; it " +
      'appears in neither the divider nor the pattern.',
  },

  /* --------------------------------------------------------- christianity */
  christianity: {
    corner: {
      view: COR,
      /* Rose window: twelve spokes inside two concentric rings. */
      paths: [
        'M24 4 A20 20 0 1 1 23.9 4 Z',
        'M24 12 A12 12 0 1 1 23.9 12 Z',
        'M24 4 V44 M4 24 H44 M9.9 9.9 L38.1 38.1 M38.1 9.9 L9.9 38.1',
        'M24 4 A20 20 0 0 1 41.3 14 M41.3 34 A20 20 0 0 1 6.7 34',
      ],
    },
    divider: {
      /* Quatrefoil on the rule, one per tile. */
      size: 64,
      paths: [
        'M0 7 H26 M38 7 H64',
        'M32 3.6 A2.6 2.6 0 1 1 32 8.8 A2.6 2.6 0 1 1 32 3.6 Z',
        'M32 5.2 A2.6 2.6 0 1 1 32 10.4 A2.6 2.6 0 1 1 32 5.2 Z',
        'M29.4 4.4 A2.6 2.6 0 1 1 29.4 9.6 A2.6 2.6 0 1 1 29.4 4.4 Z',
        'M34.6 4.4 A2.6 2.6 0 1 1 34.6 9.6 A2.6 2.6 0 1 1 34.6 4.4 Z',
      ],
    },
    pattern: {
      size: 32,
      /* Quarry glazing: the diamond leading of plain window glass. */
      paths: ['M16 0 L32 16 L16 32 L0 16 Z', 'M0 0 L16 16 L32 0 M0 32 L16 16 L32 32'],
    },
    frame: {
      view: '0 0 100 100',
      /* A gothic arch, drawn as two struck arcs meeting at a point. */
      paths: ['M2 100 V44 A56 56 0 0 1 50 4 A56 56 0 0 1 98 44 V100'],
    },
    note:
      'The rose window carries the header rather than a cross: the table asked ' +
      'for a radial motif there, and a cross set as repeating ornament would be ' +
      'an emblem used as wallpaper.',
  },

  /* -------------------------------------------------------------- judaism */
  judaism: {
    corner: {
      view: COR,
      /* Pomegranate: the fruit as drawn on ancient synagogue floors — a body,
         a calyx crown, and the seed division. */
      paths: [
        'M24 12 C 36 12, 42 22, 42 30 C 42 39, 34 45, 24 45 C 14 45, 6 39, 6 30 C 6 22, 12 12, 24 12 Z',
        'M24 12 V3 M24 6 L18 2 M24 6 L30 2 M20 5 L24 8 L28 5',
        'M24 18 V40 M15 22 C 18 28, 18 34, 15 39 M33 22 C 30 28, 30 34, 33 39',
      ],
    },
    divider: {
      /* Vine, with a pomegranate hung from each turn — the synagogue-floor
         border, running. */
      size: 72,
      paths: [
        'M0 7 Q 18 2, 36 7 T 72 7',
        'M36 7 C 33 8, 32.5 11, 34.5 12 C 36.5 13, 39 11.5, 38 9.5 C 37.4 8.4, 36.6 7.8, 36 7 Z',
        'M0 7 L1.6 5.4 M72 7 L70.4 5.4',
      ],
    },
    pattern: {
      size: 28,
      /* Mosaic tessera: the square-set field a floor is laid in. */
      paths: ['M0 0 H28 V28 H0 Z', 'M14 0 V28 M0 14 H28'],
    },
    note:
      'The Star of David is not used. The table allowed it "once, small, if at ' +
      'all"; the pomegranate-and-vine from ancient synagogue floors is the ' +
      'richer and less emblematic choice, and it is the one this kit takes.',
  },

  /* ------------------------------------------------------------- hinduism */
  hinduism: {
    corner: {
      view: COR,
      /* Lotus: eight petals about a centre. */
      paths: [
        'M24 6 C 30 16, 30 24, 24 30 C 18 24, 18 16, 24 6 Z',
        'M24 42 C 18 32, 18 24, 24 18 C 30 24, 30 32, 24 42 Z',
        'M6 24 C 16 18, 24 18, 30 24 C 24 30, 16 30, 6 24 Z',
        'M42 24 C 32 30, 24 30, 18 24 C 24 18, 32 18, 42 24 Z',
        'M24 20 A4 4 0 1 1 23.9 20 Z',
      ],
    },
    divider: {
      /* Boteh, mirrored about the tile's centre. */
      size: 72,
      paths: [
        'M0 7 H26 M46 7 H72',
        'M32 12.5 C 27 10.5, 27.5 4, 31.5 3.5 C 35 3, 36 6.5, 33.6 8 C 32.2 8.9, 31.6 10.8, 32 12.5 Z',
        'M40 12.5 C 45 10.5, 44.5 4, 40.5 3.5 C 37 3, 36 6.5, 38.4 8 C 39.8 8.9, 40.4 10.8, 40 12.5 Z',
      ],
    },
    pattern: {
      size: 36,
      /* Temple-pillar border: the stepped shaft and its capital, repeated. */
      paths: [
        'M6 36 V10 H30 V36 M2 10 H34 M4 6 H32 M6 2 H30',
        'M12 36 V14 M24 36 V14 M18 36 V14',
      ],
    },
  },

  /* ------------------------------------------------------------- buddhism */
  buddhism: {
    corner: {
      view: COR,
      /* Endless knot: the closed interlace, drawn as a single figure. */
      paths: [
        'M12 12 H36 V36 H12 Z',
        'M12 20 H28 V44 M36 28 H20 V4',
        'M4 20 H12 M4 28 H20 M36 20 H44 M28 28 H44',
      ],
    },
    divider: {
      /* Lotus on the rule, one per tile. */
      size: 64,
      paths: [
        'M0 7 H24 M40 7 H64',
        'M32 2.5 C 34.2 5, 34.2 8.4, 32 11 C 29.8 8.4, 29.8 5, 32 2.5 Z',
        'M24 7 C 27 5, 30.4 5.6, 32 11 M40 7 C 37 5, 33.6 5.6, 32 11',
      ],
    },
    pattern: {
      size: 34,
      /* The endless knot's lattice, opened out into a field. */
      paths: ['M0 8 H34 M0 26 H34 M8 0 V34 M26 0 V34', 'M8 8 H26 V26 H8 Z'],
    },
    /* No mark: the masthead identifier is already the dharmachakra. */
    note:
      'The dharmachakra is in the header once, as the masthead identifier the ' +
      'symbol set already carries; the kit adds no second wheel. The lotus goes ' +
      'on the divider and the knot into the corner and the field, as the table ' +
      'asked.',
  },

  /* -------------------------------------------------------------- sikhism */
  sikhism: {
    corner: {
      view: COR,
      /* Phulkari: the counted-thread lozenge the embroidery is built from. */
      paths: [
        'M24 4 L44 24 L24 44 L4 24 Z',
        'M24 14 L34 24 L24 34 L14 24 Z',
        'M24 4 V44 M4 24 H44',
      ],
    },
    divider: {
      /* Phulkari: the counted-thread chevron, running. */
      size: 56,
      paths: ['M0 7 H56', 'M6 12 L16 2.5 L26 12', 'M30 2.5 L40 12 L50 2.5'],
    },
    pattern: {
      size: 30,
      /* The counted-thread field itself. */
      paths: ['M15 0 L30 15 L15 30 L0 15 Z', 'M15 7 L23 15 L15 23 L7 15 Z'],
    },
    note:
      'Ik Onkar is set once in the header as calligraphy, in the Gurmukhi face ' +
      'the reading room already carries, rather than drawn as a shape. The ' +
      'khanda is not used at all: the table asked that it not be ornament, and ' +
      'the phulkari geometry carries the kit instead.',
  },

  /* -------------------------------------------------------------- chinese */
  chinese: {
    corner: {
      view: COR,
      /* Window lattice: the ice-crack and square-grid joinery of a lattice
         screen, taken as a corner unit. */
      paths: [
        'M4 4 H44 V44 H4 Z',
        'M4 18 H44 M4 30 H44 M18 4 V44 M30 4 V44',
        'M18 18 H30 V30 H18 Z',
      ],
    },
    divider: {
      /* Yunwen: one cloud head, curling off the rule. */
      size: 72,
      paths: [
        'M0 7 H30 M52 7 H72',
        'M30 7 C 35 7, 34.5 2.8, 39 2.8 C 43.4 2.8, 44.6 7, 41 8 C 38.6 8.7, 38.2 11, 41 11.6',
        'M52 7 C 49 7, 48.6 4.6, 46 4.6',
      ],
    },
    pattern: {
      size: 32,
      /* The lattice as a field. */
      paths: ['M0 0 H32 V32 H0 Z', 'M0 16 H32 M16 0 V32', 'M8 8 L16 0 L24 8 L32 16 L24 24 L16 32 L8 24 L0 16 Z'],
    },
    mark: {
      view: '0 0 24 24',
      /* A bi disc: the ring with its central aperture. */
      paths: ['M12 1.5 A10.5 10.5 0 1 1 11.9 1.5 Z', 'M12 8 A4 4 0 1 1 11.9 8 Z', 'M12 5 A7 7 0 1 1 11.9 5 Z'],
    },
  },

  /* --------------------------------------------------------------- shinto */
  shinto: {
    corner: {
      view: COR,
      /* Asanoha: the hemp-leaf unit, six-fold about a centre. */
      paths: [
        'M24 2 L44 13 V35 L24 46 L4 35 V13 Z',
        'M24 2 V46 M4 13 L44 35 M44 13 L4 35',
        'M24 24 L44 13 M24 24 L44 35 M24 24 L4 13 M24 24 L4 35',
      ],
    },
    divider: {
      /* Shide: the folded paper streamer, hung from a rule at the top of the
         band so the folds hang the way they do from a shimenawa. */
      size: 48,
      paths: ['M0 3 H48', 'M20 3 V5.8 H26 V8.6 H20 V11.4 H26'],
    },
    pattern: {
      size: 32,
      /* Seigaiha: the wave crest, laid as overlapping arcs. */
      paths: [
        'M0 32 A16 16 0 0 1 32 32',
        'M0 32 A11 11 0 0 1 22 32',
        'M0 32 A6 6 0 0 1 12 32',
        'M16 16 A16 16 0 0 1 48 16 M-16 16 A16 16 0 0 1 16 16',
      ],
    },
    /* No mark: the masthead identifier is already a torii. */
    note:
      'The torii is in the header once, as the masthead identifier the symbol ' +
      'set already carries; the kit adds no second gate. Asanoha takes the ' +
      'corner, seigaiha the field, and the shide zigzag the divider.',
  },

  /* -------------------------------------------------------------- jainism */
  jainism: {
    corner: {
      view: COR,
      /* Jali: one pierced filigree unit of a marble screen. */
      paths: [
        'M24 4 L44 24 L24 44 L4 24 Z',
        'M24 12 L36 24 L24 36 L12 24 Z',
        'M24 20 L28 24 L24 28 L20 24 Z',
        'M14 14 L34 34 M34 14 L14 34',
      ],
    },
    divider: {
      /* Lotus, outline only: the most restrained divider of the ten. */
      size: 80,
      paths: [
        'M0 7 H33 M47 7 H80',
        'M40 3.4 C 41.8 5.2, 41.8 8.2, 40 10.4 C 38.2 8.2, 38.2 5.2, 40 3.4 Z',
        'M33 7 C 35.6 5.6, 38.6 6, 40 10.4 M47 7 C 44.4 5.6, 41.4 6, 40 10.4',
      ],
    },
    pattern: {
      size: 26,
      /* The jali field: pierced lattice, the lightest tile of the ten. */
      paths: ['M13 0 L26 13 L13 26 L0 13 Z', 'M13 6 L20 13 L13 20 L6 13 Z'],
    },
    note:
      'The ahimsa palm is never drawn — the table forbids it as decoration and ' +
      'it appears nowhere in this kit. Jainism is the restraint case: its band ' +
      'is tinted at 6% against the other nine at 15%, so the room reads as ' +
      'marble rather than as a colour.',
  },

  /* ------------------------------------------------------- zoroastrianism */
  zoroastrianism: {
    corner: {
      view: COR,
      /* Persepolis rosette: the twelve-petal boss of the palace reliefs. */
      paths: [
        'M24 4 A20 20 0 1 1 23.9 4 Z',
        'M24 10 A14 14 0 1 1 23.9 10 Z',
        'M24 4 V44 M4 24 H44 M9.9 9.9 L38.1 38.1 M38.1 9.9 L9.9 38.1',
        'M24 21 A3 3 0 1 1 23.9 21 Z',
      ],
    },
    divider: {
      /* Persepolis rosette, running: one boss per tile on a continuous rule. */
      size: 44,
      paths: [
        'M0 7 H16 M28 7 H44',
        'M22 2.6 A4.4 4.4 0 1 1 21.9 2.6 Z',
        'M22 2.6 V11.4 M17.6 7 H26.4 M18.9 3.9 L25.1 10.1 M25.1 3.9 L18.9 10.1',
      ],
    },
    pattern: {
      size: 36,
      /* Fravashi wing geometry, abstracted to the feather courses of the wing
         and nothing else — no figure, no disc, no face. */
      paths: [
        'M0 9 H36 M0 21 H36 M0 33 H36',
        'M6 9 V21 M18 9 V21 M30 9 V21 M0 21 V33 M12 21 V33 M24 21 V33 M36 21 V33',
      ],
    },
    mark: {
      view: '0 0 24 24',
      /* A flame: three tongues rising from a base. */
      paths: [
        'M12 22 C 5 22, 3 16, 7 11 C 8 14, 10 14, 10 11 C 10 6, 12 3, 12 1 C 12 3, 14 6, 14 11 C 14 14, 16 14, 17 11 C 21 16, 19 22, 12 22 Z',
        'M6 23 H18',
      ],
    },
    note:
      'The fravashi is used only as wing geometry, abstracted to the feather ' +
      'courses: no winged figure, no human form, no solar disc. The table asked ' +
      'for it "once, small, abstracted", and the abstraction is total.',
  },
};
