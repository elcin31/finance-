import ConceptExplorer from '@/components/concept-explorer';
export const metadata = { title: 'Интерактивные объяснения' };
export default function Page() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ИЗМЕНЯЙТЕ УСЛОВИЯ. ПОНИМАЙТЕ ПРИЧИНЫ.</span>
          <h1>Финансы в движении</h1>
          <p>Пять учебных моделей: от капитализации до связи риска и диверсификации.</p>
        </div>
      </div>
      <ConceptExplorer />
    </>
  );
}
