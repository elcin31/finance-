import FinancialLab from '@/components/financial-lab';
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
    </>
  );
}
