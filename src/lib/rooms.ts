/**
 * The museum's rooms, numbered.
 *
 * One registry, because the numerals appear in four places that must never
 * disagree: the plaque on the room's own wall, the tooltip on the rooms rail,
 * the first-visit orientation card, and the colophon. They were authored
 * separately before this and had already drifted — the Matrix was Room V and
 * Compare was Room VI under the same name, the deep dives were Room IV called
 * "The Reading Rooms" while the Reading Room itself was Room IX.
 *
 * Eight numbered galleries, front of house. Methodology and the Colophon are
 * back-of-house and carry no numeral: they describe the museum rather than
 * exhibiting anything, and numbering them would promise a ninth and tenth room
 * a visitor never finds on the rail.
 */
export interface Room {
  /** The route this room lives at. */
  readonly href: string;
  /** Roman numeral, absent for back-of-house. */
  readonly numeral?: string;
  /** The gallery's name, set as the plaque's display line. */
  readonly name: string;
  /** The one-line subtitle, engraved between the plaque's rules. */
  readonly says: string;
  /** The short label the rooms rail uses, where it differs from the name. */
  readonly chip?: string;
}

export const ROOMS: readonly Room[] = [
  {
    href: '/',
    numeral: 'I',
    name: 'The Entrance Hall',
    says: 'Five thousand years of belief, on one line.',
  },
  {
    href: '/timeline',
    numeral: 'II',
    name: 'The Timeline',
    says: 'What happened, and when — four hundred sourced events across ten traditions.',
    chip: 'Timeline',
  },
  {
    href: '/map',
    numeral: 'III',
    name: 'The Map',
    says: 'Where each tradition was, era by era.',
    chip: 'Map',
  },
  {
    href: '/matrix',
    numeral: 'IV',
    name: 'The Matrix',
    says: 'What ten traditions hold, side by side on one set of questions.',
    chip: 'Matrix',
  },
  {
    href: '/traditions',
    numeral: 'V',
    name: 'The Traditions',
    says: 'Each tradition whole: history, belief, practice, law and demographics.',
    chip: 'Deep dives',
  },
  {
    href: '/read',
    numeral: 'VI',
    name: 'The Reading Room',
    says: 'The texts themselves, the original beside the English.',
    chip: 'Reading Room',
  },
  {
    href: '/tree',
    numeral: 'VII',
    name: 'The Family Tree',
    says: 'Which tradition came from which, and where the branches parted.',
    chip: 'Family tree',
  },
  {
    href: '/wheel',
    numeral: 'VIII',
    name: 'The Year Wheel',
    says: "When each tradition's festivals fall, and how they drift against each other.",
    chip: 'Year wheel',
  },
  /*
    Compare is not in the owner's enumeration and takes no numeral.

    It is a bench rather than a gallery: the same fields the Matrix exhibits,
    read two traditions at a time. Numbering it would either give the museum a
    ninth room the owner did not name or push every numeral after it along.
    Flagged for a ruling; unnumbered is the reversible call.
  */
  {
    href: '/compare',
    name: 'Compare',
    says: 'Two traditions, section by section, from the same fields as everything else.',
    chip: 'Compare',
  },
  {
    href: '/methodology',
    name: 'Methodology',
    says: 'How this reference is built, sourced and gated.',
  },
  {
    href: '/colophon',
    name: 'The Colophon',
    says: 'How this was made, and by what.',
  },
];

const BY_HREF = new Map(ROOMS.map((r) => [r.href, r]));

/** The room a path belongs to; a dive belongs to The Traditions. */
export function roomFor(pathname: string): Room | undefined {
  const path = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  const exact = BY_HREF.get(path);
  if (exact !== undefined) return exact;
  /* Inner pages belong to their gallery: /traditions/islam, /read/quran/2. */
  const owner = ROOMS.filter((r) => r.href !== '/').find((r) => path.startsWith(`${r.href}/`));
  return owner;
}

/** "Room IV" — what the plaque's eyebrow says, in the museum's voice. */
export const roomLabel = (room: Room): string =>
  room.numeral === undefined ? room.name : `Room ${room.numeral}`;

/** "Room IV · The Matrix" — for a tooltip, where the name is not already shown. */
export const roomTitle = (room: Room): string =>
  room.numeral === undefined ? room.name : `Room ${room.numeral} · ${room.name}`;
