import { z } from 'zod';
import { ERA_SNAPSHOTS, contestable, requireContestedNote, slug, sourceRef, sourcingStatus, traditionId } from './primitives.js';

/**
 * Era-snapshot schema — Phase 0 spec §6.
 *
 * One GeoJSON file per snapshot. The twelve snapshot years are locked by the
 * spec and are not a runtime choice; anything else is rejected.
 *
 * "Each snapshot: per region, `dominant` tradition, `significant` minorities
 *  (>10%), and a `confidence` grade (A: well-documented, B: scholarly estimate,
 *  C: speculative, rendered hatched)."
 *
 * Pre-500 BCE is deliberately out of scope: the evidence is too thin to polygon
 * honestly. The timeline covers it; the map does not.
 *
 * The files are valid GeoJSON — `type: "FeatureCollection"` with a `features`
 * array — plus foreign members carrying the snapshot's own metadata, which the
 * GeoJSON spec permits.
 */

/** A: well-documented. B: scholarly estimate. C: speculative, rendered hatched. */
export const confidenceGrade = z.enum(['a', 'b', 'c']);

const longitude = z.number().min(-180).max(180);
const latitude = z.number().min(-90).max(90);
const position = z.tuple([longitude, latitude]);

/** A closed ring. GeoJSON requires at least four positions, first equal to last. */
const linearRing = z
  .array(position)
  .min(4, 'a linear ring needs at least four positions')
  .refine((ring) => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    return first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1];
  }, 'a linear ring must close: the last position repeats the first');

const polygon = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(linearRing).min(1),
});

const multiPolygon = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(linearRing).min(1)).min(1),
});

export const realmGeometry = z.discriminatedUnion('type', [polygon, multiPolygon]);

/**
 * One realm on one snapshot. `tradition` is the dominant tradition;
 * `minorities` are the significant ones, which the spec defines as above 10%.
 */
export const realmProperties = z
  .object({
    id: slug,
    name: z.string().min(1),
    tradition: traditionId,
    grade: confidenceGrade,
    minorities: z.array(traditionId).default([]),
    /** Where the label sits and how it curves, for the atlas lettering. */
    label_anchor: z.tuple([longitude, latitude]).optional(),
    label_curve: z.number().min(-90).max(90).default(0),
    /* Real realms cite their source; the requirement is enforced at the
       snapshot level, where fixture status is known. A fixture is scaffolding,
       not a claim, so it has nothing to cite. */
    sources: z.array(sourceRef).default([]),
    note: z.string().optional(),
    ...contestable,
  })
  .superRefine(requireContestedNote);

export const realmFeature = z.object({
  type: z.literal('Feature'),
  properties: realmProperties,
  geometry: realmGeometry,
});

export const snapshotSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    /** Foreign members: the snapshot's own metadata. */
    id: slug,
    era: z.number().int(),
    label: z.string().min(1),
    /**
     * Development fixture. Never real data, never promoted, never in a
     * production build. Real snapshots arrive from the owner's research.
     */
    fixture: z.boolean().default(false),
    sourcing: sourcingStatus,
    features: z.array(realmFeature),
  })
  .superRefine((value, ctx) => {
    if (!(ERA_SNAPSHOTS as readonly number[]).includes(value.era)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['era'],
        message:
          `era ${value.era} is not one of the twelve snapshots locked by spec §6: ` +
          ERA_SNAPSHOTS.join(', '),
      });
    }

    /* A fixture is scaffolding. Promoting one would put invented geography in
       front of a reader, so the schema refuses it outright rather than relying
       on the build gate to catch it. */
    if (value.fixture && value.sourcing === 'sourced') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourcing'],
        message: 'a fixture snapshot can never be marked sourced',
      });
    }

    if (!value.fixture) {
      for (const [i, feature] of value.features.entries()) {
        if (feature.properties.sources.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['features', i, 'properties', 'sources'],
            message: 'every realm on a real snapshot cites its source (spec §9.2)',
          });
        }
      }
    }

    const seen = new Set<string>();
    for (const [i, feature] of value.features.entries()) {
      const id = feature.properties.id;
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['features', i, 'properties', 'id'],
          message: `duplicate realm id "${id}" within this snapshot`,
        });
      }
      seen.add(id);
    }
  });

export type Snapshot = z.infer<typeof snapshotSchema>;
export type RealmFeature = z.infer<typeof realmFeature>;
export type ConfidenceGrade = z.infer<typeof confidenceGrade>;
