export type SkillId = 'literacy' | 'mathematics' | 'investments' | 'portfolio' | 'english';
export type Unit = 'number' | 'percent' | 'currency' | 'bps';
export type Answer = string | string[] | Record<string, string>;
export type ExerciseBase = {
  id: string;
  prompt: string;
  hint: string;
  explanation: string;
  skills: SkillId[];
};
export type ChoiceExercise = ExerciseBase & {
  kind: 'choice' | 'scenario';
  options: { id: string; label: string }[];
  correct: string[];
  multiple?: boolean;
};
export type NumericExercise = ExerciseBase & {
  kind: 'numeric';
  expected: number;
  unit: Unit;
  absoluteTolerance?: number;
  relativeTolerance?: number;
};
export type BooleanExercise = ExerciseBase & { kind: 'boolean'; correct: boolean };
export type MatchingExercise = ExerciseBase & {
  kind: 'matching';
  pairs: { id: string; left: string; right: string }[];
};
export type Exercise = ChoiceExercise | NumericExercise | BooleanExercise | MatchingExercise;
export type LessonBlock =
  | { id: string; type: 'text'; title: string; paragraphs: string[] }
  | {
      id: string;
      type: 'formula';
      title: string;
      expression: string;
      variables: { symbol: string; meaning: string }[];
      note?: string;
    }
  | {
      id: string;
      type: 'example';
      title: string;
      description: string;
      steps: string[];
      result: string;
    }
  | {
      id: string;
      type: 'interactive';
      title: string;
      mode: 'compound' | 'discount' | 'portfolio';
      description: string;
    }
  | { id: string; type: 'exercise'; exercise: Exercise }
  | { id: string; type: 'summary'; title: string; points: string[] };
export type Term = {
  en: string;
  ru: string;
  definition: string;
  context: string;
  lessonId: string;
};
export type Lesson = {
  id: string;
  version: number;
  moduleId: string;
  title: string;
  subtitle: string;
  objective: string;
  minutes: number;
  skills: SkillId[];
  exam?: boolean;
  blocks: LessonBlock[];
  terms: Term[];
};
export type LearningModule = {
  id: string;
  title: string;
  english: string;
  description: string;
  color: string;
  lessonIds: string[];
};
