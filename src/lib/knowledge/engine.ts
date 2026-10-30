import { competencies, getCompetency } from '@/content/skills';
import type {
  CompetencyId,
  ErrorType,
  ExamResult,
  ExerciseEntry,
  LearningData,
} from '../learning-types';
import { hasCompleted, isUnlocked, type Progress } from '../progress';
import { lessons } from '@/content/curriculum';
import { collectEvidence, exerciseCatalogue, type CatalogueEntry } from './evidence';
import { deriveReviewSchedule } from './retention';
import type {
  KnowledgeEvidence,
  KnowledgeSnapshot,
  Recommendation,
  ReviewItem,
  SkillAssessment,
} from './types';

export const MASTERY_WEIGHTS = {
  financial: { practice: 0.45, review: 0.3, exam: 0.25 },
  english: { practice: 0.55, review: 0.45, exam: 0 },
} as const;
export const PREREQUISITE_MASTERY = 30;

type PracticeUnit = {
  templateId: string;
  variantId: string;
  first: KnowledgeEvidence;
  credit: number;
  independentCorrect: boolean;
};

const round = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
const difficultyWeight = (difficulty: 1 | 2 | 3) => 1 + (difficulty - 1) * 0.25;

function practiceUnits(evidence: KnowledgeEvidence[]): PracticeUnit[] {
  const groups = new Map<string, KnowledgeEvidence[]>();
  for (const event of evidence) {
    if (!event.valid) continue;
    const key = `${event.templateId}|${event.variantId}`;
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((events) => {
      events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
      const first = events[0];
      const corrected = events.some((event) => event.correct);
      const credit = first.correct ? (first.hintsUsed ? 0.5 : 1) : corrected ? 0.35 : 0;
      return {
        templateId: first.templateId,
        variantId: first.variantId,
        first,
        credit,
        independentCorrect: first.correct && !first.hintsUsed,
      };
    })
    .sort(
      (a, b) =>
        Date.parse(a.first.at) - Date.parse(b.first.at) || a.first.id.localeCompare(b.first.id),
    );
}

function practiceScore(units: PracticeUnit[], available: CatalogueEntry[]) {
  const knownTemplates = new Set(
    available
      .filter((entry) => !entry.exam)
      .map((entry) => entry.exercise.templateId ?? entry.exercise.id),
  );
  const target = Math.max(3, Math.min(6, knownTemplates.size));
  const perTemplate = new Map<string, PracticeUnit[]>();
  for (const unit of units) {
    const group = perTemplate.get(unit.templateId) ?? [];
    group.push(unit);
    perTemplate.set(unit.templateId, group);
  }
  let weightedScore = 0;
  let totalWeight = 0;
  for (const variants of perTemplate.values()) {
    const recent = [...variants]
      .sort(
        (a, b) =>
          Date.parse(b.first.at) - Date.parse(a.first.at) || a.first.id.localeCompare(b.first.id),
      )
      .slice(0, 3);
    const weights = recent.reduce((sum, unit) => sum + difficultyWeight(unit.first.difficulty), 0);
    const score =
      recent.reduce((sum, unit) => sum + unit.credit * difficultyWeight(unit.first.difficulty), 0) /
      weights;
    const templateWeight = weights / recent.length;
    weightedScore += score * templateWeight;
    totalWeight += templateWeight;
  }
  const coverage = Math.min(1, perTemplate.size / target);
  return {
    score: totalWeight ? (weightedScore / totalWeight) * coverage * 100 : 0,
    coverage: coverage * 100,
    templates: perTemplate.size,
  };
}

/** Only trusted RPC/DB ExamResults belong here; a plain TS object is not proof of origin. */
function verifiedExamScore(id: CompetencyId, results: ExamResult[], now: number): number {
  if (id.startsWith('english-')) return 0;
  const latest = new Map<string, ExamResult>();
  const seen = new Set<string>();
  const sorted = [...results]
    .filter(
      (result) =>
        [2, 3].includes(result.bankVersion) &&
        Number.isFinite(Date.parse(result.submittedAt)) &&
        Date.parse(result.submittedAt) <= now,
    )
    .sort(
      (a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt) || b.id.localeCompare(a.id),
    );
  for (const result of sorted) {
    if (seen.has(result.id)) continue;
    seen.add(result.id);
    if (!result.answers.some((answer) => answer.competencyIds.includes(id))) continue;
    if (!latest.has(result.moduleId)) latest.set(result.moduleId, result);
  }
  let correct = 0;
  let total = 0;
  for (const result of latest.values()) {
    const questions = new Set<string>();
    for (const answer of result.answers) {
      if (!answer.competencyIds.includes(id) || questions.has(answer.questionId)) continue;
      questions.add(answer.questionId);
      const weight = difficultyWeight(answer.difficulty);
      total += weight;
      if (answer.correct) correct += weight;
    }
  }
  return total ? (correct / total) * 100 : 0;
}

function desiredDifficulty(units: PracticeUnit[]): 1 | 2 | 3 {
  const recent = units.slice(-6);
  if (recent.length < 3 || recent.slice(-2).some((unit) => !unit.independentCorrect)) return 1;
  const mean = recent.reduce((sum, unit) => sum + unit.credit, 0) / recent.length;
  if (recent.length >= 6 && mean >= 0.85) return 3;
  return mean >= 0.75 ? 2 : 1;
}

function taskFor(id: CompetencyId, catalogue: CatalogueEntry[], evidence: KnowledgeEvidence[]) {
  const related = evidence.filter((event) => event.competencyIds.includes(id));
  const difficulty = desiredDifficulty(practiceUnits(related));
  const lastByTemplate = new Map<string, number>();
  for (const event of related) {
    if (event.valid)
      lastByTemplate.set(
        event.templateId,
        Math.max(lastByTemplate.get(event.templateId) ?? 0, Date.parse(event.at)),
      );
  }
  const selected = catalogue
    .filter((entry) => !entry.exam && entry.competencyIds.includes(id))
    .sort(
      (a, b) =>
        (lastByTemplate.get(a.exercise.templateId ?? a.exercise.id) ?? 0) -
          (lastByTemplate.get(b.exercise.templateId ?? b.exercise.id) ?? 0) ||
        Number(a.legacy) - Number(b.legacy) ||
        Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty) ||
        a.exercise.id.localeCompare(b.exercise.id),
    )[0];
  return {
    lessonId: selected?.lessonId ?? getCompetency(id).lessonIds[0],
    templateId: selected ? (selected.exercise.templateId ?? selected.exercise.id) : null,
    exerciseId: selected?.exercise.id ?? null,
    difficulty: selected?.difficulty ?? difficulty,
    needsLesson: Boolean(selected?.legacy),
  };
}

