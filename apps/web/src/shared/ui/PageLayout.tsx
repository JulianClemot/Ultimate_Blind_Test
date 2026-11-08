import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ConnectionBadge } from '@/shared/realtime/ConnectionBadge';

import { LanguageSwitcher } from './LanguageSwitcher';

export const PageLayout = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-6">
    <div className="vinyl" aria-hidden />
    <header className="flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3 font-display text-2xl">
        <span className="eq" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
        Ultimate Blind Test
      </Link>
      <div className="flex items-center gap-3">
        <ConnectionBadge />
        <LanguageSwitcher />
      </div>
    </header>
    <main className="flex flex-1 flex-col gap-6">{children}</main>
  </div>
);
