import type { ExamSession } from './learning-types';
import type { Answer } from './types';
import { parseExamSession } from './learning-validation';
import { supabase } from './supabase';

async function call(name: string, args: Record<string, unknown>): Promise<ExamSession> {
  if (!supabase)
    throw new Error(
      'Экзамен требует подключения к настроенному FINLAB серверу. Повторите после подключения.',
    );
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`Экзамен: ${error.message}`);
  const session = parseExamSession(data);
  if (!session) throw new Error('Получен несовместимый ответ сервера экзаменов.');
  return session;
}
export async function startExam(
  moduleId: string,
  requestId: string,
  guestToken?: string,
): Promise<ExamSession> {
  const session = await call('finlab_exam_start', {
    module_id: moduleId,
    request_id: requestId,
    guest_token: guestToken ?? null,
  });
  return guestToken ? { ...session, guestToken } : session;
}
export function getExam(id: string, token?: string): Promise<ExamSession> {
  return call('finlab_exam_get', { attempt_id: id, guest_token: token ?? null });
}
export function submitExam(
  id: string,
  answers: Record<string, Answer>,
  token?: string,
): Promise<ExamSession> {
  return call('finlab_exam_submit', { attempt_id: id, answers, guest_token: token ?? null });
}
export function claimExam(id: string, token: string): Promise<ExamSession> {
  return call('finlab_exam_claim', { attempt_id: id, guest_token: token });
}
export function saveExamDraft(
  id: string,
  answers: Record<string, Answer>,
  position: number,
  token?: string,
): Promise<ExamSession> {
  return call('finlab_exam_draft', {
    attempt_id: id,
    answers,
    position,
    guest_token: token ?? null,
  });
}
export async function findActiveExam(moduleId: string): Promise<ExamSession | null> {
  if (!supabase) throw new Error('Сервер экзаменов не настроен.');
  const { data, error } = await supabase.rpc('finlab_exam_active', { module_id: moduleId });
  if (error) throw new Error(`Не удалось восстановить экзамен: ${error.message}`);
  if (data === null) return null;
  const session = parseExamSession(data);
  if (!session) throw new Error('Не удалось проверить сохранённый экзамен.');
  return session;
}
