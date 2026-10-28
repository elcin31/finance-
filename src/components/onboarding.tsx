'use client';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Compass, Target } from 'lucide-react';
import { useLearning } from './providers';
import type { Answer } from '@/lib/types';
const goals = [
  'Освоить финансовую грамотность',
  'Научиться инвестированию',
  'Стать финансовым аналитиком',
  'Изучить Asset Management',
  'Освоить финансовый английский',
];
const levels = ['С нуля', 'Знаю базовые понятия', 'Уже инвестирую', 'Работаю с финансами'];
const diagnostics = [
  {
    id: 'diagnostic-equity',
    prompt: 'Есть активы на 800 000 ₽ и долг 300 000 ₽. Чему равен чистый капитал?',
    options: ['1 100 000 ₽', '500 000 ₽', '300 000 ₽'],
    correct: '1',
    explanation: 'Чистый капитал = активы − обязательства = 500 000 ₽.',
  },
  {
    id: 'diagnostic-pv',
    prompt:
      'Через два года вы получите 121 000 ₽. Ставка — 10% в год. Какова приведённая стоимость?',
    options: ['100 000 ₽', '110 000 ₽', '121 000 ₽'],
    correct: '0',
    explanation: 'PV = 121 000 / 1,1² = 100 000 ₽.',
  },
  {
    id: 'diagnostic-return',
    prompt:
      'Акция куплена за 1 000 ₽, продана за 1 080 ₽ и принесла дивиденд 40 ₽. Полная доходность до расходов?',
    options: ['4%', '8%', '12%'],
    correct: '2',
    explanation: 'Total return = (1 080 − 1 000 + 40) / 1 000 = 12%.',
  },
];
export default function Onboarding() {
  const { progress, update, ready } = useLearning();
  if (!progress || !ready) return <div className="loading-state">Готовим ваш старт…</div>;
  const state = progress.states.onboarding;
  const drafts = state?.drafts ?? {};
  const step = Math.min(state?.position ?? 0, 4);
  const get = (key: string, fallback: string) =>
    typeof drafts[key] === 'string' ? (drafts[key] as string) : fallback;
  const goal = get('goal', progress.preferences.goal);
  const level = get('level', progress.preferences.level);
  const pace = get('pace', String(progress.preferences.pace));
  const set = (key: string, value: Answer) =>
    update((p) => ({
      ...p,
      states: {
        ...p.states,
        onboarding: {
          position: step,
          runId: p.states.onboarding?.runId ?? crypto.randomUUID(),
          drafts: { ...p.states.onboarding?.drafts, [key]: value },
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  const go = (position: number) =>
    update((p) => ({
      ...p,
      states: {
        ...p.states,
        onboarding: {
          position,
          runId: p.states.onboarding?.runId ?? crypto.randomUUID(),
          drafts: { ...p.states.onboarding?.drafts, goal, level, pace },
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  const finish = () => {
    const correct = diagnostics.filter((q) => drafts[q.id] === q.correct).length;
    const score = Math.round((correct / 3) * 100);
    const recommended =
      correct >= 2
        ? goal.includes('инвест') || goal.includes('Asset')
          ? 'm3-securities'
          : 'm2-percent'
        : 'm1-money';
    const at = new Date().toISOString();
    update((p) => {
      const runId = p.states.onboarding?.runId ?? crypto.randomUUID();
      return {
        ...p,
        preferences: {
          goal,
          level,
          pace: Number(pace),
          diagnosticScore: score,
          recommendedLesson: recommended,
          onboardingDone: true,
        },
        preferencesUpdatedAt: at,
        states: {
          ...p.states,
          onboarding: {
            position: 4,
            runId,
            drafts: { ...drafts, goal, level, pace },
            updatedAt: at,
          },
        },
        attempts: [
          ...p.attempts,
          ...diagnostics
            .filter((q) => !p.attempts.some((a) => a.runId === runId && a.exerciseId === q.id))
            .map((q) => ({
              id: crypto.randomUUID(),
              lessonId: 'onboarding',
              exerciseId: q.id,
              runId,
              answer: drafts[q.id] ?? '',
              correct: drafts[q.id] === q.correct,
              at,
            })),
        ],
      };
    });
  };
  if (step === 4)
    return (
      <section className="panel completion-card">
        <div className="completion-icon">
          <Compass size={28} />
        </div>
        <span className="eyebrow">ВАШ ПУТЬ НАСТРОЕН</span>
        <h1>Начнём с подходящего шага.</h1>
        <p>
          {progress.preferences.diagnosticScore >= 67
            ? 'База у вас уже есть. Рекомендуем перейти к следующему уровню — и возвращаться к основам в любое время.'
            : 'Начнём с основ: денег, капитала и финансовых решений. Каждый шаг добавит ясности.'}
        </p>
        <div className="completion-score">{progress.preferences.diagnosticScore}%</div>
        <small>Диагностика · {pace} минут в день</small>
        <details className="model-note" style={{ textAlign: 'left' }}>
          <summary>Посмотреть объяснения диагностики</summary>
          {diagnostics.map((q) => (
            <p key={q.id}>{q.explanation}</p>
          ))}
        </details>
        <Link className="button primary" href={`/lesson/${progress.preferences.recommendedLesson}`}>
          К рекомендованному уроку <ArrowRight size={15} />
        </Link>
        <Link className="button" href="/path">
          Весь учебный путь
        </Link>
      </section>
    );
  const titles = [
    'Что вы хотите освоить?',
    'Откуда начнём?',
    'В каком темпе вам удобно?',
    'Найдём точку старта',
  ];
  const descriptions = [
    'Мы подберём стартовую тему под вашу цель. Все материалы останутся доступны по учебному пути.',
    'Это не оценка. Финансы проще изучать, когда новые знания опираются на знакомые.',
    'Даже короткая, но регулярная практика помогает увидеть общую картину.',
    'Три настоящих финансовых вопроса. Выберите то, что кажется верным — ошибки здесь полезны.',
  ];
  return (
    <div className="onboarding-container">
      <div className="lesson-top">
        <Link href="/" className="text-link">
          <ArrowLeft size={13} /> В академию
        </Link>
        <span>ШАГ {step + 1} ИЗ 4</span>
      </div>
      <div className="step-dots">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i <= step ? 'active' : ''} />
        ))}
      </div>
      <div className="onboarding-intro">
        <span className="eyebrow">ВАШ ПЕРСОНАЛЬНЫЙ СТАРТ</span>
        <h1>{titles[step]}</h1>
        <p>{descriptions[step]}</p>
      </div>
      {step < 3 ? (
        <div className="choice-grid">
          {(step === 0 ? goals : step === 1 ? levels : ['10', '15', '30']).map((option) => {
            const selected = (step === 0 ? goal : step === 1 ? level : pace) === option;
            return (
              <button
                type="button"
                className={`choice-card ${selected ? 'selected' : ''}`}
                key={option}
                aria-pressed={selected}
                onClick={() => set(step === 0 ? 'goal' : step === 1 ? 'level' : 'pace', option)}
              >
                <span className="radio" />
                <span>{step === 2 ? `${option} минут в день` : option}</span>
                {step === 2 && (
                  <span className="muted" style={{ fontSize: 10, marginLeft: 'auto' }}>
                    {option === '10'
                      ? 'Мягкий старт'
                      : option === '15'
                        ? 'Стабильный ритм'
                        : 'Погружение'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        diagnostics.map((q, i) => (
          <section className="panel diagnostic-card" key={q.id}>
            <span className="eyebrow">ВОПРОС 0{i + 1}</span>
            <h3>{q.prompt}</h3>
            <div className="diagnostic-options">
              {q.options.map((option, index) => (
                <button
                  type="button"
                  key={option}
                  className={drafts[q.id] === String(index) ? 'selected' : ''}
                  aria-pressed={drafts[q.id] === String(index)}
                  onClick={() => set(q.id, String(index))}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>
        ))
      )}
      <div className="onboarding-actions">
        <button className="button ghost" disabled={step === 0} onClick={() => go(step - 1)}>
          <ArrowLeft size={14} /> Назад
        </button>
        <button
          className="button primary"
          disabled={step === 3 && diagnostics.some((q) => typeof drafts[q.id] !== 'string')}
          onClick={() => (step < 3 ? go(step + 1) : finish())}
        >
          {step === 3 ? 'Настроить мой путь' : 'Продолжить'}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
