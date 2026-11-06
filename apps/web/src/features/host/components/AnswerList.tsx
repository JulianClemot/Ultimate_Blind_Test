import type { AnswerDto, VerdictDto } from '@ubt/shared';

import { cn } from '@/shared/lib/cn';
import { formatElapsed } from '@/shared/lib/time';

interface AnswerListProps {
  readonly answers: readonly AnswerDto[];
  readonly asks?: { readonly title: boolean; readonly artist: boolean };
  /** When provided, verdicts become toggles letting the host correct them. */
  readonly onJudge?: (answer: AnswerDto, verdict: VerdictDto) => void;
}

const VerdictToggle = ({
  label,
  correct,
  onToggle,
}: {
  label: string;
  correct: boolean;
  onToggle?: (() => void) | undefined;
}) => (
  <button
    type="button"
    aria-pressed={correct}
    aria-label={`${label} ${correct ? 'correct' : 'wrong'}`}
    disabled={!onToggle}
    onClick={onToggle}
    className={cn(
      'rounded-full px-2 py-0.5 text-xs font-medium',
      correct ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive',
      onToggle && 'hover:ring-2 hover:ring-ring',
    )}
  >
    {label} {correct ? '✓' : '✗'}
  </button>
);

type Outcome = 'correct' | 'partial' | 'wrong';

const OUTCOME_STYLE: Record<Outcome, { label: string; className: string }> = {
  correct: { label: '✓ Correct', className: 'bg-success/15 text-success' },
  partial: { label: '◐ Partial', className: 'bg-warning/15 text-warning' },
  wrong: { label: '✗ Wrong', className: 'bg-destructive/10 text-destructive' },
};

/** Overall result over the parts the round asks for. */
const outcomeOf = (
  verdict: VerdictDto,
  asks: { readonly title: boolean; readonly artist: boolean },
): Outcome => {
  const asked = [...(asks.title ? [verdict.title] : []), ...(asks.artist ? [verdict.artist] : [])];
  const right = asked.filter(Boolean).length;
  return right === 0 ? 'wrong' : right === asked.length ? 'correct' : 'partial';
};

/** Answers in server arrival order, with the automatic (or corrected) verdict. */
export const AnswerList = ({
  answers,
  asks = { title: true, artist: true },
  onJudge,
}: AnswerListProps) =>
  answers.length === 0 ? (
    <p className="text-sm text-muted-foreground">No answer yet.</p>
  ) : (
    <ol className="flex flex-col divide-y">
      {answers.map((answer, index) => (
        <li key={answer.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
          <span className="w-6 text-right font-mono text-muted-foreground">{index + 1}.</span>
          <span className="font-medium">{answer.playerName}</span>
          <span className="min-w-0 flex-1 truncate">{answer.text}</span>
          <span
            role="status"
            aria-label={`${answer.playerName}: ${outcomeOf(answer.verdict, asks)}`}
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold',
              OUTCOME_STYLE[outcomeOf(answer.verdict, asks)].className,
            )}
          >
            {OUTCOME_STYLE[outcomeOf(answer.verdict, asks)].label}
          </span>
          <span className="flex gap-1">
            {asks.title && (
              <VerdictToggle
                label="Title"
                correct={answer.verdict.title}
                onToggle={
                  onJudge &&
                  (() => onJudge(answer, { ...answer.verdict, title: !answer.verdict.title }))
                }
              />
            )}
            {asks.artist && (
              <VerdictToggle
                label="Artist"
                correct={answer.verdict.artist}
                onToggle={
                  onJudge &&
                  (() => onJudge(answer, { ...answer.verdict, artist: !answer.verdict.artist }))
                }
              />
            )}
          </span>
          <time className="font-mono text-sm tabular-nums">{formatElapsed(answer.elapsedMs)}</time>
        </li>
      ))}
    </ol>
  );
