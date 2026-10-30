import { describe, expect, it } from 'vitest';
import { lessons } from '@/content/curriculum';
import { competencies } from '@/content/skills';
import type {
  CompetencyId,
  ExamResult,
  ExerciseEntry,
  LearningData,
  LearningEvent,
} from '../learning-types';
import { emptyProgress, isUnlocked } from '../progress';
import type { Exercise } from '../types';
import {
  addUtcDays,
  buildKnowledge,
  collectEvidence,
  deriveReviewSchedule,
  difficultyForExercise,
  mapLegacyExercise,
  utcDay,
} from './index';

const start = '2026-01-01T12:00:00.000Z';
const end = '2026-03-01T12:00:00.000Z';
const data = (events: LearningEvent[] = [], examResults: ExamResult[] = []): LearningData => ({
  version: 2,
  events,
  examResults,
  drafts: {},
});
let sequence = 0;

function entriesFor(id: CompetencyId, count = 3): ExerciseEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const templateId = `test-${id}-${index}`;
    return {
      lessonId: id.startsWith('english-') ? 'm3-total-return' : 'm2-npv',
      competencyIds: [id],
      difficulty: 1,
      exercise: {
        id: templateId,
        templateId,
        variantId: `${templateId}:base`,
        seed: 0,
        kind: 'numeric',
        prompt: 'Расчёт',
        expected: 1,
        unit: 'number',
        hint: 'Принцип',
        explanation: 'Решение',
        skills: id.startsWith('english-') ? ['english'] : ['mathematics'],
        competencyIds: [id],
      },
    };
  });
}

function event(overrides: Partial<LearningEvent> = {}): LearningEvent {
  sequence += 1;
  return {
    id: `event-${sequence}`,
    sessionId: 'session',
    exerciseId: 'test-english-reading-0',
    templateId: 'test-english-reading-0',
    variantId: 'variant-1',
    seed: 1,
    lessonId: 'm3-total-return',
    contentVersion: 2,
    competencyIds: ['english-reading'],
    difficulty: 1,
    mode: 'practice',
    answer: '1',
    valid: true,
    correct: true,
    errorType: 'none',
    hintsUsed: false,
    at: start,
    ...overrides,
  };
}

function eventFor(entry: ExerciseEntry, overrides: Partial<LearningEvent> = {}): LearningEvent {
  return event({
    exerciseId: entry.exercise.id,
    templateId: entry.exercise.templateId ?? entry.exercise.id,
    lessonId: entry.lessonId,
    competencyIds: entry.competencyIds,
    difficulty: entry.difficulty,
    variantId: `${entry.exercise.id}:1`,
    ...overrides,
  });
}

function history(entries: ExerciseEntry[], at = start): LearningEvent[] {
  return entries.map((entry) => eventFor(entry, { at }));
}

function skill(
  id: CompetencyId,
  events: LearningEvent[],
  entries: ExerciseEntry[],
  now = end,
  exams: ExamResult[] = [],
) {
  return buildKnowledge(emptyProgress(), data(events, exams), entries, now).skills.find(
    (item) => item.id === id,
  )!;
}

function reviewHistory(id: CompetencyId, entry: ExerciseEntry): LearningEvent[] {
  const times = [
    start,
    '2026-01-02T12:00:00.000Z',
    '2026-01-05T12:00:00.000Z',
    '2026-01-12T12:00:00.000Z',
    '2026-01-26T12:00:00.000Z',
  ];
  return times.map((at, index) =>
    eventFor(entry, {
      competencyIds: [id],
      at,
      variantId: `${entry.exercise.id}:review-${index}`,
      mode: index ? 'review' : 'practice',
    }),
  );
}

function trustedExam(
  id: CompetencyId,
  correct = true,
  overrides: Partial<ExamResult> = {},
): ExamResult {
  return {
    id: 'db-result',
    moduleId: 'm2',
    lessonId: 'm2-exam',
    bankVersion: 2,
    variant: 1,
    score: correct ? 100 : 0,
    passed: correct,
    submittedAt: '2026-01-03T12:00:00.000Z',
    answers: [
      {
        questionId: 'exam-question',
        competencyIds: [id],
        difficulty: 2,
        answer: '1',
        correct,
        explanation: 'Проверено сервером',
        expectedAnswer: '1',
      },
    ],
    ...overrides,
  };
}

