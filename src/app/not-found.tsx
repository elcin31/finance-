import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="empty-state">
      <span className="eyebrow">404 · НОВЫЙ МАРШРУТ</span>
      <h1>Здесь пока нет урока</h1>
      <p>Все доступные темы собраны на вашем образовательном пути.</p>
      <Link href="/path" className="button primary">
        Открыть путь обучения
      </Link>
    </section>
  );
}
