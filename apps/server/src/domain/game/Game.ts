import type { RoundPlan } from '../design/RoundPlan';
import type { Verdict } from '../music/answerMatching';
import type { Track } from '../music/Track';
import { err, ok, type Result } from '../shared/Result';
import type { Timestamp } from '../shared/Timestamp';
import type { Answer } from './Answer';
import type { GameCode } from './GameCode';
import { gameError, type GameError } from './GameErrors';
import type { Player } from './Player';
import type { PlayerName } from './PlayerName';
import { buildRecap, type GameRecap } from './recap';
import { Round } from './Round';
import type { Song, SubmitAnswerCommand } from './Song';
import {
  balancedSplit,
  generateTeamNames,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  normalizeTeamName,
  sameTeamName,
  type IntSource,
  type Team,
  type TeamScore,
} from './Team';

export type GameStatus = 'lobby' | 'playing' | 'finished';

export interface CreateGameProps {
  readonly id: string;
  readonly code: GameCode;
  readonly hostToken: string;
  readonly createdAt: Timestamp;
  readonly name: string;
  /** Copied from the design: later edits of the design do not affect a running game. */
  readonly rounds: readonly RoundPlan[];
}

export interface AddPlayerCommand {
  readonly playerId: string;
  readonly name: PlayerName;
  readonly joinedAt: Timestamp;
}

export interface StartSongCommand {
  readonly songId: string;
  readonly startedAt: Timestamp;
  readonly track: Track;
  /** Every playable track of the round's playlist: the suggestions of an easy round. */
  readonly playlistTracks?: readonly Track[];
}

export interface GameSubmitAnswerCommand extends SubmitAnswerCommand {
  /** Id of the suggestion the player picked (easy rounds); `text` is then ignored. */
  readonly suggestionId?: string | undefined;
}

export interface Score {
  readonly player: Player;
  readonly points: number;
}

/** Where a last-standing round stands, as far as revealed songs tell. */
export interface EliminationState {
  readonly roundNumber: number;
  /** Still in the running. */
  readonly remaining: readonly Player[];
  /** Out, in the order they left. */
  readonly eliminated: readonly Player[];
  /** Those who left with the song just revealed (empty while it is playing). */
  readonly leftAfterCurrentSong: readonly Player[];
}

export interface GenerateTeamsCommand {
  readonly teamCount: number;
  readonly random: IntSource;
}

/** Aggregate root of a party: every change to a running game goes through this class. */
export class Game {
  static readonly MAX_PLAYERS = 50;

  private readonly players = new Map<string, Player>();
  private readonly rounds: readonly Round[];
  private finished = false;
  private teams: readonly Team[] = [];
  private readonly teamOfPlayer = new Map<string, string>();
  private readonly kickedNames: PlayerName[] = [];

  private constructor(
    readonly id: string,
    readonly code: GameCode,
    private readonly hostToken: string,
    readonly createdAt: Timestamp,
    readonly name: string,
    plans: readonly RoundPlan[],
  ) {
    this.rounds = plans.map((plan, index) => new Round(index + 1, plan));
  }

  static create(props: CreateGameProps): Result<Game, GameError> {
    if (props.rounds.length === 0) {
      return err(gameError('EMPTY_DESIGN', 'Add at least one round before launching the game'));
    }
    return ok(
      new Game(props.id, props.code, props.hostToken, props.createdAt, props.name, props.rounds),
    );
  }

  get status(): GameStatus {
    if (this.finished) return 'finished';
    return this.currentSong ? 'playing' : 'lobby';
  }

  get currentRound(): Round | undefined {
    return this.rounds.findLast((round) => round.currentSong !== undefined);
  }

  get currentSong(): Song | undefined {
    return this.currentRound?.currentSong;
  }

  /** Round the next song will belong to; undefined once every round is complete. */
  get upcomingRound(): Round | undefined {
    if (this.finished) return undefined;
    const current = this.currentRound;
    if (!current) return this.rounds[0];
    return current.isComplete ? this.rounds[current.number] : current;
  }

  listRounds(): readonly Round[] {
    return this.rounds;
  }

  isHost(token: string): boolean {
    return token === this.hostToken;
  }

  listPlayers(): readonly Player[] {
    return [...this.players.values()];
  }

  findPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  hasPlayed(trackId: string): boolean {
    return this.rounds.some((round) => round.listSongs().some((song) => song.track.id === trackId));
  }