function legacyExercise(lessonId: string, exerciseId: string): Exercise {
  const lesson = lessons.find((item) => item.id === lessonId)!;
  return lesson.blocks
    .flatMap((block) => (block.type === 'exercise' ? [block.exercise] : []))
    .find((exercise) => exercise.id === exerciseId)!;
}

describe('competency model and precise legacy mapping', () => {
  it('defines exactly 20 stable competencies with existing lessons and an acyclic prerequisite graph', () => {
    expect(competencies).toHaveLength(20);
    expect(new Set(competencies.map((item) => item.id)).size).toBe(20);
    const visit = (id: CompetencyId, path: CompetencyId[] = []) => {
      expect(path).not.toContain(id);
      const definition = competencies.find((item) => item.id === id)!;
      expect(definition).toBeDefined();
      for (const prerequisite of definition.prerequisites) visit(prerequisite, [...path, id]);
    };
    for (const definition of competencies) {
      expect(definition.lessonIds.length).toBeGreaterThan(0);
      expect(definition.lessonIds.every((id) => lessons.some((lesson) => lesson.id === id))).toBe(
        true,
      );
      visit(definition.id);
    }
  });

  it('keeps NPV and IRR evidence separate and does not credit a whole financial lesson for matching English', () => {
    expect(mapLegacyExercise('m2-npv', legacyExercise('m2-npv', 'm2-npv-practice'))).toEqual([
      'npv',
    ]);
    expect(mapLegacyExercise('m2-npv', legacyExercise('m2-npv', 'm2-npv-irr-unique'))).toEqual([
      'irr',
    ]);
    expect(mapLegacyExercise('m2-npv', legacyExercise('m2-npv', 'm2-npv-scenario'))).toEqual([
      'npv',
      'irr',
    ]);
    expect(mapLegacyExercise('m2-npv', legacyExercise('m2-npv', 'm2-npv-english'))).toEqual([
      'english-terminology',
    ]);
  });

  it('distinguishes a coupon calculation, ownership rights and total versus portfolio return', () => {
    expect(
      mapLegacyExercise('m3-securities', legacyExercise('m3-securities', 'm3-securities-practice')),
    ).toEqual(['bonds', 'dividends']);
    expect(
      mapLegacyExercise('m3-securities', legacyExercise('m3-securities', 'm3-securities-rights')),
    ).toEqual(['stocks', 'bonds']);
    expect(
      mapLegacyExercise(
        'm3-total-return',
        legacyExercise('m3-total-return', 'm3-total-return-practice'),
      ),
    ).toEqual(['returns']);
    expect(
      mapLegacyExercise('m3-portfolio', legacyExercise('m3-portfolio', 'm3-portfolio-practice')),
    ).toEqual(['portfolio-returns']);
  });

  it('respects explicit typed metadata and explicit difficulty without guessing unknown content', () => {
    const exercise = entriesFor('english-reading')[0].exercise;
    expect(mapLegacyExercise('unknown', exercise)).toEqual(['english-reading']);
    expect(mapLegacyExercise('unknown', { ...exercise, competencyIds: ['not-a-skill'] })).toEqual(
      [],
    );
    expect(
      difficultyForExercise(
        'm3-diversification',
        legacyExercise('m3-diversification', 'm3-diversification-practice'),
      ),
    ).toBe(3);
    expect(difficultyForExercise('unknown', { ...exercise, difficulty: 3 })).toBe(3);
  });
});