const errorDescriptions: Record<ErrorType, string> = {
  none: 'ошибок нет',
  concept: 'ошибки в понимании принципа',
  calculation: 'ошибки расчёта',
  unit: 'путаница в единицах измерения',
  format: 'ошибки формата ответа',
  selection: 'ошибки выбора или сопоставления',
  ordering: 'ошибки порядка действий',
};

function errorReason(skill: SkillAssessment): string {
  const frequent = Object.entries(skill.errorCounts)
    .filter(([type]) => type !== 'none')
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0) || a[0].localeCompare(b[0]))[0];
  if (frequent)
    return `${errorDescriptions[frequent[0] as ErrorType]}: ${frequent[1]} ${frequent[1] === 1 ? 'ответ' : 'ответа/ответов'}.`;
  if (skill.attempts)
    return `Самостоятельно верных первых решений: ${skill.correctIndependent}; точность — ${skill.firstAttemptAccuracy}%.`;
  return 'Проверенных ответов пока нет: уровень не оценён.';
}

function foundationFor(
  skill: SkillAssessment,
  byId: Map<CompetencyId, SkillAssessment>,
): SkillAssessment {
  const visited = new Set<CompetencyId>();
  let current = skill;
  while (current.missingPrerequisites.length && !visited.has(current.id)) {
    visited.add(current.id);
    current = current.missingPrerequisites
      .map((id) => byId.get(id)!)
      .sort(
        (a, b) =>
          a.mastery - b.mastery ||
          competencies.findIndex((item) => item.id === a.id) -
            competencies.findIndex((item) => item.id === b.id),
      )[0];
  }
  return current;
}

