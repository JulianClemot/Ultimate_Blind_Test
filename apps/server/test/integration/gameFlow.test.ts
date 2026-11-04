import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type {
  ClientToServerEvents,
  CreateGameDesignResponseDto,
  CreateGameResponseDto,
  GameDesignDto,
  PlaylistSummaryDto,
  RoundCatalogDto,
  RoundPlanPayload,
  ServerToClientEvents,
} from '@ubt/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAppServer, type AppServer } from '../../src/compositionRoot';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type Payload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];

/** Resolves with the next payload of `event` (socket.io's overloads can't be narrowed generically). */
const nextEvent = <E extends keyof ServerToClientEvents>(socket: ClientSocket, event: E) =>
  new Promise<Payload<E>>((resolve) => {
    (socket as unknown as { once(e: E, l: (p: Payload<E>) => void): void }).once(event, resolve);
  });

const preview = (id: number) => `https://cdnt-preview.dzcdn.net/api/1/${id}.mp3?hdnea=exp=1`;

/** Minimal stand-in for api.deezer.com with two playlists of one playable track each. */
const PLAYLISTS: Record<
  string,
  { title: string; track: { id: number; title: string; artist: string } }
> = {
  '42': {
    title: 'French Touch',
    track: { id: 3135556, title: 'One More Time', artist: 'Daft Punk' },
  },
  '7': { title: '80s', track: { id: 1109731, title: 'Take On Me', artist: 'a-ha' } },
};

