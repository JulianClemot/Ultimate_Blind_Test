import type { NumericRuleDto, RoundCatalogDto, RoundTypeDto } from '@ubt/shared';
import type { Dispatch } from 'react';

import { ROUND_TYPE_INFO, ROUND_TYPES } from '@/shared/lib/roundTypes';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';

import { roundWarnings, type EditorAction, type EditorRound } from '../designEditorState';
import { PlaylistField } from './PlaylistField';

interface RoundEditorProps {
  readonly round: EditorRound;
  readonly index: number;
  readonly count: number;
  readonly catalog: RoundCatalogDto;
  readonly dispatch: Dispatch<EditorAction>;
}

const NUMERIC_RULES: readonly { rule: NumericRuleDto; label: string; hint?: string }[] = [
  { rule: 'songCount', label: 'Songs' },
  { rule: 'answerTimeSec', label: 'Answer time (s)' },
  { rule: 'excerptSec', label: 'Music played (s)', hint: 'Out of the 30 s preview' },
  { rule: 'titlePoints', label: 'Title points', hint: '0 = title not asked' },
  { rule: 'artistPoints', label: 'Artist points', hint: '0 = artist not asked' },
  { rule: 'bothBonus', label: 'Bonus for both' },
  { rule: 'speedBonus', label: 'Max speed bonus', hint: 'Decreases until time is up' },
];

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

export const RoundEditor = ({ round, index, count, catalog, dispatch }: RoundEditorProps) => {
  const key = round.key;
  const warnings = roundWarnings(round);
  return (
    <Card className="flex flex-col gap-4" aria-label={`Round ${index + 1}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Round {index + 1}</h3>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => dispatch({ type: 'roundMoved', key, offset: -1 })}
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label="Move down"
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
            Remove
          </Button>
        </div>
      </div>

      <Field label="Round name">
        <Input
          value={round.name}
          maxLength={60}
          placeholder={round.playlistTitle ?? `Round ${index + 1}`}
          onChange={(e) => dispatch({ type: 'roundRenamed', key, name: e.target.value })}
        />
      </Field>

      <Field label="Round type" hint={ROUND_TYPE_INFO[round.type].description}>
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
              {ROUND_TYPE_INFO[type].label}
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

      <details>
        <summary className="cursor-pointer text-sm font-medium">Rules</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Who scores">
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
              <option value="first">First players only</option>
              <option value="everyone">Everyone correct</option>
            </Select>
          </Field>
          {round.rules.scoring === 'first' && (
            <Field
              label="Number of winners"
              hint="The first players to answer correctly get the points"
            >
              <RuleInput rule="winnerCount" round={round} catalog={catalog} dispatch={dispatch} />
            </Field>
          )}
          {round.rules.scoring === 'first' && round.rules.winnerCount > 1 && (
            <Field
              label="Points lost per place"
              hint="Each next winner gets this many points less (0 = same for all)"
            >
              <RuleInput rule="rankStep" round={round} catalog={catalog} dispatch={dispatch} />
            </Field>
          )}
          <Field label="Speed">
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
          {NUMERIC_RULES.map(({ rule, label, hint }) => (
            <Field key={rule} label={label} {...(hint ? { hint } : {})}>
              <RuleInput rule={rule} round={round} catalog={catalog} dispatch={dispatch} />
            </Field>
          ))}
        </div>
      </details>

      {warnings.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-amber-600 dark:text-amber-400">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </Card>
  );
};
