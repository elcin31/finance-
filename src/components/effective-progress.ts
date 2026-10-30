'use client';
import { useMemo } from 'react';
import { useLearning } from './providers';
import { useKnowledge } from './learning-provider';
import { withExamResults } from '@/lib/effective-progress';

export function useEffectiveProgress() {
  const { progress } = useLearning();
  const { data } = useKnowledge();
  return useMemo(
    () => (progress ? withExamResults(progress, data.examResults) : null),
    [progress, data.examResults],
  );
}
