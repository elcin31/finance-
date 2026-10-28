import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import { AppShell } from '@/components/shell';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'FINLAB Academy — понимание создаёт капитал', template: '%s · FINLAB Academy' },
  description:
    'Интерактивная финансовая академия: 18 уроков, 3 экзамена и лаборатория финансовых расчётов. Изучайте финансы шаг за шагом.',
  applicationName: 'FINLAB Academy',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'FINLAB' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f9f8' },
    { media: '(prefers-color-scheme: dark)', color: '#101b18' },
  ],
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('finlab.theme');document.documentElement.dataset.theme=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){}",
          }}
        />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
