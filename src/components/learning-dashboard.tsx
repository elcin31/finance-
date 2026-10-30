'use client';
import Link from 'next/link';
import { ArrowRight, RotateCcw, Target } from 'lucide-react';
import { useKnowledge } from './learning-provider';
import { getCompetency } from '@/content/skills';

export function LearningDashboard() {
  const { knowledge, data, ready } = useKnowledge();
  if (!ready)
    return (
      <div className="panel" role="status">
        Сопоставляем результаты практики…
      </div>
    );
  const recommendation = knowledge.recommendations[0];
  const weak = knowledge.skills
    .filter(
      (skill) =>
        skill.attempts > 0 && (skill.status === 'review' || skill.firstAttemptAccuracy < 75),
    )
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3);
  const latest = [...data.examResults].sort(
    (a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt),
  )[0];
  const valid = knowledge.evidence.filter((event) => event.valid);
  const next = recommendation
    ? recommendation.kind === 'lesson'
      ? `/lesson/${recommendation.lessonId}`
      : recommendation.kind === 'review'
        ? `/review?skill=${recommendation.competencyId}`
        : `/practice?skill=${recommendation.competencyId}`
    : '/lesson/m1-money';
  return (
    <section className="panel adaptive-dashboard">
      <div className="panel-header">
        <h3>
          <Target size={16} /> Персональный следующий шаг
        </h3>
        <Link className="text-link" href="/knowledge">
          Мои знания <ArrowRight size={13} />
        </Link>
      </div>
      <h2>
        {recommendation
          ? getCompetency(recommendation.competencyId)?.name
          : 'Начните с финансовых основ'}
      </h2>
      <p>
        {recommendation?.reason ??
          'Практика покажет, что вы уже понимаете и какие темы требуют внимания.'}
      </p>
      <Link className="button small primary" href={next}>
        {recommendation?.kind === 'review'
          ? 'Повторить навык'
          : recommendation?.kind === 'practice'
            ? 'Решить задачу'
            : 'Открыть урок'}
        <ArrowRight size={13} />
      </Link>
      <div className="adaptive-stat-grid">
        <Link href="/review">
          <RotateCcw size={14} />
          <strong>{knowledge.reviewQueue.length}</strong>
          <span>навыков к повторению</span>
        </Link>
        <Link href="/knowledge">
          <strong>{valid.length}</strong>
          <span>проверенных ответов</span>
        </Link>
        <Link href="/knowledge">
          <strong>{latest ? `${latest.score}%` : '—'}</strong>
          <span>{latest ? 'последний экзамен' : 'экзаменов пока нет'}</span>
        </Link>
      </div>
      {weak.length > 0 ? (
        <div className="weak-skill-links">
          <span className="muted">Полезно укрепить:</span>
          {weak.map((skill) => (
            <Link href={`/practice?skill=${skill.id}`} key={skill.id}>
              {skill.name} · {skill.mastery}% <ArrowRight size={12} />
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 11, marginBottom: 0 }}>
          {valid.length
            ? 'Слабые стороны появятся по результатам новых самостоятельных задач.'
            : 'Пока нет проверенных результатов. Проценты освоения будут рассчитаны из ваших ответов.'}
        </p>
      )}
    </section>
  );
}
