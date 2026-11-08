import type { RoundPlan } from '../design/RoundPlan';
import { trackLabel, type Suggestion, type Track } from '../music/Track';
import type { Timestamp } from '../shared/Timestamp';
import { Song } from './Song';

/** A round being played: the plan copied from the design at launch, plus the songs played so far. */
export class Round {
  private readonly songs: Song[] = [];
  private suggestionList: readonly Suggestion[] | undefined;

  constructor(
    readonly number: number,
    readonly plan: RoundPlan,
  ) {}

  get isComplete(): boolean {
    return this.songs.length >= this.plan.rules.songCount;
  }

  get currentSong(): Song | undefined {
    return this.songs.at(-1);
  }

  /** Easy rounds only: the tracks players can pick from, alphabetical. Empty otherwise. */
  get suggestions(): readonly Suggestion[] {
    return this.suggestionList ?? [];
  }

  findSuggestion(id: string): Suggestion | undefined {
    return this.suggestions.find((suggestion) => suggestion.id === id);
  }

  /**
   * Keeps the playlist's tracks as suggestions, once, when the round starts. Does nothing
   * unless the round is easy. Nothing tells which track is the song being played.
   */
  captureSuggestions(tracks: readonly Track[]): void {
    if (!this.plan.rules.easyMode || this.suggestionList) return;
    const byId = new Map(tracks.map((track) => [track.id, track]));
    this.suggestionList = [...byId.values()]
      .map(({ id, title, artist }): Suggestion => ({
        id,
        label: trackLabel({ title, artist }),
        title,
        artist,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  listSongs(): readonly Song[] {
    return this.songs;
  }

  addSong(songId: string, startedAt: Timestamp, track: Track): Song {
    const song = new Song(
      songId,
      this.number,
      this.songs.length + 1,
      startedAt,
      track,
      this.plan.rules,
    );
    this.songs.push(song);
    return song;
  }
}
