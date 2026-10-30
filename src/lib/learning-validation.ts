import { z } from 'zod';
import type { ExamSession, LearningData, LearningEvent, PracticeDraft } from './learning-types';

const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,179}$/);
const uuid = z.uuid();
const seed = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const timestamp = z.iso.datetime({ offset: true }).refine((value) => {
  const time = Date.parse(value);
  return time >= Date.UTC(2000, 0, 1) && time <= Date.now() + 300_000;
});
const version = z.number().int().min(1).max(10000);
export const answerSchema = z.union([
  z.string().max(3000),
  z.array(z.string().max(3000)).max(64),
  z.record(id, z.string().max(3000)).refine((value) => Object.keys(value).length <= 64),
]);
const competency = z.enum([
  'financial-literacy',
  'interest-rates',
  'inflation',
  'returns',
  'compounding',
  'present-value',
  'future-value',
  'discounting',
  'npv',
  'irr',
  'stocks',
  'bonds',
  'dividends',
  'portfolio-returns',
  'diversification',
  'risk-return',
  'english-terminology',
  'english-reading',
  'english-calculations',
  'english-expressions',
]);
const competencies = z
  .array(competency)
  .min(1)
  .max(20)
  .refine((values) => new Set(values).size === values.length);
const difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const eventSchema = z
  .object({
    id: uuid,
    sessionId: uuid,
    exerciseId: id,
    templateId: id,
    variantId: id,
    seed,
    lessonId: id,
    contentVersion: version,
    competencyIds: competencies,
    difficulty,
    mode: z.enum(['lesson', 'practice', 'review', 'english']),
    answer: answerSchema,
    valid: z.boolean(),
    correct: z.boolean(),
    errorType: z.enum([
      'none',
      'concept',
      'calculation',
      'unit',
      'format',
      'selection',
      'ordering',
    ]),
    hintsUsed: z.boolean(),
    at: timestamp,
  })
  .strict()
  .refine((value) => !value.correct || value.valid);
const draftSchema = z
  .object({
    id,
    exerciseId: id,
    templateId: id,
    seed,
    sessionId: uuid.optional(),
    hintsUsed: z.boolean().optional(),
    mode: z.enum(['practice', 'review', 'english']),
    answer: answerSchema,
    updatedAt: timestamp,
  })
  .strict();
const examAnswerSchema = z
  .object({
    questionId: id,
    competencyIds: competencies,
    difficulty,
    answer: answerSchema,
    correct: z.boolean(),
    explanation: z.string().min(1).max(12000),
    expectedAnswer: answerSchema,
  })
  .strict();
const examResultSchema = z
  .object({
    id: uuid,
    moduleId: z.enum(['m1', 'm2', 'm3']),
    lessonId: id,
    bankVersion: version,
    variant: z.number().int().min(0).max(15),
    score: z.number().min(0).max(100),
    passed: z.boolean(),
    submittedAt: timestamp,
    answers: z.array(examAnswerSchema).min(1).max(20),
  })
  .strict()
  .refine((result) => result.passed === result.score >= 80)
  .refine(
    (result) =>
      new Set(result.answers.map((answer) => answer.questionId)).size === result.answers.length,
  );
const learningSchema = z
  .object({
    version: z.literal(2),
    events: z.array(eventSchema).max(20000),
    drafts: z
      .record(id, draftSchema)
      .refine((value) => Object.keys(value).length <= 256)
      .refine((value) => Object.entries(value).every(([key, draft]) => key === draft.id)),
    examResults: z.array(examResultSchema).max(2000),
  })
  .strict()
  .refine((value) => new Set(value.events.map((event) => event.id)).size === value.events.length)
  .refine(
    (value) =>
      new Set(value.examResults.map((result) => result.id)).size === value.examResults.length,
  );

const option = z.object({ id, label: z.string().max(3000) }).strict();
const publicBase = {
  id,
  prompt: z.string().min(1).max(10000),
  skills: z
    .array(z.enum(['literacy', 'mathematics', 'investments', 'portfolio', 'english']))
    .max(10),
  competencyIds: z.array(z.string()).max(20).optional(),
  difficulty: difficulty.optional(),
  instruction: z.string().max(3000).optional(),
  templateId: id.optional(),
  variantId: id.optional(),
  seed: seed.optional(),
};
const publicExercise = z.discriminatedUnion('kind', [
  z
    .object({
      ...publicBase,
      kind: z.literal('numeric'),
      unit: z.enum(['number', 'percent', 'currency', 'bps']),
      currency: z.enum(['RUB', 'USD']).optional(),
      absoluteTolerance: z.number().min(0).optional(),
      relativeTolerance: z.number().min(0).optional(),
    })
    .strict(),
  z
    .object({
      ...publicBase,
      kind: z.literal('choice'),
      options: z.array(option).min(2).max(12),
      multiple: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      ...publicBase,
      kind: z.literal('scenario'),
      options: z.array(option).min(2).max(12),
      multiple: z.boolean().optional(),
    })
    .strict(),
  z.object({ ...publicBase, kind: z.literal('boolean') }).strict(),
  z
    .object({ ...publicBase, kind: z.literal('ordering'), items: z.array(option).min(2).max(12) })
    .strict(),
]);
const sessionSchema = z
  .object({
    id: uuid,
    moduleId: z.enum(['m1', 'm2', 'm3']),
    lessonId: id,
    bankVersion: version,
    variant: z.number().int().min(0).max(15),
    startedAt: timestamp,
    guestToken: uuid.optional(),
    draft: z
      .record(id, answerSchema)
      .refine((value) => Object.keys(value).length <= 8)
      .optional(),
    position: z.number().int().min(0).max(8).optional(),
    updatedAt: timestamp.optional(),
    questions: z
      .array(
        z
          .object({ id, competencyIds: competencies, difficulty, exercise: publicExercise })
          .strict(),
      )
      .length(8),
    result: examResultSchema.optional(),
  })
  .strict();

function bounded(value: unknown): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= 3_500_000;
  } catch {
    return false;
  }
}
export function parseLearningData(value: unknown): LearningData | null {
  if (!bounded(value)) return null;
  const result = learningSchema.safeParse(value);
  return result.success ? result.data : null;
}
export function parseLearningEvent(value: unknown): LearningEvent | null {
  const result = eventSchema.safeParse(value);
  return result.success ? result.data : null;
}
export function parsePracticeDraft(value: unknown): PracticeDraft | null {
  const result = draftSchema.safeParse(value);
  return result.success ? result.data : null;
}
export function parseExamSession(value: unknown): ExamSession | null {
  if (!bounded(value)) return null;
  const result = sessionSchema.safeParse(value);
  return result.success ? result.data : null;
}
