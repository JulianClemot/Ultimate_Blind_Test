# Spec — End-of-game recap

## Why

When the last song ends, the game just stops on a scoreboard. That is the moment people are most
social and competitive. A recap gives the party a payoff (podium, funny awards, replay of the
tracks) and a one-tap way to share it, which is the cheapest source of word of mouth.

Scope of this iteration: **recap + share card**. Rematch, reactions, team mode and playlist filters
are follow-ups (the recap screen leaves room for a "Play again" button).

## Vocabulary

- **Finder** of a song: a player with at least one answer that is correct for a part the song asks
  (title and/or artist, see `RoundRules.asks`). The **find time** is the `elapsedMs` of their
  _first_ correct answer.
- **Wrong attempt**: an answer that is correct for no asked part.
- **Standing**: a player's final rank. Ties share a rank (1, 2, 2, 4), same rule as the web
  `Scoreboard`. Order is points desc, then name.

## Behaviour (Gherkin)

```gherkin
Feature: Game recap

  Background:
    Given a finished game with players Alice, Bob and Chloé

  Scenario: Standings with shared ranks
    Given Alice and Bob finish with 5 points and Chloé with 2
    Then the recap standings are Alice #1, Bob #1, Chloé #3

  Scenario: Recap exists only once the game is finished
    Given a game that is still playing
    Then it has no recap

  Scenario: Fastest finger
    Given Alice found 3 songs after 2 s on average and Bob found 3 songs after 4 s
    Then Alice gets "fastest-finger" with value 2000 (average ms)
    And a player who found fewer than min(2, songs played) songs cannot get it

  Scenario: Sniper
    Given Alice was the first finder of 2 songs and Bob of 1
    Then Alice gets "sniper" with value 2
    And nobody gets it when nobody found a song

  Scenario: Stubborn
    Given Bob made 5 wrong attempts over the game and Alice 1
    Then Bob gets "stubborn" with value 5
    And nobody gets it when the maximum is below 3

  Scenario: Comeback kid
    Given Chloé was last after song 2 and ended 1st
    Then Chloé gets "comeback-kid" with value 2 (places gained)
    And nobody gets it when the best gain is below 2

  Scenario: Ties on an award
    Given two players have the same award value
    Then the better final standing wins, then the name order

  Scenario: Solo game
    Given a single player
    Then there are no superlatives (standings and songs are still given)

  Scenario: Host corrections count
    Given the host corrected an answer before or after the game finished
    Then the recap is computed from the corrected verdicts
    And a correction after the end re-publishes the recap

  Scenario: Track replay
    Then the recap lists every revealed song in play order with its title and artist
    And, per player: points, whether the title / artist was found, find time and wrong attempts

  Scenario: Everyone receives the recap
    When the game finishes (last song or host ends it)
    Then every host and player socket receives "game:recap" after "game:finished"
    And a host attaching or a player rejoining after the end gets the recap in the snapshot/session

  Scenario: Share card
    When a player or the host taps "Share"
    Then a PNG card (game name, top 3, highlighted award) is shared through the system share sheet
    And the PNG is downloaded when the browser cannot share files
```

## Awards (superlatives)

| Kind             | Value                  | Rule                                                           |
| ---------------- | ---------------------- | -------------------------------------------------------------- |
| `fastest-finger` | average find time (ms) | lowest average; needs ≥ `min(2, songsPlayed)` found songs      |
| `sniper`         | songs found first      | highest count; ≥ 1                                             |
| `stubborn`       | wrong attempts         | highest count; ≥ 3                                             |
| `comeback-kid`   | places gained          | max over checkpoints after song k of `rank_k − finalRank`; ≥ 2 |

- At most one winner per award; a player may collect several.
- Fewer than 2 players → no awards.
- "First finder" compares find times of the song; the earliest wins.
- Ranks at a checkpoint use cumulative points of songs 1..k (same ordering as the final standings).

## Privacy

- The recap is only built after the game is finished, so every song is revealed.
- It contains **no answer text**, only per-player outcomes (points, found flags, find time, wrong
  attempt count). Never the content of another player's answers.

## Contracts (`@ubt/shared`)

```ts
type SuperlativeKindDto = 'fastest-finger' | 'sniper' | 'stubborn' | 'comeback-kid';
interface StandingDto {
  rank;
  playerId;
  playerName;
  points;
}
interface SuperlativeDto {
  kind;
  playerId;
  playerName;
  value;
}
interface PlayerSongResultDto {
  playerId;
  playerName;
  points;
  foundTitle;
  foundArtist;
  foundAtMs: number | null;
  wrongAttempts;
}
interface SongRecapDto {
  songId;
  roundNumber;
  roundName;
  number;
  title;
  artist;
  results: PlayerSongResultDto[];
}
interface GameRecapDto {
  gameName;
  standings;
  superlatives;
  songs;
}
```

- New server → client event `game:recap(recap: GameRecapDto)` to everyone, after `game:finished`.
- `GameSnapshotDto.recap` and `PlayerSessionDto.recap`: `GameRecapDto | null` (null until finished).

## Implementation plan (TDD order)

1. **Domain** `domain/game/recap.ts` (+ `Game.recap()`): pure functions, unit tests first.
2. **Contracts + mapper** `toGameRecapDto`; snapshot / session carry `recap`.
3. **Publisher**: `gameFinished` also emits `game:recap`; a correction after the end re-emits it.
4. **Integration test** in `apps/server/test/integration/gameFlow.test.ts`.
5. **Web**: reducers handle `game:recap` (pure, tested); `shareCard` model (pure, tested) + canvas
   renderer; `Recap` component used by the host and player finished screens.
