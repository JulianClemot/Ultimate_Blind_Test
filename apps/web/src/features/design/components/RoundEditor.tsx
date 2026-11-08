import type { NumericRuleDto, RoundCatalogDto, RoundTypeDto } from '@ubt/shared';
import type { Dispatch } from 'react';
import { useTranslation } from 'react-i18next';

import type { DesignAccess } from '@/shared/api/designsApi';
import { roundTypeInfo, ROUND_TYPES } from '@/shared/lib/roundTypes';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';

import { roundWarnings, type EditorAction, type EditorRound } from '../designEditorState';
import { PlaylistField } from './PlaylistField';
import { SourceReview } from './SourceReview';

interface RoundEditorProps {
  /** Whose design this is: films and series lookups are reserved to its owner. */
  readonly access: DesignAccess;
  readonly round: EditorRound;
  readonly index: number;
  readonly count: number;
  readonly catalog: RoundCatalogDto;
  readonly dispatch: Dispatch<EditorAction>;
}

/** Translation keys (under `design.`) of the label and optional hint of each numeric rule. */
const NUMERIC_RULES: readonly { rule: NumericRuleDto; label: string; hint?: string }[] = [
  { rule: 'songCount', label: 'songs' },
  { rule: 'answerTimeSec', label: 'answerTime' },
  { rule: 'excerptSec', label: 'excerpt', hint: 'excerptHint' },
  { rule: 'titlePoints', label: 'titlePoints', hint: 'titlePointsHint' },
  { rule: 'artistPoints', label: 'artistPoints', hint: 'artistPointsHint' },
  { rule: 'sourcePoints', label: 'sourcePoints', hint: 'sourcePointsHint' },
  { rule: 'bothBonus', label: 'bothBonus' },
  { rule: 'speedBonus', label: 'speedBonus', hint: 'speedBonusHint' },
];

/** A round asks the film or series, or the title and the artist: the other points are hidden. */
const shownRule = (rule: NumericRuleDto, asksSource: boolean): boolean => {
  if (rule === 'sourcePoints') return asksSource;
  if (rule === 'titlePoints' || rule === 'artistPoints' || rule === 'bothBonus') return !asksSource;
  return true;
};

const RuleInput = ({
  rule,
  round,
  catalog,
  dispatch,
}: Pick<RoundEditorProps, 'round' | 'catalog' | 'dispatch'> & { rule: NumericRuleDto }) => (
  <Input
    type="number"
    inputMode="numeric"
    min={catalog.limits[rule].min}
    max={catalog.limits[rule].max}
    value={round.rules[rule]}
    onChange={(e) =>
      dispatch({ type: 'ruleChanged', key: round.key, rule, value: e.target.valueAsNumber || 0 })
    }
  />
);

export const RoundEditor = ({
  access,
  round,
  index,
  count,
  catalog,
  dispatch,
}: RoundEditorProps) => {
  const { t } = useTranslation();
  const asksSource = round.rules.sourcePoints > 0;
  const key = round.key;
  const warnings = roundWarnings(round);
  return (
    <Card className="flex flex-col gap-4" aria-label={t('common.round', { number: index + 1 })}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{t('common.round', { number: index + 1 })}</h3>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            aria-label={t('design.moveUp')}
            disabled={index === 0}
            onClick={() => dispatch({ type: 'roundMoved', key, offset: -1 })}
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label={t('design.moveDown')}
            disabled={index === count - 1}
            onClick={() => dispatch({ type: 'roundMoved', key, offset: 1 })}
          >
            ↓
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => dispatch({ type: 'roundRemoved', key })}
          >
            {t('design.remove')}
          </Button>
        </div>
      </div>

      <Field label={t('design.roundName')}>
        <Input
          value={round.name}
          maxLength={60}
          placeholder={round.playlistTitle ?? t('common.round', { number: index + 1 })}
          onChange={(e) => dispatch({ type: 'roundRenamed', key, name: e.target.value })}
        />
      </Field>

      <Field label={t('design.roundType')} hint={roundTypeInfo(round.type).description}>
        <Select
          value={round.type}
          onChange={(e) =>
            dispatch({
              type: 'roundTypeChanged',
              key,
              roundType: e.target.value as RoundTypeDto,
              catalog,
            })
          }
        >
          {ROUND_TYPES.map((type) => (
            <option key={type} value={type}>
              {roundTypeInfo(type).label}
            </option>
          ))}
        </Select>
      </Field>

      <PlaylistField
        value={round.playlist}
        title={round.playlistTitle}
        playableTracks={round.playableTracks}
        onChange={(playlist) => dispatch({ type: 'playlistChanged', key, playlist })}
        onChecked={(playlist, summary) =>
          dispatch({ type: 'playlistChecked', key, playlist, summary })
        }
      />

      <SourceReview access={access} round={round} catalog={catalog} dispatch={dispatch} />

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={round.rules.teamMode}
          onChange={(e) => dispatch({ type: 'teamModeChanged', key, teamMode: e.target.checked })}
        />
        <span className="flex flex-col">
          <span className="font-medium">{t('design.teamMode')}</span>
          <span className="text-xs text-muted-foreground">{t('design.teamModeHint')}</span>
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={round.rules.easyMode}
          onChange={(e) => dispatch({ type: 'easyModeChanged', key, easyMode: e.target.checked })}
        />
        <span className="flex flex-col">
          <span className="font-medium">{t('design.easyMode')}</span>
          <span className="text-xs text-muted-foreground">{t('design.easyModeHint')}</span>
        </span>
      </label>

      <details>
        <summary className="cursor-pointer text-sm font-medium">{t('design.rules')}</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={t('design.whoScores')}>
            <Select
              value={round.rules.scoring}
              onChange={(e) =>
                dispatch({
                  type: 'scoringChanged',
                  key,
                  scoring: e.target.value === 'everyone' ? 'everyone' : 'first',
                })
              }
            >
              <option value="first">{t('design.firstOnly')}</option>
              <option value="everyone">{t('design.everyoneCorrect')}</option>
            </Select>
          </Field>
          {round.rules.scoring === 'first' && (
            <Field label={t('design.winners')} hint={t('design.winnersHint')}>
              <RuleInput rule="winnerCount" round={round} catalog={catalog} dispatch={dispatch} />
            </Field>
          )}
          {round.rules.scoring === 'first' && round.rules.winnerCount > 1 && (
            <Field label={t('design.rankStep')} hint={t('design.rankStepHint')}>
              <RuleInput rule="rankStep" round={round} catalog={catalog} dispatch={dispatch} />
            </Field>
          )}
          <Field label={t('design.speed')}>
            <Select
              value={round.rules.playbackRate}
              onChange={(e) =>
                dispatch({ type: 'playbackRateChanged', key, rate: Number(e.target.value) })
              }
            >
              {catalog.playbackRates.map((rate) => (
                <option key={rate} value={rate}>
                  ×{rate}
                </option>
              ))}
            </Select>
          </Field>
          {NUMERIC_RULES.filter(({ rule }) => shownRule(rule, asksSource)).map(
            ({ rule, label, hint }) => (
              <Field
                key={rule}
                label={t(
                  `design.${label === 'sourcePoints' && round.type === 'game' ? 'gamePoints' : label}`,
                )}
                {...(hint ? { hint: t(`design.${hint}`) } : {})}
              >
                <RuleInput rule={rule} round={round} catalog={catalog} dispatch={dispatch} />
              </Field>
            ),
          )}
        </div>
      </details>

      {warnings.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-warning">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </Card>
  );
};
