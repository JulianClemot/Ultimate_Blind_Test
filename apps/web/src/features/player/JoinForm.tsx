import type { PlayerSessionDto } from '@ubt/shared';
import { useState, type SubmitEvent } from 'react';

import { Button } from '@/shared/ui/button';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { Input } from '@/shared/ui/input';

import { useJoinGame } from './useJoinGame';

export const JoinForm = ({
  onJoined,
  initialCode = '',
}: {
  onJoined: (session: PlayerSessionDto) => void;
  initialCode?: string;
}) => {
  const [code, setCode] = useState(initialCode);
  const [playerName, setPlayerName] = useState('');
  const join = useJoinGame();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    join.mutate({ code, playerName }, { onSuccess: (session) => onJoined(session) });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        aria-label="Game code"
        placeholder="GAME CODE"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="font-mono uppercase tracking-widest"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <Input
        aria-label="Your name"
        placeholder="Your name"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
      />
      <ErrorMessage error={join.error} />
      <Button type="submit" disabled={!code.trim() || !playerName.trim() || join.isPending}>
        Join
      </Button>
    </form>
  );
};
