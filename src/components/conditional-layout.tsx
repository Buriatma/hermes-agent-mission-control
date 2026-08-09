'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { CommandPalette } from '@/components/command-palette';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone = pathname === '/login';
  const isChat = pathname === '/chat';

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-dvh">
      <div className="hq-ambient" aria-hidden />
      <Sidebar />
      <main className={`relative flex-1 page-enter overflow-hidden ${
        isChat ? 'h-dvh' : 'overflow-auto pt-16 md:pt-0 pb-20 md:pb-0 px-4 sm:px-6 md:px-10 lg:px-12 py-4 md:py-8'
      }`}>
        <div className={`${isChat ? 'h-full md:h-[calc(100vh-1rem)] md:rounded-2xl md:border md:border-[var(--line)]/50 md:shadow-2xl md:shadow-black/20 md:overflow-hidden' : 'pb-safe'}`}>
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
