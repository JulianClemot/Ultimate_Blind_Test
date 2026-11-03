export interface IdGenerator {
  /** Returns a new unguessable unique identifier. */
  next(): string;
}