  addPlayer(command: AddPlayerCommand): Result<Player, GameError> {
    if (this.finished) return err(gameError('GAME_FINISHED', 'This game is over'));
    if (this.players.size >= Game.MAX_PLAYERS) {
      return err(gameError('GAME_FULL', `A game is limited to ${Game.MAX_PLAYERS} players`));
    }
    if (this.listPlayers().some((p) => p.name.sameAs(command.name))) {
      return err(gameError('PLAYER_NAME_TAKEN', `"${command.name.value}" is already taken`));
    }
    if (this.kickedNames.some((kicked) => kicked.sameAs(command.name))) {
      return err(gameError('PLAYER_KICKED', 'The host removed this player from the game'));
    }
    const player: Player = { id: command.playerId, name: command.name, joinedAt: command.joinedAt };
    this.players.set(player.id, player);
    // Teams already exist: a latecomer joins the smallest one to keep them even.
    const smallest = this.smallestTeam();
    if (smallest) this.teamOfPlayer.set(player.id, smallest.id);
    return ok(player);
  }

  /**
   * The host kicks a player, at any time before the end. Their answers disappear (so they take no
   * place from the others), they leave their team, and their name cannot be used again in this game.
   */
  removePlayer(playerId: string): Result<Player, GameError> {
    if (this.finished) return err(gameError('GAME_FINISHED', 'This game is over'));
    const player = this.players.get(playerId);
    if (!player) return err(gameError('UNKNOWN_PLAYER', 'Player is not part of this game'));
    this.players.delete(playerId);
    this.teamOfPlayer.delete(playerId);
    for (const round of this.rounds) {
      round.forget(playerId);
      for (const song of round.listSongs()) song.removeAnswersOf(playerId);
    }
    this.kickedNames.push(player.name);
    return ok(player);
  }

  // ── Teams ──────────────────────────────────────────────────────────────────

  /** True when at least one round counts for the teams. */
  get usesTeamMode(): boolean {
    return this.rounds.some((round) => round.plan.rules.teamMode);
  }

  get hasTeams(): boolean {
    return this.teams.length > 0;
  }

  listTeams(): readonly Team[] {
    return this.teams;
  }

  teamOf(playerId: string): Team | undefined {
    return this.teams.find((team) => team.id === this.teamOfPlayer.get(playerId));
  }

  membersOf(team: Team): readonly Player[] {
    return this.listPlayers().filter((player) => this.teamOfPlayer.get(player.id) === team.id);
  }

