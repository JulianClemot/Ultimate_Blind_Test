import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

export const Card = ({ className, ...props }: ComponentProps<'section'>) => (
  <section
    className={cn('rounded-xl border bg-card p-6 text-card-foreground shadow-sm', className)}
    {...props}
  />
);

export const CardTitle = ({ className, ...props }: ComponentProps<'h2'>) => (
  <h2 className={cn('mb-4 text-lg font-semibold', className)} {...props} />
);
