import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useDeleteDesign } from '@/shared/api/designsApi';
import { HttpError } from '@/shared/api/httpClient';
import { useDesignStore, type SavedDesign } from '@/shared/session/designStore';
import { Button } from '@/shared/ui/button';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { TrashIcon } from '@/shared/ui/icons';

/** The games designed in this browser, with a two-step delete (button, then confirmation). */
export const MyGames = () => {
  const { t } = useTranslation();
  const designs = useDesignStore((s) => s.designs);
  const forget = useDesignStore((s) => s.forget);
  const remove = useDeleteDesign();
  const [confirming, setConfirming] = useState<string | null>(null);

  if (designs.length === 0) return null;

  const cancel = () => {
    setConfirming(null);
    remove.reset();
  };

  const confirmDelete = (design: SavedDesign) => {
    const done = () => {
      forget(design.designId);
      setConfirming(null);
    };
    remove.mutate(
      { designId: design.designId, editToken: design.editToken },
      {
        onSuccess: done,
        // Already deleted elsewhere: nothing left to delete, just drop it from the list.
        onError: (error) => {
          if (error instanceof HttpError && error.code === 'DESIGN_NOT_FOUND') {
            done();
            remove.reset();
          }
        },
      },
    );
  };

  return (
    <>
      <h3 className="mt-6 mb-2 text-sm font-semibold">{t('home.myGames')}</h3>
      <ul className="flex flex-col divide-y">
        {designs.map((design) => (
          <li key={design.designId} className="flex items-center justify-between gap-2 py-2">
            {confirming === design.designId ? (
              <>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {t('home.deleteConfirm', { name: design.name })}
                </span>
                <Button
                  variant="outline"
                  disabled={remove.isPending}
                  onClick={() => confirmDelete(design)}
                >
                  {t('home.yesDelete')}
                </Button>
                <Button variant="ghost" disabled={remove.isPending} onClick={cancel}>
                  {t('common.cancel')}
                </Button>
              </>
            ) : (
              <>
                <Link
                  to={`/designs/${design.designId}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {design.name}
                </Link>
                <Button
                  variant="ghost"
                  aria-label={t('home.deleteGame', { name: design.name })}
                  title={t('common.delete')}
                  className="size-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    remove.reset();
                    setConfirming(design.designId);
                  }}
                >
                  <TrashIcon />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <ErrorMessage error={remove.error} />
    </>
  );
};
