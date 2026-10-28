'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { emptyProgress, mergeProgress, type Progress } from '@/lib/progress';
import { parseProgress } from '@/lib/validation';
import { configured, supabase } from '@/lib/supabase';
import { loadRemoteProgress, syncRemoteProgress } from '@/lib/remote-progress';

type Status = 'local' | 'loading' | 'syncing' | 'synced' | 'error';
type LearningContext = {
  progress: Progress | null;
  update: (change: (p: Progress) => Progress) => void;
  user: User | null;
  ready: boolean;
  status: Status;
  storageError: string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  retrySync: () => void;
  authConfigured: boolean;
};
const Context = createContext<LearningContext | null>(null);
const GUEST_KEY = 'finlab.guest.v1';
const accountKey = (uid: string) => `finlab.account.v1.${uid}`;
export function Providers({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [storageError, setStorageError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const current = useRef<Progress | null>(null);
  const currentUser = useRef<User | null>(null);
  const generation = useRef(0);
  const initialized = useRef(false);
  const dirty = useRef(false);
  const syncing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushRef = useRef<() => void>(() => {});

  const read = useCallback((key: string) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? parseProgress(JSON.parse(raw)) : null;
    } catch {
      setStorageError(
        'Не удалось прочитать сохранение. Экспортируйте прогресс перед очисткой браузера.',
      );
      return null;
    }
  }, []);
  const persist = useCallback((next: Progress, key: string) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setStorageError(
        'Хранилище браузера недоступно или заполнено. Ответы остаются в этой вкладке.',
      );
    }
  }, []);
  const publish = useCallback(
    (next: Progress) => {
      current.current = next;
      setProgress(next);
      persist(next, currentUser.current ? accountKey(currentUser.current.id) : GUEST_KEY);
    },
    [persist],
  );
  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), 700);
  }, []);
  flushRef.current = async () => {
    if (
      !currentUser.current ||
      !current.current ||
      !initialized.current ||
      syncing.current ||
      !dirty.current
    )
      return;
    const gen = generation.current;
    const snapshot = current.current;
    syncing.current = true;
    dirty.current = false;
    setStatus('syncing');
    try {
      const remote = await syncRemoteProgress(snapshot);
      if (generation.current !== gen) return;
      publish(mergeProgress(remote, current.current!));
      setStatus('synced');
    } catch {
      if (generation.current === gen) {
        dirty.current = true;
        setStatus('error');
      }
    } finally {
      syncing.current = false;
      if (generation.current === gen && dirty.current && navigator.onLine) {
        /* next edit or explicit retry reschedules after a failure */
      }
    }
    if (
      generation.current === gen &&
      dirty.current &&
      current.current !== snapshot &&
      navigator.onLine
    )
      schedule();
  };
  const update = useCallback(
    (change: (p: Progress) => Progress) => {
      if (!current.current) return;
      publish(change(current.current));
      if (currentUser.current) {
        dirty.current = true;
        schedule();
      }
    },
    [publish, schedule],
  );
  const retrySync = useCallback(() => {
    dirty.current = true;
    flushRef.current();
  }, []);

  useEffect(() => {
    let savedTheme: string | null = null;
    try {
      savedTheme = localStorage.getItem('finlab.theme');
    } catch {
      setStorageError('Хранилище браузера недоступно. Прогресс сохранится только в этой вкладке.');
    }
    const actualTheme =
      savedTheme === 'dark' || (!savedTheme && matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light';
    setTheme(actualTheme);
    document.documentElement.dataset.theme = actualTheme;
    const guest = read(GUEST_KEY) ?? emptyProgress();
    publish(guest);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    let alive = true;
    const initialize = async (nextUser: User | null) => {
      if (!alive) return;
      const gen = ++generation.current;
      initialized.current = false;
      clearTimeout(timer.current);
      dirty.current = false;
      currentUser.current = nextUser;
      setUser(nextUser);
      setReady(false);
      if (!nextUser) {
        publish(read(GUEST_KEY) ?? emptyProgress());
        setStatus('local');
        initialized.current = true;
        setReady(true);
        return;
      }
      setStatus('loading');
      const cached = read(accountKey(nextUser.id));
      publish(cached ?? emptyProgress());
      try {
        const remote = await loadRemoteProgress();
        if (!alive || generation.current !== gen) return;
        const guestProgress = read(GUEST_KEY);
        const importedKey = guestProgress
          ? `finlab.imported.${nextUser.id}.${guestProgress.sourceId}`
          : '';
        let canonical = remote ?? emptyProgress();
        if (cached) canonical = mergeProgress(canonical, cached);
        const hasGuestWork =
          guestProgress &&
          (guestProgress.attempts.length > 0 ||
            guestProgress.preferences.onboardingDone ||
            Object.keys(guestProgress.states).length > 0);
        if (hasGuestWork && !localStorage.getItem(importedKey))
          canonical = mergeProgress(canonical, guestProgress);
        canonical = await syncRemoteProgress(canonical);
        if (!alive || generation.current !== gen) return;
        if (hasGuestWork) {
          localStorage.setItem(importedKey, '1');
          localStorage.removeItem(GUEST_KEY);
        }
        publish(canonical);
        setStatus('synced');
        initialized.current = true;
      } catch {
        if (alive && generation.current === gen) {
          setStatus('error');
          initialized.current = true;
          dirty.current = true;
        }
      } finally {
        if (alive && generation.current === gen) setReady(true);
      }
    };
    if (supabase) {
      supabase.auth
        .getUser()
        .then(({ data }) => initialize(data.user))
        .catch(() => initialize(null));
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
        setTimeout(() => initialize(session?.user ?? null), 0);
      });
      const online = () => {
        dirty.current = true;
        flushRef.current();
      };
      window.addEventListener('online', online);
      return () => {
        alive = false;
        clearTimeout(timer.current);
        listener.subscription.unsubscribe();
        window.removeEventListener('online', online);
      };
    }
    initialize(null);
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, [publish, read]);

  const toggleTheme = useCallback(
    () =>
      setTheme((previous) => {
        const next = previous === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('finlab.theme', next);
        } catch {}
        return next;
      }),
    [],
  );
  return (
    <Context.Provider
      value={{
        progress,
        update,
        user,
        ready,
        status,
        storageError,
        theme,
        toggleTheme,
        retrySync,
        authConfigured: configured,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLearning() {
  const value = useContext(Context);
  if (!value) throw new Error('Learning provider missing');
  return value;
}
