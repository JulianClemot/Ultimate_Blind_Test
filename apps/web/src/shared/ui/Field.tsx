import type { ReactNode } from 'react';

/** Label + control + optional hint, stacked. */
export const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <label className="flex flex-col gap-1 text-sm">
    <span className="font-medium">{label}</span>
    {children}
    {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
  </label>
);
