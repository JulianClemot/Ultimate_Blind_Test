import type { PlaylistSummaryDto } from '@ubt/shared';
import { useTranslation } from 'react-i18next';

import { useCheckPlaylist } from '@/shared/api/designsApi';
import { Button } from '@/shared/ui/button';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Input } from '@/shared/ui/input';

interface PlaylistFieldProps {
  readonly value: string;
  readonly title: string | null;
  readonly playableTracks: number | null;
  readonly onChange: (playlist: string) => void;
  readonly onChecked: (playlist: string, summary: PlaylistSummaryDto) => void;
}

/** Deezer playlist input with a "Check" button showing its title and playable tracks. */
export const PlaylistField = ({
  value,
  title,
  playableTracks,
  onChange,
  onChecked,
}: PlaylistFieldProps) => {
  const { t } = useTranslation();
  const check = useCheckPlaylist();
  const verify = () => {
    const playlist = value.trim();
    check.mutate(playlist, { onSuccess: (summary) => onChecked(value, summary) });
  };
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{t('design.playlist')}</span>
      <div className="flex gap-2">
        <Input
          aria-label={t('design.playlist')}
          placeholder={t('design.playlistPlaceholder')}
          value={value}
          onChange={(e) => {
            check.reset();
            onChange(e.target.value);
          }}
          onBlur={() => {
            if (value.trim() && playableTracks === null && !check.isPending) verify();
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={verify}
          disabled={!value.trim() || check.isPending}
        >
          {t('design.check')}
        </Button>
      </div>
      {playableTracks !== null && (
        <span className="text-xs text-muted-foreground">
          {t('design.playableTracks', {
            title: title ?? t('design.playlistFallback'),
            count: playableTracks,
          })}
        </span>
      )}
      {playableTracks === null && title && (
        <span className="text-xs text-muted-foreground">{title}</span>
      )}
      <ErrorMessage error={check.error} />
    </div>
  );
};
