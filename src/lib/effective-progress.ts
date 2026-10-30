import { lessons } from '@/content/curriculum';
import type { Progress } from './progress';
import type { ExamResult } from './learning-types';

/** A view over historical credits and server-issued exam results. Never saved to the v1 document. */
export function withExamResults(progress: Progress, results: ExamResult[]): Progress {
  const ids = new Set(progress.completions.map((item) => item.runId));
  const completions = results.flatMap((result) => {
    const lesson = lessons.find((item) => item.id === result.lessonId && item.exam);
    if (!lesson || !result.passed || result.score < 80 || ids.has(result.id)) return [];
    ids.add(result.id);
    return [
      {
        lessonId: lesson.id,
        runId: result.id,
        version: lesson.version,
        score: result.score,
        completedAt: result.submittedAt,
      },
    ];
  });
  return completions.length
    ? { ...progress, completions: [...progress.completions, ...completions] }
    : progress;
}
