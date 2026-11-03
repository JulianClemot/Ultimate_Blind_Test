import type { GameCode } from '../../../domain';

export interface GameCodeGenerator {
  next(): GameCode;
}
