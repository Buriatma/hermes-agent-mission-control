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
    <div className="flex h-screen">
      <div className="hq-ambient" aria-hidden />
      <Sidebar />
      <main className={`relative flex-1 page-enter ${
        isChat
          ? 'overflow-hidden pt-16 md:pt-0 pb-[72px] md:pb-0'
          : 'overflow-auto pt-16 md:pt-0 pb-20 md:pb-0 px-4 sm:px-6 md:px-10 lg:px-12 py-4 md:py-8'
      }`}>
        <div className={isChat ? 'h-full' : 'pb-safe'}>
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
