import type {
  AnswerDto,
  GameDesignDto,
  GameRecapDto,
  GameSnapshotDto,
  HostSongDto,
  PlayerDto,
  PlayerSessionDto,
  PlaylistSummaryDto,
  RevealDto,
  RoundPlanDto,
  RoundSummaryDto,
  ScoreDto,
  SongDto,
} from '@ubt/shared';

import type { PlayerSession, Playlist } from '../../application';
import type { Answer, Game, GameDesign, Player, RoundPlan, Score, Song } from '../../domain';

// ── Game designs ────────────────────────────────────────────────────────────

export const toRoundPlanDto = (plan: RoundPlan): RoundPlanDto => ({
  name: plan.name,
  type: plan.type,
  playlist: plan.playlist.value,
  playlistTitle: plan.playlistTitle,
  rules: plan.rules.toProps(),
});

export const toGameDesignDto = (design: GameDesign): GameDesignDto => ({
  id: design.id,
  name: design.name,
  rounds: design.rounds.map(toRoundPlanDto),
  updatedAt: design.updatedAt,
});

export const toPlaylistSummaryDto = (playlist: Playlist): PlaylistSummaryDto => ({
  id: playlist.id,
  title: playlist.title,
  playableTracks: playlist.tracks.length,
});

// ── Parties ─────────────────────────────────────────────────────────────────

export const toPlayerDto = (player: Player): PlayerDto => ({
  id: player.id,
  name: player.name.value,
});

const toScoreDto = ({ player, points }: Score): ScoreDto => ({
  playerId: player.id,
  playerName: player.name.value,
  points,
});

/** Players only ever see scores of revealed songs. */
export const toPublicScoreboard = (game: Game): ScoreDto[] =>
  game.scoreboard({ revealedOnly: true }).map(toScoreDto);

export const toSongDto = (game: Game, song: Song): SongDto => {
  const round = game.listRounds()[song.roundNumber - 1];
  return {
    id: song.id,
    roundNumber: song.roundNumber,
    roundName: round?.plan.name ?? '',
    roundType: round?.plan.type ?? 'classic',
    number: song.number,
    songCount: song.rules.songCount,
    startedAt: song.startedAt,
    answerTimeSec: song.rules.answerTimeSec,
    asksTitle: song.rules.asks('title'),
    asksArtist: song.rules.asks('artist'),
    revealed: song.isRevealed,
  };
};

/** Only the audio leaves the server before the reveal: title and artist stay secret. */
export const toHostSongDto = (game: Game, song: Song): HostSongDto => ({
  ...toSongDto(game, song),
  previewUrl: song.track.previewUrl,
  excerptSec: song.rules.excerptSec,
  playbackRate: song.rules.playbackRate,
});

export const toRevealDto = (game: Game, song: Song): RevealDto => ({
  songId: song.id,
  title: song.track.title,
  artist: song.track.artist,
  scoreboard: toPublicScoreboard(game),
});

export const toAnswerDto = (game: Game, answer: Answer): AnswerDto => ({
  id: answer.id,
  songId: answer.songId,
  playerId: answer.playerId,
  playerName: game.findPlayer(answer.playerId)?.name.value ?? 'Unknown player',
  text: answer.text,
  receivedAt: answer.receivedAt,
  elapsedMs: answer.elapsedMs,
  clientSentAt: answer.clientSentAt,
  verdict: answer.verdict,
  judgedByHost: answer.judgedByHost,
});

const revealOf = (game: Game): RevealDto | null => {
  const song = game.currentSong;
  return song?.isRevealed ? toRevealDto(game, song) : null;
};

const toRoundSummaries = (game: Game): RoundSummaryDto[] =>
  game.listRounds().map((round) => ({
    number: round.number,
    name: round.plan.name,
    type: round.plan.type,
    songCount: round.plan.rules.songCount,
    rules: round.plan.rules.toProps(),
  }));

export const toGameRecapDto = (game: Game): GameRecapDto | null => {
  const recap = game.recap();
  if (!recap) return null;
  return {
    gameName: game.name,
    standings: recap.standings.map(({ rank, player, points }) => ({
      rank,
      playerId: player.id,
      playerName: player.name.value,
      points,
    })),
    superlatives: recap.superlatives.map(({ kind, player, value }) => ({
      kind,
      playerId: player.id,
      playerName: player.name.value,
      value,
    })),
    songs: recap.songs.map((song) => ({
      ...song,
      results: song.results.map(({ player, ...result }) => ({
        playerId: player.id,
        playerName: player.name.value,
        ...result,
      })),
    })),
  };
};

export const toGameSnapshotDto = (game: Game): GameSnapshotDto => {
  const song = game.currentSong;
  return {
    id: game.id,
    code: game.code.value,
    name: game.name,
    status: game.status,
    players: game.listPlayers().map(toPlayerDto),
    rounds: toRoundSummaries(game),
    currentSong: song ? toHostSongDto(game, song) : null,
    reveal: revealOf(game),
    answers: song ? song.answersByArrival().map((a) => toAnswerDto(game, a)) : [],
    scoreboard: toPublicScoreboard(game),
    hasNextSong: game.upcomingRound !== undefined,
    recap: toGameRecapDto(game),
  };
};

export const toPlayerSessionDto = ({ game, player }: PlayerSession): PlayerSessionDto => {
  const song = game.currentSong;
  return {
    gameId: game.id,
    code: game.code.value,
    name: game.name,
    status: game.status,
    player: toPlayerDto(player),
    rounds: toRoundSummaries(game),
    currentSong: song ? toSongDto(game, song) : null,
    reveal: revealOf(game),
    myAnswers: song ? song.answersOf(player.id).map((a) => toAnswerDto(game, a)) : [],
    scoreboard: toPublicScoreboard(game),
    recap: toGameRecapDto(game),
  };
};