describe('history normalization, versions and deduplication', () => {
  it('merges the same legacy and richer event ID once and preserves hint information', () => {
    const progress = emptyProgress();
    progress.attempts = [
      {
        id: 'shared-client-id',
        lessonId: 'm1-money',
        exerciseId: 'm1-money-practice',
        runId: 'legacy-run',
        contentVersion: 1,
        answer: '10800',
        correct: true,
        at: start,
      },
    ];
    const richer = event({
      id: 'shared-client-id',
      mode: 'lesson',
      contentVersion: 1,
      lessonId: 'm1-money',
      exerciseId: 'm1-money-practice',
      templateId: 'm1-money-practice',
      variantId: 'm1-money-practice',
      hintsUsed: true,
    });
    const evidence = collectEvidence(progress, data([richer, richer]), []);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      source: 'learning',
      hintsUsed: true,
      competencyIds: ['interest-rates', 'future-value'],
    });
    const invalid = collectEvidence(
      progress,
      data([{ ...richer, valid: false, correct: false, errorType: 'format' }]),
      [],
    );
    expect(invalid).toHaveLength(1);
    expect(invalid[0].valid).toBe(false);
  });

  it('re-evaluates legacy input, excludes outdated content and ignores unknown future practice versions', () => {
    const progress = emptyProgress();
    progress.attempts = [
      {
        id: 'bad-legacy',
        lessonId: 'm1-money',
        exerciseId: 'm1-money-practice',
        runId: 'run',
        answer: '',
        correct: true,
        at: start,
      },
      {
        id: 'outdated',
        lessonId: 'm1-money',
        exerciseId: 'm1-money-practice',
        runId: 'run',
        contentVersion: 2,
        answer: '10800',
        correct: true,
        at: start,
      },
    ];
    const future = event({ contentVersion: 3 });
    const evidence = collectEvidence(progress, data([future]), []);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      id: 'bad-legacy',
      valid: false,
      correct: false,
      errorType: 'format',
    });
    const snapshot = buildKnowledge(progress, data([future]), [], end);
    expect(snapshot.skills.find((item) => item.id === 'interest-rates')?.mastery).toBe(0);
  });

  it('sorts actual instants across offsets and handles duplicate ID conflicts deterministically', () => {
    const entries = entriesFor('english-reading');
    const early = eventFor(entries[0], {
      id: 'early',
      correct: false,
      errorType: 'calculation',
      at: '2026-01-01T12:00:00+05:00',
    });
    const later = eventFor(entries[0], { id: 'later', at: '2026-01-01T08:00:00Z' });
    const events = [later, early, { ...later, correct: false, errorType: 'concept' as const }];
    const first = collectEvidence(emptyProgress(), data(events), entries);
    const reversed = collectEvidence(emptyProgress(), data([...events].reverse()), entries);
    expect(first).toEqual(reversed);
    expect(first.map((item) => item.id)).toEqual(['early', 'later']);
    expect(first[1].correct).toBe(false);
    expect(first[0].at).toBe('2026-01-01T07:00:00.000Z');
  });
});

