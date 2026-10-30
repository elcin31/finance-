import type { ExerciseEntry, CompetencyId, LearningData } from './learning-types';
import { practiceEntries } from '@/content/practice-bank';
import { generateProblem, problemTemplates } from './problem-generator';
import { stableSeed } from './learning-store';

export const allPracticeEntries: ExerciseEntry[] = [
  ...practiceEntries,
  ...problemTemplates.map((template) => generateProblem(template.id, 0, template.difficulty)),
];

export function restoreExercise(
  templateId: string,
  exerciseId: string,
  seed: number,
  difficulty?: 1 | 2 | 3,
): ExerciseEntry | undefined {
  const generated = problemTemplates.find((template) => template.id === templateId);
  if (generated) {
    const encoded = Number(exerciseId.split(':').at(-1));
    return generateProblem(
      templateId,
      seed,
      difficulty ?? ([1, 2, 3].includes(encoded) ? (encoded as 1 | 2 | 3) : generated.difficulty),
    );
  }
  return practiceEntries.find(
    (entry) => entry.exercise.id === exerciseId || entry.exercise.templateId === templateId,
  );
}

export function freshGeneratedProblem(
  templateId: string,
  data: LearningData,
  difficulty: 1 | 2 | 3,
): ExerciseEntry {
  const previous = data.events.filter((event) => event.templateId === templateId);
  const used = new Set(previous.map((event) => event.variantId));
  const count = used.size;
  let seed = stableSeed(`${templateId}:${count + 1}`);
  let entry = generateProblem(templateId, seed, difficulty);
  const last = [...previous]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id))
    .at(-1);
  const lastPrompt = last
    ? generateProblem(templateId, last.seed, last.difficulty).exercise.prompt
    : undefined;
  const draftSeeds = new Set(
    Object.values(data.drafts)
      .filter((item) => item.templateId === templateId)
      .map((item) => item.seed),
  );
  // Seed collisions and repeated prompts are resolved deterministically, including unsent drafts.
  while (
    used.has(entry.exercise.variantId!) ||
    draftSeeds.has(seed) ||
    entry.exercise.prompt === lastPrompt
  ) {
    seed = (seed + 1) >>> 0;
    entry = generateProblem(templateId, seed, difficulty);
  }
  return entry;
}

/** Least recently used applicable template, then closest difficulty, then stable ID. */
export function selectPractice(
  data: LearningData,
  competencyId: CompetencyId,
  difficulty: 1 | 2 | 3,
  category?: ExerciseEntry['category'],
): ExerciseEntry {
  const candidates = allPracticeEntries.filter(
    (entry) =>
      entry.competencyIds.includes(competencyId) && (!category || entry.category === category),
  );
  if (!candidates.length) throw new Error('Для этого навыка пока нет практических заданий.');
  const lastAt = (entry: ExerciseEntry) => {
    const templateId = entry.exercise.templateId ?? entry.exercise.id;
    return Math.max(
      0,
      ...data.events
        .filter((event) => event.templateId === templateId)
        .map((event) => Date.parse(event.at)),
    );
  };
  candidates.sort(
    (a, b) =>
      lastAt(a) - lastAt(b) ||
      Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty) ||
      a.exercise.id.localeCompare(b.exercise.id),
  );
  const selected = candidates[0];
  const templateId = selected.exercise.templateId ?? selected.exercise.id;
  if (problemTemplates.some((template) => template.id === templateId)) {
    return freshGeneratedProblem(templateId, data, difficulty);
  }
  return selected;
}
