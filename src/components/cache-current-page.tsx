'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** Cache only server-rendered public content; account RPCs are never cached. */
export function CacheCurrentPage() {
  const path = usePathname(),
    search = useSearchParams().toString();
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      navigator.serviceWorker.ready
        .then((registration) =>
          registration.active?.postMessage({
            type: 'CACHE_PAGE',
            url: `${path}${search ? `?${search}` : ''}`,
          }),
        )
        .catch(() => {});
  }, [path, search]);
  return null;
}