/** Recomputable knowledge model. All time-dependent behavior uses the explicit ISO `now` input. */
export function buildKnowledge(
  progress: Progress,
  learning: LearningData,
  entries: ExerciseEntry[],
  now: string,
): KnowledgeSnapshot {
  const cutoff = Date.parse(now);
  if (!Number.isFinite(cutoff))
    throw new RangeError('Для расчёта знаний нужна корректная дата ISO.');
  const evidence = collectEvidence(progress, learning, entries).filter(
    (event) => Date.parse(event.at) <= cutoff,
  );
  const catalogue = exerciseCatalogue(entries);
  const skills: SkillAssessment[] = competencies.map((competency) => {
    const events = evidence.filter((event) => event.competencyIds.includes(competency.id));
    const valid = events.filter((event) => event.valid);
    const units = practiceUnits(events);
    const practice = practiceScore(
      units,
      catalogue.filter((entry) => entry.competencyIds.includes(competency.id)),
    );
    const schedule = deriveReviewSchedule(events, now);
    const examApplicable = competency.group !== 'english';
    const exam = verifiedExamScore(competency.id, learning.examResults, cutoff);
    const weights = examApplicable ? MASTERY_WEIGHTS.financial : MASTERY_WEIGHTS.english;
    const reviewScore = (schedule.stage / 4) * 100;
    const mastery = round(
      practice.score * weights.practice + reviewScore * weights.review + exam * weights.exam,
    );
    const errorCounts: SkillAssessment['errorCounts'] = {};
    for (const event of events) {
      if (!event.correct && event.errorType !== 'none')
        errorCounts[event.errorType] = (errorCounts[event.errorType] ?? 0) + 1;
    }
    return {
      ...competency,
      mastery,
      practiceScore: round(practice.score),
      reviewScore: round(reviewScore),
      examScore: round(exam),
      practiceCoverage: round(practice.coverage),
      reviewStage: schedule.stage,
      attempts: valid.length,
      correctIndependent: units.filter((unit) => unit.independentCorrect).length,
      attemptedTemplates: practice.templates,
      firstAttemptAccuracy: units.length
        ? round((units.filter((unit) => unit.independentCorrect).length / units.length) * 100)
        : 0,
      errorCounts,
      dueAt: schedule.dueAt,
      lastPracticedAt: schedule.lastPracticedAt,
      missingPrerequisites: [],
      examApplicable,
      nextDifficulty: desiredDifficulty(units),
      status: valid.length || exam > 0 ? 'learning' : 'not-started',
    };
  });
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  for (const skill of skills) {
    skill.missingPrerequisites = skill.prerequisites.filter(
      (id) => byId.get(id)!.mastery < PREREQUISITE_MASTERY,
    );
    if (skill.dueAt && Date.parse(skill.dueAt) <= cutoff) skill.status = 'review';
    else if (
      skill.mastery >= 80 &&
      skill.reviewStage >= 2 &&
      (!skill.examApplicable || skill.examScore >= 70) &&
      !skill.missingPrerequisites.length
    )
      skill.status = 'mastered';
  }
  const reviewQueue: ReviewItem[] = skills
    .filter((skill) => skill.dueAt !== null && Date.parse(skill.dueAt) <= cutoff)
    .sort(
      (a, b) =>
        Date.parse(a.dueAt!) - Date.parse(b.dueAt!) ||
        a.mastery - b.mastery ||
        a.id.localeCompare(b.id),
    )
    .map((skill) => ({
      competencyId: skill.id,
      dueAt: skill.dueAt!,
      stage: skill.reviewStage,
      ...taskFor(skill.id, catalogue, evidence),
      reason: `Повторение назначено на ${skill.dueAt!.slice(0, 10)} UTC. ${errorReason(skill)}`,
    }));

  const englishGoal = /англий|english/iu.test(progress.preferences.goal);
  const rank = (skill: SkillAssessment) =>
    skill.status === 'review'
      ? 0
      : skill.attempts && (skill.practiceScore < 75 || skill.firstAttemptAccuracy < 75)
        ? 1
        : skill.status === 'not-started'
          ? 2
          : 3;
  const candidates = [...skills].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Number(englishGoal && b.group === 'english') - Number(englishGoal && a.group === 'english') ||
      a.mastery - b.mastery ||
      competencies.findIndex((item) => item.id === a.id) -
        competencies.findIndex((item) => item.id === b.id),
  );
  const recommendations: Recommendation[] = [];
  const recommended = new Set<CompetencyId>();
  for (const source of candidates) {
    const target = foundationFor(source, byId);
    if (recommended.has(target.id)) continue;
    recommended.add(target.id);
    const { needsLesson, ...task } = taskFor(target.id, catalogue, evidence);
    const missingFoundation = source.id !== target.id;
    const kind =
      missingFoundation || (!target.attempts && target.group !== 'english') || !task.exerciseId
        ? 'lesson'
        : source.status === 'review'
          ? 'review'
          : needsLesson
            ? 'lesson'
            : 'practice';
    const reason = missingFoundation
      ? `Для «${source.name}» сначала укрепите «${target.name}»: освоение ${target.mastery}% при ориентире основы ${PREREQUISITE_MASTERY}%. ${errorReason(source)} ${errorReason(target)}`
      : source.status === 'review'
        ? `Подошёл срок повторения «${source.name}». ${errorReason(source)}`
        : `${target.name}: освоение ${target.mastery}%. ${errorReason(target)}`;
    const preferredLessonId =
      kind === 'lesson' && (missingFoundation || !target.attempts || !needsLesson)
        ? target.lessonIds[0]
        : task.lessonId;
    const preferredLesson = lessons.find((lesson) => lesson.id === preferredLessonId);
    const accessibleLesson =
      kind === 'lesson' && preferredLesson && !isUnlocked(preferredLesson, lessons, progress)
        ? lessons.find(
            (lesson) =>
              lesson.moduleId === preferredLesson.moduleId &&
              !lesson.exam &&
              !hasCompleted(progress, lesson) &&
              isUnlocked(lesson, lessons, progress),
          )
        : preferredLesson;
    recommendations.push({
      competencyId: target.id,
      kind,
      ...task,
      lessonId: accessibleLesson?.id ?? preferredLessonId,
      reason,
    });
    if (recommendations.length === 5) break;
  }
  return { at: new Date(cutoff).toISOString(), skills, reviewQueue, recommendations, evidence };
}
