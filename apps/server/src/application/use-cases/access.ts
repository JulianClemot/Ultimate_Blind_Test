import { err, ok, type Game, type GameDesign, type Result } from '../../domain';
import { appError, gameNotFound, notHost, type UseCaseError } from '../errors';
import type { DesignAccess, HostCommand } from '../ports/in';
import type { GameDesignRepository, GameRepository } from '../ports/out';

/** Loads a design its caller is allowed to edit. */
export const loadOwnedDesign = async (
  designs: GameDesignRepository,
  { designId, editToken }: DesignAccess,
): Promise<Result<GameDesign, UseCaseError>> => {
  const design = await designs.findById(designId);
  if (!design) return err(appError('DESIGN_NOT_FOUND', 'Game design not found'));
  if (!design.canEdit(editToken)) {
    return err(appError('NOT_DESIGN_OWNER', 'You cannot edit this game design'));
  }
  return ok(design);
};

/** Loads a game on behalf of its host. */
export const loadHostedGame = async (
  games: GameRepository,
  { gameId, hostToken }: HostCommand,
): Promise<Result<Game, UseCaseError>> => {
  const game = await games.findById(gameId);
  if (!game) return err(gameNotFound());
  if (!game.isHost(hostToken)) return err(notHost());
  return ok(game);
};
