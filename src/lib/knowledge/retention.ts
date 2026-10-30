import type { KnowledgeEvidence } from './types';

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
export const DAY_MS = 86_400_000;
/** Familiar fixed-bank questions can test retention again after a real seven-day gap. */
export const FAMILIAR_VARIANT_GAP_MS = 7 * DAY_MS;

export type ReviewSchedule = {
  stage: number;
  dueAt: string | null;
  lastPracticedAt: string | null;
  qualifiedReviews: number;
};

export function utcDay(at: string): string {
  return new Date(at).toISOString().slice(0, 10);
}

export function addUtcDays(at: string, days: number): string {
  const date = new Date(at);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

/** Replay one competency's history. Invalid input is never a failed knowledge check. */
export function deriveReviewSchedule(evidence: KnowledgeEvidence[], now: string): ReviewSchedule {
  const cutoff = Date.parse(now);
  if (!Number.isFinite(cutoff)) throw new RangeError('Для повторений нужна корректная дата ISO.');
  const events = evidence
    .filter(
      (event) =>
        event.valid && Number.isFinite(Date.parse(event.at)) && Date.parse(event.at) <= cutoff,
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
  const variants = new Set<string>();
  const variantLastAt = new Map<string, number>();
  let stage = 0;
  let dueAt: string | null = null;
  let lastPracticedAt: string | null = null;
  let lastRetentionDay: string | null = null;
  let qualifiedReviews = 0;
  let retentionNotBefore: string | null = null;

  for (const event of events) {
    const key = `${event.templateId}|${event.variantId}`;
    const firstVariantAnswer = !variants.has(key);
    const previousAt = lastPracticedAt;
    const time = Date.parse(event.at);
    const day = utcDay(event.at);
    const independentReview =
      firstVariantAnswer || time - (variantLastAt.get(key) ?? time) >= FAMILIAR_VARIANT_GAP_MS;
    const delayed =
      previousAt !== null && time - Date.parse(previousAt) >= DAY_MS && utcDay(previousAt) !== day;
    if (!event.correct) {
      stage = 0;
      qualifiedReviews = 0;
      dueAt = new Date(time).toISOString();
      retentionNotBefore = addUtcDays(event.at, 1);
    } else if (
      event.mode === 'review' &&
      independentReview &&
      !event.hintsUsed &&
      delayed &&
      dueAt !== null &&
      time >= Date.parse(dueAt) &&
      retentionNotBefore !== null &&
      time >= Date.parse(retentionNotBefore) &&
      lastRetentionDay !== day
    ) {
      stage = Math.min(REVIEW_INTERVAL_DAYS.length - 1, stage + 1);
      qualifiedReviews += 1;
      lastRetentionDay = day;
      dueAt = addUtcDays(event.at, REVIEW_INTERVAL_DAYS[stage]);
      retentionNotBefore = dueAt;
    } else if (event.mode === 'review' || dueAt === null || stage === 0) {
      // Corrections, hints, same-day successes and memorized variants never advance retention.
      dueAt = addUtcDays(event.at, 1);
      // An early extra session cannot shorten the 3/7/14/30-day retention interval.
      if (retentionNotBefore === null || Date.parse(dueAt) > Date.parse(retentionNotBefore))
        retentionNotBefore = dueAt;
    }
    variants.add(key);
    variantLastAt.set(key, time);
    lastPracticedAt = new Date(time).toISOString();
  }
  return { stage, dueAt, lastPracticedAt, qualifiedReviews };
}
