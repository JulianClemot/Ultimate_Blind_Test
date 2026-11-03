import type { ScoreDto } from '@ubt/shared';
import { useEffect } from 'react';

import { Button } from '@/shared/ui/button';
import { CloseIcon } from '@/shared/ui/icons';
import { Scoreboard } from '@/shared/ui/Scoreboard';

interface ScoreboardPanelProps {
  readonly open: boolean;
  readonly scores: readonly ScoreDto[];
  readonly onClose: () => void;
}

/**
 * Scoreboard drawer on the right of the host screen. It floats above the page, so opening
 * it never moves the blind test. Closed with its button or the Escape key.
 */
export const ScoreboardPanel = ({ open, scores, onClose }: ScoreboardPanelProps) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <aside
      aria-label="Scores"
      className="fixed inset-y-0 right-0 z-10 flex w-full max-w-xs flex-col gap-4 overflow-y-auto border-l bg-card p-6 text-card-foreground shadow-xl"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Scores</h2>
        <Button variant="ghost" aria-label="Close scores" className="size-9 p-0" onClick={onClose}>
          <CloseIcon />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Points of the songs revealed so far, as the players see them.
      </p>
      <Scoreboard scores={scores} />
    </aside>
  );
};
