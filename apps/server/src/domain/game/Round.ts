import type { RoundPlan } from '../design/RoundPlan';
import type { Track } from '../music/Track';
import type { Timestamp } from '../shared/Timestamp';
import { Song } from './Song';

/** A round being played: the plan copied from the design at launch, plus the songs played so far. */
export class Round {
  private readonly songs: Song[] = [];

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
