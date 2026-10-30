'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLearning } from './providers';
import type { ExamResult, LearningData, LearningEvent, PracticeDraft } from '@/lib/learning-types';
import { emptyLearningData, mergeLearningData } from '@/lib/learning-store';
import { parseLearningData } from '@/lib/learning-validation';
import { loadLearningData, syncLearningData } from '@/lib/learning-remote';
import { getExam, claimExam } from '@/lib/secure-exams';
import { readGuestCapabilities, forgetGuestCapability } from '@/lib/exam-local';
import { buildKnowledge } from '@/lib/knowledge';
import { allPracticeEntries } from '@/lib/practice-registry';

type SyncState = 'loading' | 'local' | 'syncing' | 'synced' | 'error';
type KnowledgeContext = {
  data: LearningData;
  ready: boolean;
  status: SyncState;
  error: string;
  knowledge: ReturnType<typeof buildKnowledge>;
  record: (event: LearningEvent) => void;
  saveDraft: (draft: PracticeDraft) => void;
  rememberExamResult: (result: ExamResult) => void;
  refresh: () => Promise<void>;
};
const Context = createContext<KnowledgeContext | null>(null);
const GUEST = 'finlab.learning.guest.v2';
const account = (uid: string) => `finlab.learning.account.v2.${uid}`;

