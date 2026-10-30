'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CircleCheck,
  Clock3,
  GitBranch,
  GraduationCap,
  RefreshCw,
  Target,
} from 'lucide-react';
import { competencyGroups, getCompetency } from '@/content/skills';
import { getLesson, lessons, modules } from '@/content/curriculum';
import { hasCompleted, nextLesson } from '@/lib/progress';
import {
  MASTERY_WEIGHTS,
  type KnowledgeEvidence,
  type Recommendation,
  type SkillAssessment,
  type SkillStatus,
} from '@/lib/knowledge';
import type { CompetencyId, ErrorType } from '@/lib/learning-types';
import { number } from '@/lib/format';
import { useKnowledge } from './learning-provider';
import { useLearning } from './providers';
import styles from './knowledge.module.css';

const statusLabels: Record<SkillStatus, string> = {
  'not-started': 'Не изучен',
  learning: 'Изучается',
  review: 'Требует повторения',
  mastered: 'Освоен',
};
const errorLabels: Record<ErrorType, string> = {
  none: 'Без ошибки',
  concept: 'Понимание принципа',
  calculation: 'Расчёт',
  unit: 'Единицы измерения',
  format: 'Формат ответа',
  selection: 'Выбор и сопоставление',
  ordering: 'Порядок действий',
};
const modeLabels = {
  lesson: 'Урок',
  practice: 'Практика',
  review: 'Повторение',
  english: 'Financial English',
};
const englishTracks: Partial<Record<CompetencyId, string>> = {
  'english-terminology': 'vocabulary',
  'english-reading': 'reading',
  'english-calculations': 'calculations',
  'english-expressions': 'expressions',
};

