import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';

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
        aria-label="Game name"
        placeholder="Friday night blind test"
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <ErrorMessage error={create.error} />
      <Button type="submit" disabled={!name.trim() || create.isPending}>
        Design a game
      </Button>
    </form>
  );
};

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <PageLayout>
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardTitle>Host a game</CardTitle>
          <p className="mb-4 text-sm text-muted-foreground">
            Prepare the rounds in advance, then launch the party and share its code.
          </p>
          <CreateDesignForm />
          <MyGames />
        </Card>
        <Card>
          <CardTitle>Join a game</CardTitle>
          <JoinForm onJoined={(session) => void navigate(`/play/${session.gameId}`)} />
        </Card>
      </div>
    </PageLayout>
  );
};
