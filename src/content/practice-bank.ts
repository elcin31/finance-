import type { ExerciseEntry } from '@/lib/learning-types';
import { financePractice } from './finance-practice';
import { englishPractice } from './english-practice';

/** Authored bank only. Parameterized generators may consume this bank without a dependency cycle. */
export const practiceEntries: ExerciseEntry[] = [...financePractice, ...englishPractice];
