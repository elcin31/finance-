import { z } from 'zod';
import type { Progress } from './progress';

const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/);
const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const answerText = z.string().max(3000);
const answer = z.union([
  answerText,
  z
    .array(answerText)
    .max(64)
    .refine((values) => new Set(values).size === values.length),
  z.record(id, answerText).refine((value) => Object.keys(value).length <= 128),
]);
const state = z
  .object({
    position: z.number().int().min(0).max(256),
    runId: uuid,
    contentVersion: z.number().int().min(1).max(10000).optional(),
    drafts: z.record(id, answer).refine((value) => Object.keys(value).length <= 128),
    updatedAt: timestamp,
  })
  .strict();
const progressSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceId: uuid,
    preferences: z
      .object({
        goal: z.string().min(1).max(200),
        level: z.string().min(1).max(100),
        pace: z.number().int().min(1).max(240),
        diagnosticScore: z.number().min(0).max(100),
        recommendedLesson: id,
        onboardingDone: z.boolean(),
      })
      .strict(),
    preferencesUpdatedAt: timestamp,
    states: z.record(id, state).refine((value) => Object.keys(value).length <= 128),
    attempts: z
      .array(
        z
          .object({
            id: uuid,
            lessonId: id,
            exerciseId: id,
            runId: uuid,
            contentVersion: z.number().int().min(1).max(10000).optional(),
            answer,
            correct: z.boolean(),
            at: timestamp,
          })
          .strict(),
      )
      .max(20000),
    completions: z
      .array(
        z
          .object({
            lessonId: id,
            runId: uuid,
            version: z.number().int().min(1).max(10000),
            score: z.number().min(0).max(100),
            completedAt: timestamp,
          })
          .strict(),
      )
      .max(4000),
  })
  .strict()
  .refine((value) => new Set(value.attempts.map((item) => item.id)).size === value.attempts.length)
  .refine(
    (value) =>
      new Set(value.completions.map((item) => item.runId)).size === value.completions.length,
  );

/** Validate disk/network data before trusting it. Never coerce booleans or numeric grades. */
export function parseProgress(value: unknown): Progress | null {
  try {
    // Bound the document before recursively parsing untrusted local/network values.
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 2_000_000) return null;
    const result = progressSchema.safeParse(value);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
