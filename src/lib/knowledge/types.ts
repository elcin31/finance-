import type { Competency, CompetencyId, ErrorType, LearningEvent } from '../learning-types';

export type KnowledgeEvidence = LearningEvent & { source: 'legacy' | 'learning' };
export type SkillStatus = 'not-started' | 'learning' | 'review' | 'mastered';

export type SkillAssessment = Competency & {
  mastery: number;
  status: SkillStatus;
  /** Normalized component scores, 0–100. Their weighted sum is mastery. */
  practiceScore: number;
  reviewScore: number;
  examScore: number;
  practiceCoverage: number;
  reviewStage: number;
  attempts: number;
  correctIndependent: number;
  attemptedTemplates: number;
  firstAttemptAccuracy: number;
  errorCounts: Partial<Record<ErrorType, number>>;
  dueAt: string | null;
  lastPracticedAt: string | null;
  missingPrerequisites: CompetencyId[];
  examApplicable: boolean;
  nextDifficulty: 1 | 2 | 3;
};

export type Recommendation = {
  competencyId: CompetencyId;
  kind: 'review' | 'practice' | 'lesson';
  lessonId: string;
  templateId: string | null;
  exerciseId: string | null;
  difficulty: 1 | 2 | 3;
  reason: string;
};

export type ReviewItem = Omit<Recommendation, 'kind'> & {
  dueAt: string;
  stage: number;
};

export type KnowledgeSnapshot = {
  at: string;
  skills: SkillAssessment[];
  reviewQueue: ReviewItem[];
  recommendations: Recommendation[];
  evidence: KnowledgeEvidence[];
};
