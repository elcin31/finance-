import FinancialLab from '@/components/financial-lab';
import Link from 'next/link';
export const metadata = { title: 'Финансовая лаборатория' };
export default function Page() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">МЕНЯЙТЕ ПАРАМЕТРЫ. НАХОДИТЕ ЗАКОНОМЕРНОСТИ.</span>
          <h1>Финансовая лаборатория</h1>
          <p>Превратите формулы в понятные решения. Все сценарии — учебные.</p>
        </div>
      </div>
      <FinancialLab />
      <section className="panel concepts-entry">
        <div>
          <span className="eyebrow">ИССЛЕДУЙТЕ ПРИНЦИПЫ</span>
          <h2>Увидеть, как работают финансы</h2>
          <p>
            Сравните простые и сложные проценты, покупательную способность, дисконтирование, риск и
            диверсификацию. Все модели — учебные.
          </p>
        </div>
        <Link className="button primary" href="/lab/concepts">
          Открыть интерактивные модели →
        </Link>
      </section>
    </>
  );
}