describe('bounded, evidence-based mastery', () => {
  it('starts all 20 skills at zero without inventing accuracy or a due queue', () => {
    const snapshot = buildKnowledge(emptyProgress(), data(), [], start);
    expect(
      snapshot.skills.every(
        (item) => item.mastery === 0 && item.status === 'not-started' && item.attempts === 0,
      ),
    ).toBe(true);
    expect(snapshot.reviewQueue).toEqual([]);
    expect(snapshot.recommendations[0].kind).toBe('lesson');
    expect(snapshot.recommendations[0].reason).toContain('не оценён');
  });

  it('caps ordinary financial practice at 45 and English practice at 55 without retention or verified exams', () => {
    const finance = entriesFor('npv', 6);
    const english = entriesFor('english-reading');
    const financeAssessment = skill('npv', history(finance), finance, start);
    const englishAssessment = skill('english-reading', history(english), english, start);
    expect(financeAssessment.practiceScore).toBe(100);
    expect(financeAssessment.mastery).toBe(45);
    expect(englishAssessment.mastery).toBe(55);
    expect(financeAssessment.reviewScore).toBe(0);
    expect(financeAssessment.examScore).toBe(0);
  });

  it('ignores invalid answers for the first independent attempt while exposing useful format/error counts', () => {
    const entries = entriesFor('english-reading');
    const invalid = eventFor(entries[0], {
      valid: false,
      correct: false,
      errorType: 'unit',
      at: '2026-01-01T10:00:00Z',
    });
    const correct = eventFor(entries[0]);
    const assessment = skill('english-reading', [invalid, correct], entries, start);
    expect(assessment.attempts).toBe(1);
    expect(assessment.correctIndependent).toBe(1);
    expect(assessment.firstAttemptAccuracy).toBe(100);
    expect(assessment.errorCounts).toEqual({ unit: 1 });
    expect(assessment.reviewStage).toBe(0);
  });

  it('bounds corrected guesses at 0.35 and hinted first answers at 0.5', () => {
    const entries = entriesFor('english-reading');
    const wrong = history(entries).map((item) => ({
      ...item,
      correct: false,
      errorType: 'calculation' as const,
    }));
    const corrected = wrong.map((item) => ({
      ...item,
      id: `${item.id}-retry`,
      at: '2026-01-01T12:01:00Z',
      correct: true,
      errorType: 'none' as const,
    }));
    const retry = skill('english-reading', [...wrong, ...corrected], entries, end);
    expect(retry.practiceScore).toBe(35);
    expect(retry.mastery).toBe(19.25);
    expect(retry.correctIndependent).toBe(0);
    const hinted = skill(
      'english-reading',
      history(entries).map((item) => ({ ...item, hintsUsed: true })),
      entries,
      start,
    );
    expect(hinted.practiceScore).toBe(50);
    expect(hinted.mastery).toBe(27.5);
  });

  it('does not farm mastery from new sessions, duplicate IDs, same-day answers or the same variant on later days', () => {
    const entries = entriesFor('english-reading');
    const initial = history(entries);
    const farmed = [
      ...initial,
      ...initial,
      ...Array.from({ length: 30 }, (_, index) => ({
        ...initial[0],
        id: `repeat-${index}`,
        sessionId: `repeat-session-${index}`,
        at: addUtcDays(start, index),
        mode: 'review' as const,
      })),
    ];
    const before = skill('english-reading', initial, entries, end);
    const after = skill('english-reading', farmed, entries, end);
    expect(after.mastery).toBe(before.mastery);
    expect(after.correctIndependent).toBe(before.correctIndependent);
    expect(after.attemptedTemplates).toBe(3);
    expect(after.reviewStage).toBe(0);
  });

  it('uses an average and coverage rather than awarding unlimited points for seeded variants of one template', () => {
    const entries = entriesFor('english-reading');
    const oneTemplate = Array.from({ length: 100 }, (_, index) =>
      eventFor(entries[0], { variantId: `independent-${index}`, seed: index }),
    );
    const assessment = skill('english-reading', oneTemplate, entries, start);
    expect(assessment.attemptedTemplates).toBe(1);
    expect(assessment.practiceCoverage).toBe(33.33);
    expect(assessment.practiceScore).toBe(33.33);
    expect(assessment.mastery).toBeCloseTo(18.33, 2);
  });

  it('recomputes identically from shuffled history and never mutates its inputs', () => {
    const entries = entriesFor('english-reading');
    const progress = emptyProgress();
    const learning = data([...history(entries), ...reviewHistory('english-reading', entries[0])]);
    const original = JSON.stringify({ progress, learning, entries });
    const before = buildKnowledge(progress, learning, entries, end);
    const after = buildKnowledge(
      progress,
      { ...learning, events: [...learning.events].reverse() },
      [...entries].reverse(),
      end,
    );
    expect(after).toEqual(before);
    expect(JSON.stringify({ progress, learning, entries })).toBe(original);
    expect(
      before.skills.every(
        (item) => Number.isFinite(item.mastery) && item.mastery >= 0 && item.mastery <= 100,
      ),
    ).toBe(true);
  });
});

