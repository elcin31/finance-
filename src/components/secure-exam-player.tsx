'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, RotateCcw, Trophy } from 'lucide-react';
import { lessons, modules } from '@/content/curriculum';
import { competencies } from '@/content/skills';
import { useLearning } from './providers';
import { useKnowledge } from './learning-provider';
import { useEffectiveProgress } from './effective-progress';
import { ExerciseView } from './exercise-view';
import { isUnlocked, nextLesson } from '@/lib/progress';
import { withExamResults } from '@/lib/effective-progress';
import { initialExerciseAnswer } from '@/lib/learning-store';
import { readLocalExam, writeLocalExam, type LocalExam } from '@/lib/exam-local';
import { findActiveExam, getExam, saveExamDraft, startExam, submitExam } from '@/lib/secure-exams';
import { examInputError } from '@/lib/exam-input';
import type { ExamSession } from '@/lib/learning-types';
import type { Answer, Lesson } from '@/lib/types';

export default function SecureExamPlayer({ lesson }: { lesson: Lesson }) {
  const { ready: legacyReady, user, authConfigured } = useLearning();
  const { ready, rememberExamResult, refresh } = useKnowledge();
  const progress = useEffectiveProgress();
  const [local, setLocal] = useState<LocalExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('');
  const current = useRef<LocalExam | null>(null);
  const revision = useRef(0);
  const epoch = useRef(0);
  const saving = useRef(false);
  const persist = useCallback(
    (item: LocalExam) => {
      current.current = item;
      setLocal(item);
      try {
        writeLocalExam(lesson.moduleId, item, user?.id);
      } catch {
        setError(
          'Не удалось сохранить черновик на устройстве. Дождитесь серверного сохранения перед закрытием страницы.',
        );
      }
    },
    [lesson.moduleId, user?.id],
  );
  const accept = useCallback(
    (session: ExamSession, previous?: LocalExam | null) => {
      const answers = previous?.dirty && !session.result ? previous.answers : (session.draft ?? {});
      const item: LocalExam = {
        requestId: session.id,
        guestToken: previous?.guestToken ?? session.guestToken,
        session,
        answers: Object.fromEntries(
          session.questions.map((question) => [
            question.id,
            answers[question.id] ?? initialExerciseAnswer(question.exercise),
          ]),
        ),
        position: previous?.dirty ? (previous.position ?? 0) : (session.position ?? 0),
        updatedAt: previous?.dirty ? previous.updatedAt : (session.updatedAt ?? session.startedAt),
        dirty: !!previous?.dirty && !session.result,
      };
      persist(item);
      if (session.result) rememberExamResult(session.result);
    },
    [persist, rememberExamResult],
  );

  useEffect(() => {
    if (!legacyReady || !ready) return;
    const generation = ++epoch.current;
    let active = true;
    setLoading(true);
    setError('');
    current.current = null;
    setLocal(null);
    const restore = async () => {
      const cached = readLocalExam(lesson.moduleId, user?.id);
      try {
        const session = cached?.session?.id
          ? await getExam(cached.session.id, cached.guestToken)
          : user
            ? await findActiveExam(lesson.moduleId)
            : null;
        if (!active || generation !== epoch.current) return;
        if (session) accept(session, cached);
        else if (cached && !cached.session) persist(cached);
      } catch (failure) {
        if (!active || generation !== epoch.current) return;
        // A cached public question sheet may be used offline; cached grades are never accepted.
        if (cached?.session && !cached.session.result) persist(cached);
        setError(failure instanceof Error ? failure.message : 'Не удалось восстановить экзамен.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, [legacyReady, ready, user?.id, lesson.moduleId, accept, persist]);

  const flushDraft = useCallback(async () => {
    const item = current.current;
    if (!item?.session || item.session.result || !item.dirty || saving.current) return;
    const rev = revision.current,
      generation = epoch.current;
    saving.current = true;
    setSaveState('Сохраняем черновик на сервере…');
    try {
      const canonical = await saveExamDraft(
        item.session.id,
        item.answers,
        item.position ?? 0,
        item.guestToken,
      );
      if (generation !== epoch.current) return;
      if (canonical.result) accept(canonical, current.current);
      else if (rev === revision.current && !current.current?.session?.result)
        persist({ ...current.current!, session: canonical, dirty: false });
      setSaveState('Черновик сохранён на сервере');
    } catch {
      if (generation === epoch.current)
        setSaveState('Черновик на устройстве; серверное сохранение ожидает подключения');
    } finally {
      saving.current = false;
      if (
        generation === epoch.current &&
        rev !== revision.current &&
        current.current?.dirty &&
        !current.current.session?.result
      )
        setTimeout(() => void flushDraft(), 0);
    }
  }, [accept, persist]);
  useEffect(() => {
    if (!local?.dirty || !local.session || local.session.result) return;
    const timer = setTimeout(() => void flushDraft(), 600);
    return () => clearTimeout(timer);
  }, [local, flushDraft]);
  useEffect(() => {
    const online = () => void flushDraft();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [flushDraft]);

  if (!ready || !legacyReady || !progress || loading)
    return (
      <div className="loading-state" role="status">
        Восстанавливаем экзамен…
      </div>
    );
  const unlocked = isUnlocked(lesson, lessons, progress);
  if (!unlocked)
    return (
      <section className="empty-state">
        <LockKeyhole size={28} />
        <h1>Сначала — предыдущая практика</h1>
        <p>Завершите шесть уроков этого модуля, чтобы проверить знания на экзамене.</p>
        <Link href="/path?view=lessons" className="button primary">
          К урокам <ArrowRight size={14} />
        </Link>
      </section>
    );

  const begin = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const pending: LocalExam =
      local && !local.session
        ? local
        : {
            requestId: crypto.randomUUID(),
            guestToken: user ? undefined : crypto.randomUUID(),
            answers: {},
            updatedAt: new Date().toISOString(),
          };
    persist(pending);
    try {
      accept(await startExam(lesson.moduleId, pending.requestId, pending.guestToken), pending);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось начать экзамен.');
    } finally {
      setBusy(false);
    }
  };
  const module = modules.find((item) => item.id === lesson.moduleId)!;
  const session = local?.session;
  if (!session)
    return (
      <section className="panel exam-intro">
        <span className="eyebrow">ПРОВЕРКА КОМПЕТЕНЦИЙ · {module.title}</span>
        <h1>{lesson.title}</h1>
        <p>
          Восемь заданий: финансовые расчёты, решения и последовательности. Проходной балл — 80%.
        </p>
        <ul className="summary-list">
          <li>
            <Check size={15} />
            <span>Можно возвращаться к вопросам и менять ответы до отправки.</span>
          </li>
          <li>
            <Check size={15} />
            <span>Разбор откроется после завершения всей попытки.</span>
          </li>
          <li>
            <Check size={15} />
            <span>Проверка выполняется сервером. Для начала и отправки нужен интернет.</span>
          </li>
        </ul>
        {progress.completions.some((item) => item.lessonId === lesson.id) && (
          <p className="notice">
            Предыдущий зачёт сохранён. Новая проверка использует правила FINLAB 0.2.
          </p>
        )}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <button
          className="button primary"
          disabled={busy || !authConfigured}
          onClick={() => void begin()}
        >
          {busy ? 'Открываем вариант…' : 'Начать экзамен'} <ArrowRight size={15} />
        </button>
        {!authConfigured && (
          <p className="muted">
            Сервер экзаменов не настроен. Инструкция подключения находится в репозитории FINLAB.
          </p>
        )}
      </section>
    );

  if (session.result) {
    const result = session.result;
    const weak = competencies.filter((skill) =>
      result.answers.some((answer) => !answer.correct && answer.competencyIds.includes(skill.id)),
    );
    const next = nextLesson(lessons, withExamResults(progress, [result]));
    return (
      <section
        data-testid="exam-session"
        data-exam-id={session.id}
        data-module-id={session.moduleId}
        data-bank-version={session.bankVersion}
        data-variant={session.variant}
      >
        <div className="panel completion-card">
          <div className="completion-icon">
            <Trophy size={28} />
          </div>
          <span className="eyebrow">СЕРВЕРНАЯ ПРОВЕРКА ЗАВЕРШЕНА</span>
          <h1>{result.passed ? 'Экзамен пройден!' : 'Знания стоит закрепить'}</h1>
          <p>{lesson.title}</p>
          <div className="completion-score">{result.score}%</div>
          <p>
            {result.answers.filter((answer) => answer.correct).length} из {result.answers.length}{' '}
            верно · порог 80%
          </p>
          {result.passed && next.id !== lesson.id && (
            <Link href={`/lesson/${next.id}`} className="button primary">
              Следующий урок <ArrowRight size={14} />
            </Link>
          )}
          <button className="button" disabled={busy} onClick={() => void begin()}>
            <RotateCcw size={14} />
            Повторить экзамен
          </button>
          <p className="muted">
            Результат этой попытки зафиксирован. Пересдача даёт другой вариант; освоение не
            суммирует баллы повторных отправок.
          </p>
          <Link href="/knowledge" className="text-link">
            Мои знания <ArrowRight size={14} />
          </Link>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
        </div>
        {weak.length > 0 && (
          <section className="panel" style={{ marginTop: 20 }}>
            <h2>На что обратить внимание</h2>
            <div className="exam-recommendations">
              {weak.map((skill) => (
                <div key={skill.id}>
                  <h3>{skill.name}</h3>
                  <p>{skill.description}</p>
                  <Link className="text-link" href={`/lesson/${skill.lessonIds[0]}`}>
                    Повторить объяснение
                  </Link>
                  <Link className="button small" href={`/practice?skill=${skill.id}`}>
                    Решить новую задачу <ArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}
        <div className="section-heading">
          <h2>Разбор решений</h2>
          <Link href="/review" className="text-link">
            К повторениям <ArrowRight size={13} />
          </Link>
        </div>
        <div className="exam-results">
          {result.answers.map((answer, index) => (
            <article className="panel" key={answer.questionId}>
              <span className={`pill ${answer.correct ? 'green' : ''}`}>
                {index + 1}. {answer.correct ? 'Верно' : 'Требует практики'}
              </span>
              <h3>
                {
                  session.questions.find((question) => question.id === answer.questionId)?.exercise
                    .prompt
                }
              </h3>
              <p>{answer.explanation}</p>
              <details>
                <summary>Сопоставить ответы</summary>
                <p>
                  Ваш ответ:{' '}
                  <AnswerLabel answer={answer.answer} session={session} id={answer.questionId} />
                </p>
                <p>
                  Правильный ответ:{' '}
                  <AnswerLabel
                    answer={answer.expectedAnswer}
                    session={session}
                    id={answer.questionId}
                  />
                </p>
              </details>
            </article>
          ))}
        </div>
      </section>
    );
  }
  const position = Math.min(Math.max(local?.position ?? 0, 0), session.questions.length - 1);
  const question = session.questions[position];
  const answers = local!.answers;
  const change = (answer: Answer) => {
    revision.current++;
    setError('');
    persist({
      ...current.current!,
      answers: { ...current.current!.answers, [question.id]: answer },
      dirty: true,
      updatedAt: new Date().toISOString(),
    });
  };
  const move = (to: number) => {
    revision.current++;
    setError('');
    persist({
      ...current.current!,
      position: to,
      dirty: true,
      updatedAt: new Date().toISOString(),
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const inputError = examInputError(question, answers[question.id]);
  const submit = async () => {
    if (busy) return;
    const incomplete = session.questions.findIndex((item) =>
      examInputError(item, answers[item.id]),
    );
    if (incomplete >= 0) {
      move(incomplete);
      setError(
        examInputError(session.questions[incomplete], answers[session.questions[incomplete].id])!,
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await submitExam(session.id, answers, local?.guestToken);
      accept(result, current.current);
      await refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Ответы пока не отправлены. Повторите при подключении.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      data-testid="exam-session"
      data-exam-id={session.id}
      data-module-id={session.moduleId}
      data-bank-version={session.bankVersion}
      data-variant={session.variant}
    >
      <div className="lesson-top">
        <Link href="/path?view=lessons" className="text-link">
          <ArrowLeft size={14} />К пути обучения
        </Link>
        <span>
          ЭКЗАМЕН · ВОПРОС {position + 1} ИЗ {session.questions.length}
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Прогресс экзамена"
        aria-valuenow={position + 1}
        aria-valuemin={0}
        aria-valuemax={session.questions.length}
      >
        <span style={{ width: `${((position + 1) / session.questions.length) * 100}%` }} />
      </div>
      <nav className="exam-question-nav" aria-label="Вопросы экзамена">
        {session.questions.map((item, index) => (
          <button
            key={item.id}
            className={`button small ${position === index ? 'primary' : ''}`}
            aria-current={position === index ? 'step' : undefined}
            onClick={() => move(index)}
            disabled={busy}
          >
            {index + 1}
            {!examInputError(item, answers[item.id]) && <Check size={12} />}
          </button>
        ))}
      </nav>
      <div className="panel exam-question" data-question-id={question.id}>
        <span className="eyebrow">{module.title} · ПРОХОДНОЙ БАЛЛ 80%</span>
        <ExerciseView
          key={question.id}
          exercise={question.exercise}
          answer={answers[question.id] ?? ''}
          onChange={change}
          solved={busy}
        />
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="lesson-controls">
          <button
            className="button ghost"
            disabled={position === 0 || busy}
            onClick={() => move(position - 1)}
          >
            <ArrowLeft size={14} />
            Назад
          </button>
          {position < session.questions.length - 1 ? (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => (inputError ? setError(inputError) : move(position + 1))}
            >
              Следующий вопрос <ArrowRight size={14} />
            </button>
          ) : (
            <button className="button primary" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Проверяем…' : 'Завершить экзамен'}
              <Check size={14} />
            </button>
          )}
        </div>
        <p className="muted exam-save" role="status">
          {saveState || 'Ответы сохраняются на этом устройстве. Проверка — после завершения.'}
        </p>
      </div>
    </section>
  );
}

function AnswerLabel({
  answer,
  session,
  id,
}: {
  answer: Answer;
  session: ExamSession;
  id: string;
}) {
  const exercise = session.questions.find((question) => question.id === id)?.exercise;
  if (Array.isArray(answer))
    return (
      <>
        {answer
          .map(
            (item) =>
              exercise?.options?.find((option) => option.id === item)?.label ??
              exercise?.items?.find((option) => option.id === item)?.label ??
              item,
          )
          .join(' → ')}
      </>
    );
  if (answer === 'true' || answer === 'false')
    return <>{answer === 'true' ? 'Верно' : 'Неверно'}</>;
  return <>{typeof answer === 'string' ? answer : JSON.stringify(answer)}</>;
}
