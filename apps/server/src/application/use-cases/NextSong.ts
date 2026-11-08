import { err, ok, withOverrides, type Result, type RoundPlan, type Track } from '../../domain';
import { appError, type UseCaseError } from '../errors';
import type { HostCommand, NextSongResult, NextSongUseCase } from '../ports/in';
import type {
  Clock,
  GameEventPublisher,
  GameRepository,
  IdGenerator,
  MusicCatalog,
  Playlist,
  RandomGenerator,
} from '../ports/out';
import type { PlaylistAnalyzer } from '../services/PlaylistAnalyzer';
import { loadHostedGame } from './access';

/**
 * Plays the next song: a random, not yet played track of the upcoming round's playlist.
 * When every round is complete, finishes the game instead.
 */
export class NextSong implements NextSongUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly events: GameEventPublisher,
    private readonly catalog: MusicCatalog,
    private readonly random: RandomGenerator,
    private readonly analyzer?: PlaylistAnalyzer,
  ) {}

  async execute(command: HostCommand): Promise<Result<NextSongResult, UseCaseError>> {
    const loaded = await loadHostedGame(this.games, command);
    if (!loaded.ok) return loaded;
    const game = loaded.value;

    // Checked before calling the catalog, so a misclick does not cost a Deezer request.
    const movable = game.canMoveOn();
    if (!movable.ok) return movable;

    const round = game.upcomingRound;
    if (!round) {
      const finished = game.finish();
      if (!finished.ok) return finished;
      await this.games.save(game);
      this.events.gameFinished(game);
      return ok({ kind: 'finished', game });
    }
    // Also checked before the catalog call, for the same reason.
    const ready = game.checkTeamsReady();
    if (!ready.ok) return ready;
    const playlist = await this.catalog.playlist(round.plan.playlist);
    if (!playlist.ok) return playlist;

    const eligible = await this.eligibleTracks(round.plan, playlist.value);
    if (eligible.length === 0) {
      return err(
        appError(
          'NO_SOURCE_TRACKS',
          `No track of the playlist of round ${round.number} could be linked to a film, series or game`,
        ),
      );
    }
    const candidates = eligible.filter((track) => !game.hasPlayed(track.id));
    if (candidates.length === 0) {
      return err(
        appError(
          'PLAYLIST_EXHAUSTED',
          `No unplayed track with a preview left in the playlist of round ${round.number}`,
        ),
      );
    }
    const track = candidates[this.random.nextInt(candidates.length)];
    if (!track) throw new Error('RandomGenerator returned an out-of-range index');

    // The song starts once the track is known, so the catalog lookup is not counted
    // in the players' answer times.
    const song = game.startSong({
      songId: this.ids.next(),
      startedAt: this.clock.now(),
      track,
      playlistTracks: eligible,
    });
    if (!song.ok) return song;
    await this.games.save(game);
    this.events.songStarted(game, song.value);
    return ok({ kind: 'song', game, song: song.value });
  }

  /**
   * Tracks a round can play. In a round about films and series, only those with a known
   * film or series, named as the host corrected them, carry it as their `source`.
   */
  private async eligibleTracks(plan: RoundPlan, playlist: Playlist): Promise<readonly Track[]> {
    if (!plan.rules.asks('source')) return playlist.tracks;
    if (!this.analyzer) return [];
    const analysis = await this.analyzer.analyze(playlist);
    const sources = withOverrides(analysis.sources, plan.sourceOverrides);
    return playlist.tracks.flatMap((track) => {
      const source = sources.get(track.id);
      return source ? [{ ...track, source }] : [];
    });
  }
}
