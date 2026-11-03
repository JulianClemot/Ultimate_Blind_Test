import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ConnectionBadge } from '@/shared/realtime/ConnectionBadge';

export const PageLayout = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-6">
    <header className="flex items-center justify-between">
      <Link to="/" className="text-xl font-bold tracking-tight">
        Ultimate Blind Test
      </Link>
      <ConnectionBadge />
    </header>
    <main className="flex flex-1 flex-col gap-6">{children}</main>
  </div>
);
