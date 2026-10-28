'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="empty-state">
      <h1>Не удалось открыть страницу</h1>
      <p>Ваши сохранённые ответы останутся на устройстве. Попробуйте загрузить страницу ещё раз.</p>
      <button className="button primary" onClick={reset}>
        Попробовать снова
      </button>
    </section>
  );
}
