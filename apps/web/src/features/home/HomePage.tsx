import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { useCreateDesign } from '@/shared/api/designsApi';
import { useDesignStore } from '@/shared/session/designStore';
import { Button } from '@/shared/ui/button';
import { Card, CardTitle } from '@/shared/ui/card';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Input } from '@/shared/ui/input';
import { PageLayout } from '@/shared/ui/PageLayout';

import { JoinForm } from '../player/JoinForm';
import { MyGames } from './MyGames';

const CreateDesignForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const remember = useDesignStore((s) => s.remember);
  const create = useCreateDesign();
  const [name, setName] = useState('');

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(name, {
      onSuccess: ({ design, editToken }) => {
        remember({ designId: design.id, editToken, name: design.name });
        void navigate(`/designs/${design.id}`);
      },
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        aria-label={t('home.gameName')}
        placeholder={t('home.gameNamePlaceholder')}
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <ErrorMessage error={create.error} />
      <Button type="submit" disabled={!name.trim() || create.isPending}>
        {t('home.designGame')}
      </Button>
    </form>
  );
};

export const HomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return (
    <PageLayout>
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardTitle>{t('home.hostTitle')}</CardTitle>
          <p className="mb-4 text-sm text-muted-foreground">{t('home.hostIntro')}</p>
          <CreateDesignForm />
          <MyGames />
        </Card>
        <Card>
          <CardTitle>{t('home.joinTitle')}</CardTitle>
          <JoinForm
            initialCode={searchParams.get('code') ?? ''}
            onJoined={(session) => void navigate(`/play/${session.gameId}`)}
          />
        </Card>
      </div>
    </PageLayout>
  );
};
