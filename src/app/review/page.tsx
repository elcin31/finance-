import ReviewCenter from '@/components/review-center';
import StudySession from '@/components/study-session';
export const metadata = { title: 'Повторить знания' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  const { skill } = await searchParams;
  return skill ? <StudySession skill={skill} mode="review" /> : <ReviewCenter />;
}
