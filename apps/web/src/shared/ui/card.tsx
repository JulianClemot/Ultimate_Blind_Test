import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

export const Card = ({ className, ...props }: ComponentProps<'section'>) => (
  <section
    className={cn(
      'rounded-2xl border-2 bg-card p-6 text-card-foreground shadow-[6px_6px_0_var(--ink)]',
      className,
    )}
    {...props}
  />
);

export const CardTitle = ({ className, ...props }: ComponentProps<'h2'>) => (
  <h2 className={cn('mb-4 text-2xl', className)} {...props} />
);
