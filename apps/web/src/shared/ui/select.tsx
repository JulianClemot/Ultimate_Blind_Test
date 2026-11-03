import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

export const Select = ({ className, ...props }: ComponentProps<'select'>) => (
  <select
    className={cn(
      'flex h-10 w-full rounded-full border-2 border-input bg-white/70 px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
      className,
    )}
    {...props}
  />
);
