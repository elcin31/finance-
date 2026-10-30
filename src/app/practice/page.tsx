import StudySession from '@/components/study-session';
export const metadata = { title: 'Адаптивная практика' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; template?: string; exercise?: string; mode?: string }>;
}) {
  const params = await searchParams;
  return (
    <StudySession
      skill={params.skill}
      template={params.template}
      exercise={params.exercise}
      mode={params.mode === 'review' ? 'review' : 'practice'}
    />
  );
}
