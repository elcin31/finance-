import LearningPath from '@/components/learning-path';
export const metadata = { title: 'Образовательный путь' };
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <LearningPath view={view} />;
}
