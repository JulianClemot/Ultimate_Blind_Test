import type { Answer } from './Answer';
import type { Player } from './Player';
import type { Round } from './Round';
import type { Song } from './Song';

/**
 * End-of-game recap: final standings, fun awards and a replay of the tracks. Pure and recomputed
 * from the answers, so host corrections are always reflected. It never exposes answer texts.
 */

export type SuperlativeKind = 'fastest-finger' | 'sniper' | 'stubborn' | 'comeback-kid';

export interface Standing {
  /** Ties share a rank (1, 2, 2, 4). */
  readonly rank: number;
  readonly player: Player;
  readonly points: number;
}

export interface Superlative {
  readonly kind: SuperlativeKind;
  readonly player: Player;
  /** Average find time in ms, songs found first, wrong attempts, or places gained. */
  readonly value: number;
}

export interface PlayerSongResult {
  readonly player: Player;
  readonly points: number;
  readonly foundTitle: boolean;
  readonly foundArtist: boolean;
  /** Time (ms after the song started) of the first correct answer; null when never found. */
  readonly foundAtMs: number | null;
  /** Answers that were correct for no part the song asks. */
  readonly wrongAttempts: number;
}

export interface SongRecap {
  readonly songId: string;
  readonly roundNumber: number;
  readonly roundName: string;
  /** Position within its round, from 1. */
  readonly number: number;
  readonly title: string;
  readonly artist: string;
  /** Players who found the song first (fastest), then the others by name. */
  readonly results: readonly PlayerSongResult[];
}

export interface GameRecap {
  readonly standings: readonly Standing[];
  readonly superlatives: readonly Superlative[];
  readonly songs: readonly SongRecap[];
}

/** Minimum values for an award to be worth giving. */
const MIN_STUBBORN_ATTEMPTS = 3;
const MIN_COMEBACK_PLACES = 2;
const MIN_FINDS_FOR_FASTEST = 2;

const byPointsThenName = (a: Standing | PlayerTotal, b: Standing | PlayerTotal) =>
  b.points - a.points || a.player.name.value.localeCompare(b.player.name.value);

interface PlayerTotal {
  readonly player: Player;
  readonly points: number;
}

/** Ranks best first; ties share the rank of the first of them. */
const rank = (totals: readonly PlayerTotal[]): Standing[] => {
  const ordered = [...totals].sort(byPointsThenName);
  return ordered.map((total) => ({
    ...total,
    rank: ordered.findIndex((other) => other.points === total.points) + 1,
  }));
};

const isCorrect = (song: Song, answer: Answer): boolean =>
  (song.rules.asks('title') && answer.verdict.title) ||
  (song.rules.asks('artist') && answer.verdict.artist);

const resultOf = (song: Song, player: Player): PlayerSongResult => {
  const answers = song.answersOf(player.id);
  return {
    player,
    points: song.points().get(player.id) ?? 0,
    foundTitle: song.rules.asks('title') && answers.some((a) => a.verdict.title),
    foundArtist: song.rules.asks('artist') && answers.some((a) => a.verdict.artist),
    foundAtMs: answers.find((a) => isCorrect(song, a))?.elapsedMs ?? null,
    wrongAttempts: answers.filter((a) => !isCorrect(song, a)).length,
  };
};

const byFindTimeThenName = (a: PlayerSongResult, b: PlayerSongResult) => {
  if (a.foundAtMs !== null && b.foundAtMs !== null) return a.foundAtMs - b.foundAtMs;
  if (a.foundAtMs !== null) return -1;
  if (b.foundAtMs !== null) return 1;
  return a.player.name.value.localeCompare(b.player.name.value);
};

/**
 * Picks the best player by `score` among those scoring at least `min` (null = not eligible).
 * `candidates` is given in final-standing order, so a tie goes to the better standing.
 */
const best = (
  kind: SuperlativeKind,
  candidates: readonly Player[],
  score: (player: Player) => number | null,
  { min = -Infinity, lowerIsBetter = false } = {},
): Superlative | undefined => {
  let winner: Superlative | undefined;
  for (const player of candidates) {
    const value = score(player);
    if (value === null || value < min) continue;
    if (!winner || (lowerIsBetter ? value < winner.value : value > winner.value)) {
      winner = { kind, player, value };
    }
  }
  return winner;
};

export const buildRecap = (players: readonly Player[], rounds: readonly Round[]): GameRecap => {
  const songs = rounds.flatMap((round) => round.listSongs());
  const results = songs.map((song) => players.map((player) => resultOf(song, player)));

  const cumulative = (upTo: number): Standing[] =>
    rank(
      players.map((player, p) => ({
        player,
        points: results.slice(0, upTo).reduce((sum, song) => sum + (song[p]?.points ?? 0), 0),
      })),
    );
  const standings = cumulative(songs.length);
  const ordered = standings.map((standing) => standing.player);
  const indexOf = (player: Player) => players.indexOf(player);
  const resultsOf = (player: Player) =>
    results.map((song) => song[indexOf(player)]).filter((r) => r !== undefined);

  const superlatives: Superlative[] = [];
  if (players.length >= 2) {
    const minFinds = Math.min(MIN_FINDS_FOR_FASTEST, songs.length);
    const average = (player: Player): number | null => {
      const times = resultsOf(player).flatMap((r) => (r.foundAtMs === null ? [] : [r.foundAtMs]));
      if (times.length < Math.max(1, minFinds)) return null;
      return times.reduce((sum, t) => sum + t, 0) / times.length;
    };
    const fastest = best('fastest-finger', ordered, average, { lowerIsBetter: true });

    const firsts = (player: Player) =>
      results.filter((song) => {
        const times = song.flatMap((r) => (r.foundAtMs === null ? [] : [r.foundAtMs]));
        const mine = song[indexOf(player)]?.foundAtMs ?? null;
        return mine !== null && mine === Math.min(...times);
      }).length;

    const gain = (player: Player): number => {
      const final = standings.find((s) => s.player === player)?.rank ?? 0;
      let max = 0;
      for (let k = 1; k < songs.length; k++) {
        const then = cumulative(k).find((s) => s.player === player)?.rank ?? final;
        max = Math.max(max, then - final);
      }
      return max;
    };

    const awards = [
      fastest && { ...fastest, value: Math.round(fastest.value) },
      best('sniper', ordered, firsts, { min: 1 }),
      best('stubborn', ordered, (p) => resultsOf(p).reduce((n, r) => n + r.wrongAttempts, 0), {
        min: MIN_STUBBORN_ATTEMPTS,
      }),
      best('comeback-kid', ordered, gain, { min: MIN_COMEBACK_PLACES }),
    ];
    superlatives.push(...awards.filter((award) => award !== undefined));
  }

  return {
    standings,
    superlatives,
    songs: songs.map((song, s) => {
      const round = rounds[song.roundNumber - 1];
      return {
        songId: song.id,
        roundNumber: song.roundNumber,
        roundName: round?.plan.name ?? '',
        number: song.number,
        title: song.track.title,
        artist: song.track.artist,
        results: [...(results[s] ?? [])].sort(byFindTimeThenName),
      };
    }),
  };
};
