import { notFound } from 'next/navigation';
import { getLesson, lessons } from '@/content/curriculum';
import LessonPlayer from '@/components/lesson-player';
export function generateStaticParams() {
  return lessons.map((l) => ({ id: l.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: getLesson(id)?.title ?? 'Урок' };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  return <LessonPlayer lesson={lesson} />;
}