describe('verified exam component', () => {
  it('does not treat a legacy completion or local legacy exam answers as a verified exam', () => {
    const progress = emptyProgress();
    progress.completions = [
      { lessonId: 'm2-exam', version: 1, runId: 'legacy-exam', score: 100, completedAt: start },
    ];
    const snapshot = buildKnowledge(progress, data(), [], end);
    expect(snapshot.skills.every((item) => item.examScore === 0)).toBe(true);
    expect(snapshot.skills.every((item) => item.mastery === 0)).toBe(true);
  });

  it('assigns the protected 25% only to current trusted exam results and replaces an older module result', () => {
    const result = trustedExam('npv');
    expect(skill('npv', [], [], end, [result, result]).examScore).toBe(100);
    expect(skill('npv', [], [], end, [result]).mastery).toBe(25);
    const newer = trustedExam('npv', false, {
      id: 'new-result',
      submittedAt: '2026-01-04T12:00:00Z',
    });
    expect(skill('npv', [], [], end, [result, newer]).examScore).toBe(0);
    expect(skill('npv', [], [], end, [{ ...result, bankVersion: 4 }]).examScore).toBe(0);
  });

  it('does not invent an English exam component and lets real practice plus delayed reviews reach its applicable 100%', () => {
    const entries = entriesFor('english-reading');
    const events = [...history(entries), ...reviewHistory('english-reading', entries[0])];
    const assessment = skill('english-reading', events, entries, '2026-01-26T12:00:00Z', [
      trustedExam('english-reading'),
    ]);
    expect(assessment.examApplicable).toBe(false);
    expect(assessment.examScore).toBe(0);
    expect(assessment.practiceScore).toBe(100);
    expect(assessment.reviewScore).toBe(100);
    expect(assessment.mastery).toBe(100);
  });

  it('requires retention and verified exam evidence for financial mastered status and prioritizes due reviews', () => {
    const entries = entriesFor('financial-literacy', 6);
    const events = [...history(entries), ...reviewHistory('financial-literacy', entries[0])];
    const now = '2026-01-26T12:00:00Z';
    const beforeExam = skill('financial-literacy', events, entries, now);
    expect(beforeExam.mastery).toBe(75);
    expect(beforeExam.status).toBe('learning');
    const result = trustedExam('financial-literacy', true, { moduleId: 'm1', lessonId: 'm1-exam' });
    const mastered = skill('financial-literacy', events, entries, now, [result]);
    expect(mastered.mastery).toBe(100);
    expect(mastered.status).toBe('mastered');
    expect(
      skill('financial-literacy', events, entries, '2026-02-25T12:00:00Z', [result]).status,
    ).toBe('review');
  });
});

