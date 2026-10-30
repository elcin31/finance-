'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Check, Lightbulb, RotateCcw } from 'lucide-react';
import { useKnowledge } from './learning-provider';
import { ExerciseView } from './exercise-view';
import { getCompetency } from '@/content/skills';
import { practiceEntries } from '@/content/practice-bank';
import { problemTemplates } from '@/lib/problem-generator';
import { freshGeneratedProblem, restoreExercise, selectPractice } from '@/lib/practice-registry';
import { initialExerciseAnswer } from '@/lib/learning-store';
import { gradeExercise } from '@/lib/evaluation';
import type { Answer } from '@/lib/types';
import type { CompetencyId, ErrorType, ExerciseEntry, PracticeDraft } from '@/lib/learning-types';

export type StudyOptions = {
  skill?: string;
  template?: string;
  exercise?: string;
  mode?: 'practice' | 'review' | 'english';
  category?: ExerciseEntry['category'];
};
export default function StudySession({
  skill,
  template,
  exercise,
  mode = 'practice',
  category,
}: StudyOptions) {
  const router = useRouter();
  const [activeExercise, setActiveExercise] = useState(exercise);
  useEffect(() => setActiveExercise(exercise), [exercise]);
  const { data, knowledge, ready, record, saveDraft, status } = useKnowledge();
  const [defaultSkill, setDefaultSkill] = useState<CompetencyId | null>(null);
  useEffect(() => {
    if (ready && !defaultSkill)
      setDefaultSkill(knowledge.recommendations[0]?.competencyId ?? 'financial-literacy');
  }, [ready, defaultSkill, knowledge.recommendations]);
  const creating = useRef(false);
  const forced = activeExercise
    ? practiceEntries.find((entry) => entry.exercise.id === activeExercise)
    : undefined;
  const templateDefinition = problemTemplates.find((item) => item.id === template);
  const competencyId = (getCompetency(skill ?? '')?.id ??
    forced?.competencyIds[0] ??
    templateDefinition?.competencyIds[0] ??
    defaultSkill ??
    knowledge.recommendations[0]?.competencyId ??
    'financial-literacy') as CompetencyId;
  const competency = getCompetency(competencyId)!;
  const assessment = knowledge.skills.find((item) => item.id === competencyId)!;
  const recommendation = knowledge.recommendations.find(
    (item) => item.competencyId === competencyId,
  );
  const difficulty = assessment.nextDifficulty;
  const draft = useMemo(
    () =>
      Object.values(data.drafts)
        .filter((item) => {
          if (item.mode !== mode) return false;
          const entry = restoreExercise(item.templateId, item.exerciseId, item.seed);
          return (
            entry?.competencyIds.includes(competencyId) &&
            (!category || entry.category === category) &&
            (!template || item.templateId === template) &&
            (!activeExercise || item.exerciseId === activeExercise)
          );
        })
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0],
    [data.drafts, mode, competencyId, category, template, activeExercise],
  );
  const entry = draft ? restoreExercise(draft.templateId, draft.exerciseId, draft.seed) : undefined;
  const makeDraft = (next: ExerciseEntry, reuseId?: string): PracticeDraft => ({
    id: reuseId ?? crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    exerciseId: next.exercise.id,
    templateId: next.exercise.templateId ?? next.exercise.id,
    seed: next.exercise.seed ?? 0,
    mode,
    answer: initialExerciseAnswer(next.exercise),
    hintsUsed: false,
    updatedAt: new Date().toISOString(),
  });
  const choose = () =>
    forced ??
    (templateDefinition
      ? freshGeneratedProblem(templateDefinition.id, data, difficulty)
      : selectPractice(data, competencyId, difficulty, category));
  useEffect(() => {
    if (!ready || draft || creating.current) return;
    creating.current = true;
    try {
      saveDraft(makeDraft(choose()));
    } finally {
      creating.current = false;
    }
    // A draft is created only once for an explicit task context; every field change is persisted below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, draft, competencyId, template, exercise, mode, category]);
  if (!ready || !draft || !entry)
    return (
      <div className="loading-state" role="status">
        Подбираем задачу по вашим результатам…
      </div>
    );
  const question = entry.exercise;
  const sessionId = draft.sessionId ?? draft.id;
  const events = data.events.filter(
    (event) => event.sessionId === sessionId && event.exerciseId === question.id,
  );
  const last = events.at(-1);
  const solved = events.some((event) => event.valid && event.correct);
  const same = last && JSON.stringify(last.answer) === JSON.stringify(draft.answer);
  const feedback = (solved || same) && last ? gradeExercise(question, last.answer) : undefined;
  const change = (answer: Answer) =>
    saveDraft({ ...draft, answer, updatedAt: new Date().toISOString() });
  const check = () => {
    const result = gradeExercise(question, draft.answer);
    if (
      events.some(
        (event) =>
          JSON.stringify(event.answer) === JSON.stringify(draft.answer) &&
          event.hintsUsed === !!draft.hintsUsed,
      )
    )
      return;
    const errorType: ErrorType = result.correct
      ? 'none'
      : 'errorType' in result && result.errorType
        ? (result.errorType as ErrorType)
        : !result.valid
          ? 'format'
          : question.kind === 'numeric' || question.kind === 'calculation'
            ? 'calculation'
            : question.kind === 'ordering'
              ? 'ordering'
              : question.kind === 'matching'
                ? 'selection'
                : 'concept';
    record({
      id: crypto.randomUUID(),
      sessionId,
      exerciseId: question.id,
      templateId: question.templateId ?? question.id,
      variantId: question.variantId ?? `${question.id}:v1`,
      seed: question.seed ?? 0,
      lessonId: entry.lessonId,
      contentVersion: 2,
      competencyIds: entry.competencyIds,
      difficulty: entry.difficulty,
      mode,
      answer: draft.answer,
      valid: result.valid,
      correct: result.correct,
      errorType,
      hintsUsed: !!draft.hintsUsed,
      at: new Date().toISOString(),
    });
  };
  const next = () => {
    const nextEntry = templateDefinition
      ? freshGeneratedProblem(templateDefinition.id, data, difficulty)
      : selectPractice(data, competencyId, difficulty, category);
    saveDraft(makeDraft(nextEntry, draft.id));
    if (activeExercise) {
      const staticId =
        nextEntry.exercise.seed === 0 &&
        practiceEntries.some((item) => item.exercise.id === nextEntry.exercise.id)
          ? nextEntry.exercise.id
          : undefined;
      setActiveExercise(staticId);
      const params = new URLSearchParams({ skill: competencyId });
      if (staticId) params.set('exercise', staticId);
      if (
        nextEntry.exercise.templateId &&
        problemTemplates.some((item) => item.id === nextEntry.exercise.templateId)
      )
        params.set('template', nextEntry.exercise.templateId);
      if (category) params.set('track', category);
      router.replace(
        `${mode === 'english' ? '/english' : mode === 'review' ? '/review' : '/practice'}?${params}`,
        { scroll: false },
      );
    }
  };
  const back =
    mode === 'english'
      ? `/english?track=${category ?? 'vocabulary'}`
      : mode === 'review'
        ? '/review'
        : '/path';
  const levels = ['', 'Базовый', 'Прикладной', 'Аналитический'];
  return (
    <section
      data-testid="practice-session"
      data-template-id={question.templateId ?? question.id}
      data-exercise-id={question.id}
      data-seed={question.seed ?? 0}
      data-variant-id={question.variantId ?? question.id}
      data-difficulty={entry.difficulty}
      className="study-session"
    >
      <div className="lesson-top">
        <Link href={back} className="text-link">
          <ArrowLeft size={14} />
          {mode === 'english'
            ? 'Финансовый английский'
            : mode === 'review'
              ? 'Очередь повторений'
              : 'К карте навыков'}
        </Link>
        <span>
          {mode === 'review'
            ? 'ПОВТОРЕНИЕ'
            : mode === 'english'
              ? 'FINANCIAL ENGLISH'
              : 'АДАПТИВНАЯ ПРАКТИКА'}
        </span>
      </div>
      <div className="practice-skill-banner">
        <div>
          <span className="eyebrow">ВАША ТЕКУЩАЯ ЗАДАЧА</span>
          <h2>{competency.name}</h2>
          <p>
            {mode === 'review'
              ? 'Отложенная задача проверяет сохранность понимания. Для знакомого условия нужен перерыв не менее семи дней; раннее повторение не повышает удержание.'
              : (recommendation?.reason ?? competency.description)}
          </p>
        </div>
        <div className="practice-mastery">
          <strong>{assessment.mastery}%</strong>
          <span>освоение навыка</span>
        </div>
      </div>
      <div className="practice-columns">
        <div className="panel practice-question">
          <div className="practice-meta">
            <span className="pill green">{levels[entry.difficulty]}</span>
            <span className="muted">≈ 2 минуты · Учебный сценарий</span>
          </div>
          <ExerciseView
            exercise={question}
            answer={draft.answer}
            onChange={change}
            onCheck={check}
            solved={solved}
            feedback={feedback}
          />
          {!solved && (
            <button
              className="text-link"
              onClick={() =>
                saveDraft({ ...draft, hintsUsed: true, updatedAt: new Date().toISOString() })
              }
            >
              <Lightbulb size={14} /> Разобраться в подходе
            </button>
          )}
          {draft.hintsUsed && !solved && (
            <div className="hint-card">
              <strong>Подсказка к принципу</strong>
              <p>{question.hint}</p>
              <small>
                Использование подсказки сохраняется и ограничивает самостоятельный балл.
              </small>
            </div>
          )}
          {last && (
            <div className="practice-next">
              <button className="button primary" onClick={next}>
                {solved ? 'Следующая задача' : 'Попробовать новое условие'}
                <ArrowRight size={14} />
              </button>
              {solved && (
                <span>
                  <Check size={13} /> Результат учтён в истории
                </span>
              )}
            </div>
          )}
          <p
            className="muted"
            style={{ fontSize: 10, marginTop: 20, marginBottom: 0 }}
            data-testid="learning-sync-status"
          >
            {status === 'synced'
              ? 'Практика синхронизирована'
              : status === 'local'
                ? 'Практика сохраняется на этом устройстве'
                : status === 'error'
                  ? 'Изменения сохранены локально; ожидают синхронизации'
                  : 'Сохраняем результаты практики…'}
          </p>
        </div>
        <aside>
          <section className="panel">
            <span className="eyebrow">ПОНЯТЬ ПЕРЕД РАСЧЁТОМ</span>
            <h3>Связанный материал</h3>
            <p className="muted" style={{ fontSize: 12 }}>
              {competency.description}
            </p>
            <Link className="text-link" href={`/lesson/${entry.lessonId}`}>
              <BookOpen size={14} /> Открыть объяснение <ArrowRight size={13} />
            </Link>
            {assessment.missingPrerequisites.length > 0 && (
              <p className="muted" style={{ fontSize: 11, marginTop: 16 }}>
                Полезно укрепить:{' '}
                {assessment.missingPrerequisites.map((id) => getCompetency(id)?.name).join(', ')}. К
                практике можно вернуться в любое время.
              </p>
            )}
          </section>
          <section className="panel" style={{ marginTop: 18 }}>
            <span className="eyebrow">КАК УЧИТЫВАЕТСЯ ОТВЕТ</span>
            <p className="muted" style={{ fontSize: 12 }}>
              Первая самостоятельная попытка важнее исправления. Повторный ввод того же ответа не
              добавляет баллы. Новые условия и проверки спустя время дают более надёжное
              свидетельство понимания.
            </p>
            <Link href="/knowledge" className="text-link">
              Мои знания <ArrowRight size={13} />
            </Link>
          </section>
        </aside>
      </div>
    </section>
  );
}