function date(at: string, includeTime = false) {
  return new Date(at).toLocaleString(
    'ru-RU',
    includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' },
  );
}
function level(value: number) {
  if (value >= 90) return 'Устойчивое освоение';
  if (value >= 75) return 'Хорошее освоение';
  if (value >= 50) return 'Формируется понимание';
  if (value >= 25) return 'Требуется практика';
  return 'Начальный уровень';
}
function practiceHref(skill: CompetencyId) {
  return englishTracks[skill]
    ? `/english?track=${englishTracks[skill]}`
    : `/practice?skill=${skill}`;
}
function recommendationHref(recommendation: Recommendation) {
  if (recommendation.kind === 'lesson') return `/lesson/${recommendation.lessonId}`;
  if (recommendation.kind === 'review') return `/review?skill=${recommendation.competencyId}`;
  return practiceHref(recommendation.competencyId);
}
function actionLabel(recommendation: Recommendation) {
  return recommendation.kind === 'lesson'
    ? 'Разобрать тему'
    : recommendation.kind === 'review'
      ? 'Повторить знания'
      : 'Начать практику';
}
function SkillStatusBadge({ status }: { status: SkillStatus }) {
  return (
    <span className={`${styles.status} ${styles[status]}`}>
      {status === 'mastered' ? <Check size={11} /> : null}
      {statusLabels[status]}
    </span>
  );
}
function Meter({ value }: { value: number }) {
  return (
    <span className={styles.meter} aria-hidden="true">
      <span style={{ width: `${value}%` }} />
    </span>
  );
}
function ComponentScores({ skill }: { skill: SkillAssessment }) {
  return (
    <div className={styles.componentScores}>
      <div>
        <span>Практика</span>
        <strong>{number(skill.practiceScore)}%</strong>
      </div>
      <div>
        <span>Отсроченное повторение</span>
        <strong>{number(skill.reviewScore)}%</strong>
      </div>
      {skill.examApplicable ? (
        <div>
          <span>Серверный экзамен</span>
          <strong>{number(skill.examScore)}%</strong>
        </div>
      ) : null}
    </div>
  );
}
function ErrorSummary({ skill }: { skill: SkillAssessment }) {
  const errors = Object.entries(skill.errorCounts)
    .filter(([type, count]) => type !== 'none' && count && count > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  return errors.length ? (
    <div className={styles.errorChips} aria-label={`Типы ошибок: ${skill.name}`}>
      {errors.map(([type, count]) => (
        <span key={type}>
          {errorLabels[type as ErrorType]} <strong>{count}</strong>
        </span>
      ))}
    </div>
  ) : (
    <p className={styles.smallMuted}>
      {skill.attempts
        ? 'В сохранённых ответах этого навыка ошибок пока нет.'
        : 'Типичные ошибки станут видны после практики.'}
    </p>
  );
}

export function SkillTree() {
  const { knowledge, ready } = useKnowledge();
  const [selectedId, setSelectedId] = useState<CompetencyId>('financial-literacy');
  const detailId = useId();
  if (!ready)
    return (
      <div className="loading-state" role="status">
        Собираем карту знаний…
      </div>
    );
  const available = knowledge.skills.filter((skill) => skill.lessonIds.some((id) => getLesson(id)));
  const selected = available.find((skill) => skill.id === selectedId) ?? available[0];
  if (!selected)
    return (
      <div className="panel">
        <p>Карта появится, когда будут доступны связанные учебные материалы.</p>
      </div>
    );
  const recommendation = knowledge.recommendations.find(
    (item) => item.competencyId === selected.id,
  );
  const history = knowledge.evidence
    .filter((event) => event.competencyIds.includes(selected.id))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id))
    .slice(0, 5);
  const due = selected.dueAt && Date.parse(selected.dueAt) <= Date.parse(knowledge.at);
  const prerequisite = selected.missingPrerequisites[0];
  const nextHref = recommendation
    ? recommendationHref(recommendation)
    : due
      ? `/review?skill=${selected.id}`
      : prerequisite
        ? `/lesson/${getCompetency(prerequisite).lessonIds[0]}`
        : practiceHref(selected.id);
  const nextAction = recommendation
    ? actionLabel(recommendation)
    : due
      ? 'Повторить знания'
      : prerequisite
        ? 'Укрепить основу'
        : 'Практиковаться';
  return (
    <section className={styles.root} aria-label="Дерево финансовых компетенций">
      <div className={styles.mapIntro}>
        <div>
          <span className="eyebrow">КОМПЕТЕНЦИИ И ИХ СВЯЗИ</span>
          <h1>Знания складываются в систему</h1>
          <p>
            Выберите навык, чтобы увидеть основу, практику и следующий шаг. Карта не ограничивает
            доступ к открытым урокам.
          </p>
        </div>
        <Link href="/knowledge" className="text-link">
          Мои знания <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className={styles.legend} aria-label="Статусы навыков">
        {(Object.keys(statusLabels) as SkillStatus[]).map((status) => (
          <SkillStatusBadge key={status} status={status} />
        ))}
      </div>
      <div className={styles.treeGrid}>
        {competencyGroups.map((group) => (
          <section className={styles.branch} key={group.id} aria-label={group.name}>
            <header>
              <span className={styles.groupIcon}>
                <GitBranch size={16} />
              </span>
              <h3>{group.name}</h3>
              <p>{group.description}</p>
            </header>
            <div className={styles.branchCards}>
              {available
                .filter((skill) => skill.group === group.id)
                .map((skill) => (
                  <button
                    type="button"
                    data-competency-id={skill.id}
                    key={skill.id}
                    className={`${styles.skillCard} ${selected.id === skill.id ? styles.selected : ''}`}
                    aria-pressed={selected.id === skill.id}
                    aria-controls={detailId}
                    onClick={() => {
                      setSelectedId(skill.id);
                      requestAnimationFrame(() => {
                        const detail = document.getElementById(detailId);
                        detail?.scrollIntoView({
                          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                            ? 'instant'
                            : 'smooth',
                          block: 'start',
                        });
                        detail?.focus({ preventScroll: true });
                      });
                    }}
                  >
                    <span className={styles.cardTop}>
                      <span className={styles.cardName}>{skill.name}</span>
                      <strong>{number(skill.mastery)}%</strong>
                    </span>
                    <span className={styles.englishName} lang="en">
                      {skill.english}
                    </span>
                    <Meter value={skill.mastery} />
                    <SkillStatusBadge status={skill.status} />
                    {skill.prerequisites.length ? (
                      <span className={styles.cardPrerequisites}>
                        <GitBranch size={10} />
                        {skill.prerequisites.length === 1
                          ? '1 связь с основой'
                          : `${skill.prerequisites.length} связи с основой`}
                      </span>
                    ) : (
                      <span className={styles.cardPrerequisites}>Стартовый навык</span>
                    )}
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
      <section
        className={`panel ${styles.skillDetail}`}
        id={detailId}
        tabIndex={-1}
        aria-label={`Подробности навыка: ${selected.name}`}
      >
        <div className={styles.detailHeading}>
          <div>
            <span className="eyebrow" lang="en">
              {selected.english}
            </span>
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
          </div>
          <div className={styles.detailScore}>
            <strong>{number(selected.mastery)}%</strong>
            <SkillStatusBadge status={selected.status} />
            <button
              type="button"
              className="text-link"
              onClick={() => {
                const card = document.querySelector<HTMLButtonElement>(
                  `button[data-competency-id="${selected.id}"]`,
                );
                card?.scrollIntoView({
                  behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'instant'
                    : 'smooth',
                  block: 'center',
                });
                card?.focus({ preventScroll: true });
              }}
            >
              К карте навыков
            </button>
          </div>
        </div>
        <div className={styles.detailColumns}>
          <div>
            <h3>Что уже подтверждено</h3>
            <ComponentScores skill={selected} />
            <p className={styles.smallMuted}>
              Покрытие практики: {number(selected.practiceCoverage)}%. Самостоятельно верных первых
              решений: {selected.correctIndependent}.{' '}
              {selected.attempts
                ? `Точность первых попыток: ${number(selected.firstAttemptAccuracy)}%.`
                : 'Проверенных ответов пока нет.'}
            </p>
            <ErrorSummary skill={selected} />
            <h3 className={styles.sectionTitle}>Связанные основы</h3>
            {selected.prerequisites.length ? (
              <div className={styles.prerequisiteButtons}>
                {selected.prerequisites.map((id) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setSelectedId(id)}
                    className={
                      selected.missingPrerequisites.includes(id) ? styles.needsFoundation : ''
                    }
                  >
                    <GitBranch size={12} />
                    {getCompetency(id).name}
                    {selected.missingPrerequisites.includes(id) ? (
                      <span>укрепить</span>
                    ) : (
                      <Check size={12} />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.smallMuted}>
                Этот навык можно осваивать с нуля: дополнительных основ не требуется.
              </p>
            )}
            {selected.missingPrerequisites.length ? (
              <p className={styles.smallMuted}>
                Связи помогают подобрать последовательность. Вы можете начать практику и сейчас, а к
                основам вернуться по необходимости.
              </p>
            ) : null}
          </div>
          <div>
            <h3>Следующий разумный шаг</h3>
            <p className={styles.recommendationReason}>
              {recommendation?.reason ??
                (due
                  ? 'Подошёл срок повторения. Новый вариант задачи поможет проверить, сохранилось ли понимание.'
                  : prerequisite
                    ? `Перед следующей сложностью полезно укрепить «${getCompetency(prerequisite).name}».`
                    : 'Решите новый вариант задачи: результат уточнит оценку навыка.')}
            </p>
            <Link href={nextHref} className="button primary">
              {nextAction} <ArrowRight size={14} />
            </Link>
            {selected.group === 'english' ? (
              <Link href={practiceHref(selected.id)} className="text-link">
                Открыть Financial English <ArrowUpRight size={13} />
              </Link>
            ) : (
              <Link href={practiceHref(selected.id)} className="text-link">
                Дополнительная практика <ArrowUpRight size={13} />
              </Link>
            )}
            {selected.dueAt ? (
              <p className={styles.smallMuted}>
                <Clock3 size={12} />
                {due ? 'Повторение уже доступно' : `Следующее повторение: ${date(selected.dueAt)}`}
              </p>
            ) : null}
            <h3 className={styles.sectionTitle}>Уроки этого навыка</h3>
            <div className={styles.lessonLinks}>
              {selected.lessonIds.map((id) => {
                const lesson = getLesson(id);
                return lesson ? (
                  <Link href={`/lesson/${id}`} key={id}>
                    <BookOpen size={13} />
                    <span>{lesson.title}</span>
                    <ArrowUpRight size={12} />
                  </Link>
                ) : null;
              })}
            </div>
          </div>
        </div>
        <div className={styles.detailHistory}>
          <h3>Последняя практика навыка</h3>
          {history.length ? (
            <ul>
              {history.map((event) => (
                <li key={event.id}>
                  <span
                    className={
                      event.correct && event.valid ? styles.successDot : styles.practiceDot
                    }
                  />
                  <div>
                    <strong>
                      {modeLabels[event.mode]} ·{' '}
                      {getLesson(event.lessonId)?.title ?? 'Финансовая задача'}
                    </strong>
                    <span>
                      {date(event.at, true)} ·{' '}
                      {event.difficulty === 1
                        ? 'Базовая'
                        : event.difficulty === 2
                          ? 'Средняя'
                          : 'Углублённая'}{' '}
                      задача{event.hintsUsed ? ' · с подсказкой' : ''}
                    </span>
                  </div>
                  <span className={styles.historyOutcome}>
                    {!event.valid ? 'Проверьте формат' : event.correct ? 'Верно' : 'Нужна практика'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.smallMuted}>
              Здесь появятся ваши решения. Открытие страницы не добавляет баллы освоения.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

function firstVariantEvidence(evidence: KnowledgeEvidence[]) {
  const variants = new Map<string, KnowledgeEvidence>();
  for (const event of [...evidence]
    .filter((event) => event.valid)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id))) {
    const key = `${event.templateId}|${event.variantId}`;
    if (!variants.has(key)) variants.set(key, event);
  }
  return [...variants.values()];
}
function dayHistory(evidence: KnowledgeEvidence[]) {
  const days = new Map<string, { day: string; total: number; correct: number; accuracy: number }>();
  for (const event of firstVariantEvidence(evidence)) {
    const day = new Date(event.at).toISOString().slice(0, 10);
    const item = days.get(day) ?? { day, total: 0, correct: 0, accuracy: 0 };
    item.total += 1;
    if (event.correct && !event.hintsUsed) item.correct += 1;
    item.accuracy = Math.round((item.correct / item.total) * 100);
    days.set(day, item);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-14);
}
function hasDelayedSuccess(evidence: KnowledgeEvidence[]) {
  const seen = new Set<string>();
  const latest = new Map<CompetencyId, number>();
  for (const event of [...evidence]
    .filter((event) => event.valid)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id))) {
    const key = `${event.templateId}|${event.variantId}`;
    const firstVariant = !seen.has(key);
    const at = Date.parse(event.at);
    if (
      event.mode === 'review' &&
      firstVariant &&
      event.correct &&
      !event.hintsUsed &&
      event.competencyIds.some((id) => latest.has(id) && at - latest.get(id)! >= 86400000)
    )
      return true;
    seen.add(key);
    event.competencyIds.forEach((id) => latest.set(id, at));
  }
  return false;
}
function MasteryModel() {
  return (
    <details className={styles.model}>
      <summary>Как формируется оценка знаний</summary>
      <div>
        <p>
          <strong>Финансовые навыки:</strong> {number(MASTERY_WEIGHTS.financial.practice * 100)}%
          практики + {number(MASTERY_WEIGHTS.financial.review * 100)}% отсроченных повторений +{' '}
          {number(MASTERY_WEIGHTS.financial.exam * 100)}% серверных экзаменов. Для Financial
          English: {number(MASTERY_WEIGHTS.english.practice * 100)}% практики +{' '}
          {number(MASTERY_WEIGHTS.english.review * 100)}% повторений.
        </p>
        <p>
          Практика учитывает первую валидную попытку каждого нового варианта, сложность и покрытие
          нескольких типов задач. Исправление первоначальной ошибки даёт ограниченный частичный
          результат; ответ с подсказкой учитывается слабее самостоятельного.
        </p>
        <p>
          Повтор одного ответа не создаёт новые независимые доказательства. Интервалы повторения —
          1, 3, 7, 14 и 30 дней. Более высокий уровень удержания подтверждается новым вариантом
          после нужного интервала; повторение в тот же день не заменяет отсроченную проверку.
        </p>
        <p>
          Экзаменационный компонент берёт актуальные серверные результаты, а не сумму пересдач. Если
          проверки ещё не было, её компонент равен нулю: отсутствующие данные не подменяются
          достижением. Открытие урока не повышает освоение.
        </p>
        <p>
          Шкала: 0–24 — начальный уровень; 25–49 — требуется практика; 50–74 — формируется
          понимание; 75–89 — хорошее освоение; 90–100 — устойчивое освоение.
        </p>
      </div>
    </details>
  );
}

export function MyKnowledge() {
  const { data, knowledge, ready, error, status, refresh } = useKnowledge();
  const { progress, user } = useLearning();
  const days = useMemo(() => dayHistory(knowledge.evidence), [knowledge.evidence]);
  const independent = useMemo(() => firstVariantEvidence(knowledge.evidence), [knowledge.evidence]);
  if (!ready || !progress)
    return (
      <div className="loading-state" role="status">
        Пересчитываем знания по сохранённым ответам…
      </div>
    );
  const observed = knowledge.skills.filter((skill) => skill.attempts > 0 || skill.examScore > 0);
  const strong = observed
    .filter((skill) => skill.firstAttemptAccuracy >= 75 && skill.correctIndependent >= 2)
    .sort((a, b) => b.mastery - a.mastery || b.correctIndependent - a.correctIndependent)
    .slice(0, 3);
  const weak = observed
    .filter((skill) => skill.status === 'review' || skill.firstAttemptAccuracy < 75)
    .sort((a, b) => a.mastery - b.mastery || b.attempts - a.attempts)
    .slice(0, 3);
  const exams = [...data.examResults].sort(
    (a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt) || b.id.localeCompare(a.id),
  );
  const legacyExams = progress.completions
    .filter((completion) => getLesson(completion.lessonId)?.exam)
    .sort(
      (a, b) =>
        Date.parse(b.completedAt) - Date.parse(a.completedAt) || b.runId.localeCompare(a.runId),
    );
  const completeLessons = lessons.filter(
    (lesson) => !lesson.exam && hasCompleted(progress, lesson),
  ).length;
  const independentPractice = independent.filter(
    (event) =>
      (event.mode === 'practice' || event.mode === 'english') && event.correct && !event.hintsUsed,
  ).length;
  const achievements = [
    { label: 'Первый урок завершён', earned: completeLessons > 0 },
    { label: 'Три самостоятельных решения', earned: independentPractice >= 3 },
    { label: 'Успешное повторение спустя сутки', earned: hasDelayedSuccess(knowledge.evidence) },
    { label: 'Экзамен 0.2 пройден', earned: exams.some((exam) => exam.passed) },
  ].filter((achievement) => achievement.earned);
  const recentDays = days.slice(-7);
  return (
    <div className={styles.root}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ОТ РЕШЕНИЙ К КОМПЕТЕНЦИЯМ</span>
          <h1>Мои знания</h1>
          <p>Освоение, сильные стороны и следующие шаги — по вашим реальным ответам.</p>
        </div>
        <Link className="button" href="/review">
          <RefreshCw size={14} />
          Повторить знания{knowledge.reviewQueue.length ? ` · ${knowledge.reviewQueue.length}` : ''}
        </Link>
      </div>
      {error ? (
        <div className="notice warning" role="status">
          <span>{error}</span>
          <button onClick={() => void refresh()}>Повторить синхронизацию</button>
        </div>
      ) : null}
      <div className={styles.summaryGrid}>
        <section className="panel">
          <span>Навыков проверено</span>
          <strong>
            {observed.length}
            <small> / {knowledge.skills.length}</small>
          </strong>
          <p>У остальных навыков ещё нет достаточной истории.</p>
        </section>
        <section className="panel">
          <span>Новых вариантов решали</span>
          <strong>{independent.length}</strong>
          <p>Повторный ввод того же ответа не увеличивает это число.</p>
        </section>
        <section className="panel">
          <span>Ожидают повторения</span>
          <strong>{knowledge.reviewQueue.length}</strong>
          <p>
            {knowledge.reviewQueue.length
              ? 'Новые варианты помогут проверить сохранение знаний.'
              : 'Очередь появится по результатам практики.'}
          </p>
        </section>
        <section className="panel">
          <span>Серверных экзаменов</span>
          <strong>{exams.length}</strong>
          <p>
            {exams.length
              ? `${exams.filter((exam) => exam.passed).length} успешных попыток по правилам 0.2.`
              : 'Пока нет результатов экзаменов 0.2.'}
          </p>
        </section>
      </div>
      {!observed.length && !exams.length ? (
        <section className={`panel ${styles.startState}`}>
          <span className={styles.startIcon}>
            <GraduationCap size={25} />
          </span>
          <div>
            <h2>Сначала практика — затем выводы</h2>
            <p>
              Пока рано оценивать сильные и слабые стороны. Начните с урока или короткой задачи:
              система сохранит результат и предложит следующий шаг.
            </p>
          </div>
          <Link className="button primary" href={`/lesson/${nextLesson(lessons, progress).id}`}>
            Начать обучение <ArrowRight size={14} />
          </Link>
        </section>
      ) : null}
      <section className={`panel ${styles.competencyPanel}`}>
        <div className="panel-header">
          <h2>Освоение компетенций</h2>
          <Link href="/path" className="text-link">
            Карта навыков <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className={styles.skillList}>
          {knowledge.skills.map((skill) => (
            <article key={skill.id} data-competency-id={skill.id} className={styles.assessmentRow}>
              <div className={styles.assessmentHeading}>
                <div>
                  <h3>{skill.name}</h3>
                  <p>
                    {skill.attempts || skill.examScore ? level(skill.mastery) : 'Ещё не проверен'}
                  </p>
                </div>
                <div>
                  <strong>{number(skill.mastery)}%</strong>
                  <SkillStatusBadge status={skill.status} />
                </div>
              </div>
              <Meter value={skill.mastery} />
              <div className={styles.assessmentFacts}>
                <span>Практика: {number(skill.practiceScore)}%</span>
                <span>Покрытие: {number(skill.practiceCoverage)}%</span>
                <span>
                  Первые попытки:{' '}
                  {skill.attempts ? `${number(skill.firstAttemptAccuracy)}%` : 'нет данных'}
                </span>
                <span>Удержание: {number(skill.reviewScore)}%</span>
                {skill.examApplicable ? <span>Экзамен: {number(skill.examScore)}%</span> : null}
              </div>
              <Link
                className="text-link"
                href={
                  skill.status === 'review' ? `/review?skill=${skill.id}` : practiceHref(skill.id)
                }
              >
                {skill.status === 'review' ? 'Повторить навык' : 'Закрепить на практике'}
                <ArrowUpRight size={12} />
              </Link>
            </article>
          ))}
        </div>
        <MasteryModel />
      </section>
      <div className={styles.twoColumns}>
        <section className="panel">
          <div className="panel-header">
            <h2>Лучше получается</h2>
            <CircleCheck size={18} className={styles.accentIcon} />
          </div>
          {strong.length ? (
            strong.map((skill) => (
              <div className={styles.insight} key={skill.id}>
                <h3>{skill.name}</h3>
                <p>
                  {skill.correctIndependent} самостоятельных первых решений · точность{' '}
                  {number(skill.firstAttemptAccuracy)}%.
                </p>
                <Link className="text-link" href={practiceHref(skill.id)}>
                  Проверить следующий уровень <ArrowUpRight size={12} />
                </Link>
              </div>
            ))
          ) : (
            <p className={styles.smallMuted}>
              Нужно несколько самостоятельных решений разных вариантов, чтобы выделить сильные
              стороны.
            </p>
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Полезно закрепить</h2>
            <Target size={18} className={styles.accentIcon} />
          </div>
          {weak.length ? (
            weak.map((skill) => (
              <div className={styles.insight} key={skill.id}>
                <h3>{skill.name}</h3>
                <ErrorSummary skill={skill} />
                <Link
                  className="text-link"
                  href={
                    skill.status === 'review' ? `/review?skill=${skill.id}` : practiceHref(skill.id)
                  }
                >
                  Разобрать новый вариант <ArrowUpRight size={12} />
                </Link>
              </div>
            ))
          ) : (
            <p className={styles.smallMuted}>
              {observed.length
                ? 'По имеющейся истории пока нет явных слабых сторон. Продолжайте практику на новых вариантах.'
                : 'Список будет основан на ошибках, а не на предположениях о вашем уровне.'}
            </p>
          )}
        </section>
      </div>
      <section className={`panel ${styles.timelinePanel}`}>
        <div className="panel-header">
          <h2>Точность практики по дням</h2>
          <span className="pill">Первые самостоятельные ответы</span>
        </div>
        {days.length ? (
          <>
            <p className={styles.smallMuted}>
              Показаны только дни с новыми вариантами задач. Это точность первых ответов, а не
              график освоения. Даты сгруппированы по UTC.
            </p>
            <div className={styles.dayBars} aria-hidden="true">
              {recentDays.map((day) => (
                <div className={styles.dayBar} key={day.day}>
                  <strong>{day.accuracy}%</strong>
                  <div>
                    <span style={{ height: `${day.accuracy}%` }} />
                  </div>
                  <span>
                    {new Date(`${day.day}T00:00:00Z`).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      timeZone: 'UTC',
                    })}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.tableWrap}>
              <table>
                <caption>
                  Первые валидные ответы на новые варианты; исправления не меняют итог дня.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Дата, UTC</th>
                    <th scope="col">Самостоятельно верно</th>
                    <th scope="col">Всего вариантов</th>
                    <th scope="col">Точность</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.day}>
                      <th scope="row">{day.day}</th>
                      <td>{day.correct}</td>
                      <td>{day.total}</td>
                      <td>{day.accuracy}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className={styles.smallMuted}>
            После первых проверенных ответов здесь появятся ваши фактические результаты по дням.
            Пустые дни не заполняются вымышленными данными.
          </p>
        )}
      </section>
      <section className={`panel ${styles.recommendationsPanel}`}>
        <h2>Что предложит академия дальше</h2>
        <div className={styles.recommendations}>
          {knowledge.recommendations.slice(0, 3).map((recommendation) => (
            <article key={`${recommendation.competencyId}-${recommendation.kind}`}>
              <span className="eyebrow">{getCompetency(recommendation.competencyId).english}</span>
              <h3>{getCompetency(recommendation.competencyId).name}</h3>
              <p>{recommendation.reason}</p>
              <Link href={recommendationHref(recommendation)} className="text-link">
                {actionLabel(recommendation)} <ArrowRight size={13} />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className={`panel ${styles.examPanel}`}>
        <div className="panel-header">
          <h2>История экзаменов 0.2</h2>
          <span className="pill">Порог зачёта — 80%</span>
        </div>
        {exams.length ? (
          <div className={styles.examResults}>
            {exams.map((exam) => {
              const weakIds = [
                ...new Set(
                  exam.answers
                    .filter((answer) => !answer.correct)
                    .flatMap((answer) => answer.competencyIds),
                ),
              ];
              return (
                <article key={exam.id}>
                  <div className={styles.examResultHeading}>
                    <div>
                      <h3>
                        {modules.find((module) => module.id === exam.moduleId)?.title ??
                          'Финансовый модуль'}
                      </h3>
                      <p>
                        {date(exam.submittedAt, true)} · Вариант {exam.variant}
                      </p>
                    </div>
                    <div>
                      <strong>{number(exam.score)}%</strong>
                      <span>
                        {exam.passed ? 'Экзамен пройден' : 'Нужна дополнительная практика'}
                      </span>
                    </div>
                  </div>
                  <p className={styles.serverCaption}>
                    <Check size={12} />
                    {user
                      ? 'Результат сохранён сервером в вашем аккаунте.'
                      : 'Результат проверен сервером. Войдите, чтобы перенести его в аккаунт.'}
                  </p>
                  {weakIds.length ? (
                    <div className={styles.errorChips}>
                      {weakIds.map((id) => (
                        <Link href={`/practice?skill=${id}`} key={id}>
                          {getCompetency(id).name}
                          <ArrowUpRight size={11} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.smallMuted}>Все вопросы этого варианта решены верно.</p>
                  )}
                  <Link href={`/lesson/${exam.lessonId}`} className="text-link">
                    К экзамену и пересдаче <ArrowUpRight size={12} />
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.smallMuted}>
            После завершения экзамена появятся серверный балл, слабые навыки и рекомендации. До
            отправки всей попытки решения не раскрываются.
          </p>
        )}
        {legacyExams.length ? (
          <details className={styles.legacyExams}>
            <summary>Сохранённая история FINLAB 0.1 · {legacyExams.length}</summary>
            <p>
              Старые учебные результаты сохранены отдельно. Они использовали правила версии 0.1 и не
              заменяют серверный экзамен 0.2.
            </p>
            <ul>
              {legacyExams.map((exam) => (
                <li key={exam.runId}>
                  <span>{getLesson(exam.lessonId)?.title}</span>
                  <span>
                    {date(exam.completedAt)} · {number(exam.score)}%
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
      <section className={`panel ${styles.achievements}`}>
        <h2>Подтверждённые шаги</h2>
        {achievements.length ? (
          <div>
            {achievements.map((achievement) => (
              <span key={achievement.label}>
                <CircleCheck size={15} />
                {achievement.label}
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.smallMuted}>
            Завершённый урок, самостоятельное решение и успешное повторение — небольшие шаги,
            которые будут отмечены здесь по результатам работы.
          </p>
        )}
      </section>
      <p className={styles.syncNote}>
        {status === 'synced'
          ? 'История знаний синхронизирована с аккаунтом.'
          : status === 'syncing'
            ? 'Новые учебные результаты отправляются в аккаунт…'
            : user
              ? 'История аккаунта показана с учётом доступной локальной копии. Состояние синхронизации указано выше.'
              : 'Гостевая практика хранится на этом устройстве. Для синхронизации между устройствами войдите в профиль.'}
      </p>
    </div>
  );
}