  /**
   * Shuffles every player into `teamCount` teams of (almost) equal size and names them.
   * Can be redone as often as wanted, until the first song starts.
   */
  generateTeams(command: GenerateTeamsCommand): Result<readonly Team[], GameError> {
    const { teamCount, random } = command;
    if (this.status !== 'lobby') {
      return err(gameError('TEAMS_LOCKED', 'Teams can only be generated before the first song'));
    }
    if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > MAX_TEAMS) {
      return err(gameError('INVALID_TEAM_COUNT', `Choose between 2 and ${MAX_TEAMS} teams`));
    }
    if (this.players.size < teamCount) {
      return err(
        gameError('NOT_ENOUGH_PLAYERS', `${teamCount} teams need at least ${teamCount} players`),
      );
    }
    const names = generateTeamNames(teamCount, random);
    const groups = balancedSplit([...this.players.keys()], teamCount, random);
    this.teams = names.map((name, index) => ({ id: `team-${index + 1}`, name }));
    this.teamOfPlayer.clear();
    groups.forEach((group, index) => {
      const team = this.teams[index];
      if (team) group.forEach((playerId) => this.teamOfPlayer.set(playerId, team.id));
    });
    return ok(this.teams);
  }

  /** Host override of a generated name. Lobby only; names stay distinct within the game. */
  renameTeam(command: { teamId: string; name: string }): Result<readonly Team[], GameError> {
    const locked = this.checkTeamsEditable();
    if (!locked.ok) return locked;
    const team = this.teams.find((t) => t.id === command.teamId);
    if (!team) return err(gameError('UNKNOWN_TEAM', 'No such team'));
    const name = normalizeTeamName(command.name);
    if (name === undefined) {
      return err(
        gameError(
          'INVALID_TEAM_NAME',
          `Team name must contain 1 to ${MAX_TEAM_NAME_LENGTH} characters`,
        ),
      );
    }
    if (this.teams.some((t) => t.id !== team.id && sameTeamName(t.name, name))) {
      return err(gameError('TEAM_NAME_TAKEN', `"${name}" is already used by another team`));
    }
    this.teams = this.teams.map((t) => (t.id === team.id ? { ...t, name } : t));
    return ok(this.teams);
  }

  /**
   * Host override of the draw: puts players in another team, all or none. Lobby only; no team is
   * left empty, whatever the combination of players moved.
   */
  movePlayers(command: {
    playerIds: readonly string[];
    teamId: string;
  }): Result<readonly Team[], GameError> {
    const locked = this.checkTeamsEditable();
    if (!locked.ok) return locked;
    const target = this.teams.find((t) => t.id === command.teamId);
    if (!target) return err(gameError('UNKNOWN_TEAM', 'No such team'));
    const moving = new Set(command.playerIds);
    if ([...moving].some((id) => !this.players.has(id))) {
      return err(gameError('UNKNOWN_PLAYER', 'Player is not part of this game'));
    }
    const leaving = [...moving].filter((id) => this.teamOfPlayer.get(id) !== target.id);
    for (const team of this.teams) {
      if (team.id === target.id) continue;
      const members = this.membersOf(team);
      const leavers = members.filter((player) => leaving.includes(player.id)).length;
      if (leavers > 0 && leavers >= members.length) {
        return err(gameError('TEAM_WOULD_BE_EMPTY', 'Every team needs at least one player'));
      }
    }
    for (const id of leaving) this.teamOfPlayer.set(id, target.id);
    return ok(this.teams);
  }

  private checkTeamsEditable(): Result<void, GameError> {
    if (this.status !== 'lobby') {
      return err(gameError('TEAMS_LOCKED', 'Teams can only be changed before the first song'));
    }
    return ok(undefined);
  }

  /** A game with a team-mode round cannot start before its teams are generated. */
  checkTeamsReady(): Result<void, GameError> {
    if (this.usesTeamMode && !this.hasTeams) {
      return err(gameError('TEAMS_REQUIRED', 'Generate the teams before playing a team round'));
    }
    return ok(undefined);
  }

  /**
   * Points per team, best first: the sum of what its members scored in team-mode rounds.
   * Like `scoreboard`, `revealedOnly` hides songs still running.
   */
  teamScoreboard({ revealedOnly }: { revealedOnly: boolean }): readonly TeamScore[] {
    const totals = new Map<string, number>(this.teams.map((team) => [team.id, 0]));
    for (const round of this.rounds) {
      if (!round.plan.rules.teamMode) continue;
      for (const song of round.listSongs()) {
        if (revealedOnly && !song.isRevealed) continue;
        for (const [playerId, points] of song.points()) {
          const teamId = this.teamOfPlayer.get(playerId);
          if (teamId !== undefined) totals.set(teamId, (totals.get(teamId) ?? 0) + points);
        }
      }
    }
    return this.teams
      .map((team) => ({
        team,
        members: this.membersOf(team),
        points: totals.get(team.id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points || a.team.name.localeCompare(b.team.name));
  }

  private smallestTeam(): Team | undefined {
    let smallest: Team | undefined;
    let smallestSize = Infinity;
    for (const team of this.teams) {
      const size = this.membersOf(team).length;
      if (size < smallestSize) {
        smallest = team;
        smallestSize = size;
      }
    }
    return smallest;
  }

  /** Plays the next song of the upcoming round. The current song must be revealed first. */
  startSong(command: StartSongCommand): Result<Song, GameError> {
    const blocked = this.canMoveOn();
    if (!blocked.ok) return blocked;
    const ready = this.checkTeamsReady();
    if (!ready.ok) return ready;
    const round = this.upcomingRound;
    if (!round) return err(gameError('GAME_FINISHED', 'Every round has been played'));
    round.captureSuggestions(command.playlistTracks ?? [command.track]);
    return ok(
      round.addSong(
        command.songId,
        command.startedAt,
        command.track,
        this.listPlayers().map((player) => player.id),
      ),
    );
  }

  /** Ends the party, after the current song was revealed. Can be done before the last round. */
  finish(): Result<void, GameError> {
    const blocked = this.canMoveOn();
    if (!blocked.ok) return blocked;
    this.finished = true;
    return ok(undefined);
  }

  /**
   * Ends the party right now, even while a song is being played (the host leaves, or nobody
   * has been around for hours). The open song is left unrevealed.
   */
  close(): Result<void, GameError> {
    if (this.finished) return err(gameError('GAME_FINISHED', 'This game is over'));
    this.finished = true;
    return ok(undefined);
  }

  submitAnswer({ suggestionId, ...command }: GameSubmitAnswerCommand): Result<Answer, GameError> {
    if (!this.players.has(command.playerId)) {
      return err(gameError('UNKNOWN_PLAYER', 'Player is not part of this game'));
    }
    const song = this.currentSong;
    if (!song || this.finished) {
      return err(gameError('NO_ACTIVE_SONG', 'No song is being played'));
    }
    if (this.currentRound?.canAnswer(command.playerId) === false) {
      return err(gameError('PLAYER_ELIMINATED', 'You are out of this round'));
    }
    if (suggestionId === undefined) return song.submit(command);

    const suggestion = this.currentRound?.findSuggestion(suggestionId);
    if (!suggestion) {
      return err(gameError('UNKNOWN_SUGGESTION', 'No such suggestion for the current round'));
    }
    return song.submit({ ...command, text: suggestion.label, picked: suggestion });
  }

  revealSong(at: Timestamp): Result<Song, GameError> {
    const song = this.currentSong;
    if (!song) return err(gameError('NO_ACTIVE_SONG', 'No song is being played'));
    return song.reveal(at);
  }

  /** True while a song is open and every player of the game has sent their (single) answer. */
  everyoneHasAnswered(): boolean {
    const song = this.currentSong;
    if (!song || song.isRevealed || this.finished || this.players.size === 0) return false;
    // Players already out of a last-standing round have nothing to send.
    const round = this.currentRound;
    return this.listPlayers().every(
      (player) => song.hasAnswered(player.id) || round?.canAnswer(player.id) === false,
    );
  }

  /**
   * Last-standing round being played (or about to end): who is still in, who left and who left
   * after the given song. Only revealed songs count, so nothing leaks before the reveal.
   */
  eliminationOf(round: Round | undefined = this.currentRound): EliminationState | undefined {
    if (!round?.isLastStanding) return undefined;
    const byId = (ids: readonly string[]) =>
      ids.flatMap((id) => {
        const player = this.players.get(id);
        return player ? [player] : [];
      });
    const lastSong = round.currentSong;
    return {
      roundNumber: round.number,
      remaining: byId(round.survivors()),
      eliminated: byId(round.eliminated()),
      leftAfterCurrentSong: lastSong?.isRevealed
        ? byId(round.eliminatedAfterSong(lastSong.id))
        : [],
    };
  }

  judgeAnswer(answerId: string, verdict: Verdict): Result<Answer, GameError> {
    const song = this.currentSong;
    if (!song) return err(gameError('NO_ACTIVE_SONG', 'No song is being played'));
    return song.judge(answerId, verdict);
  }

  /**
   * Total points per player, best first. Players see `revealedOnly` scores so a running
   * song does not leak who already found it.
   */
  scoreboard({ revealedOnly }: { revealedOnly: boolean }): readonly Score[] {
    const totals = new Map<string, number>([...this.players.keys()].map((id) => [id, 0]));
    for (const round of this.rounds) {
      for (const song of round.listSongs()) {
        if (revealedOnly && !song.isRevealed) continue;
        for (const [playerId, points] of song.points()) {
          if (totals.has(playerId)) totals.set(playerId, (totals.get(playerId) ?? 0) + points);
        }
      }
    }
    return this.listPlayers()
      .map((player) => ({ player, points: totals.get(player.id) ?? 0 }))
      .sort(
        (a, b) => b.points - a.points || a.player.name.value.localeCompare(b.player.name.value),
      );
  }

  /** End-of-game recap; only available once the game is finished. */
  recap(): GameRecap | undefined {
    if (!this.finished) return undefined;
    const teamScores = this.usesTeamMode ? this.teamScoreboard({ revealedOnly: false }) : [];
    return buildRecap(this.listPlayers(), this.rounds, teamScores);
  }

  /** Whether the game may leave the current song (to play another one or to finish). */
  canMoveOn(): Result<void, GameError> {
    if (this.finished) return err(gameError('GAME_FINISHED', 'This game is over'));
    if (this.currentSong && !this.currentSong.isRevealed) {
      return err(gameError('SONG_IN_PROGRESS', 'Reveal the current song first'));
    }
    return ok(undefined);
  }
}
