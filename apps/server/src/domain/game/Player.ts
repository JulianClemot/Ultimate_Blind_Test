import type { Timestamp } from '../shared/Timestamp';
import type { PlayerName } from './PlayerName';

export interface Player {
  readonly id: string;
  readonly name: PlayerName;
  readonly joinedAt: Timestamp;
}
