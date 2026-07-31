import { z } from 'zod';
import { slug, sourceTier } from './primitives.js';

/**
 * Source schema — Phase 0 spec §9.1.
 *
 *   T1  academic (Oxford/Cambridge handbooks, Brill's Encyclopaedia of Islam,
 *       Encyclopaedia Judaica, peer-reviewed journals)
 *   T2  demographic authorities (Pew Research, national censuses)
 *   T3  reputable general reference (Britannica, BBC archive)
 *   T4  tradition-internal (catechisms, official denominational statements).
 *       Allowed, and required, for self-description of belief; ALWAYS labelled
 *       as internal.
 *
 * Spec §9.2.5: never cite aggregator religion websites.
 */

export const sourceSchema = z
  .object({
    id: slug,
    tier: sourceTier,
    title: z.string().min(1),
    author: z.string().optional(),
    publisher: z.string().optional(),
    year: z.number().int().min(1).max(2100).optional(),
    url: z.string().url().optional(),
    isbn: z.string().optional(),
    /** Which tradition's own voice this is, for T4. */
    internal_to: slug.optional(),
    note: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.tier === 'T4' && value.internal_to === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['internal_to'],
        message: 'T4 sources are tradition-internal and must name whose voice they are (spec §9.1)',
      });
    }
    if (value.tier !== 'T4' && value.internal_to !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['internal_to'],
        message: 'internal_to only applies to T4 tradition-internal sources',
      });
    }
  });

export type Source = z.infer<typeof sourceSchema>;
