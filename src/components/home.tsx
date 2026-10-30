'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  CircleHelp,
  Clock3,
  FlaskConical,
  Globe2,
  Layers3,
  Leaf,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { lessons, modules, terms } from '@/content/curriculum';
import { hasCompleted, nextLesson, reviewLessons, type Progress } from '@/lib/progress';
import { gradeExercise } from '@/lib/evaluation';
import type { NumericExercise } from '@/lib/types';
import { useLearning } from './providers';
import { useEffectiveProgress } from './effective-progress';
import { LearningDashboard } from './learning-dashboard';

const daily: NumericExercise = {
  id: 'daily-growth',
  kind: 'numeric',
  prompt: 'Сбережения выросли с 10 000 до 11 000 ₽. Какова доходность?',
  expected: 10,
  unit: 'percent',
  hint: 'Разделите прирост на начальную сумму и умножьте на 100. Не используйте конечную сумму как базу.',
  explanation: '(11 000 − 10 000) / 10 000 × 100 = 10%. База сравнения — первоначальная сумма.',
  skills: ['mathematics'],
};
function DailyTask({ progress }: { progress: Progress }) {
  const { update } = useLearning();
  const [formatError, setFormatError] = useState('');
  const key = `daily-${new Date().toISOString().slice(0, 10)}`;
  const state = progress.states[key];
  const answer =
    typeof state?.drafts[daily.id] === 'string' ? (state.drafts[daily.id] as string) : '';
  const attempts = progress.attempts.filter((a) => a.lessonId === key);
  const last = attempts.at(-1);
  const correct = attempts.some((a) => a.correct);
  const check = () => {
    const result = gradeExercise(daily, answer);
    if (!result.valid) {
      setFormatError(result.message);
      return;
    }
    setFormatError('');
    update((p) => ({
      ...p,
      attempts: [
        ...p.attempts,
        {
          id: crypto.randomUUID(),
          lessonId: key,
          exerciseId: daily.id,
          runId: p.states[key]?.runId ?? crypto.randomUUID(),
          answer,
          correct: result.correct,
          at: new Date().toISOString(),
        },
      ],
    }));
  };
  return (
    <section className="panel daily-card">
      <span className="eyebrow">
        <Sparkles size={12} /> ЗАДАНИЕ ДНЯ
      </span>
      <h3>
        Минутка для вашего
        <br />
        финансового мышления
      </h3>
      <p>{daily.prompt}</p>
      <label className="field">
        <span className="muted" style={{ fontSize: 10 }}>
          Ответ в процентах, например 7,5
        </span>
        <input
          className="input"
          aria-label="Ответ на задание дня, %"
          inputMode="decimal"
          value={answer}
          disabled={correct}
          onChange={(e) =>
            update((p) => ({
              ...p,
              states: {
                ...p.states,
                [key]: {
                  position: 0,
                  runId: p.states[key]?.runId ?? crypto.randomUUID(),
                  drafts: { [daily.id]: e.target.value },
                  updatedAt: new Date().toISOString(),
                },
              },
            }))
          }
        />
      </label>
      {!correct && (
        <button
          className="button small"
          style={{ width: '100%', marginTop: 12 }}
          disabled={!answer.trim()}
          onClick={check}
        >
          Проверить ответ <ArrowRight size={13} />
        </button>
      )}
      {formatError && (
        <p role="alert" className="daily-result">
          {formatError}
        </p>
      )}
      {last && (
        <div
          className="daily-result"
          role="status"
          style={{ color: correct ? 'var(--accent)' : 'var(--muted)' }}
        >
          {correct ? (
            <>
              <Check size={13} style={{ display: 'inline', marginRight: 4 }} />
              {daily.explanation}
            </>
          ) : (
            daily.hint
          )}
        </div>
      )}
      <div className="daily-tag">
        <Clock3 size={11} /> 1 минута · Учебный пример
      </div>
    </section>
  );
}
export default function Home() {
  const { ready } = useLearning();
  const progress = useEffectiveProgress();
  if (!progress || !ready)
    return (
      <div className="loading-state" role="status">
        Подготавливаем ваш учебный путь…
      </div>
    );
  const next = nextLesson(lessons, progress);
  const completed = lessons.filter((l) => hasCompleted(progress, l));
  const total = Math.round((completed.length / lessons.length) * 100);
  const currentModule = modules.find((m) => m.id === next.moduleId)!;
  const recent = lessons
    .filter((l) => progress.states[l.id])
    .sort((a, b) => progress.states[b.id].updatedAt.localeCompare(progress.states[a.id].updatedAt))
    .slice(0, 2);
  const reviews = reviewLessons(lessons, progress).slice(0, 2);
  const term = terms.find((t) => t.en.toLowerCase() === 'asset') ?? terms[0];
  const moduleIcons = [Leaf, ChartNoAxesCombined, Layers3];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ВАШЕ БУДУЩЕЕ НАЧИНАЕТСЯ СО ЗНАНИЙ</span>
          <h1>Хороший день, чтобы расти.</h1>
          <p>Шаг за шагом — к уверенному пониманию финансов.</p>
        </div>
        <span className="heading-label">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />{' '}
          Академия открыта для вас
        </span>
      </div>
      {!progress.preferences.onboardingDone && (
        <section className="onboarding-banner">
          <div>
            <strong>Давайте найдём вашу точку старта</strong>
            <p>Цель, удобный темп и три вопроса — ваш путь станет точнее.</p>
          </div>
          <Link href="/onboarding" className="button small">
            Настроить обучение <ArrowUpRight size={14} />
          </Link>
        </section>
      )}
      <div className="dashboard-grid">
        <div>
          <section className="hero-card">
            <div className="hero-copy">
              <span className="eyebrow">
                <span style={{ width: 5, height: 5, background: '#b4d6bd', borderRadius: '50%' }} />{' '}
                ЗНАНИЯ, КОТОРЫЕ ПРИНОСЯТ РЕЗУЛЬТАТ
              </span>
              <h2>
                Понимание финансов —<br />
                ваш главный актив.
              </h2>
              <p>
                От первого осознанного решения
                <br />
                до уверенного инвестиционного анализа.
                <br />
                Учитесь на практике, в своём темпе.
              </p>
              <Link className="button" href={`/lesson/${next.id}`}>
                {completed.length ? 'Продолжить обучение' : 'Начать обучение'}
                <ArrowRight size={15} />
              </Link>
            </div>
            <svg className="hero-art" viewBox="0 0 300 300" fill="none" aria-hidden="true">
              <circle cx="170" cy="170" r="124" stroke="#80aa8b" strokeOpacity=".2" />
              <circle cx="170" cy="170" r="94" stroke="#80aa8b" strokeOpacity=".25" />
              <circle cx="170" cy="170" r="63" stroke="#80aa8b" strokeOpacity=".3" />
              <path
                d="M60 227L116 195L161 204L212 134L263 110"
                stroke="#b7d8bb"
                strokeWidth="2.5"
              />
              <path d="M60 227L116 195L161 204L212 134L263 110V295H60Z" fill="url(#area)" />
              <path d="M243 108L266 108L266 131" stroke="#b7d8bb" strokeWidth="2.5" />
              <circle cx="212" cy="134" r="6" fill="#d0e5cf" />
              <rect
                x="112"
                y="77"
                width="69"
                height="62"
                rx="12"
                transform="rotate(-13 112 77)"
                fill="#d5e5ce"
              />
              <text
                x="147"
                y="117"
                transform="rotate(-13 147 117)"
                fill="#254d37"
                fontSize="33"
                fontFamily="Georgia,serif"
              >
                %
              </text>
              <path
                d="M77 171V186M69.5 178.5H84.5M238 66V77M232.5 71.5H243.5"
                stroke="#99bea0"
                strokeWidth="1.5"
              />
              <defs>
                <linearGradient
                  id="area"
                  x1="170"
                  y1="130"
                  x2="170"
                  y2="300"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#8bb298" stopOpacity=".23" />
                  <stop offset="1" stopColor="#8bb298" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <span className="hero-small-note">LEARN. UNDERSTAND. APPLY.</span>
          </section>
          <section className="panel next-lesson">
            <span className="lesson-icon">
              <BookOpen size={21} strokeWidth={1.6} />
            </span>
            <div>
              <span className="eyebrow">ВАШ СЛЕДУЮЩИЙ УРОК · {currentModule.title}</span>
              <h3>{next.title}</h3>
              <p>
                {next.minutes} мин ·{' '}
                {next.exam ? 'Итоговая проверка' : 'Теория и интерактивная практика'}
              </p>
            </div>
            <Link className="button small" href={`/lesson/${next.id}`}>
              <span>К уроку</span>
              <ArrowRight size={15} />
            </Link>
          </section>
          <LearningDashboard />
          <div className="section-heading">
            <h2>Ваша траектория</h2>
            <Link href="/path" className="text-link">
              Весь путь <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="module-grid">
            {modules.map((m, index) => {
              const Icon = moduleIcons[index];
              const done = m.lessonIds.filter((id) => completed.some((l) => l.id === id)).length;
              return (
                <Link key={m.id} className="panel module-card" href={`/path?view=lessons#${m.id}`}>
                  <div className="module-top">
                    <span className="module-symbol">
                      <Icon size={19} strokeWidth={1.6} />
                    </span>
                    <span className="module-number">МОДУЛЬ 0{index + 1}</span>
                  </div>
                  <h3>{m.title}</h3>
                  <span className="english-name">{m.english}</span>
                  <div className="module-progress">
                    <div className="progress-detail">
                      <span>
                        {done} из {m.lessonIds.length} этапов
                      </span>
                      <span>{Math.round((done / m.lessonIds.length) * 100)}%</span>
                    </div>
                    <div className="progress-track">
                      <span style={{ width: `${(done / m.lessonIds.length) * 100}%` }} />
                    </div>
                  </div>
                  <ArrowUpRight className="corner-arrow" size={15} />
                </Link>
              );
            })}
          </div>
          <div className="learning-bottom">
            <section className="panel">
              <h3>Недавно изучали</h3>
              {recent.length ? (
                recent.map((l) => (
                  <Link href={`/lesson/${l.id}`} key={l.id} className="mini-row">
                    <BookOpen size={14} />
                    <span>{l.title}</span>
                    <ArrowUpRight size={12} />
                  </Link>
                ))
              ) : (
                <>
                  <div className="mini-row">
                    <BookOpen size={15} />
                    <span>Первый урок ещё впереди</span>
                  </div>
                  <p className="muted" style={{ fontSize: 10, margin: 0 }}>
                    Ваши последние темы появятся здесь.
                  </p>
                </>
              )}
            </section>
            <section className="panel">
              <h3>Закрепить знания</h3>
              {reviews.length ? (
                reviews.map((l) => (
                  <Link href={`/lesson/${l.id}`} key={l.id} className="mini-row">
                    <RefreshCw size={14} />
                    <span>{l.title}</span>
                    <ArrowUpRight size={12} />
                  </Link>
                ))
              ) : (
                <>
                  <div className="mini-row">
                    <Target size={15} />
                    <span>Пока нет тем для повторения</span>
                  </div>
                  <p className="muted" style={{ fontSize: 10, margin: 0 }}>
                    Подскажем их по результатам практики.
                  </p>
                </>
              )}
            </section>
          </div>
        </div>
        <aside className="dashboard-aside">
          <section className="panel learning-overview">
            <div className="panel-header">
              <h3>Ваш прогресс</h3>
              <span className="level-badge">
                <TrendingUp size={16} />
              </span>
            </div>
            <div className="progress-circle">
              <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
                <circle className="ring-track" cx="60" cy="60" r="52" strokeWidth="5" />
                <circle
                  className="ring-value"
                  cx="60"
                  cy="60"
                  r="52"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(total / 100) * 326.73} 326.73`}
                />
              </svg>
              <strong>
                {total}%<span>пути пройдено</span>
              </strong>
            </div>
            <div className="progress-detail">
              <span>
                {completed.length} из {lessons.length} этапов
              </span>
              <strong>
                {completed.filter((l) => l.exam).length ? 'Уверенный старт' : 'Исследователь'}
              </strong>
            </div>
            <div className="progress-track tiny">
              <span style={{ width: `${total}%` }} />
            </div>
          </section>
          <DailyTask progress={progress} />
          {term && (
            <section className="panel english-card">
              <div className="panel-header">
                <span>FINANCIAL ENGLISH</span>
                <Globe2 size={14} style={{ color: 'var(--muted)' }} />
              </div>
              <h3>{term.en}</h3>
              <span className="translation">{term.ru}</span>
              <p>{term.definition}</p>
              <Link className="text-link" href={`/library?search=${encodeURIComponent(term.en)}`}>
                Узнать в контексте <ArrowUpRight size={13} />
              </Link>
            </section>
          )}
        </aside>
      </div>
      <div className="section-heading" style={{ marginBottom: 0 }}>
        <span
          className="muted"
          style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <CircleHelp size={13} /> Все финансовые примеры — учебные сценарии.
        </span>
        <Link className="text-link" href="/lab">
          <FlaskConical size={13} /> Открыть лабораторию
        </Link>
      </div>
    </>
  );
}
