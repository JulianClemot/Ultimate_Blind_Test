import type { AnalyzedTrackDto, PlaylistAnalysisDto, RoundCatalogDto } from '@ubt/shared';
import { useState, type Dispatch } from 'react';
import { useTranslation } from 'react-i18next';

import { useAnalyzePlaylist, type DesignAccess } from '@/shared/api/designsApi';
import { Button } from '@/shared/ui/button';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Input } from '@/shared/ui/input';

import type { EditorAction, EditorRound } from '../designEditorState';

interface SourceReviewProps {
  readonly access: DesignAccess;
  readonly round: EditorRound;
  readonly catalog: RoundCatalogDto;
  readonly dispatch: Dispatch<EditorAction>;
}

/** What the track's film or series is once the host's correction is applied ('' = none). */
const effectiveSource = (track: AnalyzedTrackDto, round: EditorRound): string => {
  const override = round.sourceOverrides[track.id];
  return override === undefined ? (track.source?.name ?? '') : (override ?? '');
};

const Summary = ({ analysis, matched }: { analysis: PlaylistAnalysisDto; matched: number }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium">
        {t(`design.review.detected_${analysis.kind}`, {
          matched,
          total: analysis.tracks.length,
        })}
      </p>
      {analysis.lookup === 'metadata' && (
        <p className="text-xs text-muted-foreground">{t('design.review.metadataOnly')}</p>
      )}
    </div>
  );
};

/**
 * Once a playlist is checked: detects whether it is film or series music, offers a round about
 * the film or series when it is, and in such a round lets the host correct what was found.
 */
export const SourceReview = ({ access, round, catalog, dispatch }: SourceReviewProps) => {
  const { t } = useTranslation();
  const analysis = useAnalyzePlaylist(access, round.playlist, round.playableTracks !== null);
  const key = round.key;
  const [fill, setFill] = useState('');

  if (round.playableTracks === null) return null;
  if (analysis.isPending) {
    return <p className="text-sm text-muted-foreground">{t('design.review.analyzing')}</p>;
  }
  if (analysis.error) return <ErrorMessage error={analysis.error} />;

  const data = analysis.data;
  const isSourceRound = round.rules.sourcePoints > 0;
  const matched = data.tracks.filter((track) => effectiveSource(track, round) !== '').length;
  const looksLikeSource = data.kind !== 'music';
  const isGame = round.type === 'game';
  const suggestedType = data.kind === 'games' ? 'game' : 'screen';
  // Tracks nothing was found for and the host has not touched: the ones a bulk name is for.
  const unnamed = data.tracks.filter(
    (track) =>
      effectiveSource(track, round) === '' && round.sourceOverrides[track.id] === undefined,
  );
  const switchTo = (roundType: 'screen' | 'game') =>
    dispatch({ type: 'roundTypeChanged', key, roundType, catalog });

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <Summary analysis={data} matched={data.tracks.filter((track) => track.source).length} />

      {looksLikeSource && (!isSourceRound || round.type !== suggestedType) && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => switchTo(suggestedType)}
        >
          {t(
            suggestedType === 'game'
              ? 'design.review.useGameRound'
              : 'design.review.useScreenRound',
          )}
        </Button>
      )}

      {/* Nothing detected does not mean nothing to play: the host can name the sources. */}
      {!looksLikeSource && !isSourceRound && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => switchTo('game')}>
            {t('design.review.useGameRoundAnyway')}
          </Button>
          <Button type="button" variant="outline" onClick={() => switchTo('screen')}>
            {t('design.review.useScreenRoundAnyway')}
          </Button>
        </div>
      )}

      {isSourceRound && (
        <details open={!looksLikeSource || matched === 0}>
          <summary className="cursor-pointer text-sm font-medium">
            {t(isGame ? 'design.review.titleGame' : 'design.review.title', { count: matched })}
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">{t('design.review.hint')}</p>
          <div className="mt-2 flex items-center gap-2">
            <Input
              className="h-8 flex-1"
              aria-label={t(isGame ? 'design.review.fillGameLabel' : 'design.review.fillLabel')}
              placeholder={t(isGame ? 'design.review.fillGameLabel' : 'design.review.fillLabel')}
              value={fill}
              onChange={(e) => setFill(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={fill.trim() === '' || unnamed.length === 0}
              onClick={() => {
                dispatch({
                  type: 'sourcesFilled',
                  key,
                  trackIds: unnamed.map((track) => track.id),
                  name: fill,
                });
                setFill('');
              }}
            >
              {t('design.review.fillApply', { count: unnamed.length })}
            </Button>
          </div>
          <ul className="mt-2 flex max-h-96 flex-col gap-2 overflow-y-auto">
            {data.tracks.map((track) => {
              const corrected = round.sourceOverrides[track.id] !== undefined;
              return (
                <li key={track.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {track.artist} – {track.title}
                  </span>
                  <Input
                    className="h-8 w-48 shrink-0"
                    aria-label={t(
                      isGame ? 'design.review.trackGame' : 'design.review.trackSource',
                      {
                        track: track.title,
                      },
                    )}
                    value={effectiveSource(track, round)}
                    onChange={(e) =>
                      dispatch({
                        type: 'sourceOverridden',
                        key,
                        trackId: track.id,
                        name: e.target.value.trim() === '' ? null : e.target.value,
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2"
                    disabled={!corrected}
                    onClick={() =>
                      dispatch({ type: 'sourceOverrideReset', key, trackId: track.id })
                    }
                  >
                    {t('design.review.reset')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
};
