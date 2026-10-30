import EnglishHub from '@/components/english-hub';
export const metadata = { title: 'Финансовый английский' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <EnglishHub
      track={typeof params.track === 'string' ? params.track : undefined}
      exercise={typeof params.exercise === 'string' ? params.exercise : undefined}
    />
  );
}
