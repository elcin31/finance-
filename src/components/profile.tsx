'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  Download,
  Globe2,
  LogOut,
  Moon,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import { useLearning } from './providers';
import { supabase } from '@/lib/supabase';
import { lessons, modules } from '@/content/curriculum';
import { hasCompleted } from '@/lib/progress';
import { useEffectiveProgress } from './effective-progress';
import { useKnowledge } from './learning-provider';
function authError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Неверный email или пароль.';
  if (/email not confirmed/i.test(message)) return 'Подтвердите email по ссылке в письме.';
  if (/rate limit|too many/i.test(message))
    return 'Слишком много запросов. Подождите перед следующей попыткой.';
  if (/already registered/i.test(message)) return 'Аккаунт с этим email уже существует.';
  if (/password/i.test(message)) return 'Проверьте пароль: используйте не менее 8 символов.';
  return 'Не удалось выполнить запрос. Проверьте соединение и попробуйте ещё раз.';
}
function AuthCard() {
  const { user, authConfigured } = useLearning();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('password');
        setMessage('Придумайте новый пароль для аккаунта.');
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('');
    setError(false);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setPassword('');
        setMessage('Вы вошли в аккаунт. Прогресс загружается из базы.');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${location.origin}/profile` },
        });
        if (error) throw error;
        setPassword('');
        setMessage(
          data.session
            ? 'Аккаунт создан. Синхронизируем прогресс.'
            : 'Проверьте почту: Supabase отправит письмо для подтверждения, если этот адрес подходит для регистрации. Затем войдите в аккаунт.',
        );
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${location.origin}/profile`,
        });
        if (error) throw error;
        setMessage(
          'Если аккаунт существует, вы получите ссылку для восстановления. Откройте её и задайте новый пароль.',
        );
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword('');
        setMode('login');
        setMessage('Пароль обновлён.');
      }
    } catch (e) {
      setError(true);
      setMessage(authError(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };
  if (!authConfigured)
    return (
      <section className="panel auth-card">
        <h2>Учитесь без регистрации</h2>
        <p>
          Гостевой прогресс сохраняется на этом устройстве. Для входа и синхронизации нужно
          настроить отдельный Supabase-проект FINLAB по инструкции в репозитории.
        </p>
        <span className="pill">Синхронизация не настроена</span>
      </section>
    );
  return (
    <section className="panel auth-card">
      <span className="eyebrow">ВАШИ ЗНАНИЯ С ВАМИ</span>
      <h2>
        {user
          ? 'Ваш аккаунт'
          : mode === 'reset'
            ? 'Восстановить доступ'
            : 'Сохраняйте прогресс в облаке'}
      </h2>
      {user && mode !== 'password' ? (
        <>
          <p style={{ overflowWrap: 'anywhere' }}>{user.email}</p>
          <p>
            База данных хранит прогресс вашего аккаунта. Гостевые ответы переносятся при первом
            входе без повторного начисления.
          </p>
          <button
            className="button"
            style={{ width: '100%' }}
            onClick={() => {
              setMode('password');
              setMessage('');
            }}
          >
            Изменить пароль
          </button>
          <button
            className="button ghost"
            style={{ width: '100%', marginTop: 8 }}
            disabled={busy}
            onClick={async () => {
              if (!supabase) return;
              setBusy(true);
              const { error } = await supabase.auth.signOut();
              if (error) {
                setError(true);
                setMessage(authError(error.message));
              } else {
                setMessage('');
                setMode('login');
              }
              setBusy(false);
            }}
          >
            <LogOut size={14} />
            Выйти из аккаунта
          </button>
        </>
      ) : (
        <>
          {mode !== 'reset' && mode !== 'password' && (
            <div className="segmented" role="tablist" aria-label="Авторизация">
              <button
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => {
                  setMode('login');
                  setMessage('');
                }}
              >
                Вход
              </button>
              <button
                role="tab"
                aria-selected={mode === 'signup'}
                onClick={() => {
                  setMode('signup');
                  setMessage('');
                }}
              >
                Регистрация
              </button>
            </div>
          )}
          <form className="form-stack" onSubmit={submit}>
            {mode !== 'password' && (
              <div className="field">
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            )}
            {mode !== 'reset' && (
              <div className="field">
                <label htmlFor="auth-password">
                  {mode === 'password' ? 'Новый пароль' : 'Пароль'}
                </label>
                <input
                  id="auth-password"
                  className="input"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={mode === 'login' ? 1 : 8}
                  maxLength={200}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode !== 'login' && <small>Не менее 8 символов</small>}
              </div>
            )}
            <button className="button primary" disabled={busy} type="submit">
              {busy
                ? 'Подождите…'
                : mode === 'login'
                  ? 'Войти'
                  : mode === 'signup'
                    ? 'Создать аккаунт'
                    : mode === 'reset'
                      ? 'Отправить ссылку'
                      : 'Сохранить пароль'}
            </button>
          </form>
          <button
            className="text-link"
            style={{ marginTop: 14 }}
            onClick={() => {
              setMode(mode === 'login' ? 'reset' : 'login');
              setMessage('');
            }}
          >
            {mode === 'login' ? 'Забыли пароль?' : 'Вернуться ко входу'}
          </button>
          <p style={{ fontSize: 10, marginTop: 12 }}>
            Авторизация работает через Supabase. Для регистрации и восстановления необходимо
            настоящее письмо.
          </p>
        </>
      )}
      {message && (
        <p
          role={error ? 'alert' : 'status'}
          className="auth-message"
          style={{ marginTop: 16, color: error ? '#b66244' : undefined }}
        >
          {message}
        </p>
      )}
    </section>
  );
}
export default function Profile() {
  const { progress: rawProgress, ready, user, status, theme, toggleTheme, update } = useLearning();
  const progress = useEffectiveProgress();
  const { knowledge, data: learningData } = useKnowledge();
  if (!progress || !ready) return <div className="loading-state">Загружаем профиль…</div>;
  const completed = lessons.filter((l) => hasCompleted(progress, l));
  const checked = new Map(progress.attempts.map((attempt) => [attempt.id, attempt]));
  for (const event of learningData.events)
    if (event.valid) checked.set(event.id, { ...event, runId: event.sessionId });
  const allAttempts = [...checked.values()];
  const correct = allAttempts.filter((a) => a.correct).length;
  const accuracy = allAttempts.length ? Math.round((correct / allAttempts.length) * 100) : 0;
  const history = [...allAttempts].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 12);
  const exportProgress = () => {
    const blob = new Blob(
      [JSON.stringify({ progress: rawProgress, learning: learningData }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finlab-progress.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ВАШИ ЗНАНИЯ В ЦИФРАХ</span>
          <h1>Каждый шаг имеет значение.</h1>
          <p>Смотрите, что уже получается и что стоит закрепить.</p>
        </div>
      </div>
      <div className="profile-grid">
        <div>
          <section className="panel">
            <div className="profile-identity">
              <span className="avatar">
                <UserRound size={23} />
              </span>
              <div>
                <h2>{user ? 'Студент FINLAB' : 'Гость академии'}</h2>
                <p>
                  {progress.preferences.goal} · {progress.preferences.pace} мин в день
                </p>
              </div>
            </div>
            <div className="stats-row">
              <div className="stat-box">
                <strong>{completed.length}</strong>
                <span>этапов завершено</span>
              </div>
              <div className="stat-box">
                <strong>{allAttempts.length}</strong>
                <span>ответов проверено</span>
              </div>
              <div className="stat-box">
                <strong>{accuracy}%</strong>
                <span>верных попыток</span>
              </div>
            </div>
            <h3 style={{ marginTop: 28 }}>Карта компетенций</h3>
            <p className="muted">
              20 навыков: самостоятельная практика, повторение спустя время и серверные экзамены.
            </p>
            {knowledge.skills.map((skill) => (
              <div className="skill-row" key={skill.id}>
                <div className="skill-title">
                  <span>{skill.name}</span>
                  <strong>{skill.mastery}%</strong>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${skill.mastery}%` }} />
                </div>
                <p>
                  {skill.attempts
                    ? `${skill.firstAttemptAccuracy}% первых самостоятельных ответов · ${skill.attemptedTemplates} типов заданий`
                    : 'Пока нет результатов практики'}
                </p>
              </div>
            ))}
            <Link className="button primary" href="/knowledge">
              Мои знания: динамика и рекомендации <ArrowUpRight size={14} />
            </Link>
            <details className="model-note">
              <summary>Как рассчитывается освоение</summary>
              <p>
                Для финансовых навыков: 45% самостоятельной практики, 30% успешных проверок спустя
                время, 25% серверных экзаменов. Для финансового английского: 55% практики и 45%
                интервальных повторений.
              </p>
              <p>
                Учитываются сложность и охват разных типов задач. Исправление после ошибки даёт
                ограниченный вклад. Повторение того же варианта не увеличивает баллы. Подробная
                модель и компоненты каждого навыка доступны в разделе «Мои знания».
              </p>
            </details>
          </section>
          <section className="panel" style={{ marginTop: 22 }}>
            <div className="panel-header">
              <h2>Прогресс по модулям</h2>
              <Link className="text-link" href="/path">
                Открыть путь <ArrowUpRight size={13} />
              </Link>
            </div>
            {modules.map((m) => {
              const count = completed.filter((l) => l.moduleId === m.id).length;
              const exams = progress.completions.filter((c) =>
                lessons.some((l) => l.id === c.lessonId && l.exam && l.moduleId === m.id),
              );
              return (
                <div className="skill-row" key={m.id}>
                  <div className="skill-title">
                    <span>{m.title}</span>
                    <strong>
                      {count}/{m.lessonIds.length}
                    </strong>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${(count / m.lessonIds.length) * 100}%` }} />
                  </div>
                  {exams.length > 0 && (
                    <p>
                      Последний экзамен:{' '}
                      {
                        [...exams].sort(
                          (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt),
                        )[0].score
                      }
                      % с первой попытки
                    </p>
                  )}
                </div>
              );
            })}
          </section>
          <section className="panel" style={{ marginTop: 22 }}>
            <h2>История практики</h2>
            {history.length ? (
              <ul className="history-list">
                {history.map((a) => (
                  <li key={a.id}>
                    {a.correct ? (
                      <Check size={15} className="correct" />
                    ) : (
                      <X size={15} className="incorrect" />
                    )}
                    <div>
                      <strong>
                        {lessons.find((l) => l.id === a.lessonId)?.title ??
                          (a.lessonId === 'onboarding' ? 'Входная диагностика' : 'Задание дня')}
                      </strong>
                      <small>
                        {new Date(a.at).toLocaleString('ru-RU', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </small>
                    </div>
                    <span className="pill">{a.correct ? 'Верно' : 'Повторить'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 12 }}>
                Проверенные ответы появятся здесь после первой практики.
              </p>
            )}
          </section>
        </div>
        <aside>
          <AuthCard />
          <section className="panel settings-card">
            <h2>Ваш ритм</h2>
            <div className="settings-row">
              <span>Оформление</span>
              <button className="button small" onClick={toggleTheme}>
                {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}{' '}
                {theme === 'light' ? 'Тёмная' : 'Светлая'}
              </button>
            </div>
            <div className="settings-row">
              <label htmlFor="profile-pace">Минут в день</label>
              <select
                id="profile-pace"
                className="select"
                style={{ width: 93, fontSize: 12, padding: '8px' }}
                value={progress.preferences.pace}
                onChange={(e) =>
                  update((p) => ({
                    ...p,
                    preferences: { ...p.preferences, pace: Number(e.target.value) },
                    preferencesUpdatedAt: new Date().toISOString(),
                  }))
                }
              >
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="30">30</option>
              </select>
            </div>
            <div className="settings-row">
              <span>Цель и уровень</span>
              <Link
                className="text-link"
                href="/onboarding"
                onClick={() =>
                  update((p) => ({
                    ...p,
                    states: {
                      ...p.states,
                      onboarding: {
                        position: 0,
                        runId: crypto.randomUUID(),
                        drafts: {},
                        updatedAt: new Date().toISOString(),
                      },
                    },
                  }))
                }
              >
                Изменить <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="settings-row">
              <span>Копия прогресса</span>
              <button className="text-link" onClick={exportProgress}>
                <Download size={13} /> Скачать
              </button>
            </div>
            <p className="muted" style={{ fontSize: 10, margin: '18px 0 0' }}>
              {user
                ? 'Основное хранилище — база аккаунта. Несинхронизированные изменения временно хранятся отдельно для вашего аккаунта на этом устройстве.'
                : 'Гостевые ответы сохраняются в браузере. Удаление данных сайта удалит локальный прогресс. Войдите в аккаунт для синхронизации между устройствами.'}
            </p>
            <details className="model-note">
              <summary>Установить FINLAB</summary>
              <p>
                В Chrome на Android выберите «Установить приложение». На iPhone откройте Safari →
                «Поделиться» → «На экран Домой». Нужен HTTPS.
              </p>
              <p>
                Загруженные публичные страницы доступны без сети. Для входа и синхронизации нужен
                интернет.
              </p>
            </details>
          </section>
        </aside>
      </div>
    </>
  );
}
