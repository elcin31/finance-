'use client';
import Link from 'next/link';
import { ArrowRight, BookOpen, Check, Globe2 } from 'lucide-react';
import { englishPractice, englishTracks, professionalTerms } from '@/content/english-practice';
import { useKnowledge } from './learning-provider';
import StudySession from './study-session';
import type { CompetencyId, ExerciseEntry } from '@/lib/learning-types';

const skills: Record<NonNullable<ExerciseEntry['category']>, CompetencyId> = {
  vocabulary: 'english-terminology',
  reading: 'english-reading',
  calculations: 'english-calculations',
  expressions: 'english-expressions',
};
export default function EnglishHub({ track, exercise }: { track?: string; exercise?: string }) {
  const { data, ready } = useKnowledge();
  const selected = englishTracks.find((item) => item.id === track) ?? englishTracks[0];
  const entry = englishPractice.find((item) => item.exercise.id === exercise);
  if (entry)
    return (
      <StudySession
        key={entry.exercise.id}
        exercise={entry.exercise.id}
        mode="english"
        skill={skills[entry.category!]}
        category={entry.category}
      />
    );
  const entries = englishPractice.filter((item) => item.category === selected.id);
  const mastery = new Set(
    data.events.filter((event) => event.valid && event.correct).map((event) => event.exerciseId),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ПОНИМАТЬ ФИНАНСЫ НА ЯЗЫКЕ ПРОФЕССИИ</span>
          <h1>Финансовый английский</h1>
          <p>
            Термины, короткая аналитика и расчёты. {englishPractice.length} задач в контексте
            финансовых решений.
          </p>
        </div>
        <Globe2 size={28} />
      </div>
      <nav
        className="learning-tabs english-tabs"
        role="tablist"
        aria-label="Направления финансового английского"
      >
        {englishTracks.map((item) => (
          <Link
            key={item.id}
            href={`/english?track=${item.id}`}
            role="tab"
            aria-selected={item.id === selected.id}
            aria-controls="english-tasks"
            className={item.id === selected.id ? 'active' : ''}
          >
            {item.title}
          </Link>
        ))}
      </nav>
      <section id="english-tasks" role="tabpanel" aria-label={selected.title}>
        <div className="section-heading">
          <div>
            <h2>{selected.title}</h2>
            <p className="muted">{selected.description}</p>
          </div>
          <span className="pill">
            {ready ? entries.filter((item) => mastery.has(item.exercise.id)).length : 0} /{' '}
            {entries.length} решено
          </span>
        </div>
        <div className="english-task-grid">
          {entries.map((item, index) => (
            <Link
              className="panel english-task"
              href={`/english?track=${selected.id}&exercise=${item.exercise.id}`}
              key={item.exercise.id}
            >
              <span className="eyebrow">
                {String(index + 1).padStart(2, '0')} ·{' '}
                {item.difficulty === 1 ? 'ОСНОВА' : item.difficulty === 2 ? 'ПРИМЕНЕНИЕ' : 'АНАЛИЗ'}{' '}
                {mastery.has(item.exercise.id) && <Check size={13} />}
              </span>
              <h3>{item.exercise.prompt}</h3>
              <span className="text-link">
                Практика <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <div className="section-heading">
        <h2>Язык финансового анализа</h2>
        <span className="muted">{professionalTerms.length} терминов в контексте</span>
      </div>
      <div className="english-terms-grid">
        {professionalTerms.map((term) => (
          <article className="panel" key={term.en}>
            <span className="eyebrow">{term.ru}</span>
            <h3>{term.en}</h3>
            <p>{term.definition}</p>
            <blockquote lang="en">{term.context}</blockquote>
            <div className="english-term-links">
              <Link href={`/english?exercise=${term.exerciseId}`} className="text-link">
                Проверить понимание <ArrowRight size={13} />
              </Link>
              <Link href={`/lesson/${term.lessonId}`} className="text-link">
                <BookOpen size={13} />
                Материал
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
