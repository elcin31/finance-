'use client';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Clock3, RotateCcw } from 'lucide-react';
import { useKnowledge } from './learning-provider';
import { getCompetency } from '@/content/skills';

export default function ReviewCenter() {
  const { knowledge, data, ready } = useKnowledge();
  if (!ready) return <div className="loading-state">Собираем расписание повторений…</div>;
  const due = knowledge.reviewQueue;
  const upcoming = knowledge.skills
    .filter((skill) => skill.dueAt && !due.some((item) => item.competencyId === skill.id))
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
  const reviewEvents = data.events.filter((event) => event.mode === 'review' && event.valid);
  const sessions = new Map<string, (typeof reviewEvents)[number]>();
  for (const event of reviewEvents) sessions.set(event.sessionId, event);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">УКРЕПЛЯЙТЕ ЗНАНИЯ ВОВРЕМЯ</span>
          <h1>Повторить знания</h1>
          <p>Короткие задачи помогают сохранить понимание надолго.</p>
        </div>
        <span className="pill green">
          <RotateCcw size={13} />
          {due.length} ожидают
        </span>
      </div>
      <div className="review-overview panel">
        <div>
          <strong>{due.length}</strong>
          <span>навыков к повторению</span>
        </div>
        <div>
          <strong>≈ {due.length * 2} мин</strong>
          <span>ориентировочная длительность</span>
        </div>
        <div>
          <strong>{sessions.size}</strong>
          <span>проверок повторения в истории</span>
        </div>
      </div>
      <div className="section-heading">
        <h2>На сегодня</h2>
        <span className="muted" style={{ fontSize: 11 }}>
          Интервалы: 1 · 3 · 7 · 14 · 30 дней
        </span>
      </div>
      {due.length ? (
        <div className="review-grid">
          {due.map((item) => (
            <article className="panel review-card" key={item.competencyId}>
              <span className="eyebrow">
                {item.stage === 0 ? 'ПОДДЕРЖАТЬ ПОНИМАНИЕ' : 'ПРОВЕРИТЬ СОХРАННОСТЬ ЗНАНИЙ'}
              </span>
              <h2>{getCompetency(item.competencyId)?.name}</h2>
              <p>{item.reason}</p>
              <span className="review-date">
                <CalendarDays size={13} />
                {new Date(item.dueAt).toLocaleString('ru-RU', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
              <Link className="button primary" href={`/review?skill=${item.competencyId}`}>
                Начать повторение <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel review-empty">
          <CalendarDays size={27} />
          <h2>
            {knowledge.evidence.length
              ? 'На сегодня обязательных повторений нет'
              : 'Расписание появится после первой практики'}
          </h2>
          <p>
            Повторения не закрывают доступ к урокам. Вы можете продолжать обучение или проверить
            навык раньше срока.
          </p>
          <Link href="/practice" className="button">
            Открыть практику <ArrowRight size={14} />
          </Link>
        </div>
      )}
      {upcoming.length > 0 && (
        <>
          <div className="section-heading">
            <h2>Ближайшие повторения</h2>
          </div>
          <div className="panel">
            {upcoming.map((skill) => (
              <div className="review-upcoming" key={skill.id}>
                <div>
                  <strong>{skill.name}</strong>
                  <p>
                    {new Date(skill.dueAt!).toLocaleDateString('ru-RU', { dateStyle: 'long' })} ·
                    освоение {skill.mastery}%
                  </p>
                </div>
                <Link className="button small" href={`/review?skill=${skill.id}`}>
                  Повторить досрочно <ArrowRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
      {sessions.size > 0 && (
        <>
          <div className="section-heading">
            <h2>Последние повторения</h2>
          </div>
          <div className="panel">
            <ul className="history-list">
              {[...sessions.values()]
                .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
                .slice(0, 8)
                .map((event) => (
                  <li key={event.id}>
                    <RotateCcw size={15} />
                    <div>
                      <strong>
                        {event.competencyIds.map((id) => getCompetency(id)?.name).join(' · ')}
                      </strong>
                      <small>
                        {new Date(event.at).toLocaleString('ru-RU', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </small>
                    </div>
                    <span className="pill">{event.correct ? 'Решено' : 'Требует практики'}</span>
                  </li>
                ))}
            </ul>
          </div>
        </>
      )}
      <details className="model-note">
        <summary>Как меняется расписание</summary>
        <p>
          Новый правильный ответ после нужного интервала увеличивает следующий срок: 1, 3, 7, 14, 30
          дней. Для уже встречавшегося условия требуется не менее семи дней с его последнего
          решения. Это позволяет повторять конечный банк английских и качественных вопросов без
          начисления за ежедневный ввод запомненного ответа. Ошибка возвращает навык к короткому
          интервалу. Исправление или раннее повторение не повышают удержание.
        </p>
        <p>
          Даты хранятся как точные моменты времени, показываются в часовом поясе браузера.
          Дублирующая отправка одного события не создаёт второго повторения.
        </p>
      </details>
    </>
  );
}
