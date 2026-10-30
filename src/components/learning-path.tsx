'use client';
import Link from 'next/link';
import { ArrowRight, Check, Clock3, LockKeyhole, Trophy } from 'lucide-react';
import { lessons, modules } from '@/content/curriculum';
import { hasCompleted, isUnlocked } from '@/lib/progress';
import { useLearning } from './providers';
import { useEffectiveProgress } from './effective-progress';
import { SkillTree } from './knowledge-screens';
export default function LearningPath({ view = 'skills' }: { view?: string }) {
  return (
    <>
      <nav className="learning-tabs" role="tablist" aria-label="Образовательный путь">
        <Link
          role="tab"
          aria-selected={view !== 'lessons'}
          href="/path"
          className={view !== 'lessons' ? 'active' : ''}
        >
          Карта навыков
        </Link>
        <Link
          role="tab"
          aria-selected={view === 'lessons'}
          href="/path?view=lessons"
          className={view === 'lessons' ? 'active' : ''}
        >
          Уроки и экзамены
        </Link>
      </nav>
      <div role="tabpanel">{view === 'lessons' ? <CurriculumPath /> : <SkillTree />}</div>
    </>
  );
}
function CurriculumPath() {
  const progress = useEffectiveProgress();
  if (!progress) return <div className="loading-state">Загружаем путь…</div>;
  const completed = lessons.filter((l) => hasCompleted(progress, l)).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LEARN → UNDERSTAND → PRACTICE → APPLY → MASTER</span>
          <h1>Ваш путь в финансах</h1>
          <p>Три модуля. Восемнадцать уроков. Знания, которые складываются в систему.</p>
        </div>
      </div>
      <div className="panel path-overview">
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 13 }}>
            Пройдено {completed} из {lessons.length} этапов
          </strong>
          <div className="progress-track">
            <span style={{ width: `${(completed / lessons.length) * 100}%` }} />
          </div>
        </div>
        <span className="pill green">В своём темпе</span>
      </div>
      <div className="path-legend">
        <span>
          <Check size={13} /> Пройдено
        </span>
        <span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />{' '}
          Доступно
        </span>
        <span>
          <LockKeyhole size={12} /> После практики
        </span>
      </div>
      {modules.map((m, i) => {
        const done = m.lessonIds.filter((id) =>
          lessons.some((l) => l.id === id && hasCompleted(progress, l)),
        ).length;
        return (
          <section className="panel path-module" key={m.id} id={m.id}>
            <div className="path-module-header">
              <div className="module-badge">0{i + 1}</div>
              <div>
                <span className="eyebrow" style={{ fontSize: 8, marginBottom: 4 }}>
                  {m.english}
                </span>
                <h2>{m.title}</h2>
                <p>{m.description}</p>
              </div>
              <span className="pill">
                {done} / {m.lessonIds.length}
              </span>
            </div>
            <div className="path-lessons">
              {m.lessonIds.map((id, j) => {
                const l = lessons.find((x) => x.id === id)!;
                const done = hasCompleted(progress, l);
                const open = isUnlocked(l, lessons, progress);
                return (
                  <div
                    key={id}
                    className={`path-lesson ${done ? 'done' : open ? 'available' : 'locked'}`}
                  >
                    <span className="step-marker">
                      {done ? (
                        <Check size={14} />
                      ) : !open ? (
                        <LockKeyhole size={12} />
                      ) : l.exam ? (
                        <Trophy size={14} />
                      ) : (
                        String(j + 1).padStart(2, '0')
                      )}
                    </span>
                    <div className="path-lesson-copy">
                      <h3>{l.title}</h3>
                      <p>
                        {l.exam ? 'Практический экзамен' : l.subtitle} · {l.minutes} мин
                      </p>
                    </div>
                    {open ? (
                      <Link
                        className={`button small ${!done ? 'primary' : ''}`}
                        href={`/lesson/${id}`}
                      >
                        {done ? 'Повторить' : progress.states[id] ? 'Продолжить' : 'Начать'}
                        <ArrowRight size={14} />
                      </Link>
                    ) : (
                      <span className="pill" title="Завершите предыдущие уроки">
                        <LockKeyhole size={12} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <div className="future-note">
        <strong>Это только начало большой академии.</strong>
        <p>
          В следующих версиях — финансовая отчётность, экономика, анализ инвестиций, управление
          портфелем и рисками, финансовое моделирование и профессиональная практика.
        </p>
        <p>
          Первый урок каждого модуля открыт. Остальные этапы открываются последовательно, экзамен —
          после всех уроков своего модуля.
        </p>
      </div>
    </>
  );
}