describe('recomputable review schedule and UTC timing', () => {
  const schedule = (events: LearningEvent[], now = end) =>
    deriveReviewSchedule(
      events.map((item) => ({ ...item, source: 'learning' as const })),
      now,
    );

  it('uses 1/3/7/14/30 day intervals after independent delayed reviews', () => {
    const entries = entriesFor('english-reading');
    const events = reviewHistory('english-reading', entries[0]);
    expect(schedule(events.slice(0, 1)).dueAt).toBe('2026-01-02T12:00:00.000Z');
    expect(schedule(events.slice(0, 2))).toMatchObject({
      stage: 1,
      dueAt: '2026-01-05T12:00:00.000Z',
    });
    expect(schedule(events.slice(0, 3))).toMatchObject({
      stage: 2,
      dueAt: '2026-01-12T12:00:00.000Z',
    });
    expect(schedule(events.slice(0, 4))).toMatchObject({
      stage: 3,
      dueAt: '2026-01-26T12:00:00.000Z',
    });
    expect(schedule(events)).toMatchObject({ stage: 4, dueAt: '2026-02-25T12:00:00.000Z' });
  });

  it('does not advance for same-day successes, hinted reviews or memorized identical variants', () => {
    const entry = entriesFor('english-reading')[0];
    const initial = eventFor(entry);
    const sameDay = eventFor(entry, {
      variantId: 'new-same-day',
      mode: 'review',
      at: '2026-01-01T13:00:00Z',
    });
    expect(schedule([initial, sameDay])).toMatchObject({
      stage: 0,
      dueAt: '2026-01-02T13:00:00.000Z',
    });
    const hinted = eventFor(entry, {
      variantId: 'new-hinted',
      mode: 'review',
      at: '2026-01-03T13:00:00Z',
      hintsUsed: true,
    });
    expect(schedule([initial, hinted]).stage).toBe(0);
    const memorized = {
      ...initial,
      id: 'same-variant-tomorrow',
      mode: 'review' as const,
      at: '2026-01-03T13:00:00Z',
    };
    expect(schedule([initial, memorized]).stage).toBe(0);
  });

  it('does not let early extra sessions shorten an existing retention interval', () => {
    const entry = entriesFor('english-reading')[0];
    const firstStage = reviewHistory('english-reading', entry).slice(0, 2);
    const early = eventFor(entry, {
      variantId: 'early',
      mode: 'review',
      at: '2026-01-03T12:00:00Z',
    });
    const stillEarly = eventFor(entry, {
      variantId: 'still-early',
      mode: 'review',
      at: '2026-01-04T12:00:00Z',
    });
    expect(schedule([...firstStage, early, stillEarly]).stage).toBe(1);
    const due = eventFor(entry, {
      variantId: 'now-due',
      mode: 'review',
      at: '2026-01-05T12:00:00Z',
    });
    expect(schedule([...firstStage, early, stillEarly, due]).stage).toBe(2);
  });

  it('makes a failed review due now and resets retention; correction moves it to tomorrow without adding retention', () => {
    const entry = entriesFor('english-reading')[0];
    const successful = reviewHistory('english-reading', entry);
    const failed = eventFor(entry, {
      variantId: 'failure',
      mode: 'review',
      at: '2026-02-01T12:00:00Z',
      correct: false,
      errorType: 'concept',
    });
    expect(schedule([...successful, failed])).toMatchObject({
      stage: 0,
      dueAt: '2026-02-01T12:00:00.000Z',
      qualifiedReviews: 0,
    });
    const corrected = {
      ...failed,
      id: 'retry',
      correct: true,
      errorType: 'none' as const,
      at: '2026-02-01T12:01:00Z',
    };
    expect(schedule([...successful, failed, corrected])).toMatchObject({
      stage: 0,
      dueAt: '2026-02-02T12:01:00.000Z',
    });
    const snapshot = buildKnowledge(emptyProgress(), data([...successful, failed]), [entry], end);
    expect(
      snapshot.reviewQueue.find((item) => item.competencyId === 'english-reading')?.reason,
    ).toContain('ошибки в понимании принципа');
  });

  it('requires a full 24 hours, uses UTC days and preserves UTC time across daylight-saving changes', () => {
    expect(utcDay('2026-03-29T01:30:00+02:00')).toBe('2026-03-28');
    expect(addUtcDays('2026-03-28T12:00:00Z', 1)).toBe('2026-03-29T12:00:00.000Z');
    const entry = entriesFor('english-reading')[0];
    const initial = eventFor(entry, { at: '2026-03-28T12:00:00Z' });
    const tooEarly = eventFor(entry, {
      at: '2026-03-29T13:00:00+02:00',
      variantId: 'dst-early',
      mode: 'review',
    });
    expect(schedule([initial, tooEarly], '2026-03-30T12:00:00Z').stage).toBe(0);
    const delayed = eventFor(entry, {
      at: '2026-03-29T14:00:00+02:00',
      variantId: 'dst-valid',
      mode: 'review',
    });
    expect(schedule([initial, delayed], '2026-03-30T12:00:00Z').stage).toBe(1);
  });

  it('ignores future history until its actual timestamp and invalid inputs never reset retention', () => {
    const entry = entriesFor('english-reading')[0];
    const events = reviewHistory('english-reading', entry);
    expect(schedule(events, '2026-01-05T12:00:00Z').stage).toBe(2);
    const invalid = eventFor(entry, {
      valid: false,
      correct: false,
      errorType: 'format',
      at: '2026-01-27T12:00:00Z',
    });
    expect(schedule([...events, invalid]).stage).toBe(4);
    expect(() => schedule(events, 'not-a-date')).toThrow(RangeError);
  });
});

