import type { RoundPlan } from '../design/RoundPlan';
import { normalize } from '../music/answerMatching';
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
   * Keeps what players can pick from, once, when the round starts. Does nothing unless the round
   * is easy. The tracks of the playlist, or, in rounds about films and series, their names.
   * Nothing tells which one is the song being played.
   */
  captureSuggestions(tracks: readonly Track[]): void {
    if (!this.plan.rules.easyMode || this.suggestionList) return;
    this.suggestionList = (
      this.plan.rules.asks('source') ? sourceSuggestions(tracks) : trackSuggestions(tracks)
    ).sort((a, b) => a.label.localeCompare(b.label));
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

const trackSuggestions = (tracks: readonly Track[]): Suggestion[] => {
  const byId = new Map(tracks.map((track) => [track.id, track]));
  return [...byId.values()].map(({ id, title, artist }): Suggestion => ({
    id,
    kind: 'track',
    label: trackLabel({ title, artist }),
    title,
    artist,
  }));
};

const sourceSuggestions = (tracks: readonly Track[]): Suggestion[] => {
  const byKey = new Map<string, string>();
  for (const { source } of tracks) {
    const key = source ? normalize(source.name).join(' ') : '';
    if (key && !byKey.has(key)) byKey.set(key, source?.name ?? key);
  }
  return [...byKey].map(([id, label]): Suggestion => ({
    id,
    kind: 'source',
    label,
    source: label,
  }));
};
