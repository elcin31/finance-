import type { LearningData, LearningEvent, PracticeDraft } from './learning-types';
import { parseLearningData } from './learning-validation';
import { supabase } from './supabase';

function client() {
  if (!supabase)
    throw new Error('Синхронизация не настроена. Результаты сохранены на этом устройстве.');
  return supabase;
}
export async function loadLearningData(): Promise<LearningData> {
  const { data, error } = await client().rpc('finlab_learning_load');
  if (error) throw new Error(`Не удалось загрузить результаты: ${error.message}`);
  const parsed = parseLearningData(data);
  if (!parsed) throw new Error('Сервер вернул несовместимый формат результатов обучения.');
  return parsed;
}
export async function syncLearningData(
  events: LearningEvent[],
  drafts: Record<string, PracticeDraft>,
): Promise<LearningData> {
  if (!parseLearningData({ version: 2, events, drafts, examResults: [] }))
    throw new Error('Некорректные результаты не отправлены на сервер.');
  const { data, error } = await client().rpc('finlab_learning_sync', { events, drafts });
  if (error) throw new Error(`Не удалось синхронизировать результаты: ${error.message}`);
  const parsed = parseLearningData(data);
  if (!parsed) throw new Error('Не удалось проверить канонический ответ сервера.');
  return parsed;
}
