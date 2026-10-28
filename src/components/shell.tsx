'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  Route,
  FlaskConical,
  LibraryBig,
  UserRound,
  Moon,
  Sun,
  ArrowUpRight,
  Search,
  CloudCheck,
  CloudOff,
  Laptop,
} from 'lucide-react';
import { useLearning } from './providers';
import { useEffect, type ReactNode } from 'react';

export const navigation = [
  { href: '/', label: 'Главная', icon: House },
  { href: '/path', label: 'Путь обучения', short: 'Путь', icon: Route },
  { href: '/lab', label: 'Лаборатория', icon: FlaskConical },
  { href: '/library', label: 'Библиотека', icon: LibraryBig },
  { href: '/profile', label: 'Мой профиль', short: 'Профиль', icon: UserRound },
];
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg
        className="brand-mark"
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        <rect width="36" height="36" rx="11" fill="currentColor" />
        <path
          d="M11 25V12H25M11 18.5H21M18 25V22"
          stroke="var(--logo-ink)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && (
        <span className="brand-name">
          FINLAB<span>ACADEMY</span>
        </span>
      )}
    </span>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { theme, toggleTheme, user, status, storageError, retrySync } = useLearning();
  const active = navigation.find((n) => n.href === path);
  const lesson = path.startsWith('/lesson');
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.ready
        .then((registration) => registration.active?.postMessage({ type: 'CACHE_PAGE', url: path }))
        .catch(() => {});
    }
  }, [path]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Перейти к содержанию
      </a>
      <aside className="sidebar">
        <Link href="/" aria-label="FINLAB Academy — главная">
          <Logo />
        </Link>
        <div className="sidebar-label">ВАШЕ ПРОСТРАНСТВО</div>
        <nav aria-label="Основная навигация">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? 'page' : undefined}
              className={`nav-item ${path === href ? 'active' : ''}`}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-label">МАЛЕНЬКИЕ ШАГИ. БОЛЬШИЕ ЗНАНИЯ.</span>
            <p>
              Инвестируйте в то,
              <br />
              что останется с вами.
            </p>
            <Link href="/path">
              В свои знания <ArrowUpRight size={15} />
            </Link>
            <svg viewBox="0 0 150 45" fill="none" aria-hidden="true">
              <path
                d="M0 42C30 42 16 33 45 33S60 23 83 23 108 7 123 7 134 3 150 1"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <button className="theme-button" onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            <span>{theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}</span>
            <span className="theme-switch" data-on={theme === 'dark'} />
          </button>
          <div className="sidebar-version">
            FINLAB ACADEMY <span>0.1</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Академия</span>
            <span className="slash">/</span>
            <strong>
              {active?.label ?? (lesson ? 'Урок' : path === '/onboarding' ? 'Ваш старт' : 'FINLAB')}
            </strong>
          </div>
          <Link className="mobile-brand" href="/" aria-label="FINLAB — главная">
            <Logo compact />
          </Link>
          <div className="top-actions">
            <Link href="/library" className="search-shortcut">
              <Search size={17} />
              <span>Найти в академии</span>
              <kbd>⌕</kbd>
            </Link>
            <button
              className="icon-button mobile-theme"
              aria-label="Переключить тему"
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <Link href="/profile" className="avatar" aria-label="Открыть профиль">
              {user?.email?.[0]?.toUpperCase() ?? <UserRound size={18} />}
            </Link>
          </div>
        </header>
        <main id="main-content" className={`main-content ${lesson ? 'lesson-main' : ''}`}>
          {storageError && (
            <div role="alert" className="notice error">
              {storageError}
            </div>
          )}
          {status === 'error' && (
            <div role="status" className="notice warning">
              Прогресс ещё не синхронизирован. Сохранён на этом устройстве.
              <button onClick={retrySync}>Повторить</button>
            </div>
          )}
          {children}
          <footer className="footer">
            <span>Понимать. Практиковаться. Расти.</span>
            <span className="sync-caption">
              {status === 'synced' ? (
                <CloudCheck size={14} />
              ) : status === 'error' ? (
                <CloudOff size={14} />
              ) : (
                <Laptop size={14} />
              )}{' '}
              {status === 'synced'
                ? 'Прогресс синхронизирован'
                : status === 'syncing'
                  ? 'Сохраняем в аккаунт…'
                  : user
                    ? 'Прогресс в аккаунте'
                    : 'Прогресс на этом устройстве'}
            </span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Мобильная навигация">
        {navigation.map(({ href, label, short, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            aria-current={path === href ? 'page' : undefined}
            className={path === href ? 'active' : ''}
          >
            <Icon size={21} strokeWidth={1.7} />
            <span>{short ?? label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
