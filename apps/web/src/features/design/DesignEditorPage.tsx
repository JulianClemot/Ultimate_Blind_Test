import type { RoundCatalogDto, RoundTypeDto } from '@ubt/shared';
import { useEffect, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import {
  useDeleteDesign,
  useDesign,
  useRoundCatalog,
  useSaveDesign,
  type DesignAccess,
} from '@/shared/api/designsApi';
import { useLaunchGame } from '@/shared/api/gamesApi';
import { roundTypeInfo, ROUND_TYPES } from '@/shared/lib/roundTypes';
import { useDesignStore, type SavedDesign } from '@/shared/session/designStore';
import { useSessionStore } from '@/shared/session/sessionStore';
import { Button } from '@/shared/ui/button';
import { Card, CardTitle } from '@/shared/ui/card';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/input';
import { PageLayout } from '@/shared/ui/PageLayout';

import { RoundEditor } from './components/RoundEditor';
import {
  designEditorReducer,
  emptyEditor,
  roundWarnings,
  toUpdatePayload,
  totalSongs,
} from './designEditorState';

const DesignEditor = ({ saved, catalog }: { saved: SavedDesign; catalog: RoundCatalogDto }) => {
  const { t } = useTranslation();
  const access: DesignAccess = { designId: saved.designId, editToken: saved.editToken };
  const navigate = useNavigate();
  const design = useDesign(access);
  const save = useSaveDesign(access);
  const launch = useLaunchGame();
  const remove = useDeleteDesign();
  const remember = useDesignStore((s) => s.remember);
  const forget = useDesignStore((s) => s.forget);
  const setHost = useSessionStore((s) => s.setHost);
  const [state, dispatch] = useReducer(designEditorReducer, emptyEditor);
  const nextKey = useRef(0);
  const loaded = useRef(false);

  useEffect(() => {
    if (design.data && !loaded.current) {
      loaded.current = true;
      dispatch({ type: 'loaded', design: design.data });
    }
  }, [design.data]);

  if (design.error) return <ErrorMessage error={design.error} />;
  if (!design.data) return <p className="text-muted-foreground">{t('common.loadingGame')}</p>;

  const persist = async () => {
    const result = await save.mutateAsync(toUpdatePayload(state));
    dispatch({ type: 'saved', design: result });
    remember({ ...saved, name: result.name });
  };

  const startParty = async () => {
    if (state.dirty) await persist();
    const party = await launch.mutateAsync(access);
    setHost({ gameId: party.gameId, hostToken: party.hostToken });
    void navigate(`/host/${party.gameId}`);
  };

  const addRound = (roundType: RoundTypeDto) => {
    nextKey.current += 1;
    dispatch({ type: 'roundAdded', key: `new-${nextKey.current}`, roundType, catalog });
  };

  const blocking = state.rounds.flatMap(roundWarnings);
  const busy = save.isPending || launch.isPending;

  return (
    <>
      <Card className="flex flex-col gap-4">
        <Field label={t('design.gameName')}>
          <Input
            value={state.name}
            maxLength={60}
            onChange={(e) => dispatch({ type: 'renamed', name: e.target.value })}
          />
        </Field>
        <p className="text-sm text-muted-foreground">
          {t('design.summary', {
            rounds: t('common.roundCount', { count: state.rounds.length }),
            songs: t('common.songCount', { count: totalSongs(state) }),
          })}
        </p>
      </Card>

      {state.rounds.map((round, index) => (
        <RoundEditor
          key={round.key}
          access={access}
          round={round}
          index={index}
          count={state.rounds.length}
          catalog={catalog}
          dispatch={dispatch}
        />
      ))}

      {state.rounds.length < catalog.maxRounds && (
        <Card>
          <CardTitle>{t('design.addRound')}</CardTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROUND_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addRound(type)}
                className="rounded-lg border p-3 text-left hover:bg-secondary"
              >
                <span className="font-medium">{roundTypeInfo(type).label}</span>
                <span className="block text-xs text-muted-foreground">
                  {roundTypeInfo(type).description}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="sticky bottom-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-col gap-1">
          <ErrorMessage error={save.error ?? launch.error ?? remove.error} />
          {state.rounds.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('design.addRoundHint')}</p>
          )}
          {state.dirty && !save.error && (
            <p className="text-sm text-muted-foreground">{t('design.unsaved')}</p>
          )}
        </div>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            remove.mutate(access, {
              onSuccess: () => {
                forget(saved.designId);
                void navigate('/');
              },
            })
          }
        >
          {t('common.delete')}
        </Button>
        <Button variant="outline" disabled={!state.dirty || busy} onClick={() => void persist()}>
          {t('common.save')}
        </Button>
        <Button
          disabled={state.rounds.length === 0 || blocking.length > 0 || busy}
          onClick={() => void startParty().catch(() => undefined)}
        >
          {t('design.launch')}
        </Button>
      </Card>
    </>
  );
};

export const DesignEditorPage = () => {
  const { t } = useTranslation();
  const { designId } = useParams();
  const saved = useDesignStore((s) => s.designs.find((d) => d.designId === designId));
  const catalog = useRoundCatalog();

  return (
    <PageLayout>
      {!saved ? (
        <p>
          {t('design.notHere')} <Link to="/">{t('common.backHome')}</Link>
        </p>
      ) : catalog.data ? (
        <DesignEditor saved={saved} catalog={catalog.data} />
      ) : (
        <ErrorMessage error={catalog.error} />
      )}
    </PageLayout>
  );
};
