import type { RoundSummaryDto, TeamDto } from '@ubt/shared';

/** Mirrors the server limit (the server still validates the count). */
export const MAX_TEAMS = 4;

/** Whether at least one round of the game counts for the teams. */
export const usesTeamMode = (rounds: readonly RoundSummaryDto[]): boolean =>
  rounds.some((round) => round.rules.teamMode);

export const findTeam = (teams: readonly TeamDto[], teamId: string | null): TeamDto | undefined =>
  teams.find((team) => team.id === teamId);
