import KnowledgeLibrary from '@/components/library';
export const metadata = { title: 'Библиотека финансов' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  return <KnowledgeLibrary initialSearch={typeof search === 'string' ? search : ''} />;
}
