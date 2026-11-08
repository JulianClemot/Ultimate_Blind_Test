import type { SuggestionDto } from '@ubt/shared';
import { useId, useState, type KeyboardEvent, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/shared/lib/cn';
import { findSuggestions } from '@/shared/lib/suggestions';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

const PLACEHOLDERS = {
  song: 'player.answerPlaceholder',
  screen: 'player.answerPlaceholderSource',
  game: 'player.answerPlaceholderGame',
} as const;

export interface AnswerInput {
  readonly text: string;
  /** Set when the player picked a suggestion and did not edit it afterwards. */
  readonly suggestionId?: string;
}

interface AnswerFormProps {
  /** Easy rounds only: tracks proposed while the player types. */
  readonly suggestions: readonly SuggestionDto[];
  /** What the round asks instead of the song: a film or series, or a video game. */
  readonly source?: 'screen' | 'game';
  readonly onSubmit: (answer: AnswerInput) => void;
  readonly pending: boolean;
}

/**
 * The answer field. In an easy round it proposes tracks of the playlist as the player types.
 * Picking one only fills the field (the single guess is sent with the button); editing the text
 * afterwards makes it a free answer again.
 */
export const AnswerForm = ({ suggestions, source, onSubmit, pending }: AnswerFormProps) => {
  const { t } = useTranslation();
  const listId = useId();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<SuggestionDto | null>(null);
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(0);

  const easy = suggestions.length > 0;
  const matches = easy && open && !picked ? findSuggestions(suggestions, text) : [];
  const showList = matches.length > 0;
  const optionId = (index: number) => `${listId}-${index}`;

  const choose = (suggestion: SuggestionDto) => {
    setText(suggestion.label);
    setPicked(suggestion);
    setActive(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : matches.length - 1;
      setActive((current) => (current + step) % matches.length);
    } else if (event.key === 'Enter') {
      const suggestion = matches[active];
      if (suggestion) {
        event.preventDefault();
        choose(suggestion);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(picked ? { text, suggestionId: picked.id } : { text });
    setText('');
    setPicked(null);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="relative">
        <Input
          aria-label={t('player.answerLabel')}
          placeholder={t(PLACEHOLDERS[source ?? 'song'])}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPicked(null);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          {...(easy && {
            role: 'combobox',
            'aria-autocomplete': 'list' as const,
            'aria-expanded': showList,
            'aria-controls': listId,
            ...(showList && { 'aria-activedescendant': optionId(active) }),
          })}
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            aria-label={t('player.suggestions')}
            className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-[3px_3px_0_var(--ink)]"
          >
            {matches.map((suggestion, index) => (
              <li
                key={suggestion.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                // Keep the focus in the field: a blur would close the list before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion)}
                className={cn(
                  'cursor-pointer truncate px-4 py-2 text-sm',
                  index === active && 'bg-accent',
                )}
              >
                {suggestion.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {picked && <p className="text-xs text-muted-foreground">{t('player.pickedHint')}</p>}
      <Button type="submit" size="xl" disabled={!text.trim() || pending}>
        {t('player.answer')}
      </Button>
    </form>
  );
};