describe('adaptive recommendations and concrete task selection', () => {
  it('uses missing foundations as a lesson fallback and explains the concrete error', () => {
    const entries = entriesFor('npv', 6);
    const failed = eventFor(entries[0], { correct: false, errorType: 'calculation' });
    const snapshot = buildKnowledge(emptyProgress(), data([failed]), entries, start);
    const first = snapshot.recommendations[0];
    expect(first.kind).toBe('lesson');
    expect(first.competencyId).toBe('financial-literacy');
    expect(first.lessonId).toBe('m1-money');
    expect(first.reason).toContain('сначала укрепите');
    expect(first.reason).toContain('ошибки расчёта');
    const queued = snapshot.reviewQueue.find((item) => item.competencyId === 'npv')!;
    expect(queued.reason).toContain('ошибки расчёта');
    expect(queued.exerciseId).not.toBeNull();
    expect(entries.some((entry) => entry.exercise.id === queued.exerciseId)).toBe(true);
  });

  it('prioritizes financial English for an English goal without fabricating a starting mastery', () => {
    const progress = emptyProgress();
    progress.preferences.goal = 'Освоить финансовый английский';
    const snapshot = buildKnowledge(progress, data(), entriesFor('english-terminology'), start);
    expect(snapshot.recommendations[0].competencyId).toBe('english-terminology');
    expect(snapshot.recommendations[0].kind).toBe('practice');
    expect(snapshot.skills.find((item) => item.id === 'english-terminology')?.mastery).toBe(0);
  });

  it('selects a real template at a supported difficulty and raises challenge only after independent evidence', () => {
    const entries = entriesFor('english-terminology', 9).map((entry, index): ExerciseEntry => ({
      ...entry,
      difficulty: index < 3 ? 1 : index < 6 ? 2 : 3,
    }));
    const initial = buildKnowledge(emptyProgress(), data(), entries, start).recommendations.find(
      (item) => item.competencyId === 'english-terminology',
    )!;
    expect(initial.difficulty).toBe(1);
    const events = history(entries.slice(0, 3));
    const intermediate = buildKnowledge(
      emptyProgress(),
      data(events),
      entries,
      start,
    ).recommendations.find((item) => item.competencyId === 'english-terminology')!;
    expect(intermediate.difficulty).toBe(2);
    const advanced = buildKnowledge(
      emptyProgress(),
      data(history(entries.slice(0, 6))),
      entries,
      start,
    );
    expect(advanced.skills.find((item) => item.id === 'english-terminology')?.nextDifficulty).toBe(
      3,
    );
    expect(advanced.recommendations[0].competencyId).not.toBe('english-terminology');
  });
  it('moves on after strong broad practice instead of treating missing future reviews as a current weakness', () => {
    const entries = entriesFor('financial-literacy', 6);
    const snapshot = buildKnowledge(emptyProgress(), data(history(entries)), entries, start);
    const literacy = snapshot.skills.find((item) => item.id === 'financial-literacy')!;
    expect(literacy.practiceScore).toBe(100);
    expect(literacy.mastery).toBe(45);
    expect(literacy.reviewStage).toBe(0);
    expect(snapshot.recommendations[0].competencyId).not.toBe('financial-literacy');
  });
  it('suggests an accessible explanation when the practiced standalone bank needs broader lesson coverage', () => {
    const entries = entriesFor('financial-literacy', 1);
    const progress = emptyProgress();
    const snapshot = buildKnowledge(progress, data(history(entries)), entries, start);
    const next = snapshot.recommendations[0];
    expect(next.competencyId).toBe('financial-literacy');
    expect(next.kind).toBe('lesson');
    expect(
      isUnlocked(
        lessons.find((lesson) => lesson.id === next.lessonId)!,
        lessons,
        progress,
      ),
    ).toBe(true);
  });
});
