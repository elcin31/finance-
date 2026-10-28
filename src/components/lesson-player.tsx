'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, RotateCcw, Trophy } from 'lucide-react';
import { useLearning } from './providers';
import { ExerciseView } from './exercise-view';
import { LessonSandbox } from './financial-lab';
import { lessons, modules } from '@/content/curriculum';
import { exercisesOf, finishLesson, isUnlocked, nextLesson, runScore } from '@/lib/progress';
import { gradeExercise } from '@/lib/evaluation';
import type { Answer, Lesson, LessonBlock } from '@/lib/types';

function blockLabel(b: LessonBlock) {
  return b.type === 'exercise'
    ? b.exercise.kind === 'matching'
      ? 'Финансовый английский'
      : 'Практика'
    : b.type === 'interactive'
      ? 'Исследование'
      : b.type === 'summary'
        ? 'Главные выводы'
        : b.type === 'formula'
          ? 'Формула'
          : b.type === 'example'
            ? 'Разбор примера'
            : 'Понимание';
}
export default function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const { progress, update, ready } = useLearning();
  const [invalid, setInvalid] = useState<{ id: string; message: string } | null>(null);
  const state = progress?.states[lesson.id];
  const unlocked = progress ? isUnlocked(lesson, lessons, progress) : false;
  useEffect(() => {
    if (!ready || !progress || !unlocked) return;
    if (!state || (state.contentVersion ?? 1) !== lesson.version)
      update((p) => ({
        ...p,
        states: {
          ...p.states,
          [lesson.id]: {
            position: 0,
            runId: crypto.randomUUID(),
            contentVersion: lesson.version,
            drafts: {},
            updatedAt: new Date().toISOString(),
          },
        },
      }));
  }, [ready, lesson.id, lesson.version, unlocked, state, progress, update]);
  if (!progress || !ready) return <div className="loading-state">Восстанавливаем ваш урок…</div>;
  if (!unlocked)
    return (
      <section className="empty-state">
        <div className="completion-icon">
          <LockKeyhole />
        </div>
        <h1>Сначала — предыдущая практика</h1>
        <p>
          Этот этап опирается на пройденные темы. Первый урок каждого модуля открыт для знакомства.
        </p>
        <Link className="button primary" href="/path">
          Вернуться к пути <ArrowRight size={15} />
        </Link>
      </section>
    );
  if (!state || (state.contentVersion ?? 1) !== lesson.version)
    return <div className="loading-state">Открываем урок…</div>;
  const completion = progress.completions.find(
    (c) => c.runId === state.runId && c.version === lesson.version,
  );
  const runAttempts = progress.attempts.filter(
    (a) =>
      a.lessonId === lesson.id &&
      a.runId === state.runId &&
      (a.contentVersion ?? 1) === lesson.version,
  );
  const solved = (id: string) => runAttempts.some((a) => a.exerciseId === id && a.correct);
  const firstUnsolved = lesson.blocks.findIndex(
    (b) => b.type === 'exercise' && !solved(b.exercise.id),
  );
  const maxPosition = firstUnsolved === -1 ? lesson.blocks.length - 1 : firstUnsolved;
  const position = Math.min(Math.max(0, state.position), maxPosition, lesson.blocks.length - 1);
  const block = lesson.blocks[position];
  const module = modules.find((m) => m.id === lesson.moduleId)!;
  const setPosition = (p: number) => {
    setInvalid(null);
    update((old) => ({
      ...old,
      states: {
        ...old.states,
        [lesson.id]: { ...old.states[lesson.id], position: p, updatedAt: new Date().toISOString() },
      },
    }));
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const restart = () => {
    setInvalid(null);
    update((old) => ({
      ...old,
      states: {
        ...old.states,
        [lesson.id]: {
          position: 0,
          runId: crypto.randomUUID(),
          contentVersion: lesson.version,
          drafts: {},
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  };
  if (completion) {
    const passed = !lesson.exam || completion.score >= 70;
    const next = nextLesson(lessons, progress);
    return (
      <section className="panel completion-card">
        <div className="completion-icon">
          {lesson.exam ? <Trophy size={28} /> : <Check size={28} />}
        </div>
        <span className="eyebrow">{module.title}</span>
        <h1>
          {passed
            ? lesson.exam
              ? 'Экзамен пройден!'
              : 'Ещё один шаг вперёд.'
            : 'Знания стоит закрепить'}
        </h1>
        <p>{lesson.title}</p>
        <div className="completion-score">{completion.score}%</div>
        <small>Правильных ответов с первой попытки · {exercisesOf(lesson).length} заданий</small>
        <p>
          {passed
            ? 'Практика завершена. Прогресс сохранён, а результаты учтены в ваших компетенциях.'
            : 'Для зачёта экзамена нужно не менее 70% с первой попытки. Разберите решения, повторите материал и начните новую попытку.'}
        </p>
        {passed && next.id !== lesson.id ? (
          <Link className="button primary" href={`/lesson/${next.id}`}>
            Следующий урок <ArrowRight size={15} />
          </Link>
        ) : null}
        <button className="button" onClick={restart}>
          <RotateCcw size={14} />
          {passed ? 'Пройти ещё раз' : 'Повторить экзамен'}
        </button>
        <Link
          href="/path"
          className="text-link"
          style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}
        >
          К образовательному пути
        </Link>
      </section>
    );
  }
  let exerciseContent = null;
  if (block.type === 'exercise') {
    const exercise = block.exercise;
    const answer =
      state.drafts[exercise.id] ??
      (exercise.kind === 'matching'
        ? {}
        : exercise.kind === 'choice' || exercise.kind === 'scenario'
          ? []
          : '');
    const correct = solved(exercise.id);
    const last = runAttempts.filter((a) => a.exerciseId === exercise.id).at(-1);
    const unchanged = last && JSON.stringify(last.answer) === JSON.stringify(answer);
    const feedback = correct
      ? { correct: true, message: exercise.explanation }
      : invalid?.id === exercise.id
        ? { correct: false, message: invalid.message }
        : unchanged
          ? { correct: false, message: exercise.hint }
          : undefined;
    const onChange = (answer: Answer) => {
      setInvalid(null);
      update((p) => ({
        ...p,
        states: {
          ...p.states,
          [lesson.id]: {
            ...p.states[lesson.id],
            drafts: { ...p.states[lesson.id].drafts, [exercise.id]: answer },
            updatedAt: new Date().toISOString(),
          },
        },
      }));
    };
    const onCheck = () => {
      const result = gradeExercise(exercise, answer);
      if (!result.valid) {
        setInvalid({ id: exercise.id, message: result.message });
        return;
      }
      setInvalid(null);
      update((p) => ({
        ...p,
        attempts: [
          ...p.attempts,
          {
            id: crypto.randomUUID(),
            lessonId: lesson.id,
            exerciseId: exercise.id,
            runId: state.runId,
            contentVersion: lesson.version,
            answer,
            correct: result.correct,
            at: new Date().toISOString(),
          },
        ],
      }));
    };
    exerciseContent = (
      <ExerciseView
        key={exercise.id}
        exercise={exercise}
        answer={answer}
        onChange={onChange}
        onCheck={onCheck}
        solved={correct}
        feedback={feedback}
      />
    );
  }
  return (
    <>
      <div className="lesson-top">
        <Link className="text-link" href="/path">
          <ArrowLeft size={13} /> К пути обучения
        </Link>
        <span>
          {lesson.exam ? 'ЭКЗАМЕН' : 'УРОК'} · {lesson.minutes} МИН · ШАГ {position + 1} ИЗ{' '}
          {lesson.blocks.length}
        </span>
      </div>
      <div className="progress-track" style={{ marginBottom: 25, height: 3 }}>
        <span style={{ width: `${((position + 1) / lesson.blocks.length) * 100}%` }} />
      </div>
      <div className="lesson-layout">
        <aside className="lesson-outline">
          <span className="eyebrow">{module.title}</span>
          <h2>{lesson.title}</h2>
          <div className="outline-items">
            {lesson.blocks.map((b, i) => (
              <button
                key={b.id}
                className={i === position ? 'current' : ''}
                disabled={i > maxPosition}
                onClick={() => setPosition(i)}
              >
                <span>{i < position ? <Check size={10} /> : i + 1}</span>
                {blockLabel(b)}
              </button>
            ))}
          </div>
        </aside>
        <section className="lesson-content">
          <div className="panel">
            <span className="eyebrow">{lesson.exam ? 'ПРОВЕРЬТЕ СЕБЯ' : blockLabel(block)}</span>
            {position === 0 && (
              <div className="lesson-intro">
                <span className="eyebrow">ЦЕЛЬ УРОКА</span>
                <p>{lesson.objective}</p>
              </div>
            )}
            {block.type === 'text' && (
              <>
                <h1>{block.title}</h1>
                {block.paragraphs.map((p, i) => (
                  <p key={i} className="lesson-paragraph">
                    {p}
                  </p>
                ))}
              </>
            )}
            {block.type === 'formula' && (
              <>
                <h1>{block.title}</h1>
                <div className="formula-expression">{block.expression}</div>
                <div className="formula-variables">
                  {block.variables.map((v) => (
                    <div className="formula-variable" key={v.symbol}>
                      <strong>{v.symbol}</strong>
                      <span>{v.meaning}</span>
                    </div>
                  ))}
                </div>
                {block.note && (
                  <p className="lesson-paragraph" style={{ marginTop: 23 }}>
                    {block.note}
                  </p>
                )}
              </>
            )}
            {block.type === 'example' && (
              <>
                <h1>{block.title}</h1>
                <p className="lesson-paragraph">{block.description}</p>
                <ol className="example-steps">
                  {block.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <div className="example-result">{block.result}</div>
              </>
            )}
            {block.type === 'interactive' && (
              <>
                <h1>{block.title}</h1>
                <p className="lesson-paragraph">{block.description}</p>
                <LessonSandbox mode={block.mode} />
              </>
            )}
            {exerciseContent}
            {block.type === 'summary' && (
              <>
                <h1>{block.title}</h1>
                <ul className="summary-list">
                  {block.points.map((p, i) => (
                    <li key={i}>
                      <Check size={15} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <div className="lesson-terms">
                  {lesson.terms.map((t) => (
                    <span key={t.en}>
                      <strong>{t.en}</strong> — {t.ru}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="lesson-controls">
            <button
              className="button ghost"
              disabled={position === 0}
              onClick={() => setPosition(position - 1)}
            >
              <ArrowLeft size={14} /> Назад
            </button>
            <span>
              {block.type === 'exercise' && !solved(block.exercise.id)
                ? 'Проверьте ответ, чтобы продолжить'
                : 'Ответы и позиция сохраняются автоматически'}
            </span>
            <button
              className="button primary"
              disabled={block.type === 'exercise' && !solved(block.exercise.id)}
              onClick={() =>
                position < lesson.blocks.length - 1
                  ? setPosition(position + 1)
                  : update((p) => finishLesson(lesson, p))
              }
            >
              {position === lesson.blocks.length - 1 ? 'Завершить урок' : 'Продолжить'}
              <ArrowRight size={14} />
            </button>
          </div>
          {lesson.exam && (
            <p className="muted" style={{ fontSize: 10, marginTop: 16 }}>
              Порог зачёта — 70%. В результат идёт первый проверенный ответ на каждое задание;
              исправления помогают разобраться, но не повышают балл этой попытки.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