const startFakeDeezer = async (): Promise<{ url: string; server: Server }> => {
  const server = createServer((request, response) => {
    const [, , id, tracks] = (request.url ?? '').split('?')[0]?.split('/') ?? [];
    const playlist = PLAYLISTS[id ?? ''];
    const body = !playlist
      ? { error: { type: 'DataException', message: 'no data', code: 800 } }
      : tracks
        ? {
            data: [
              {
                id: playlist.track.id,
                title: playlist.track.title,
                readable: true,
                preview: preview(playlist.track.id),
                artist: { name: playlist.track.artist },
              },
            ],
          }
        : { id: Number(id), title: playlist.title };
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, server };
};

describe('blind test (HTTP + Socket.IO)', () => {
  let server: AppServer;
  let deezer: Server;
  let baseUrl: string;
  let catalog: RoundCatalogDto;
  const sockets: ClientSocket[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed test helper
  const api = async <T = unknown>(method: string, path: string, body?: unknown, token?: string) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
  };

  const openSocket = async (): Promise<ClientSocket> => {
    const socket: ClientSocket = connect(baseUrl, { transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    await new Promise<void>((resolve) => socket.once('connect', resolve));
    return socket;
  };

  const round = (
    playlist: string,
    type: 'classic' | 'everyone',
    songCount = 1,
  ): RoundPlanPayload => ({
    name: `Playlist ${playlist}`,
    type,
    playlist,
    playlistTitle: null,
    rules: { ...catalog.presets[type], songCount },
  });

  /** Designs a game with the given rounds, launches it and attaches a host socket. */
  const launchParty = async (rounds: RoundPlanPayload[]) => {
    const created = await api<CreateGameDesignResponseDto>('POST', '/api/designs', {
      name: 'Party',
    });
    const { design, editToken } = created.body;
    await api('PUT', `/api/designs/${design.id}`, { name: 'Party', rounds }, editToken);
    const launched = await api<CreateGameResponseDto>('POST', '/api/games', {
      designId: design.id,
      editToken,
    });
    const party = launched.body;
    const host = await openSocket();
    await host.emitWithAck('host:attach', { gameId: party.gameId, hostToken: party.hostToken });
    return { party, host };
  };

  beforeEach(async () => {
    const fakeDeezer = await startFakeDeezer();
    deezer = fakeDeezer.server;
    server = await createAppServer({
      HOST: '127.0.0.1',
      PORT: 0,
      CORS_ORIGIN: '*',
      DEEZER_API_URL: fakeDeezer.url,
      DATABASE_PATH: ':memory:',
      LOG_LEVEL: 'silent',
    });
    baseUrl = await server.start();
    catalog = (await api<RoundCatalogDto>('GET', '/api/round-catalog')).body;
  });

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await server.stop();
    await new Promise((resolve) => deezer.close(resolve));
  });

  it('exposes a health check and the round catalog', async () => {
    expect((await api('GET', '/api/health')).body).toEqual({ status: 'ok' });
    expect(catalog.presets.flash).toMatchObject({ excerptSec: 4 });
    expect(catalog.limits.songCount).toEqual({ min: 1, max: 50 });
  });

  it('lists the LAN addresses so the lobby QR code can use a reachable IP', async () => {
    const { status, body } = await api<{ addresses: string[] }>('GET', '/api/network');
    expect(status).toBe(200);
    expect(body.addresses).not.toContain('127.0.0.1');
    body.addresses.forEach((address) => expect(address).toMatch(/^\d+\.\d+\.\d+\.\d+$/));
  });

  describe('game designs', () => {
    it('creates, edits, reads and deletes a design with its edit token', async () => {
      const created = await api<CreateGameDesignResponseDto>('POST', '/api/designs', {
        name: 'Friday night',
      });
      expect(created.status).toBe(201);
      const { design, editToken } = created.body;
      expect(design).toMatchObject({ name: 'Friday night', rounds: [] });

      const updated = await api<GameDesignDto>(
        'PUT',
        `/api/designs/${design.id}`,
        {
          name: 'Friday night',
          rounds: [
            {
              ...round('https://www.deezer.com/fr/playlist/42', 'classic'),
              name: 'Daft Punk hour',
              playlistTitle: 'French Touch',
            },
          ],
        },
        editToken,
      );
      expect(updated.status).toBe(200);
      expect(updated.body.rounds).toEqual([
        {
          name: 'Daft Punk hour',
          type: 'classic',
          playlist: '42',
          playlistTitle: 'French Touch',
          rules: { ...catalog.presets.classic, songCount: 1 },
        },
      ]);

      expect((await api('GET', `/api/designs/${design.id}`, undefined, editToken)).body).toEqual(
        updated.body,
      );
      expect((await api('GET', `/api/designs/${design.id}`)).status).toBe(403);
      expect((await api('DELETE', `/api/designs/${design.id}`, undefined, editToken)).status).toBe(
        204,
      );
      expect((await api('GET', `/api/designs/${design.id}`, undefined, editToken)).status).toBe(
        404,
      );
    });

    it('rejects invalid rounds with the faulty round number', async () => {
      const { design, editToken } = (
        await api<CreateGameDesignResponseDto>('POST', '/api/designs', { name: 'Party' })
      ).body;
      const result = await api<{ code: string; message: string }>(
        'PUT',
        `/api/designs/${design.id}`,
        { name: 'Party', rounds: [round('42', 'classic'), round('42', 'classic', 0)] },
        editToken,
      );
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({
        code: 'INVALID_ROUND_RULES',
        message: expect.stringMatching(/^Round 2/) as unknown,
      });
      expect((await api('PUT', `/api/designs/${design.id}`, { name: 42 }, editToken)).status).toBe(
        400,
      );
    });

    it('checks Deezer playlists', async () => {
      const ok = await api<PlaylistSummaryDto>(
        'GET',
        `/api/playlists/check?playlist=${encodeURIComponent('https://www.deezer.com/fr/playlist/42')}`,
      );
      expect(ok.body).toEqual({ id: '42', title: 'French Touch', playableTracks: 1 });
      expect((await api('GET', '/api/playlists/check?playlist=404')).status).toBe(404);
      expect((await api('GET', '/api/playlists/check?playlist=nope')).status).toBe(422);
    });

    it('refuses to launch an empty design', async () => {
      const { design, editToken } = (
        await api<CreateGameDesignResponseDto>('POST', '/api/designs', { name: 'Party' })
      ).body;
      const launched = await api<{ code: string }>('POST', '/api/games', {
        designId: design.id,
        editToken,
      });
      expect(launched).toMatchObject({ status: 422, body: { code: 'EMPTY_DESIGN' } });
    });
  });

  it('reveals the song by itself, after a pause, once every player answered', async () => {
    const { party, host } = await launchParty([round('42', 'classic')]);
    const join = async (playerName: string) => {
      const socket = await openSocket();
      const joined = await socket.emitWithAck('player:join', { code: party.code, playerName });
      if (!joined.ok) throw new Error(joined.error.message);
      return socket;
    };
    const alice = await join('Alice');
    const bob = await join('Bob');
    const next = await host.emitWithAck('song:next');
    if (!next.ok || next.data.kind !== 'song') throw new Error('expected a song');

    const allAnswered = [alice, bob, host].map((socket) => nextEvent(socket, 'song:all-answered'));
    const revealedForAlice = nextEvent(alice, 'song:revealed');
    const send = (socket: typeof alice, text: string) =>
      socket.emitWithAck('answer:submit', { text, clientSentAt: Date.now() });

    // One guess only, and nothing happens while somebody is still thinking.
    expect(await send(alice, 'no idea')).toMatchObject({ ok: true });
    expect(await send(alice, 'second try')).toMatchObject({
      ok: false,
      error: { code: 'ALREADY_ANSWERED' },
    });
    const early = Promise.race([
      allAnswered[0],
      new Promise((resolve) => setTimeout(() => resolve('quiet'), 150)),
    ]);
    expect(await early).toBe('quiet');

    const lastAnswerAt = Date.now();
    expect(await send(bob, 'daft punk one more time')).toMatchObject({ ok: true });
    for (const event of allAnswered) expect(await event).toEqual({ songId: next.data.song.id });

    // Everyone is told first, then the reveal follows without the host doing anything.
    const reveal = await revealedForAlice;
    expect(Date.now() - lastAnswerAt).toBeGreaterThanOrEqual(1_900);
    expect(reveal).toMatchObject({
      songId: next.data.song.id,
      title: 'One More Time',
      scoreboard: expect.arrayContaining([
        expect.objectContaining({ playerName: 'Bob', points: 2 }),
      ]) as unknown,
    });
  }, 10_000);

  it('plays a whole party: rounds, checked answers, corrections, reveals and final scores', async () => {
    const { party, host } = await launchParty([round('42', 'classic'), round('7', 'everyone')]);

    const player = await openSocket();
    const joined = await player.emitWithAck('player:join', {
      code: party.code.toLowerCase(),
      playerName: 'Alice',
    });
    if (!joined.ok) throw new Error(joined.error.message);
    const aliceId = joined.data.player.id;

    // Before the first song, players already know every round and its rules...
    expect(joined.data).toMatchObject({ status: 'lobby', currentSong: null });
    expect(joined.data.rounds).toEqual([
      {
        number: 1,
        name: 'Playlist 42',
        type: 'classic',
        songCount: 1,
        rules: { ...catalog.presets.classic, songCount: 1 },
      },
      {
        number: 2,
        name: 'Playlist 7',
        type: 'everyone',
        songCount: 1,
        rules: { ...catalog.presets.everyone, songCount: 1 },
      },
    ]);
    // ...but nothing that could give the songs away.
    expect(JSON.stringify(joined.data)).not.toMatch(/playlistTitle|French Touch|"playlist"/);

    // Round 1, song 1: the host gets the audio, the player only the song frame.
    const songForPlayer = nextEvent(player, 'song:started');
    const songForHost = nextEvent(host, 'host:song-started');
    const next = await host.emitWithAck('song:next');
    if (!next.ok || next.data.kind !== 'song') throw new Error('expected a song');
    expect(await songForHost).toEqual(next.data.song);
    expect(next.data.song).toMatchObject({
      roundNumber: 1,
      roundName: 'Playlist 42',
      roundType: 'classic',
      number: 1,
      previewUrl: preview(3135556),
    });
    const playerSong = await songForPlayer;
    expect(playerSong).not.toHaveProperty('previewUrl');
    expect(playerSong).toMatchObject({ roundName: 'Playlist 42' });
    expect(next.data.song).toMatchObject({ title: 'One More Time', artist: 'Daft Punk' });
    expect(JSON.stringify(playerSong)).not.toMatch(/Daft Punk|One More Time/);

    // The player answers: checked automatically, timestamped by the server.
    const received = nextEvent(host, 'answer:received');
    const answer = await player.emitWithAck('answer:submit', {
      text: 'daft punk one more time',
      clientSentAt: Date.now(),
    });
    if (!answer.ok) throw new Error(answer.error.message);
    expect(answer.data).toMatchObject({
      playerName: 'Alice',
      verdict: { title: true, artist: true },
    });
    expect(await received).toEqual(answer.data);
    expect(answer.data.elapsedMs).toBeCloseTo(answer.data.receivedAt - playerSong.startedAt);

    // Reveal: everyone learns the song and the scores.
    const revealedToPlayer = nextEvent(player, 'song:revealed');
    const reveal = await host.emitWithAck('song:reveal');
    expect(reveal).toMatchObject({
      ok: true,
      data: {
        title: 'One More Time',
        artist: 'Daft Punk',
        scoreboard: [{ playerName: 'Alice', points: 2 }],
      },
    });
    expect(await revealedToPlayer).toEqual(reveal.ok && reveal.data);

    // Round 2: a wrong answer, corrected by the host after the reveal.
    const next2 = await host.emitWithAck('song:next');
    expect(next2).toMatchObject({
      ok: true,
      data: { kind: 'song', song: { roundNumber: 2, roundType: 'everyone' } },
    });
    const wrong = await player.emitWithAck('answer:submit', {
      text: 'Ah-ha, take me on',
      clientSentAt: Date.now(),
    });
    if (!wrong.ok) throw new Error(wrong.error.message);
    expect(wrong.data.verdict).toEqual({ title: false, artist: false });
    await host.emitWithAck('song:reveal');

    const judgedForPlayer = nextEvent(player, 'answer:judged');
    const scoresForPlayer = nextEvent(player, 'scoreboard:updated');
    const judged = await host.emitWithAck('answer:judge', {
      answerId: wrong.data.id,
      title: true,
      artist: true,
    });
    expect(judged).toMatchObject({
      ok: true,
      data: { judgedByHost: true, verdict: { title: true, artist: true } },
    });
    expect(await judgedForPlayer).toMatchObject({ id: wrong.data.id, judgedByHost: true });
    const totalAfterLastSong = (await scoresForPlayer)[0]?.points;
    expect(totalAfterLastSong).toBeGreaterThan(2);

    // Every round played: the next action finishes the game.
    const finishedForPlayer = nextEvent(player, 'game:finished');
    const recapForPlayer = nextEvent(player, 'game:recap');
    const recapForHost = nextEvent(host, 'game:recap');
    const end = await host.emitWithAck('song:next');
    expect(end).toMatchObject({ ok: true, data: { kind: 'finished' } });
    // The final scores include the points of the last song (corrected by the host).
    expect((await finishedForPlayer)[0]).toMatchObject({
      playerId: aliceId,
      points: totalAfterLastSong,
    });

    // Everyone gets the recap: standings, replay of the songs, and never answer texts.
    const recap = await recapForPlayer;
    expect(await recapForHost).toEqual(recap);
    expect(recap).toMatchObject({
      gameName: 'Party',
      standings: [{ rank: 1, playerId: aliceId, playerName: 'Alice', points: totalAfterLastSong }],
      superlatives: [],
      songs: [
        {
          roundNumber: 1,
          title: 'One More Time',
          artist: 'Daft Punk',
          results: [{ playerId: aliceId, foundTitle: true, foundArtist: true, wrongAttempts: 0 }],
        },
        {
          roundNumber: 2,
          title: 'Take On Me',
          artist: 'a-ha',
          results: [{ playerId: aliceId, foundTitle: true, wrongAttempts: 0 }],
        },
      ],
    });
    expect(JSON.stringify(recap)).not.toMatch(/daft punk one more time|Ah-ha, take me on/i);

    const resumed = await (
      await openSocket()
    ).emitWithAck('player:rejoin', { gameId: party.gameId, playerId: aliceId });
    expect(resumed).toMatchObject({
      ok: true,
      data: { status: 'finished', player: { name: 'Alice' } },
    });
    expect(resumed.ok && 'answers' in resumed.data).toBe(false);
    // A player coming back after the end, like a host re-attaching, gets the recap too.
    expect(resumed.ok && resumed.data.recap).toEqual(recap);
    const reattached = await (
      await openSocket()
    ).emitWithAck('host:attach', { gameId: party.gameId, hostToken: party.hostToken });
    expect(reattached.ok && reattached.data.recap).toEqual(recap);

    // A correction made after the end updates the recap for everyone.
    const updatedRecap = nextEvent(player, 'game:recap');
    await host.emitWithAck('answer:judge', {
      answerId: wrong.data.id,
      title: false,
      artist: false,
    });
    expect((await updatedRecap).songs[1]?.results[0]).toMatchObject({
      foundTitle: false,
      wrongAttempts: 1,
    });
  });

  it('has no recap before the game is finished', async () => {
    const { party, host } = await launchParty([round('42', 'classic')]);
    await host.emitWithAck('song:next');
    const snapshot = await (
      await openSocket()
    ).emitWithAck('host:attach', { gameId: party.gameId, hostToken: party.hostToken });
    expect(snapshot).toMatchObject({ ok: true, data: { status: 'playing', recap: null } });
  });

  it('gives the preview back to a host reattaching mid-song', async () => {
    const { party, host } = await launchParty([round('42', 'classic')]);
    await host.emitWithAck('song:next');

    const reattached = await (
      await openSocket()
    ).emitWithAck('host:attach', { gameId: party.gameId, hostToken: party.hostToken });
    expect(reattached).toMatchObject({
      ok: true,
      data: {
        status: 'playing',
        currentSong: { number: 1, previewUrl: preview(3135556) },
        reveal: null,
        hasNextSong: false,
      },
    });
  });

  it('reports game flow errors to the host', async () => {
    const { host } = await launchParty([round('404', 'classic')]);
    expect(await host.emitWithAck('song:next')).toMatchObject({
      ok: false,
      error: { code: 'PLAYLIST_NOT_FOUND' },
    });
    expect(await host.emitWithAck('song:reveal')).toMatchObject({
      ok: false,
      error: { code: 'NO_ACTIVE_SONG' },
    });
    expect(
      await host.emitWithAck('answer:judge', { answerId: 'x', title: true, artist: true }),
    ).toMatchObject({
      ok: false,
      error: { code: 'NO_ACTIVE_SONG' },
    });
  });

  it('lets the host end the party early', async () => {
    const { host } = await launchParty([round('42', 'classic'), round('7', 'classic')]);
    await host.emitWithAck('song:next');
    expect(await host.emitWithAck('game:finish')).toMatchObject({
      ok: false,
      error: { code: 'SONG_IN_PROGRESS' },
    });
    await host.emitWithAck('song:reveal');
    expect(await host.emitWithAck('game:finish')).toMatchObject({ ok: true });
  });

  it('rejects host actions from non-host sockets', async () => {
    const stranger = await openSocket();
    for (const event of ['song:next', 'song:reveal', 'game:finish'] as const) {
      expect(await stranger.emitWithAck(event)).toMatchObject({
        ok: false,
        error: { code: 'NOT_IDENTIFIED' },
      });
    }
  });

  it('validates payloads at the boundary', async () => {
    const socket = await openSocket();
    const result = await socket.emitWithAck('player:join', { code: 42 } as never);
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
  });
});