export function LearningProvider({ children }: { children: ReactNode }) {
  const { progress, ready: legacyReady, user } = useLearning();
  const [data, setData] = useState<LearningData>(emptyLearningData);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncState>('loading');
  const [error, setError] = useState('');
  const [clock, setClock] = useState(() => new Date().toISOString());
  const current = useRef(data);
  const owner = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const acknowledged = useRef(new Set<string>());
  const revision = useRef(0);
  const pending = useRef(false);
  const initialized = useRef(false);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    const tick = () => setClock(new Date().toISOString());
    const interval = setInterval(tick, 60_000);
    const visible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  const read = useCallback((key: string) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? parseLearningData(JSON.parse(raw)) : null;
    } catch {
      setError('Не удалось прочитать историю практики. Сохраните доступный прогресс в профиле.');
      return null;
    }
  }, []);
  const publish = useCallback((next: LearningData) => {
    current.current = next;
    setData(next);
    try {
      localStorage.setItem(owner.current ? account(owner.current) : GUEST, JSON.stringify(next));
    } catch {
      setError(
        'Не удалось сохранить новую практику на устройстве. Не закрывайте вкладку до синхронизации.',
      );
    }
  }, []);
  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush.current(), 600);
  }, []);
  flush.current = async () => {
    if (!owner.current || !initialized.current || inFlight.current || !pending.current) return;
    const gen = generation.current,
      rev = revision.current;
    inFlight.current = true;
    pending.current = false;
    setStatus('syncing');
    try {
      const events = current.current.events.filter((event) => !acknowledged.current.has(event.id));
      const canonical = await syncLearningData(events, current.current.drafts);
      if (gen !== generation.current) return;
      acknowledged.current = new Set(canonical.events.map((event) => event.id));
      publish(mergeLearningData(canonical, current.current));
      setStatus('synced');
      setError('');
      const guest = read(GUEST);
      if (guest && guest.events.every((event) => acknowledged.current.has(event.id)))
        localStorage.removeItem(GUEST);
    } catch (e) {
      if (gen === generation.current) {
        pending.current = true;
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Практика ещё не синхронизирована.');
      }
    } finally {
      inFlight.current = false;
    }
    if (gen === generation.current && rev !== revision.current && navigator.onLine) {
      pending.current = true;
      schedule();
    }
  };
  const record = useCallback(
    (event: LearningEvent) => {
      if (current.current.events.some((item) => item.id === event.id)) return;
      publish({ ...current.current, events: [...current.current.events, event] });
      revision.current++;
      pending.current = true;
      if (owner.current) {
        setStatus('syncing');
        schedule();
      }
    },
    [publish, schedule],
  );
  const saveDraft = useCallback(
    (draft: PracticeDraft) => {
      publish({ ...current.current, drafts: { ...current.current.drafts, [draft.id]: draft } });
      revision.current++;
      pending.current = true;
      if (owner.current) {
        setStatus('syncing');
        schedule();
      }
    },
    [publish, schedule],
  );
  const rememberExamResult = useCallback(
    (result: ExamResult) => {
      publish({
        ...current.current,
        examResults: [
          ...current.current.examResults.filter((item) => item.id !== result.id),
          result,
        ],
      });
    },
    [publish],
  );
  const refresh = useCallback(async () => {
    if (!owner.current) return;
    pending.current = true;
    await flush.current();
  }, []);

  useEffect(() => {
    if (!legacyReady) return;
    const gen = ++generation.current;
    owner.current = user?.id;
    initialized.current = false;
    revision.current = 0;
    pending.current = false;
    setReady(false);
    setError('');
    clearTimeout(timer.current);
    let alive = true;
    const initialize = async () => {
      let cache = read(user ? account(user.id) : GUEST) ?? emptyLearningData();
      // Keep the guest import durable even when the first account request is offline.
      if (user) {
        const guest = read(GUEST);
        if (guest) cache = mergeLearningData(cache, guest);
      }
      // Cached exam scores are never authoritative on a new load.
      publish({ ...cache, examResults: [] });
      if (!user) {
        setStatus('local');
        initialized.current = true;
        setReady(true);
        const results: ExamResult[] = [];
        for (const capability of readGuestCapabilities()) {
          try {
            const session = await getExam(capability.id, capability.token);
            if (session.result) results.push(session.result);
          } catch {}
        }
        if (alive && gen === generation.current)
          publish({ ...current.current, examResults: results });
        return;
      }
      setStatus('loading');
      try {
        const remote = await loadLearningData();
        if (!alive || gen !== generation.current) return;
        acknowledged.current = new Set(remote.events.map((event) => event.id));
        let merged = mergeLearningData(remote, current.current);
        const guest = read(GUEST);
        if (guest) merged = mergeLearningData(merged, guest);
        for (const capability of readGuestCapabilities()) {
          try {
            await claimExam(capability.id, capability.token);
            forgetGuestCapability(capability.id);
          } catch {}
        }
        const canonical = await syncLearningData(
          merged.events.filter((event) => !acknowledged.current.has(event.id)),
          merged.drafts,
        );
        if (!alive || gen !== generation.current) return;
        acknowledged.current = new Set(canonical.events.map((event) => event.id));
        publish(mergeLearningData(canonical, current.current));
        // Guest events are removed only after their immutable IDs were acknowledged.
        if (guest && guest.events.every((event) => acknowledged.current.has(event.id)))
          localStorage.removeItem(GUEST);
        setStatus('synced');
        initialized.current = true;
        if (revision.current > 0) {
          pending.current = true;
          schedule();
        }
      } catch (e) {
        if (alive && gen === generation.current) {
          setStatus('error');
          pending.current = true;
          initialized.current = true;
          setError(e instanceof Error ? e.message : 'История практики ещё не синхронизирована.');
        }
      } finally {
        if (alive && gen === generation.current) setReady(true);
      }
    };
    void initialize();
    const online = () => {
      pending.current = true;
      void flush.current();
    };
    window.addEventListener('online', online);
    return () => {
      alive = false;
      clearTimeout(timer.current);
      window.removeEventListener('online', online);
    };
  }, [legacyReady, user?.id, publish, read, schedule]);

  // Draft keystrokes and lesson navigation do not change knowledge evidence.
  const knowledge = useMemo(
    () =>
      buildKnowledge(
        progress ?? {
          schemaVersion: 1,
          sourceId: '00000000-0000-4000-8000-000000000000',
          preferences: {
            goal: '',
            level: '',
            pace: 15,
            diagnosticScore: 0,
            recommendedLesson: 'm1-money',
            onboardingDone: false,
          },
          preferencesUpdatedAt: new Date(0).toISOString(),
          states: {},
          attempts: [],
          completions: [],
        },
        data,
        allPracticeEntries,
        new Date().toISOString(),
      ),
    [progress?.attempts, progress?.preferences.goal, data.events, data.examResults, clock],
  );
  return (
    <Context.Provider
      value={{
        data,
        ready,
        status,
        error,
        knowledge,
        record,
        saveDraft,
        rememberExamResult,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useKnowledge() {
  const value = useContext(Context);
  if (!value) throw new Error('Knowledge provider is missing');
  return value;
}
