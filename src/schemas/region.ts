import { z } from 'zod';
import { slug, year } from './primitives.js';

/**
 * Region schema — Phase 0 spec §6.
 *
 * "Region ids: modern ISO countries plus ~25 historical macro-regions (Levant,
 *  Mesopotamia, Anatolia, Gangetic Plain, Deccan, Transoxiana, Maghreb, Horn of
 *  Africa, etc.). Events reference either."
 *
 * Pre-500 BCE is deliberately out of scope for the map: the evidence is too
 * thin to polygon honestly. The timeline covers it; the map does not.
 */

export const regionKind = z.enum(['country', 'macro-region']);

export const regionSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    kind: regionKind,
    /** ISO 3166-1 alpha-2, for `kind: country` only. */
    iso: z
      .string()
      .regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2, uppercase')
      .optional(),
    /** Rough extent, for macro-regions whose borders are conventions not facts. */
    approx_center: z
      .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
      .optional(),
    /** Historical macro-regions may name the window in which the label is apt. */
    active_from: year.optional(),
    active_to: year.optional(),
    note: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === 'country' && value.iso === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['iso'],
        message: 'countries carry an ISO 3166-1 alpha-2 code',
      });
    }
    if (value.kind === 'macro-region' && value.iso !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['iso'],
        message: 'historical macro-regions have no ISO code',
      });
    }
    if (
      value.active_from !== undefined &&
      value.active_to !== undefined &&
      value.active_to < value.active_from
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['active_to'],
        message: 'active_to precedes active_from',
      });
    }
  });

export type Region = z.infer<typeof regionSchema>;
