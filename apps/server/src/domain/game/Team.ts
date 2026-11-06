import type { Player } from './Player';

export interface Team {
  /** Unique within a game only (`team-1`, `team-2`…). */
  readonly id: string;
  readonly name: string;
}

export interface TeamScore {
  readonly team: Team;
  readonly members: readonly Player[];
  readonly points: number;
}

/** Anything able to draw a uniform integer in [0, maxExclusive): the `RandomGenerator` port fits. */
export interface IntSource {
  nextInt(maxExclusive: number): number;
}

const ADJECTIVES = [
  'Funky',
  'Electric',
  'Groovy',
  'Velvet',
  'Neon',
  'Cosmic',
  'Rowdy',
  'Mellow',
  'Turbo',
  'Golden',
  'Atomic',
  'Sassy',
  'Midnight',
  'Disco',
  'Crispy',
  'Wild',
];

const NOUNS = [
  'Flamingos',
  'Vinyls',
  'Llamas',
  'Maracas',
  'Pandas',
  'Bassists',
  'Echoes',
  'Falcons',
  'Walruses',
  'Cassettes',
  'Hamsters',
  'Yetis',
  'Octopuses',
  'Pickles',
  'Koalas',
  'Jukeboxes',
];

/** Removes and returns a random element. */
const draw = <T>(pool: T[], random: IntSource): T => {
  const [picked] = pool.splice(random.nextInt(pool.length), 1);
  if (picked === undefined) throw new Error('IntSource returned an out-of-range index');
  return picked;
};

/** Fisher–Yates shuffle, on a copy. */
export const shuffled = <T>(items: readonly T[], random: IntSource): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random.nextInt(i + 1);
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined)
      throw new Error('IntSource returned an out-of-range index');
    result[i] = b;
    result[j] = a;
  }
  return result;
};

/** Distinct, fun names such as "The Funky Flamingos": no adjective and no noun is used twice. */
export const generateTeamNames = (count: number, random: IntSource): string[] => {
  const adjectives = [...ADJECTIVES];
  const nouns = [...NOUNS];
  return Array.from(
    { length: count },
    () => `The ${draw(adjectives, random)} ${draw(nouns, random)}`,
  );
};

/**
 * Splits players into `teamCount` teams whose sizes differ by at most one, after a random
 * shuffle so the host cannot influence who plays with whom.
 */
export const balancedSplit = <T>(
  items: readonly T[],
  teamCount: number,
  random: IntSource,
): T[][] => {
  const teams: T[][] = Array.from({ length: teamCount }, () => []);
  shuffled(items, random).forEach((item, index) => teams[index % teamCount]?.push(item));
  return teams;
};

export const MAX_TEAMS = 4;
