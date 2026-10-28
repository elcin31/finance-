import type { Progress } from './progress';
import { supabase } from './supabase';
import { parseProgress } from './validation';

function client() {
  if (!supabase)
    throw new Error('Синхронизация не настроена. Прогресс сохраняется только на этом устройстве.');
  return supabase;
}

export async function loadRemoteProgress(): Promise<Progress | null> {
  const { data, error } = await client().rpc('finlab_load_progress');
  if (error) throw new Error(`Не удалось загрузить прогресс: ${error.message}`);
  if (data === null) return null;
  const progress = parseProgress(data);
  if (!progress)
    throw new Error('Сервер вернул несовместимый формат прогресса. Локальные ответы сохранены.');
  return progress;
}

/** Atomic DB merge. The returned database document is the canonical account state. */
export async function syncRemoteProgress(progress: Progress): Promise<Progress> {
  const incoming = parseProgress(progress);
  if (!incoming) throw new Error('Прогресс содержит некорректные данные и не отправлен на сервер.');
  const { data, error } = await client().rpc('finlab_sync_progress', { incoming });
  if (error) throw new Error(`Не удалось сохранить прогресс: ${error.message}`);
  const canonical = parseProgress(data);
  if (!canonical)
    throw new Error('Не удалось проверить сохранённый прогресс. Повторите синхронизацию.');
  return canonical;
}
