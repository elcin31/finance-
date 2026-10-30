import type { Answer, Exercise } from './types';

export type CompetencyId =
  | 'financial-literacy'
  | 'interest-rates'
  | 'inflation'
  | 'returns'
  | 'compounding'
  | 'present-value'
  | 'future-value'
  | 'discounting'
  | 'npv'
  | 'irr'
  | 'stocks'
  | 'bonds'
  | 'dividends'
  | 'portfolio-returns'
  | 'diversification'
  | 'risk-return'
  | 'english-terminology'
  | 'english-reading'
  | 'english-calculations'
  | 'english-expressions';
export type CompetencyGroup = 'fundamentals' | 'mathematics' | 'investments' | 'english';
export type Competency = {
  id: CompetencyId;
  name: string;
  english: string;
  description: string;
  group: CompetencyGroup;
  lessonIds: string[];
  prerequisites: CompetencyId[];
};
export type ErrorType =
  'none' | 'concept' | 'calculation' | 'unit' | 'format' | 'selection' | 'ordering';
export type LearningMode = 'lesson' | 'practice' | 'review' | 'english';
export type LearningEvent = {
  id: string;
  sessionId: string;
  exerciseId: string;
  templateId: string;
  variantId: string;
  seed: number;
  lessonId: string;
  contentVersion: number;
  competencyIds: CompetencyId[];
  difficulty: 1 | 2 | 3;
  mode: LearningMode;
  answer: Answer;
  valid: boolean;
  correct: boolean;
  errorType: ErrorType;
  hintsUsed: boolean;
  at: string;
};
export type PracticeDraft = {
  id: string;
  sessionId?: string;
  exerciseId: string;
  templateId: string;
  seed: number;
  mode: 'practice' | 'review' | 'english';
  answer: Answer;
  hintsUsed?: boolean;
  updatedAt: string;
};
export type ExamQuestion = {
  id: string;
  exercise: Exercise;
  competencyIds: CompetencyId[];
  difficulty: 1 | 2 | 3;
};
/** Public exam exercise omits all grading keys until submission is finished. */
export type PublicExamQuestion = {
  id: string;
  competencyIds: CompetencyId[];
  difficulty: 1 | 2 | 3;
  exercise: Omit<Exercise, 'correct' | 'expected' | 'correctOrder' | 'explanation' | 'hint'> & {
    kind: Exercise['kind'];
    options?: { id: string; label: string }[];
    pairs?: { id: string; left: string; right: string }[];
    items?: { id: string; label: string }[];
    unit?: 'number' | 'percent' | 'currency' | 'bps';
    multiple?: boolean;
    currency?: 'RUB' | 'USD';
    parameters?: {
      id: string;
      label: string;
      value: number;
      min: number;
      max: number;
      step: number;
      unit: string;
    }[];
    model?: 'future-value' | 'present-value' | 'real-return' | 'portfolio-return';
  };
};
export type ExamAnswerResult = {
  questionId: string;
  competencyIds: CompetencyId[];
  difficulty: 1 | 2 | 3;
  answer: Answer;
  correct: boolean;
  explanation: string;
  expectedAnswer: Answer;
};
export type ExamResult = {
  id: string;
  moduleId: string;
  lessonId: string;
  bankVersion: number;
  variant: number;
  score: number;
  passed: boolean;
  submittedAt: string;
  answers: ExamAnswerResult[];
};
export type ExamSession = {
  id: string;
  moduleId: string;
  lessonId: string;
  bankVersion: number;
  variant: number;
  startedAt: string;
  guestToken?: string;
  questions: PublicExamQuestion[];
  draft?: Record<string, Answer>;
  position?: number;
  updatedAt?: string;
  result?: ExamResult;
};
export type LearningData = {
  version: 2;
  events: LearningEvent[];
  drafts: Record<string, PracticeDraft>;
  examResults: ExamResult[];
};
export type ExerciseEntry = {
  exercise: Exercise;
  lessonId: string;
  competencyIds: CompetencyId[];
  difficulty: 1 | 2 | 3;
  category?: 'vocabulary' | 'reading' | 'calculations' | 'expressions';
};
